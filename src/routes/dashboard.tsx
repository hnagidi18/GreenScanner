import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  Leaf, Upload, Image as ImageIcon, Droplets, Sprout, BarChart3,
  TrendingDown, Grid3x3, ArrowLeft, Loader2, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Green-Scanner Dashboard — Analyze Aerial Image" },
      { name: "description", content: "Upload an aerial JPG of your field to detect crop, weed, and soil and get a precision spraying plan." },
    ],
  }),
  component: DashboardPage,
});

type Result = {
  cropPct: number;
  weedPct: number;
  soilPct: number;
  density: number;
  dose: number;
  saved: number;
  grid: boolean[];
  onCount: number;
  segmentedUrl: string;
};

const BASE_DOSE = 10;

function morph(mask: Uint8Array, w: number, h: number, op: "erode" | "dilate", iters = 1) {
  let src = mask;
  for (let k = 0; k < iters; k++) {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (op === "erode") {
          let v = 1;
          for (let dy = -1; dy <= 1 && v; dy++) {
            for (let dx = -1; dx <= 1 && v; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) { v = 0; break; }
              if (!src[ny * w + nx]) v = 0;
            }
          }
          dst[i] = v;
        } else {
          let v = 0;
          for (let dy = -1; dy <= 1 && !v; dy++) {
            for (let dx = -1; dx <= 1 && !v; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              if (src[ny * w + nx]) { v = 1; break; }
            }
          }
          dst[i] = v;
        }
      }
    }
    src = dst;
  }
  return src;
}

function connectedComponents(mask: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(mask.length);
  const sizes: number[] = [0];
  let next = 1;
  const stack: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;
      const id = next++;
      let size = 0;
      stack.push(i);
      labels[i] = id;
      while (stack.length) {
        const p = stack.pop()!;
        size++;
        const px = p % w, py = (p - px) / w;
        const ns = [
          py > 0 ? p - w : -1,
          py < h - 1 ? p + w : -1,
          px > 0 ? p - 1 : -1,
          px < w - 1 ? p + 1 : -1,
        ];
        for (const n of ns) {
          if (n >= 0 && mask[n] && !labels[n]) {
            labels[n] = id;
            stack.push(n);
          }
        }
      }
      sizes.push(size);
    }
  }
  return { labels, sizes };
}

/**
 * Faithful port of app.py's HSV segmentation pipeline.
 *
 * Pipeline (mirrors app.py exactly):
 *   1. Resize to 800x600.
 *   2. Convert RGB -> HSV (OpenCV convention: H in [0,179], S/V in [0,255]).
 *   3. Vegetation mask = inRange(HSV, [25,35,35], [95,255,255]).
 *   4. Morphological OPEN then CLOSE with a 5x5 kernel (we use two 3x3
 *      iterations to approximate a 5x5 structuring element).
 *   5. Connected components on the vegetation mask:
 *        - area >= areaThreshold  -> CROP (continuous healthy mass)
 *        - area <  areaThreshold  -> WEED (small / scattered patch)
 *   6. Soil = everything that is NOT vegetation.
 *   7. Render brown / green / red overlay blended at alpha = 0.4 over original.
 *   8. 8x8 spray grid: cell ON when weed coverage in cell > 2%.
 */
async function processImage(file: File): Promise<Result> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });

  // ----- Step 1: resize to 800x600 (matches app.py) -----
  const w = 800, h = 600;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
  const N = w * h;

  // ----- Step 2 & 3: RGB -> HSV and vegetation mask via HSV inRange -----
  // OpenCV HSV ranges: H in [0,179], S in [0,255], V in [0,255].
  // app.py uses lower=[25,35,35], upper=[95,255,255].
  const H_LO = 25, H_HI = 95;
  const S_LO = 35, V_LO = 35;

  // Per-pixel green-vigor score (Excess Green) — used ONLY to break ties
  // between crop/weed for borderline components, not to define vegetation.
  const exg = new Float32Array(N);
  const vegMask = new Uint8Array(N);

  for (let p = 0; p < N; p++) {
    const i = p * 4;
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];

    // RGB -> HSV (OpenCV scale)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const V = max;                                // 0..255
    const S = max === 0 ? 0 : (d * 255) / max;    // 0..255
    let Hdeg = 0;
    if (d !== 0) {
      if (max === r)      Hdeg = 60 * (((g - b) / d) % 6);
      else if (max === g) Hdeg = 60 * ((b - r) / d + 2);
      else                Hdeg = 60 * ((r - g) / d + 4);
      if (Hdeg < 0) Hdeg += 360;
    }
    const Hcv = Hdeg / 2;                         // 0..179 (OpenCV)

    exg[p] = 2 * g - r - b;

    if (Hcv >= H_LO && Hcv <= H_HI && S >= S_LO && V >= V_LO) vegMask[p] = 1;
  }

  // ----- Step 4: morphological OPEN then CLOSE -----
  // app.py uses a 5x5 kernel; we apply two 3x3 iterations to approximate it.
  let cleaned = morph(vegMask, w, h, "erode", 2);
  cleaned = morph(cleaned, w, h, "dilate", 2);   // OPEN done
  cleaned = morph(cleaned, w, h, "dilate", 2);
  cleaned = morph(cleaned, w, h, "erode", 2);    // CLOSE done

  // ----- Step 5: connected components -> crop (large) vs weed (small) -----
  // app.py uses area_threshold = 1500 at 800x600. We use the same constant
  // here since we render at the same resolution.
  const AREA_THRESHOLD = 1500;
  const { labels, sizes } = connectedComponents(cleaned, w, h);
  const NC = sizes.length;

  // 0 = soil (no component), 1 = crop, 2 = weed
  const compClass = new Uint8Array(NC);
  for (let id = 1; id < NC; id++) {
    compClass[id] = sizes[id] >= AREA_THRESHOLD ? 1 : 2;
  }

  // ----- Step 6: per-pixel class assignment + render -----
  const out = ctx.createImageData(w, h);
  const cells = Array.from({ length: 64 }, () => ({ weed: 0, total: 0 }));
  const cw = w / 8, ch = h / 8;
  let crop = 0, weed = 0, soil = 0;
  const ALPHA = 0.4; // matches app.py's cv2.addWeighted(image, 0.6, seg, 0.4)

  // Touch exg so TS doesn't drop it (kept for future component tie-breaks).
  void exg;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];

      const id = labels[p];
      const cls = id ? compClass[id] : 0; // 0 soil, 1 crop, 2 weed

      // Overlay colors match app.py: soil [139,69,19], crop [0,255,0], weed [255,0,0]
      let cr = 139, cg = 69, cb = 19;
      if (cls === 1)      { cr = 0;   cg = 255; cb = 0;   crop++; }
      else if (cls === 2) { cr = 255; cg = 0;   cb = 0;   weed++; }
      else                {                                  soil++; }

      out.data[i]     = Math.round(r * (1 - ALPHA) + cr * ALPHA);
      out.data[i + 1] = Math.round(g * (1 - ALPHA) + cg * ALPHA);
      out.data[i + 2] = Math.round(b * (1 - ALPHA) + cb * ALPHA);
      out.data[i + 3] = 255;

      const cx = Math.min(7, Math.floor(x / cw));
      const cy = Math.min(7, Math.floor(y / ch));
      const idx = cy * 8 + cx;
      cells[idx].total++;
      if (cls === 2) cells[idx].weed++;
    }
  }
  const cells = Array.from({ length: 64 }, () => ({ weed: 0, total: 0 }));
  const cw = w / 8, ch = h / 8;
  let crop = 0, weed = 0, soil = 0;
  const ALPHA = 0.55; // fixed overlay opacity, no user control needed

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
      const v = classMask[p];
      let cr = 0, cg = 0, cb = 0;
      let cls: "crop" | "weed" | "soil";
      if (v === 1) { cr = 34; cg = 197; cb = 94; crop++; cls = "crop"; }
      else if (v === 2) { cr = 239; cg = 68; cb = 68; weed++; cls = "weed"; }
      else { cr = 120; cg = 72; cb = 40; soil++; cls = "soil"; }

      out.data[i]     = Math.round(r * (1 - ALPHA) + cr * ALPHA);
      out.data[i + 1] = Math.round(g * (1 - ALPHA) + cg * ALPHA);
      out.data[i + 2] = Math.round(b * (1 - ALPHA) + cb * ALPHA);
      out.data[i + 3] = 255;

      const cx = Math.min(7, Math.floor(x / cw));
      const cy = Math.min(7, Math.floor(y / ch));
      const idx = cy * 8 + cx;
      cells[idx].total++;
      if (cls === "weed") cells[idx].weed++;
    }
  }

  ctx.putImageData(out, 0, 0);
  const segmentedUrl = c.toDataURL("image/jpeg", 0.9);
  URL.revokeObjectURL(url);

  const total = crop + weed + soil;
  const cropPct = (crop / total) * 100;
  const weedPct = (weed / total) * 100;
  const soilPct = (soil / total) * 100;
  // app.py: density = weed_pixels / total_pixels; dose scales with that.
  const density = weedPct;
  const dose = +(BASE_DOSE * (weedPct / 100)).toFixed(2);
  const saved = +(BASE_DOSE - dose).toFixed(2);

  // app.py spray grid: ON when weed coverage in cell > 2%.
  const grid = cells.map((cc) => cc.total > 0 && (cc.weed / cc.total) * 100 > 2);
  const onCount = grid.filter(Boolean).length;

  return { cropPct, weedPct, soilPct, density, dose, saved, grid, onCount, segmentedUrl };
}

function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  const runProcess = useCallback(async (f: File) => {
    const id = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const r = await processImage(f);
      if (id === runIdRef.current) setResult(r);
    } catch (e: any) {
      if (id === runIdRef.current) setError(e?.message ?? "Failed to process image.");
    } finally {
      if (id === runIdRef.current) setLoading(false);
    }
  }, []);

  const onFile = useCallback((f: File) => {
    setError(null);
    if (!/\.(jpe?g)$/i.test(f.name) && f.type !== "image/jpeg") {
      setError("Please upload a JPG/JPEG image.");
      return;
    }
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setResult(null);
    runProcess(f);
  }, [runProcess]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container-page flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="grid place-items-center h-9 w-9 rounded-xl gradient-primary text-primary-foreground shadow-soft">
              <Leaf className="h-5 w-5" />
            </span>
            Green-Scanner
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary transition">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </header>

      <section className="gradient-hero">
        <div className="container-page py-12 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary mb-4 shadow-soft">
            <Sparkles className="h-3.5 w-3.5" /> Live Analysis
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold">Analyze your aerial field image</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Upload a JPG taken from a drone or aerial camera. Green-Scanner segments crop, weed and soil, then computes weed density,
            herbicide dose and a precision 8×8 spray plan.
          </p>
        </div>
      </section>

      <main className="container-page py-10 space-y-8">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className="rounded-3xl border-2 border-dashed border-border bg-card p-8 md:p-12 text-center shadow-card"
        >
          <div className="mx-auto h-14 w-14 rounded-2xl gradient-primary text-primary-foreground grid place-items-center mb-4 shadow-soft">
            <Upload className="h-6 w-6" />
          </div>
          <h2 className="font-display text-xl font-bold">Upload aerial field image (JPG)</h2>
          <p className="text-sm text-muted-foreground mt-1">Drag & drop a .jpg file here or click below to choose.</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-full gradient-primary text-primary-foreground px-6 py-3 font-semibold shadow-soft hover:opacity-95 transition"
          >
            <ImageIcon className="h-4 w-4" /> Choose JPG file
          </button>
          {file && <p className="mt-3 text-xs text-muted-foreground">Selected: {file.name}</p>}
          {error && <p className="mt-3 text-sm text-[var(--weed)] font-semibold">{error}</p>}
        </div>

        {loading && (
          <div className="rounded-2xl bg-card border border-border p-8 flex items-center gap-3 justify-center shadow-card">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Segmenting image and computing spray plan…</span>
          </div>
        )}

        {result && originalUrl && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              <Panel label="Original image">
                <img src={originalUrl} alt="Original aerial" className="w-full h-full object-cover" />
              </Panel>
              <Panel label="Segmented output (Green=Crop · Red=Weed · Brown=Soil)">
                <img src={result.segmentedUrl} alt="Segmented" className="w-full h-full object-cover" />
              </Panel>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard label="Crop Coverage" value={`${result.cropPct.toFixed(2)}%`} color="var(--leaf)" Icon={Sprout} />
              <MetricCard label="Weed Density" value={`${result.weedPct.toFixed(2)}%`} color="var(--weed)" Icon={Leaf} />
              <MetricCard label="Soil Coverage" value={`${result.soilPct.toFixed(2)}%`} color="var(--soil)" Icon={BarChart3} />
              <MetricCard label="Required Herbicide" value={`${result.dose} L/ac`} color="var(--info)" Icon={Droplets} />
              <MetricCard label="Chemical Saved" value={`${result.saved} L/ac`} color="var(--warn)" Icon={TrendingDown} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Grid3x3 className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Precision spray grid (8×8)</h3>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {result.grid.map((on, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-lg grid place-items-center text-[10px] font-bold ${on ? "bg-[var(--weed)] text-white" : "bg-secondary text-muted-foreground"}`}
                    >
                      {on ? "ON" : "OFF"}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl gradient-primary text-primary-foreground p-6 md:p-8 shadow-card">
                <h3 className="font-display font-bold text-xl">Spray decision summary</h3>
                <p className="opacity-90 mt-2 text-sm">
                  Based on a measured weed density of {result.density.toFixed(2)}% within vegetation,
                  Green-Scanner recommends targeted spraying on {result.onCount} of 64 grid cells.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Stat label="ON cells" value={`${result.onCount} / 64`} />
                  <Stat label="Coverage saved" value={`${Math.round(((64 - result.onCount) / 64) * 100)}%`} />
                  <Stat label="Dose / acre" value={`${result.dose} L`} />
                  <Stat label="Saved / acre" value={`${result.saved} L`} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border py-8 mt-10">
        <div className="container-page text-center text-sm text-muted-foreground">
          Green-Scanner | AI for Precision Agriculture
        </div>
      </footer>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
      <div className="aspect-[4/3] bg-secondary">{children}</div>
      <div className="p-4 text-sm font-semibold text-center text-muted-foreground">{label}</div>
    </div>
  );
}

function MetricCard({ label, value, color, Icon }: { label: string; value: string; color: string; Icon: any }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <span className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${color}22`, color }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="text-xs text-muted-foreground mt-4">{label}</div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 backdrop-blur p-3">
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-display font-bold text-lg">{value}</div>
    </div>
  );
}
