/**
 * @aiims/ui-web — design-system components (FEDR-0004) over the shared token
 * layer. Calm clinical aesthetic; accessibility is a component requirement
 * (labelled fields, visible focus, status = colour + text, WCAG 2.1 AA).
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* --------------------------------- Button ------------------------------- */

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-4 py-1.5 text-sm", md: "px-5 py-2.5 text-sm" };
  const variants = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    secondary:
      "bg-transparent text-slate-800 border border-slate-300 hover:border-teal-700 hover:text-teal-800",
    ghost: "bg-transparent text-teal-800 hover:bg-teal-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

/* --------------------------------- Inputs ------------------------------- */

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-0";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

export function TextInput({ className, ...props }: TextInputProps) {
  return <input className={cx(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, "appearance-none pr-9", className)} {...props} />;
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/* ---------------------------------- Card -------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("card", className)}>{children}</div>;
}

/* --------------------------------- Tabs ---------------------------------- */

export interface TabItem {
  key: string;
  label: string;
  /** Small count badge, e.g. the number of records in this tab. Omit for none. */
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx("flex gap-1 overflow-x-auto border-b border-slate-200 px-1", className)}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={cx(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium tracking-wide transition-colors",
              isActive
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span
                className={cx(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  isActive ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ EmptyState ------------------------------- */

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}

/* --------------------------------- Badge -------------------------------- */

type Tone = "teal" | "slate" | "amber" | "green" | "sky";
const toneClass: Record<Tone, string> = {
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ring-1 ring-inset",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Avatar -------------------------------- */

// Shade variety within the one brand hue (not a rainbow of colors) — calmer,
// on-label, still enough to tell people apart at a glance in a dense list.
const AVATAR_TONES = [
  "bg-teal-100 text-teal-800",
  "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/15",
  "bg-slate-100 text-slate-700",
  "bg-stone-100 text-stone-700",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tone =
    AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" };
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex items-center justify-center rounded-full font-semibold",
        sizes[size],
        tone,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/* --------------------------------- IDCard -------------------------------- */
// A hospital-issued identification card (staff badge or patient card),
// styled after a real ID: photo, registration/MRN, a barcode + verification
// swatch, and a punch-hole — so the identity on screen reads as issued and
// verified, not a placeholder row of text.

/** Small deterministic PRNG seeded from a string — same id always renders
 *  the same "barcode", so it looks authentic rather than random noise. */
function seededRand(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  h = h || 1;
  return () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return (h >>> 8) / 0xffffff;
  };
}

function IDBarcode({
  seed,
  width = 176,
  height = 30,
}: {
  seed: string;
  width?: number;
  height?: number;
}) {
  const rand = seededRand(seed);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < width - 3) {
    const w = 1 + Math.floor(rand() * 3);
    bars.push({ x, w });
    x += w + 1 + Math.floor(rand() * 2);
  }
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="text-slate-700"
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Decorative QR-style swatch with real finder-pattern corners — a visual
 *  cue of "digitally verifiable", not a scannable code. */
function IDQrSwatch({
  seed,
  size = 40,
  cells = 9,
}: {
  seed: string;
  size?: number;
  cells?: number;
}) {
  const rand = seededRand(seed + ":qr");
  const cell = size / cells;

  // A finder square is a ring (outer 3px border) with a solid centre — the
  // instantly-recognisable corner marker on any real QR code.
  const finderAt = (r: number, c: number, top: boolean, left: boolean): boolean | null => {
    const rr = top ? r : cells - 1 - r;
    const cc = left ? c : cells - 1 - c;
    if (rr > 4 || cc > 4) return null; // outside this 5x5 finder block
    const onRing = rr === 0 || rr === 4 || cc === 0 || cc === 4;
    const onCore = rr >= 2 && rr <= 2 && cc >= 2 && cc <= 2;
    return onRing || onCore;
  };

  const filled: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const tl = finderAt(r, c, true, true);
      if (tl !== null) return tl;
      const tr = finderAt(r, c, true, false);
      if (tr !== null) return tr;
      const bl = finderAt(r, c, false, true);
      if (bl !== null) return bl;
      return rand() > 0.55;
    }),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="shrink-0 text-slate-800"
    >
      <rect width={size} height={size} rx={4} fill="white" />
      {filled.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function IDMetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className={cx("truncate text-[13px] font-medium text-slate-800", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  );
}

export interface IDCardProps {
  /** "staff" (doctor/admin/etc.) or "patient" — sets the accent + label. */
  kind: "staff" | "patient";
  name: string;
  /** e.g. "REG. NO." or "MRN". */
  idLabel: string;
  idValue: string;
  /** e.g. "Consultant — Cardiology" or "Female · 36 yrs". */
  subtitle?: string;
  meta?: { label: string; value: string }[];
  statusLabel?: string;
  hospitalName?: string;
  facility?: string;
  issuedValue?: string;
  className?: string;
}

/** Full-size printable-looking ID card — doctor badge or patient card. */
export function IDCard({
  kind,
  name,
  idLabel,
  idValue,
  subtitle,
  meta = [],
  statusLabel = "Active",
  hospitalName = "AIIMS+",
  facility,
  issuedValue,
  className,
}: IDCardProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // A flat brand-tone block, not a gradient — reads like a product-box color
  // chip. Staff and patient keep their existing, distinct flat tones.
  const accent = kind === "staff" ? "bg-teal-800" : "bg-sky-800";
  const photoTone = kind === "staff" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800";

  return (
    <div
      className={cx(
        "relative mx-auto w-full max-w-[368px] overflow-hidden rounded-[24px] border border-slate-200 bg-white",
        className,
      )}
    >
      {/* lanyard punch-hole */}
      <div
        aria-hidden
        className="absolute left-1/2 top-2 h-3 w-11 -translate-x-1/2 rounded-full bg-slate-900/10"
      />

      {/* header strip */}
      <div className={cx("relative px-5 pb-5 pt-6 text-white", accent)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z" />
            </svg>
            <span className="font-display text-base tracking-tight">{hospitalName}</span>
          </div>
          <span className="rounded-full border border-white/40 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]">
            {statusLabel}
          </span>
        </div>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/80">
          {kind === "staff" ? "Staff Identification Card" : "Patient Identification Card"}
        </p>
      </div>

      {/* photo + name */}
      <div className="relative flex items-end gap-3 px-5">
        <div className="relative -mt-9 shrink-0">
          <div
            className={cx(
              "grid h-[72px] w-[72px] place-items-center rounded-full text-xl font-medium ring-[3px] ring-white",
              photoTone,
            )}
          >
            {initials || "?"}
          </div>
          <span
            aria-label="Verified"
            className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-teal-700 ring-2 ring-white"
          >
            <svg
              width={11}
              height={11}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>
        <div className="min-w-0 flex-1 pb-2 pt-3">
          <p className="font-display truncate text-lg leading-tight text-slate-900">{name}</p>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      {/* identifiers */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 px-5 pb-4 pt-4">
        <IDMetaCell label={idLabel} value={idValue} mono />
        {facility ? <IDMetaCell label="Facility" value={facility} /> : null}
        {meta.map((m) => (
          <IDMetaCell key={m.label} label={m.label} value={m.value} />
        ))}
        {issuedValue ? <IDMetaCell label="Issued" value={issuedValue} /> : null}
      </dl>

      {/* barcode footer */}
      <div className="flex items-end justify-between gap-3 border-t border-dashed border-slate-200 px-5 py-3.5">
        <div>
          <IDBarcode seed={idValue} />
          <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-slate-500">{idValue}</p>
        </div>
        <IDQrSwatch seed={idValue} />
      </div>
    </div>
  );
}

/** Compact horizontal strip for a top bar — the same verified identity, at a
 *  glance, without taking up the vertical room the full card needs. */
export function IDBadgeStrip({
  kind,
  name,
  idLabel,
  idValue,
  subtitle,
  className,
}: Pick<IDCardProps, "kind" | "name" | "subtitle" | "className"> & {
  idLabel?: string;
  idValue?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const photoTone = kind === "staff" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800";
  return (
    <div
      className={cx(
        "flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/85 py-1.5 pl-1.5 pr-3 backdrop-blur",
        className,
      )}
    >
      <span className="relative shrink-0">
        <span
          className={cx(
            "grid h-9 w-9 place-items-center rounded-full text-xs font-medium",
            photoTone,
          )}
        >
          {initials || "?"}
        </span>
        <span
          aria-label="Verified"
          className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-teal-700 ring-2 ring-white"
        >
          <svg
            width={8}
            height={8}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
      {idLabel && idValue ? (
        <div className="hidden shrink-0 border-l border-slate-200 pl-2.5 sm:block">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {idLabel}
          </p>
          <p className="font-mono text-[11px] text-slate-700">{idValue}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- DataTable ------------------------------ */

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="px-4 py-16 text-center text-slate-500">{empty ?? "No records"}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cx("px-4 py-3 font-semibold", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
            >
              {columns.map((c) => (
                <td key={c.header} className={cx("px-4 py-3 align-middle", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
