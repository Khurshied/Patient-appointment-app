"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  extractDevCode,
  fetchMe,
  postLoginPath,
  type AuthKind,
} from "./api";
import { errorMessage } from "./api";
import { identifierKind, looksLikeIdentifier } from "./format";
import { useSettings } from "./hooks";
import { Alert, Button, Field, PracticeMark } from "./ui";

type Method = "otp" | "password";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { settings, error: settingsError, loading: settingsLoading } = useSettings();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOn = settings?.auth.password ?? false;
  const otpOn = settings?.auth.otp ?? true;
  const [method, setMethod] = useState<Method>("otp");
  const activeMethod: Method = !passwordOn ? "otp" : !otpOn ? "password" : method;

  useEffect(() => {
    if (!passwordOn) setMethod("otp");
    else if (!otpOn) setMethod("password");
  }, [passwordOn, otpOn]);

  const kind: AuthKind = identifierKind(identifier);

  const title = mode === "login" ? "Sign in" : "Create your account";
  const lede =
    mode === "login"
      ? "Use the email or mobile number you registered with."
      : "Register with an email address or mobile number. The practice will use this to confirm visits and send reminders.";

  async function afterAuth() {
    const me = await fetchMe();
    router.replace(postLoginPath(me));
    router.refresh();
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeIdentifier(identifier)) {
      setError("Enter a valid email or mobile number.");
      return;
    }
    if (passwordOn && password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = { identifier: identifier.trim(), kind };
      if (passwordOn && password) body.password = password;
      const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
      const maybe = extractDevCode(data);
      if (maybe) setDevCode(maybe);
      if (otpOn) {
        try {
          const otp = await api("/api/auth/otp/request", {
            method: "POST",
            body: JSON.stringify({ identifier: identifier.trim() }),
          });
          const codeFromOtp = extractDevCode(otp);
          if (codeFromOtp) setDevCode(codeFromOtp);
          setOtpSent(true);
        } catch {
          await afterAuth();
        }
      } else {
        await afterAuth();
      }
    } catch (err) {
      setError(errorMessage(err, "Could not create your account."));
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      await afterAuth();
    } catch (err) {
      setError(errorMessage(err, "Could not sign in with that password."));
    } finally {
      setBusy(false);
    }
  }

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeIdentifier(identifier)) {
      setError("Enter a valid email or mobile number.");
      return;
    }
    setBusy(true);
    try {
      const data = await api("/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      setDevCode(extractDevCode(data));
      setOtpSent(true);
    } catch (err) {
      setError(errorMessage(err, "Could not send a sign-in code."));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      await afterAuth();
    } catch (err) {
      setError(errorMessage(err, "That code did not work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const practice = settings?.practiceName ?? "the practice";
  const showMethodTabs = passwordOn && otpOn && mode === "login";

  const form = useMemo(() => {
    if (mode === "register") {
      if (otpSent) {
        return (
          <form className="pt-stack" onSubmit={onVerifyOtp}>
            <p className="pt-muted">We sent a one-time code to {identifier.trim()}.</p>
            {devCode ? (
              <Alert tone="info">
                Development code (QA)
                <div className="pt-devcode">{devCode}</div>
              </Alert>
            ) : null}
            <Field label="One-time code" htmlFor="otp">
              <input
                id="otp"
                className="pt-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and continue"}
            </Button>
          </form>
        );
      }
      return (
        <form className="pt-stack" onSubmit={onRegister}>
          <Field
            label="Email or mobile number"
            htmlFor="identifier"
            hint={kind === "email" ? "We’ll treat this as an email address." : "We’ll treat this as a mobile number."}
          >
            <input
              id="identifier"
              className="pt-input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          {passwordOn ? (
            <Field label="Password" htmlFor="password" hint="At least 8 characters. Shown because this practice allows password sign-in.">
              <input
                id="password"
                className="pt-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
          ) : null}
          <Button type="submit" disabled={busy || settingsLoading}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>
      );
    }

    if (activeMethod === "password") {
      return (
        <form className="pt-stack" onSubmit={onPasswordLogin}>
          <Field label="Email or mobile number" htmlFor="identifier">
            <input
              id="identifier"
              className="pt-input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              className="pt-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      );
    }

    if (otpSent) {
      return (
        <form className="pt-stack" onSubmit={onVerifyOtp}>
          <p className="pt-muted">Enter the code sent to {identifier.trim()}.</p>
          {devCode ? (
            <Alert tone="info">
              Development code (QA)
              <div className="pt-devcode">{devCode}</div>
            </Alert>
          ) : null}
          <Field label="One-time code" htmlFor="otp">
            <input
              id="otp"
              className="pt-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </Field>
          <div className="pt-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify code"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOtpSent(false);
                setCode("");
              }}
            >
              Use a different identifier
            </Button>
          </div>
        </form>
      );
    }

    return (
      <form className="pt-stack" onSubmit={onRequestOtp}>
        <Field label="Email or mobile number" htmlFor="identifier">
          <input
            id="identifier"
            className="pt-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy || settingsLoading}>
          {busy ? "Sending code…" : "Send sign-in code"}
        </Button>
      </form>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    otpSent,
    identifier,
    password,
    code,
    busy,
    settingsLoading,
    passwordOn,
    activeMethod,
    kind,
    devCode,
  ]);

  return (
    <div className="pt-auth" style={{ minHeight: "100vh" }}>
      <div className="pt-main" style={{ maxWidth: 480 }}>
        <Link href="/" className="pt-brand" style={{ color: "inherit", marginBottom: 24, display: "inline-flex" }}>
          <PracticeMark name={practice} />
          {practice}
        </Link>
        <h1 className="pt-h1">{title}</h1>
        <p className="pt-lede">{lede}</p>
        <div className="pt-card pt-stack">
          {settingsError ? <Alert>{settingsError}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}
          {showMethodTabs ? (
            <div className="pt-tabs" role="tablist" aria-label="Sign-in method">
              <Button
                variant={activeMethod === "otp" ? "primary" : "ghost"}
                aria-selected={activeMethod === "otp"}
                onClick={() => {
                  setMethod("otp");
                  setError(null);
                }}
              >
                One-time code
              </Button>
              <Button
                variant={activeMethod === "password" ? "primary" : "ghost"}
                aria-selected={activeMethod === "password"}
                onClick={() => {
                  setMethod("password");
                  setError(null);
                }}
              >
                Password
              </Button>
            </div>
          ) : null}
          {form}
        </div>
        <p className="pt-lede" style={{ marginTop: 20 }}>
          {mode === "login" ? (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already registered? <Link href="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
