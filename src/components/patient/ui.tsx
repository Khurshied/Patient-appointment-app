"use client";

export function Alert({
  children,
  tone = "error",
  id,
}: {
  children: React.ReactNode;
  tone?: "error" | "ok" | "info";
  id?: string;
}) {
  if (!children) return null;
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`pt-alert pt-alert-${tone}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <button type={type} className={`pt-btn pt-btn-${variant}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="pt-label" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {hint ? <span className="pt-hint">{hint}</span> : null}
    </label>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = status.replace(/ /g, "_");
  return <span className={`pt-badge pt-badge-${cls}`}>{label ?? status.replace(/_/g, " ")}</span>;
}

export function PracticeMark({ name }: { name: string }) {
  const letter = (name.trim()[0] || "P").toUpperCase();
  return (
    <span className="pt-mark" aria-hidden="true">
      {letter}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="pt-empty pt-card">
      <p className="pt-h1" style={{ fontSize: "1.25rem" }}>
        {title}
      </p>
      <div className="pt-lede" style={{ margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}
