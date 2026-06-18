import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

function otsuThreshold(values: Float32Array | number[], indices: Int32Array | null, lo: number, hi: number): number {
  const BINS = 64;
  const hist = new Int32Array(BINS);
  const step = (hi - lo) / BINS || 1;
  const len = indices ? indices.length : (values as Float32Array).length;
  for (let k = 0; k < len; k++) {
    const v = indices ? (values as Float32Array)[indices[k]] : (values as Float32Array)[k];
    let b = Math.floor((v - lo) / step);
    if (b < 0) b = 0; else if (b >= BINS) b = BINS - 1;
    hist[b]++;
  }
  let sumAll = 0;
  for (let i = 0; i < BINS; i++) sumAll += i * hist[i];
  let wB = 0, sumB = 0, maxVar = -1, bestT = 0;
  for (let t = 0; t < BINS; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = len - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; bestT = t; }
  }
  return lo + (bestT + 0.5) * step;
}

async function processImage(file: File): Promise<Result> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });

  const MAX = 640;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
  const N = w * h;

  // ---------- Step 1: Excess-Green index per pixel ----------
  // ExG = 2G - R - B is a standard vegetation index that emphasises
  // chlorophyll-rich pixels and suppresses brown soil.
  const exg = new Float32Array(N);
  let exgMin = Infinity, exgMax = -Infinity;
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    const v = 2 * g - r - b;
    exg[p] = v;
    if (v < exgMin) exgMin = v;
    if (v > exgMax) exgMax = v;
  }

  // ---------- Step 2: soil / vegetation split via Otsu ----------
  // Otsu finds the threshold that best separates the two natural classes
  // (soil vs. vegetation) in the ExG histogram — no manual tuning needed.
  let vegThr = otsuThreshold(exg, null, exgMin, exgMax);
  // Make sure ExG must actually be positive-ish to count as vegetation
  // (prevents grey/brown speckles from being labelled vegetation).
  vegThr = Math.max(vegThr, 8);

  const veg0 = new Uint8Array(N);
  let vegCount0 = 0;
  for (let p = 0; p < N; p++) {
    if (exg[p] > vegThr) { veg0[p] = 1; vegCount0++; }
  }
  // Safety: if Otsu collapsed everything to one side (no soil or no veg),
  // fall back to a relative threshold so we always have all three classes.
  if (vegCount0 / N > 0.95 || vegCount0 / N < 0.02) {
    const fallback = exgMin + (exgMax - exgMin) * 0.45;
    vegCount0 = 0;
    for (let p = 0; p < N; p++) {
      veg0[p] = exg[p] > fallback ? 1 : 0;
      if (veg0[p]) vegCount0++;
    }
  }

  // Light open: erode then dilate removes single-pixel noise but preserves rows.
  let cleaned = morph(veg0, w, h, "erode", 1);
  cleaned = morph(cleaned, w, h, "dilate", 1);

  let vegTotal = 0;
  for (let p = 0; p < N; p++) if (cleaned[p]) vegTotal++;

  // ---------- Step 3: crop vs weed split within vegetation ----------
  // Build an array of ExG values for vegetation pixels only and run Otsu
  // again. Crop tends to have a *higher* ExG (denser, healthier green);
  // weed patches are typically paler / sparser and sit below the split.
  const vegIdx = new Int32Array(vegTotal);
  let k = 0;
  for (let p = 0; p < N; p++) if (cleaned[p]) vegIdx[k++] = p;

  let vegExgMin = Infinity, vegExgMax = -Infinity;
  for (let i = 0; i < vegTotal; i++) {
    const v = exg[vegIdx[i]];
    if (v < vegExgMin) vegExgMin = v;
    if (v > vegExgMax) vegExgMax = v;
  }
  const cropThr = vegTotal > 0
    ? otsuThreshold(exg, vegIdx, vegExgMin, vegExgMax)
    : 0;

  // Per-pixel "looks like crop" cue (strong green) vs "looks like weed" (weak green).
  const cropCue = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (cleaned[p] && exg[p] >= cropThr) cropCue[p] = 1;

  // ---------- Step 4: connected components + per-component classification ----------
  const { labels, sizes } = connectedComponents(cleaned, w, h);
  const NC = sizes.length;
  const compExgSum = new Float64Array(NC);
  const compCropCue = new Int32Array(NC);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const id = labels[p];
      if (!id) continue;
      compExgSum[id] += exg[p];
      if (cropCue[p]) compCropCue[id]++;
    }
  }

  // Component-level decision:
  //   - Small isolated component  → WEED (irregular, unwanted patch)
  //   - Large + mostly strong-green pixels → CROP (healthy continuous mass)
  //   - Large but pale (low cropCue ratio) → WEED (off-color patch)
  // `smallThr` adapts to the image size so it works for any resolution.
  const smallThr = Math.max(40, Math.floor(N * 0.0015));
  // 0 = unused, 1 = crop, 2 = weed
  const compClass = new Uint8Array(NC);
  for (let id = 1; id < NC; id++) {
    const s = sizes[id];
    if (s === 0) continue;
    if (s < smallThr) { compClass[id] = 2; continue; }
    const cueRatio = compCropCue[id] / s;
    compClass[id] = cueRatio >= 0.5 ? 1 : 2;
  }

  // ---------- Step 5: per-pixel class mask ----------
  // Inside a crop component, any pixel that fails the strong-green cue is
  // treated as an inter-row weed pixel. Inside a weed component everything
  // is weed. Outside vegetation → soil.
  const classMask = new Uint8Array(N); // 0 soil, 1 crop, 2 weed
  for (let p = 0; p < N; p++) {
    if (!cleaned[p]) { classMask[p] = 0; continue; }
    const cc = compClass[labels[p]];
    if (cc === 1) {
      classMask[p] = cropCue[p] ? 1 : 2;
    } else {
      classMask[p] = 2;
    }
  }

  const countClasses = () => {
    let cc = 0, wd = 0, sl = 0;
    for (let p = 0; p < N; p++) {
      const v = classMask[p];
      if (v === 1) cc++; else if (v === 2) wd++; else sl++;
    }
    return { c: cc, wd, sl };
  };
  let cnt = countClasses();

  // ---------- Step 6: safety rails so output never collapses to one color ----------
  // 6a) If weed dominates vegetation (>65%), the largest weed component is
  //     almost certainly the main crop mass — promote it back to crop.
  if (vegTotal > 0 && cnt.wd / vegTotal > 0.65) {
    const weedIds: number[] = [];
    for (let id = 1; id < NC; id++) if (compClass[id] === 2) weedIds.push(id);
    weedIds.sort((a, b) => sizes[b] - sizes[a]);
    for (const id of weedIds) {
      if (sizes[id] < smallThr) break;
      compClass[id] = 1;
      for (let p = 0; p < N; p++) if (labels[p] === id) classMask[p] = cropCue[p] ? 1 : 2;
      cnt = countClasses();
      if (cnt.wd / vegTotal <= 0.4) break;
    }
  }

  // 6b) If virtually no weed was found but small isolated components exist,
  //     mark the smallest of them as weed so output shows all three classes.
  if (vegTotal > 0 && cnt.wd / vegTotal < 0.02) {
    const cropIds: number[] = [];
    for (let id = 1; id < NC; id++) if (compClass[id] === 1 && sizes[id] < smallThr * 4) cropIds.push(id);
    cropIds.sort((a, b) => sizes[a] - sizes[b]);
    for (const id of cropIds) {
      compClass[id] = 2;
      for (let p = 0; p < N; p++) if (labels[p] === id) classMask[p] = 2;
      cnt = countClasses();
      if (cnt.wd / vegTotal >= 0.04) break;
    }
  }

  // 6c) Hard cap: if vegetation covers >95% of the image, restore the weakest
  //     vegetation pixels back to soil so brown is always visible somewhere.
  if (vegTotal / N > 0.95) {
    const target = Math.floor(N * 0.9);
    const sorted = Array.from(exg).map((v, i) => [v, i] as [number, number]);
    sorted.sort((a, b) => a[0] - b[0]);
    let removed = 0;
    for (const [, idx] of sorted) {
      if (classMask[idx] === 0) continue;
      classMask[idx] = 0;
      removed++;
      if (vegTotal - removed <= target) break;
    }
    cnt = countClasses();
  }

  // ---------- Step 7: render overlay ----------
  const out = ctx.createImageData(w, h);
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
  const vegPixels = crop + weed;
  const density = vegPixels > 0 ? (weed / vegPixels) * 100 : 0;
  const dose = +(BASE_DOSE * (density / 100)).toFixed(2);
  const saved = +(BASE_DOSE - dose).toFixed(2);

  const grid = cells.map((cc) => cc.total > 0 && (cc.weed / cc.total) > 0.012);
  const onCount = grid.filter(Boolean).length;

  return { cropPct, weedPct, soilPct, density, dose, saved, grid, onCount, segmentedUrl };
}

function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(RECOMMENDED);
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  const runProcess = useCallback(async (f: File, s: Settings) => {
    const id = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const r = await processImage(f, s);
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
    runProcess(f, settings);
  }, [runProcess, settings]);

  // Re-run when settings change (debounced) and a file is loaded.
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => runProcess(file, settings), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, file]);

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

        {/* Tuning controls */}
        {file && (
          <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Segmentation controls</h3>
              </div>
              <button
                onClick={() => setSettings(RECOMMENDED)}
                className="inline-flex items-center gap-2 rounded-full bg-secondary hover:bg-secondary/80 px-4 py-2 text-sm font-semibold transition"
              >
                <RotateCcw className="h-4 w-4" /> Use Recommended Settings
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <SliderRow
                label="Weed Sensitivity"
                value={settings.sensitivity}
                min={0} max={100} step={1}
                onChange={(v) => setSettings((s) => ({ ...s, sensitivity: v }))}
                hint="Higher = detects more weed pixels"
              />
              <SliderRow
                label="Min Weed Patch Size"
                value={settings.minPatch}
                min={5} max={300} step={5}
                onChange={(v) => setSettings((s) => ({ ...s, minPatch: v }))}
                hint="Drops tiny red speckles"
              />
              <SliderRow
                label="Segmentation Strength"
                value={settings.strength}
                min={0} max={100} step={1}
                onChange={(v) => setSettings((s) => ({ ...s, strength: v }))}
                hint="Overlay opacity & cleanup"
              />
            </div>
          </div>
        )}

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

function SliderRow({
  label, value, min, max, step, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
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
