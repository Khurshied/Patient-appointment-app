"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, isStaff } from "./api";
import { useMe, useSettings } from "./hooks";
import { PracticeMark } from "./ui";

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, error } = useMe();
  const { settings } = useSettings();
  const practice = settings?.practiceName ?? "Practice";

  useEffect(() => {
    if (!loading && me === null) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [loading, me, pathname, router]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // still leave
    }
    router.replace("/");
    router.refresh();
  }

  const items = [
    { href: "/dashboard", label: "Home" },
    { href: "/request", label: "Request a visit" },
    { href: "/appointments", label: "My appointments" },
  ];

  return (
    <div className="pt-app pt-shell">
      <a className="pt-skip" href="#pt-main">
        Skip to content
      </a>
      <header className="pt-top">
        <div className="pt-top-inner">
          <Link href="/dashboard" className="pt-brand">
            <PracticeMark name={practice} />
            {practice}
          </Link>
          <nav className="pt-nav" aria-label="Patient">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {isStaff(me ?? null) ? <Link href="/inbox">Staff</Link> : null}
            <button type="button" className="pt-linkish" onClick={() => void logout()}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main id="pt-main" className="pt-main">
        {loading ? <p className="pt-muted">Loading your session…</p> : null}
        {error ? <p className="pt-alert pt-alert-error">{error}</p> : null}
        {!loading && me ? children : null}
      </main>
    </div>
  );
}
