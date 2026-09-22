"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "warn";
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={`staff-btn staff-btn-${variant}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="staff-field">
      <span className="staff-field-label">{label}</span>
      {children}
      {hint ? <span className="staff-field-hint">{hint}</span> : null}
    </label>
  );
}

export function Banner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "ok";
}) {
  return <div className={`staff-banner staff-banner-${tone}`}>{children}</div>;
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="staff-empty">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="staff-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="staff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="staff-modal-head">
          <h2 id="staff-modal-title">{title}</h2>
          <button type="button" className="staff-icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`staff-pill staff-pill-${key}`}>{status.replaceAll("_", " ")}</span>;
}
