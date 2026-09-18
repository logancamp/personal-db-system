import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 1 0 20Z" />
              <path d="M12 2a10 10 0 0 0 0 20" fillOpacity="0.35" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">personal server</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}
