"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultSettings,
  fetchAppointments,
  fetchMe,
  fetchSettings,
  isAdmin,
  isStaff,
  logout,
} from "./api";
import type { PracticeSettings, StaffUser } from "./types";
import { Button } from "./ui";

type StaffContextValue = {
  user: StaffUser;
  settings: PracticeSettings;
  refreshSettings: () => Promise<void>;
};

const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within StaffShell");
  return ctx;
}

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [settings, setSettings] = useState<PracticeSettings>(defaultSettings());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [closeOutCount, setCloseOutCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const me = await fetchMe();
      if (!isStaff(me.user)) {
        router.replace("/login");
        return;
      }
      setUser(me.user);
      try {
        setSettings(await fetchSettings());
      } catch {
        setSettings(defaultSettings());
      }
      try {
        const closeOut = await fetchAppointments({ closeOut: true });
        setCloseOutCount(closeOut.length);
      } catch {
        setCloseOutCount(0);
      }
      setReady(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await fetchSettings());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings");
    }
  }, []);

  const value = useMemo(
    () => (user ? { user, settings, refreshSettings } : null),
    [user, settings, refreshSettings],
  );

  if (!ready || !value) {
    return (
      <div className="staff-root">
        <div className="staff-main">
          <p className="staff-muted">Checking your staff session…</p>
        </div>
      </div>
    );
  }

  const admin = isAdmin(value.user);
  const showCloseOut =
    value.settings.completeMode === "required" || closeOutCount > 0;

  const links = [
    { href: "/inbox", label: "Inbox" },
    { href: "/calendar", label: "Calendar" },
    ...(showCloseOut
      ? [{ href: "/needs-close-out", label: "Needs close-out" }]
      : []),
    ...(admin ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <StaffContext.Provider value={value}>
      <div className="staff-root">
        <div className="staff-shell">
          <aside className="staff-nav">
            <div className="staff-brand">
              <small>Practice</small>
              <strong>Staff</strong>
            </div>
            <nav>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={pathname?.startsWith(link.href) ? "active" : ""}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="staff-nav-spacer" />
            <div className="staff-user">
              <strong>{value.user.displayName}</strong>
              <span>{value.user.roles.join(" · ")}</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                Sign out
              </Button>
            </div>
          </aside>
          <main className="staff-main">
            {error ? <p className="staff-banner staff-banner-error">{error}</p> : null}
            {children}
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
