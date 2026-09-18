import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const sizes: Record<ButtonSize, string> = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent-strong text-on-accent hover:opacity-90",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-raised",
    danger: "border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15",
    ghost: "text-ink-muted hover:bg-raised hover:text-ink",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function IconButton({
  className = "",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: ButtonSize }) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 ${
        size === "sm" ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
      } ${className}`}
      {...props}
    />
  );
}

const fieldSurface =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-accent disabled:opacity-50";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldSurface} ${className}`} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldSurface} resize-y leading-relaxed ${className}`} />;
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      {(title || actions) && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "border-line-strong bg-raised text-ink-muted",
    accent: "border-accent/40 bg-accent-soft text-accent-strong",
    danger: "border-danger/40 bg-danger-soft text-danger",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function UnreadBadge({
  count,
  dot = false,
  tone = "solid",
}: {
  count: number;
  dot?: boolean;
  tone?: "solid" | "inverse";
}) {
  if (count <= 0) return null;
  const label = `${count} unread`;
  const colours =
    tone === "inverse" ? "bg-on-accent text-accent-strong" : "bg-accent-strong text-on-accent";

  if (dot) {
    return <span aria-label={label} title={label} className={`h-2 w-2 rounded-full ${colours}`} />;
  }
  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] leading-[18px] font-semibold tabular-nums ${colours}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-ink-muted">{children}</p>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: ButtonSize;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-lg border border-line-strong bg-raised p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors ${
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${
              selected
                ? "bg-accent-strong text-on-accent"
                : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-accent-strong" : "bg-line-strong"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-canvas shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-ink">{label}</span>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
        checked
          ? "border-accent-strong bg-accent-strong text-on-accent"
          : "border-line-strong bg-surface hover:border-accent"
      } ${className}`}
    >
      {checked && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} className="h-3 w-3" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
