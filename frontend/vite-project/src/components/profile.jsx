import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Settings,
  Badge,
  CheckCircle2,
  School,
  Star,
  SlidersHorizontal,
  Pencil,
  AlertTriangle,
  User,
  LogIn,
  UserPlus,
  LogOut,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import { API_BASE } from "../config/api";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "288291673778-u7cbjjafogp1gjpionp6cscf6ct81gu8.apps.googleusercontent.com";

const c = {
  background:              "#09090b",
  surfaceContainer:        "#121215",
  surfaceContainerLow:     "#0f0f12",
  surfaceContainerLowest:  "#09090b",
  surfaceContainerHigh:    "#18181b",
  surfaceContainerHighest: "#1e1e22",
  secondaryContainer:      "#27272a",
  onSurface:               "#fafafa",
  onSurfaceVariant:        "#a1a1aa",
  outline:                 "#52525b",
  outlineVariant:          "#27272a",
  primary:                 "#a78bfa",
  onPrimary:               "#0a0012",
  secondary:               "#71717a",
  tertiary:                "#34d399",
  error:                   "#ef4444",
};

function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <div
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "999px",
          backgroundColor: checked ? c.primary : c.surfaceContainerLowest,
          border: `1px solid ${c.outlineVariant}`,
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "2px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: checked ? "#fff" : c.onSurfaceVariant,
            border: `1px solid ${c.outlineVariant}`,
            transform: checked ? "translateX(20px)" : "translateX(0)",
            transition: "transform 0.2s, background 0.2s",
          }}
        />
      </div>
    </label>
  );
}

export default function AskSangamProfile({ user, token, onLoginSuccess, onLogout }) {
  const [authMode, setAuthMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(false);
  const [theme, setTheme] = useState("Dark");

  const googleBtnRef = useRef(null);

  const credits = 86;
  const totalCredits = 120;
  const creditPct = Math.round((credits / totalCredits) * 100);

  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e) => setIsWide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Handle Google OAuth Credential callback
  const handleGoogleCredentialResponse = async (response) => {
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google authentication failed.");

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Initialize Google Sign-In SDK & Render Official Button
  useEffect(() => {
    if (token) return;

    const initGoogle = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "filled_dark",
              size: "large",
              width: "100%",
              text: "continue_with",
              shape: "pill",
            });
          }
        } catch (e) {
          console.error("Google SDK init error:", e);
        }
      }
    };

    initGoogle();
    const timer = setInterval(initGoogle, 500);
    return () => clearInterval(timer);
  }, [token]);

  const handleCustomGoogleClick = () => {
    setAuthError("");
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          console.log("Google OneTap Reason:", reason);
          if (reason === "opt_out_or_bypass_by_user" || reason === "suppressed_by_user") {
            setAuthError("Google OneTap was closed previously. Please click the official Google button above or clear browser cookies.");
          } else {
            setAuthError("Please ensure 'http://localhost:5173' is added under Authorized JavaScript Origins in your Google Cloud Console for Client ID.");
          }
        }
      });
    } else {
      setAuthError("Google Sign-In SDK loading... Please wait a second and try again.");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint = authMode === "login" ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
      const body =
        authMode === "login"
          ? { identifier: identifier.trim(), password }
          : { username: username.trim(), email: email.trim(), password, role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onLoginSuccess(data.token, data.user);
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.background,
        color: c.onSurface,
        overflowY: "auto",
        minHeight: 0,
      }}
      className="hide-scrollbar"
    >
      {/* ── Top App Bar ── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 16px",
          height: "56px",
          borderBottom: `1px solid ${c.outlineVariant}`,
          backgroundColor: c.background,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={22} style={{ color: c.primary }} />
          <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.3px" }}>
            Profile & Authentication
          </h1>
        </div>
        <button
          aria-label="Settings"
          style={{ padding: "8px", borderRadius: "50%", color: c.onSurfaceVariant, cursor: "pointer" }}
        >
          <Settings size={22} />
        </button>
      </header>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1,
          padding: "24px 16px",
          maxWidth: "800px",
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          boxSizing: "border-box",
        }}
      >
        {/* ── AUTH CARD (if not logged in) ── */}
        {!token || !user ? (
          <section
            className="card"
            style={{
              padding: "28px 24px",
              maxWidth: "460px",
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <KeyRound size={24} style={{ color: c.primary }} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
                {authMode === "login" ? "Sign In to Ask Sangam" : "Create an Account"}
              </h2>
              <p style={{ fontSize: "13px", color: c.onSurfaceVariant, marginTop: "4px" }}>
                Google OAuth 2.0 & JWT Role-Based Auth
              </p>
            </div>

            {authError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: c.error,
                  fontSize: "13px",
                  marginBottom: "16px",
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                {authError}
              </div>
            )}

            {/* ── Google Sign-In Container ── */}
            <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Official Rendered Google Button */}
              <div ref={googleBtnRef} style={{ width: "100%", minHeight: "44px", display: "flex", justifyContent: "center" }} />
              
              {/* Secondary Custom Button Trigger */}
              <button
                type="button"
                onClick={handleCustomGoogleClick}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  backgroundColor: c.surfaceContainerHigh,
                  border: `1px solid ${c.outlineVariant}`,
                  color: c.onSurface,
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background 0.15s",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google Prompt
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: c.outlineVariant }} />
              <span style={{ fontSize: "11px", color: c.onSurfaceVariant, textTransform: "uppercase" }}>or password</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: c.outlineVariant }} />
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {authMode === "login" ? (
                <div>
                  <label style={{ fontSize: "12px", color: c.onSurfaceVariant, display: "block", marginBottom: "4px" }}>
                    Username or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="alex_mercer or alex@sangam.edu.in"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: c.surfaceContainerLowest,
                      border: `1px solid ${c.outlineVariant}`,
                      color: c.onSurface,
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: "12px", color: c.onSurfaceVariant, display: "block", marginBottom: "4px" }}>
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex_mercer"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: c.surfaceContainerLowest,
                        border: `1px solid ${c.outlineVariant}`,
                        color: c.onSurface,
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: c.onSurfaceVariant, display: "block", marginBottom: "4px" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@sangam.edu.in"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: c.surfaceContainerLowest,
                        border: `1px solid ${c.outlineVariant}`,
                        color: c.onSurface,
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: c.onSurfaceVariant, display: "block", marginBottom: "4px" }}>
                      Select Role (RBAC)
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: c.surfaceContainerLowest,
                        border: `1px solid ${c.outlineVariant}`,
                        color: c.onSurface,
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: "12px", color: c.onSurfaceVariant, display: "block", marginBottom: "4px" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: c.surfaceContainerLowest,
                    border: `1px solid ${c.outlineVariant}`,
                    color: c.onSurface,
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  marginTop: "8px",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: c.primary,
                  color: c.onPrimary,
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {authLoading ? (
                  "Processing..."
                ) : authMode === "login" ? (
                  <>
                    <LogIn size={18} /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={18} /> Register
                  </>
                )}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: c.onSurfaceVariant }}>
              {authMode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("register"); setAuthError(""); }}
                    style={{ color: c.primary, fontWeight: 600, cursor: "pointer" }}
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    style={{ color: c.primary, fontWeight: 600, cursor: "pointer" }}
                  >
                    Sign in here
                  </button>
                </>
              )}
            </div>

            {/* Demo Accounts */}
            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: c.surfaceContainerLowest,
                border: `1px dashed ${c.outlineVariant}`,
                fontSize: "11px",
                color: c.onSurfaceVariant,
              }}
            >
              <span style={{ fontWeight: 600, color: c.onSurface, display: "block", marginBottom: "4px" }}>
                💡 Demo Logins:
              </span>
              • Student: <code>alex_mercer</code> / <code>StudentPass123!</code><br />
              • Admin: <code>admin</code> / <code>AdminPass123!</code><br />
              • Faculty: <code>faculty_user</code> / <code>FacultyPass123!</code>
            </div>
          </section>
        ) : (
          /* ── LOGGED IN PROFILE ── */
          <section
            style={{
              display: "grid",
              gridTemplateColumns: isWide ? "1fr 1fr" : "1fr",
              gap: "16px",
            }}
          >
            {/* Avatar & Info card */}
            <div
              className="card"
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: isWide ? "row" : "column",
                alignItems: isWide ? "flex-start" : "center",
                gap: "20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <button
                aria-label="Edit profile"
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: c.surfaceContainerLowest,
                  border: `1px solid ${c.outlineVariant}`,
                  color: c.onSurfaceVariant,
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <Pencil size={16} />
              </button>

              <div style={{ position: "relative", flexShrink: 0 }}>
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.username}
                    style={{
                      width: "88px",
                      height: "88px",
                      borderRadius: "50%",
                      border: `2px solid ${c.primary}`,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "88px",
                      height: "88px",
                      borderRadius: "50%",
                      border: `2px solid ${c.outlineVariant}`,
                      backgroundColor: c.surfaceContainerHigh,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <User size={40} style={{ color: c.onSurfaceVariant }} />
                  </div>
                )}
              </div>

              <div style={{ textAlign: isWide ? "left" : "center", flex: 1 }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                  {user.username}
                </h2>
                <p style={{ fontSize: "13px", color: c.onSurfaceVariant, marginBottom: "12px" }}>
                  {user.email}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: isWide ? "flex-start" : "center" }}>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      border: "1px solid rgba(167,139,250,0.4)",
                      backgroundColor: "rgba(167,139,250,0.1)",
                      color: c.primary,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      textTransform: "capitalize",
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={14} />
                    Role: {user.role}
                  </span>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      border: "1px solid rgba(52,211,153,0.25)",
                      backgroundColor: "rgba(52,211,153,0.08)",
                      color: c.tertiary,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    Authenticated JWT
                  </span>
                </div>
              </div>
            </div>

            {/* Stats card */}
            <div
              className="card"
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", color: c.onSurfaceVariant, display: "flex", alignItems: "center", gap: "8px" }}>
                  <School size={18} style={{ color: c.primary }} />
                  Session
                </span>
                <span style={{ fontWeight: 600, fontSize: "13px", color: c.tertiary }}>Active Session</span>
              </div>
              <div style={{ height: "1px", backgroundColor: c.outlineVariant }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", color: c.onSurfaceVariant, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Star size={18} style={{ color: c.primary }} />
                  Permissions
                </span>
                <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                  {user.role === "admin" ? "Full Admin Access" : "Standard Student Access"}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  borderRadius: "999px",
                  backgroundColor: c.surfaceContainerLowest,
                  border: `1px solid ${c.outlineVariant}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${creditPct}%`,
                    height: "100%",
                    borderRadius: "999px",
                    backgroundColor: c.primary,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* ── Preferences ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: c.onSurfaceVariant,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0 4px",
              margin: 0,
            }}
          >
            <SlidersHorizontal size={16} />
            Preferences
          </h3>

          <div style={{ backgroundColor: c.surfaceContainer, border: `1px solid ${c.outlineVariant}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: `1px solid ${c.outlineVariant}` }}>
              <div>
                <p style={{ fontWeight: 500, margin: "0 0 4px" }}>Push Notifications</p>
                <p style={{ fontSize: "12px", color: c.onSurfaceVariant, margin: 0 }}>Receive alerts for important updates and deadlines.</p>
              </div>
              <Toggle checked={pushNotifications} onChange={() => setPushNotifications((v) => !v)} />
            </div>

            <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: `1px solid ${c.outlineVariant}` }}>
              <div>
                <p style={{ fontWeight: 500, margin: "0 0 4px" }}>Email Summaries</p>
                <p style={{ fontSize: "12px", color: c.onSurfaceVariant, margin: 0 }}>Weekly digests of your academic progress and campus news.</p>
              </div>
              <Toggle checked={emailSummaries} onChange={() => setEmailSummaries((v) => !v)} />
            </div>

            <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <p style={{ fontWeight: 500, margin: "0 0 4px" }}>Theme</p>
                <p style={{ fontSize: "12px", color: c.onSurfaceVariant, margin: 0 }}>Choose your preferred visual aesthetic.</p>
              </div>
              <div style={{ display: "flex", backgroundColor: c.surfaceContainerLowest, border: `1px solid ${c.outlineVariant}`, borderRadius: "10px", padding: "4px", gap: "2px" }}>
                {["Light", "Dark", "System"].map((option) => {
                  const active = theme === option;
                  return (
                    <button
                      key={option}
                      onClick={() => setTheme(option)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "7px",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                        backgroundColor: active ? c.secondaryContainer : "transparent",
                        color: active ? c.primary : c.onSurfaceVariant,
                        border: active ? `1px solid ${c.outlineVariant}` : "1px solid transparent",
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Danger Zone / Sign Out ── */}
        {token && user && (
          <section style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "24px" }}>
            <h3
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: c.error,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0 4px",
                margin: 0,
              }}
            >
              <AlertTriangle size={16} />
              Danger Zone
            </h3>
            <div
              style={{
                backgroundColor: "rgba(59,17,17,0.15)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "14px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ fontWeight: 500, margin: "0 0 2px" }}>Logout</p>
                <p style={{ fontSize: "12px", color: c.onSurfaceVariant, margin: 0 }}>Sign out of your active session.</p>
              </div>
              <button
                onClick={onLogout}
                style={{
                  padding: "8px 20px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "1px solid rgba(239,68,68,0.5)",
                  color: c.error,
                  backgroundColor: "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
