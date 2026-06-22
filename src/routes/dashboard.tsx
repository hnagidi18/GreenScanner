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

/**
 * Send the uploaded image to the Python FastAPI U-Net backend
 * (backend/main.py). All segmentation happens server-side using the
 * trained model at backend/models/unet_crop_weed_soil.pth.
 */
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

async function processImage(file: File): Promise<Result> {
  const form = new FormData();
  form.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/predict`, { method: "POST", body: form });
  } catch {
    throw new Error(
      `Could not reach the Python backend at ${API_URL}. Start it with:\n` +
      `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`,
    );
  }

  if (!res.ok) {
    let detail = `Backend error (${res.status}).`;
    try {
      const j = await res.json();
      if (j?.detail) detail = String(j.detail);
    } catch { /* keep default */ }
    throw new Error(detail);
  }

  const j = (await res.json()) as {
    segmentedImage: string;
    cropPct: number;
    weedPct: number;
    soilPct: number;
    density: number;
    dose: number;
    saved: number;
    grid: boolean[];
    onCount: number;
  };

  return {
    cropPct: j.cropPct,
    weedPct: j.weedPct,
    soilPct: j.soilPct,
    density: j.density,
    dose: j.dose,
    saved: j.saved,
    grid: j.grid,
    onCount: j.onCount,
    segmentedUrl: j.segmentedImage,
  };
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
