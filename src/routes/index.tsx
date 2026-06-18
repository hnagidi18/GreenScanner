import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Leaf, Sprout, Droplets, Gauge, LayoutDashboard, ScanLine, Wand2,
  ShieldCheck, TrendingDown, Sparkles, ArrowRight, CircleDot,
  Image as ImageIcon, BarChart3, Grid3x3, CheckCircle2, Cpu,
  Layers, Brain, Rocket, Cloud, Smartphone, MapPin,
  Code2, Eye, Calculator, Database, LineChart, Monitor,
  FlaskConical,
} from "lucide-react";
import finding1Input from "@/assets/findings/p1_1.jpg";
import finding1Output from "@/assets/findings/p1_2.jpg";
import finding2Input from "@/assets/findings/p2_1.jpg";
import finding2Output from "@/assets/findings/p2_2.jpg";
import finding3Input from "@/assets/findings/p3_1.jpg";
import finding3Output from "@/assets/findings/p3_2.jpg";
import segmentationField from "@/assets/segmentation-field.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Green-Scanner — AI Precision Agriculture" },
      { name: "description", content: "AI-based aerial weed density estimation and precision spraying decision system." },
    ],
  }),
  component: Landing,
});

function Section({ id, eyebrow, title, sub, children }: { id?: string; eyebrow?: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pt-4 pb-10 md:pt-6 md:pb-14">
      <div className="container-page">
        <div className="max-w-2xl mb-8">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary mb-3">
              <CircleDot className="h-3 w-3" /> {eyebrow}
            </div>
          )}
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h2>
          {sub && <p className="mt-3 text-base md:text-lg text-muted-foreground">{sub}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Nav() {
  const links = [
    { id: "top", label: "Home" },
    { id: "how", label: "How it works" },
    { id: "features", label: "Features" },
    { id: "insights", label: "Insights" },
    { id: "tech", label: "Technology" },
    { id: "results", label: "Results" },
    { id: "future", label: "Future Enhancements" },
  ];
  const [active, setActive] = useState<string>("top");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    links.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="container-page flex items-center justify-between h-16">
        <a href="#top" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="grid place-items-center h-9 w-9 rounded-xl gradient-primary text-primary-foreground shadow-soft">
            <Leaf className="h-5 w-5" />
          </span>
          Green-Scanner
        </a>
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
          {links.map((l) => {
            const isActive = active === l.id;
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-secondary text-primary font-semibold shadow-soft ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {l.label}
              </a>
            );
          })}
        </nav>
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full gradient-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft hover:opacity-95 transition">
          Launch <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative gradient-hero overflow-hidden">
      <div className="container-page pt-10 pb-14 md:pt-14 md:pb-20 grid md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-7 animate-float-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary mb-6 shadow-soft">
            <Sparkles className="h-3.5 w-3.5" /> AI for Precision Agriculture
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.05] text-foreground">
            Green-Scanner
          </h1>
          <p className="mt-3 text-xl md:text-2xl font-semibold text-primary">
            AI-Based Aerial Weed Density Estimation & Precision Spraying Decision System
          </p>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl">
            An intelligent precision agriculture system that transforms aerial field images into crop, weed and soil
            insights — with optimized herbicide recommendations and spray-grid planning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#how" className="inline-flex items-center gap-2 rounded-full gradient-primary text-primary-foreground px-6 py-3 font-semibold shadow-soft hover:opacity-95 transition">
              Explore System <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#insights" className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3 font-semibold text-foreground shadow-soft hover:bg-secondary transition">
              <LayoutDashboard className="h-4 w-4" /> See Insights
            </a>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              { v: "−63%", l: "Chemical use" },
              { v: "8×8", l: "Spray grid" },
              { v: "Eco-Friendly\nFarming", l: "Protects Environment" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card border border-border p-4 shadow-card">
                <div className="text-base sm:text-lg font-display font-bold text-primary whitespace-pre-line leading-tight">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-5">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative rounded-3xl bg-card border border-border shadow-card p-5 animate-float-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--leaf)] animate-pulse-ring" />
            3-Class Segmentation
          </div>
          <div className="text-xs text-muted-foreground mt-1">Crop • Weed • Soil Classification</div>
        </div>
        <Layers className="h-5 w-5 text-primary" />
      </div>

      {/* Realistic field photo — 3-class segmentation */}
      <div className="relative rounded-2xl overflow-hidden border border-border aspect-[4/3] bg-secondary">
        <img
          src={segmentationField}
          alt="Aerial crop field showing crop, weed, and soil regions"
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full h-full object-cover block"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <LegendCard color="var(--leaf)" label="Crop" sub="Healthy Plants" />
        <LegendCard color="var(--weed)" label="Weed" sub="Unwanted Plants" />
        <LegendCard color="var(--soil)" label="Soil" sub="Bare Ground" />
      </div>

    </div>
  );
}

function LegendCard({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="text-lg font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function Problem() {
  const items = [
    { icon: Droplets, t: "Blanket spraying", d: "Herbicide is applied uniformly across whole fields — even where there are no weeds." },
    { icon: TrendingDown, t: "High chemical cost", d: "Farmers spend heavily on inputs that are largely wasted on crop and soil areas." },
    { icon: ShieldCheck, t: "Environmental harm", d: "Excess chemicals leach into soil and water, damaging ecosystems and crop health." },
    { icon: ScanLine, t: "No targeting", d: "Without spatial intelligence, sprayers can't distinguish weeds from crops in real time." },
  ];
  return (
    <Section id="problem" eyebrow="The problem" title="Spraying every inch wastes money and harms the planet" sub="Traditional weed control treats the whole field as if it were 100% weeds. It isn't.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((it) => (
          <div key={it.t} className="rounded-2xl bg-card border border-border p-6 shadow-card hover:-translate-y-1 transition">
            <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center text-[var(--warn)] mb-4">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">{it.t}</h3>
            <p className="text-sm text-muted-foreground mt-2">{it.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Solution() {
  const items = [
    { icon: ScanLine, t: "Image segmentation", d: "HSV thresholding and morphological filtering isolate vegetation from soil." },
    { icon: Gauge, t: "Weed density", d: "Connected-component analysis separates crops from weeds and quantifies coverage." },
    { icon: Wand2, t: "Chemical optimization", d: "Dose is scaled directly by weed density — only spray where it's needed." },
    { icon: Grid3x3, t: "Spray grid simulation", d: "An 8×8 ON/OFF actuator grid maps decisions back onto the field." },
  ];
  return (
    <Section id="solution" eyebrow="Our solution" title="See weeds. Spray smart. Save chemicals." sub="Green-Scanner turns a single aerial photo into a precision spraying decision in seconds.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((it) => (
          <div key={it.t} className="rounded-2xl gradient-primary text-primary-foreground p-6 shadow-soft hover:-translate-y-1 transition">
            <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center mb-4">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">{it.t}</h3>
            <p className="text-sm opacity-90 mt-2">{it.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: ImageIcon, t: "Aerial upload", d: "Drone or aerial field image" },
    { icon: ScanLine, t: "Segmentation", d: "Crop · Weed · Soil masks" },
    { icon: Gauge, t: "Density", d: "Pixel-based weed %" },
    { icon: Droplets, t: "Optimization", d: "Herbicide dose calc" },
    { icon: Grid3x3, t: "Spray grid", d: "ON / OFF cell plan" },
    { icon: LayoutDashboard, t: "Dashboard", d: "Farmer-ready report" },
  ];
  return (
    <Section id="how" eyebrow="How it works" title="From aerial pixel to spray decision">
      <div className="relative">
        <div className="hidden lg:block absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 relative">
          {steps.map((s, i) => (
            <div key={s.t} className="rounded-2xl bg-card border border-border p-5 shadow-card text-center">
              <div className="mx-auto h-12 w-12 rounded-full gradient-primary text-primary-foreground grid place-items-center mb-3 shadow-soft">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="text-xs text-muted-foreground font-semibold">Step {i + 1}</div>
              <div className="font-display font-semibold mt-1">{s.t}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Features() {
  const features = [
    { t: "Crop Region Detection", d: "Identifies healthy crop regions from aerial field images for accurate field analysis." },
    { t: "Weed Region Detection", d: "Detects weed-infested areas that require targeted herbicide application." },
    { t: "Soil Segmentation", d: "Separates bare soil regions from vegetation for improved field assessment." },
    { t: "Weed Density Percentage", d: "Calculates the percentage of weed coverage across the field using pixel analysis." },
    { t: "Herbicide Recommendation", d: "Generates optimized herbicide dosage based on measured weed density." },
    { t: "Chemical Savings Calculation", d: "Estimates the reduction in chemical usage compared to traditional blanket spraying." },
    { t: "Precision Spray Grid Simulation", d: "Creates an ON/OFF spray map for targeted weed treatment." },
    { t: "Farmer-Friendly Dashboard", d: "Displays all results in an easy-to-understand visual dashboard." },
  ];
  return (
    <Section id="features" eyebrow="Key features" title="A complete precision-spraying stack">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <div key={f.t} className="rounded-2xl bg-card border border-border p-5 shadow-card hover:border-primary/50 hover:-translate-y-1 transition">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[var(--leaf)] shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-semibold leading-snug">{f.t}</div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.d}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SegmentationShowcase() {
  return (
    <Section id="segmentation" eyebrow="Segmentation" title="From raw field to clear decisions" sub="The same field — first as a raw aerial photo, then as a pixel-perfect crop / weed / soil map.">
      <div className="grid md:grid-cols-2 gap-6">
        <SegPanel before />
        <SegPanel />
      </div>
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <Legend color="#2e7d32" label="Crop" />
        <Legend color="#e53935" label="Weed" />
        <Legend color="#8d6e63" label="Soil" />
      </div>
    </Section>
  );
}

// Shared field layout — same crop rows + weed clumps in both panels so the
// "before vs after" comparison is obvious.
const FIELD_ROWS = [0.12, 0.28, 0.44, 0.60, 0.76, 0.92];
const WEED_CLUMPS = [
  { cx: 22, cy: 18, r: 5 },
  { cx: 68, cy: 30, r: 4 },
  { cx: 40, cy: 48, r: 6 },
  { cx: 82, cy: 62, r: 4.5 },
  { cx: 16, cy: 72, r: 5 },
  { cx: 55, cy: 86, r: 4 },
];

function SegPanel({ before }: { before?: boolean }) {
  const label = before ? "Original aerial image" : "Segmented output";
  const caption = before
    ? "Raw drone capture — weeds blend into the crop rows."
    : "AI mask — every pixel classified as crop, weed or soil.";

  return (
    <div className="group rounded-3xl bg-card border border-border shadow-card overflow-hidden hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      <div className="aspect-[4/3] relative overflow-hidden">
        <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-semibold text-foreground shadow-soft">
          {before ? <ImageIcon className="h-3.5 w-3.5" /> : <ScanLine className="h-3.5 w-3.5" />}
          {before ? "Input · Aerial photo" : "Output · AI segmentation"}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
        >
          {/* Soil background */}
          <rect
            width="100"
            height="100"
            fill={before ? "#8d6e63" : "#8d6e63"}
          />

          {/* Crop rows */}
          {FIELD_ROWS.map((y, i) => (
            <rect
              key={i}
              x="2"
              y={y * 100 - 4}
              width="96"
              height="6"
              fill={before ? "#3f6b32" : "#2e7d32"}
              rx="1"
              opacity={before ? 0.92 : 1}
            />
          ))}

          {/* Subtle row texture for the input only */}
          {before &&
            FIELD_ROWS.map((y, i) =>
              Array.from({ length: 24 }).map((_, j) => (
                <circle
                  key={`${i}-${j}`}
                  cx={3 + j * 4}
                  cy={y * 100 - 1}
                  r={0.9}
                  fill="#4a8540"
                  opacity={0.7}
                />
              )),
            )}

          {/* Weed clumps */}
          {WEED_CLUMPS.map((w, i) =>
            before ? (
              // In the raw image weeds look like irregular muddy-green blobs
              <g key={i} opacity={0.92}>
                <circle cx={w.cx} cy={w.cy} r={w.r} fill="#6b8a3a" />
                <circle cx={w.cx + 1.2} cy={w.cy - 0.8} r={w.r * 0.7} fill="#7a9a45" />
                <circle cx={w.cx - 1} cy={w.cy + 1} r={w.r * 0.6} fill="#5a7a32" />
              </g>
            ) : (
              // In the output weeds are clean red regions with a bounding box
              <g key={i}>
                <circle cx={w.cx} cy={w.cy} r={w.r} fill="#e53935" />
                <rect
                  x={w.cx - w.r - 1.5}
                  y={w.cy - w.r - 1.5}
                  width={(w.r + 1.5) * 2}
                  height={(w.r + 1.5) * 2}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  strokeDasharray="1.2 0.8"
                />
              </g>
            ),
          )}

          {/* Grid overlay on output to suggest the 8x8 spray decision grid */}
          {!before && (
            <g stroke="#ffffff" strokeWidth="0.15" opacity="0.35">
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 12.5} y1="0" x2={(i + 1) * 12.5} y2="100" />
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={(i + 1) * 12.5} x2="100" y2={(i + 1) * 12.5} />
              ))}
            </g>
          )}
        </svg>

        {!before && (
          <div className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-[var(--leaf)] text-white px-3 py-1 text-xs font-semibold shadow-soft">
            <CheckCircle2 className="h-3.5 w-3.5" /> 6 weed zones detected
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border bg-card">
        <div className="font-display font-semibold text-center">{label}</div>
        <div className="text-xs text-muted-foreground text-center mt-1">{caption}</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 shadow-soft">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function Dashboard() {
  const cards = [
    {
      l: "Crop Coverage",
      d: "Percentage of healthy crop pixels detected across the field.",
      c: "var(--leaf)",
      i: Sprout,
    },
    {
      l: "Weed Density",
      d: "Share of weeds within total vegetation — the core spray driver.",
      c: "var(--weed)",
      i: Leaf,
    },
    {
      l: "Soil Coverage",
      d: "Bare-soil zones flagged to skip — no herbicide needed.",
      c: "var(--soil)",
      i: BarChart3,
    },
    {
      l: "Recommended Dose",
      d: "Herbicide volume scaled to measured weed density per acre.",
      c: "var(--info)",
      i: Droplets,
    },
    {
      l: "Chemical Saved",
      d: "Litres avoided vs. a uniform blanket-spray baseline.",
      c: "var(--warn)",
      i: TrendingDown,
    },
  ];
  return (
    <Section
      id="insights"
      eyebrow="Insights"
      title="What every scan reveals"
      sub="Upload one aerial JPG and Green-Scanner returns these adaptive insights — no manual tuning required."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div
            key={c.l}
            className="group rounded-2xl bg-card border border-border p-5 shadow-card hover:-translate-y-1 hover:border-primary/40 transition"
          >
            <div className="flex items-center justify-between">
              <span
                className="h-10 w-10 rounded-xl grid place-items-center"
                style={{ background: `${c.c}22`, color: c.c }}
              >
                <c.i className="h-5 w-5" />
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${c.c}1a`, color: c.c }}
              >
                Adaptive
              </span>
            </div>
            <div className="font-display font-semibold mt-4">{c.l}</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full gradient-primary text-primary-foreground px-6 py-3 font-semibold shadow-soft hover:opacity-95 transition"
        >
          <LayoutDashboard className="h-4 w-4" /> Try it with your image <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Section>
  );
}

function SprayGrid() {
  const on = new Set([0,1,2,3,5,8,16,17,23,25,30,33,42,43,50,51,55,58,59,12,19,38,44]);
  return (
    <Section id="spray" eyebrow="Spray planning" title="Precision spray ON/OFF grid" sub="Each cell maps to a section of the field. Sprayers fire only on weed-positive zones.">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 64 }).map((_, i) => {
              const isOn = on.has(i);
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg grid place-items-center text-[10px] font-bold ${isOn ? "bg-[var(--weed)] text-white" : "bg-secondary text-muted-foreground"}`}
                >
                  {isOn ? "ON" : "OFF"}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="font-display text-2xl font-bold">Spray only where it counts</h3>
          <p className="text-muted-foreground mt-3">
            Green-Scanner translates the segmentation mask into a discrete actuator grid that mirrors typical boom-sprayer hardware. Sections without weeds stay OFF — saving chemicals, fuel and time.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-secondary p-4">
              <div className="text-xs text-muted-foreground">ON cells</div>
              <div className="font-display text-xl font-bold">23 / 64</div>
            </div>
            <div className="rounded-xl bg-secondary p-4">
              <div className="text-xs text-muted-foreground">Coverage saved</div>
              <div className="font-display text-xl font-bold text-primary">64%</div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Tech() {
  const tech = [
    { n: "Python", d: "Core programming language used for image analysis, data processing, and recommendation generation.", i: Code2 },
    { n: "OpenCV", d: "Used for image preprocessing, vegetation detection, and crop/weed/soil segmentation.", i: Eye },
    { n: "NumPy", d: "Used for pixel-level calculations, density estimation, and numerical operations.", i: Calculator },
    { n: "Pandas", d: "Used for organizing analysis results and generating reports.", i: Database },
    { n: "Matplotlib", d: "Used for spray grid visualization and graphical outputs.", i: LineChart },
    { n: "Streamlit", d: "Used to build the interactive web-based dashboard.", i: Monitor },
    { n: "Computer Vision", d: "Used to identify crop, weed, and soil regions from aerial images.", i: ScanLine },
    { n: "AI / ML", d: "Used for intelligent weed analysis and precision agriculture decision support.", i: Brain },
  ];
  return (
    <Section id="tech" eyebrow="Technology" title="Built on a proven open-source stack">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tech.map((t) => (
          <div key={t.n} className="rounded-2xl bg-card border border-border p-5 shadow-card hover:border-primary/50 hover:-translate-y-1 transition">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-secondary grid place-items-center text-primary shrink-0">
                <t.i className="h-5 w-5" />
              </span>
              <span className="font-display font-semibold">{t.n}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{t.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FutureEnhancements() {
  const items = [
    { t: "U-Net Integration", d: "Advanced semantic segmentation for improved crop and weed classification.", i: Layers },
    { t: "DeepLabV3+ Detection", d: "More accurate weed detection using modern segmentation architectures.", i: Brain },
    { t: "Real-Time Drone Processing", d: "Direct processing of live aerial images captured by drones.", i: Rocket },
    { t: "Cloud Deployment", d: "Public URL access and cloud-based scalability.", i: Cloud },
    { t: "Mobile Application", d: "Access Green-Scanner features through Android and iOS devices.", i: Smartphone },
    { t: "GPS-Enabled Precision Spraying", d: "Location-aware spray planning for smart farming systems.", i: MapPin },
  ];
  return (
    <Section id="future" eyebrow="Roadmap" title="Future Enhancements" sub="Planned improvements for the next generation of Green-Scanner.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((it) => (
          <div key={it.t} className="rounded-2xl bg-card border border-border p-6 shadow-card hover:border-primary/50 hover:-translate-y-1 transition">
            <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center text-primary mb-4">
              <it.i className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">{it.t}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{it.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Novelty() {
  const stats = [
    { v: "88.24%", l: "F1-score (UNet + EfficientNetB0)" },
    { v: "88.20%", l: "Precision on CoFly-WeedDB" },
    { v: "56.21%", l: "Mean IoU — best of 5 backbones" },
  ];
  const parts = ["Detection", "Density", "Optimization", "Spray Grid", "Dashboard"];
  return (
    <Section id="novelty" eyebrow="Research novelty" title="Built on state-of-the-art UAV weed-detection research">
      <div className="rounded-3xl gradient-primary text-primary-foreground p-8 md:p-12 shadow-card">
        <p className="text-base md:text-lg opacity-95 max-w-3xl">
          Green-Scanner is informed by Shahi et al. (2023),{" "}
          <a
            href="https://www.mdpi.com/2504-446X/7/10/624"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/50 hover:decoration-white"
          >
            "Deep Learning-Based Weed Detection Using UAV Images: A Comparative Study"
          </a>{" "}
          (<em>Drones</em>, MDPI). The study benchmarks SegNet, UNet and DeepLabV3+ against five backbone CNNs
          (VGG16, ResNet50, DenseNet121, EfficientNetB0, MobileNetV2) on the CoFly-WeedDB UAV dataset and
          identifies <strong>UNet + EfficientNetB0</strong> as the top semantic-segmentation model for aerial weed
          detection.
        </p>
        <p className="mt-4 text-base md:text-lg opacity-95 max-w-3xl">
          Where the paper stops at <em>detection accuracy</em>, Green-Scanner pushes the pipeline further — turning
          segmentation masks into <strong>weed-density metrics, optimized herbicide doses and an actuator-level spray
          grid</strong>. That is the novelty: not just <em>where</em> the weeds are, but <em>how much</em> chemical to
          apply and <em>which sprayer cells</em> to fire.
        </p>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/10 backdrop-blur p-4">
              <div className="text-2xl font-display font-bold">{s.v}</div>
              <div className="text-xs opacity-90 mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {parts.map((p, i) => (
            <div key={p} className="flex items-center gap-3">
              <div className="rounded-full bg-white/15 backdrop-blur px-4 py-2 font-display font-semibold text-sm">
                {p}
              </div>
              {i < parts.length - 1 && <ArrowRight className="h-4 w-4 opacity-70" />}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs opacity-75">
          Reference: Shahi, T.B.; Dahal, S.; Sitaula, C.; Neupane, A.; Guo, W. <em>Deep Learning-Based Weed Detection
          Using UAV Images: A Comparative Study.</em> Drones 2023, 7(10), 624.
          https://doi.org/10.3390/drones7100624
        </p>
      </div>
    </Section>
  );
}

function Benefits() {
  const items = [
    { t: "Reduces herbicide usage", d: "Dose scales with measured weed density." },
    { t: "Lowers farming cost", d: "Less chemical, less fuel, less labor." },
    { t: "Supports precision agriculture", d: "Cell-level decisions, not field-level guesses." },
    { t: "Reduces chemical pollution", d: "Protects soil, water and pollinators." },
    { t: "Helps farmers decide", d: "Clear dashboards in plain language." },
  ];
  return (
    <Section id="benefits" eyebrow="Benefits" title="Better for the farm. Better for the planet.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((it) => (
          <div key={it.t} className="rounded-2xl bg-card border border-border p-6 shadow-card">
            <CheckCircle2 className="h-6 w-6 text-[var(--leaf)]" />
            <h3 className="mt-3 font-display font-semibold text-lg">{it.t}</h3>
            <p className="text-sm text-muted-foreground mt-2">{it.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

type Finding = {
  label: string;
  severity: "low" | "med" | "high";
  input: string;
  output: string;
  crop: string;
  weed: string;
  soil: string;
  herb: string;
  saved: string;
};

const FINDINGS: Finding[] = [
  { label: "No Weed", severity: "low", input: finding1Input, output: finding1Output,
    crop: "55.37%", weed: "0.19%", soil: "46.43%", herb: "0.02 L/ac", saved: "9.98 L/ac" },
  { label: "Low Weed", severity: "med", input: finding2Input, output: finding2Output,
    crop: "59.37%", weed: "2.97%", soil: "37.67%", herb: "0.3 L/ac", saved: "9.7 L/ac" },
  { label: "High Weed", severity: "high", input: finding3Input, output: finding3Output,
    crop: "6.95%", weed: "21.95%", soil: "71.11%", herb: "7.6 L/ac", saved: "2.4 L/ac" },
];

function SeverityPill({ level, children }: { level: "low" | "med" | "high"; children: React.ReactNode }) {
  const styles = {
    low: "bg-[var(--leaf)]/15 text-[var(--primary)] border-[var(--leaf)]/30",
    med: "bg-[var(--warn)]/15 text-[var(--warn)] border-[var(--warn)]/30",
    high: "bg-[var(--weed)]/15 text-[var(--weed)] border-[var(--weed)]/40",
  }[level];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

function FindingThumb({ src, alt, tag }: { src: string; alt: string; tag: string }) {
  return (
    <div className="relative h-20 w-28 overflow-hidden rounded-lg border border-border shadow-soft">
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
        {tag}
      </span>
    </div>
  );
}

function FinalFindings() {
  return (
    <Section
      id="results"
      eyebrow="Results"
      title="Results"
      sub="Comparison of Green-Scanner performance under different weed conditions."
    >
      {/* Desktop / tablet table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="p-4 font-display font-semibold">Test Case</th>
                <th className="p-4 font-display font-semibold">Original</th>
                <th className="p-4 font-display font-semibold">Segmented</th>
                <th className="p-4 font-display font-semibold">Crop Coverage</th>
                <th className="p-4 font-display font-semibold">Weed Density</th>
                <th className="p-4 font-display font-semibold">Soil Coverage</th>
                <th className="p-4 font-display font-semibold">Herbicide Required</th>
                <th className="p-4 font-display font-semibold">Chemical Saved</th>
              </tr>
            </thead>
            <tbody>
              {FINDINGS.map((f) => (
                <tr key={f.label} className="border-t border-border transition-colors hover:bg-secondary/40">
                  <td className="p-4 font-display font-semibold">
                    <div className="flex items-center gap-2">
                      <SeverityPill level={f.severity}>{f.label}</SeverityPill>
                    </div>
                  </td>
                  <td className="p-4"><FindingThumb src={f.input} alt={`${f.label} input`} tag="Input" /></td>
                  <td className="p-4"><FindingThumb src={f.output} alt={`${f.label} segmented`} tag="Output" /></td>
                  <td className="p-4 text-muted-foreground">{f.crop}</td>
                  <td className="p-4"><SeverityPill level={f.severity}>{f.weed}</SeverityPill></td>
                  <td className="p-4 text-muted-foreground">{f.soil}</td>
                  <td className="p-4">
                    <span className={`font-semibold ${f.severity === "high" ? "text-[var(--weed)]" : f.severity === "med" ? "text-[var(--warn)]" : "text-[var(--primary)]"}`}>
                      {f.herb}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`font-semibold ${f.severity === "high" ? "text-[var(--warn)]" : "text-[var(--primary)]"}`}>
                      {f.saved}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden grid gap-4">
        {FINDINGS.map((f) => (
          <div key={f.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <SeverityPill level={f.severity}>{f.label}</SeverityPill>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <FindingThumb src={f.input} alt={`${f.label} input`} tag="Input" />
              <FindingThumb src={f.output} alt={`${f.label} segmented`} tag="Output" />
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Crop Coverage</dt><dd className="text-right">{f.crop}</dd>
              <dt className="text-muted-foreground">Weed Density</dt><dd className="text-right"><SeverityPill level={f.severity}>{f.weed}</SeverityPill></dd>
              <dt className="text-muted-foreground">Soil Coverage</dt><dd className="text-right">{f.soil}</dd>
              <dt className="text-muted-foreground">Herbicide Required</dt>
              <dd className={`text-right font-semibold ${f.severity === "high" ? "text-[var(--weed)]" : f.severity === "med" ? "text-[var(--warn)]" : "text-[var(--primary)]"}`}>{f.herb}</dd>
              <dt className="text-muted-foreground">Chemical Saved</dt>
              <dd className={`text-right font-semibold ${f.severity === "high" ? "text-[var(--warn)]" : "text-[var(--primary)]"}`}>{f.saved}</dd>
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/50 p-6 md:p-8 shadow-card">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <FlaskConical className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-xl">Results Summary</h3>
            <p className="text-sm md:text-base text-muted-foreground mt-2 leading-relaxed">
              Results demonstrate that Green-Scanner dynamically adjusts herbicide recommendations
              based on weed density. As weed infestation increases, the required herbicide increases
              while potential chemical savings decrease, validating the effectiveness of precision
              agriculture-based decision making.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function CTA() {
  return (
    <section id="cta" className="py-12 md:py-16">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl gradient-primary text-primary-foreground p-12 md:p-16 text-center shadow-card">
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[var(--info)]/30 blur-2xl" />
          <h2 className="relative font-display text-3xl md:text-5xl font-extrabold">Smarter Farming with AI</h2>
          <p className="relative mt-4 opacity-90 max-w-xl mx-auto">
            Launch the Green-Scanner dashboard and turn your next aerial scan into a precision spray plan.
          </p>
          <Link to="/dashboard" className="relative inline-flex mt-8 items-center gap-2 rounded-full bg-background text-primary px-7 py-3 font-semibold shadow-soft hover:opacity-95 transition">
            Launch Green-Scanner Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="container-page flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-display font-semibold text-foreground">
          <Leaf className="h-4 w-4 text-primary" /> Green-Scanner
        </div>
        <div>Green-Scanner | AI for Precision Agriculture</div>
        <div>© {new Date().getFullYear()} All rights reserved.</div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Features />
      <SegmentationShowcase />
      <Dashboard />
      <SprayGrid />
      <Tech />
      <Novelty />
      <FinalFindings />
      <Benefits />
      <FutureEnhancements />
      <CTA />
      <Footer />
    </div>
  );
}
