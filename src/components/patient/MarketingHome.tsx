"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMe, type Me } from "./api";
import { useSettings } from "./hooks";
import { PracticeMark } from "./ui";

export function MarketingHome() {
  const { settings } = useSettings();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const practice = settings?.practiceName ?? "Your dentist";

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const ctaHref = me ? "/dashboard" : "/login";
  const ctaLabel = me ? "Go to your visits" : "Sign in";

  return (
    <div className="pt-market">
      <header className="pt-top">
        <div className="pt-top-inner">
          <span className="pt-brand">
            <PracticeMark name={practice} />
            {practice}
          </span>
          <nav className="pt-nav" aria-label="Account">
            <Link href={ctaHref}>{ctaLabel}</Link>
            {!me ? <Link href="/register">Register</Link> : null}
          </nav>
        </div>
      </header>
      <section className="pt-hero">
        <div>
          <p className="pt-kicker">In-person visits</p>
          <h1 className="pt-h1">Request a time that works. The practice confirms it.</h1>
          <p className="pt-lede">
            Register with email or mobile, choose a visit type, and pick from open slots. No phone tag for a first
            request — the dentist still approves every appointment.
          </p>
          <div className="pt-row">
            <Link className="pt-btn pt-btn-primary" href={me ? "/request" : "/register"}>
              {me ? "Request a visit" : "Create an account"}
            </Link>
            <Link className="pt-btn pt-btn-ghost" href={ctaHref}>
              {ctaLabel}
            </Link>
          </div>
        </div>
        <aside className="pt-hero-card">
          <p className="pt-kicker">How it works</p>
          <ol className="pt-stack" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Register with email or phone.</li>
            <li>Choose a visit type and any required details.</li>
            <li>Pick a generated slot — you never type a free-form time.</li>
            <li>Wait for confirmation. Reminders follow once it is on the calendar.</li>
          </ol>
        </aside>
      </section>
      <p className="pt-footer-note">Booking and reminders only. Clinical records are not stored here.</p>
    </div>
  );
}
