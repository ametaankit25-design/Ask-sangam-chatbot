import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Search, User, MessageSquarePlus, Trash2, Clock, Lock } from "lucide-react";
import { API_BASE } from "../config/api";

const c = {
  background: "#09090b",
  surfaceContainer: "#121215",
  surfaceContainerHigh: "#18181b",
  onSurface: "#fafafa",
  onSurfaceVariant: "#a1a1aa",
  outlineVariant: "#27272a",
  primary: "#a78bfa",
  secondary: "#71717a",
  error: "#ef4444",
};

export default function AskSangamHistory({ token, onSelectSession, onNewSession, activeSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSessions = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sessions.");
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.error("Delete session failed:", err);
    }
  };

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

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
            Conversation History
          </h1>
        </div>
        <button
          onClick={onNewSession}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            backgroundColor: c.primary,
            color: "#0a0012",
            fontWeight: 600,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <MessageSquarePlus size={16} /> New Chat
        </button>
      </header>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
          maxWidth: "720px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {!token ? (
          <div
            className="card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Lock size={36} style={{ color: c.primary }} />
            <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Sign In Required</h3>
            <p style={{ fontSize: "14px", color: c.onSurfaceVariant, maxWidth: "340px" }}>
              Please sign in on the Profile tab to view and save your backend conversation history.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.5px" }}>
                Saved Sessions
              </h2>
              <span style={{ fontSize: "12px", color: c.onSurfaceVariant }}>
                {sessions.length} {sessions.length === 1 ? "session" : "sessions"} stored
              </span>
            </div>

            {/* Search Bar */}
            <div style={{ position: "relative", marginBottom: "24px" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: c.onSurfaceVariant,
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search past conversations..."
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  padding: "12px 14px 12px 42px",
                  border: `1px solid ${c.outlineVariant}`,
                  backgroundColor: c.surfaceContainer,
                  color: c.onSurface,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {loading ? (
              <p style={{ textAlign: "center", padding: "40px 0", color: c.onSurfaceVariant }}>Loading history...</p>
            ) : error ? (
              <p style={{ textAlign: "center", padding: "20px", color: c.error }}>{error}</p>
            ) : filteredSessions.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: "40px 24px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <Clock size={32} style={{ color: c.onSurfaceVariant }} />
                <p style={{ fontSize: "14px", color: c.onSurfaceVariant }}>
                  {query ? `No conversations match "${query}".` : "No saved sessions yet. Start a new conversation!"}
                </p>
                <button
                  onClick={onNewSession}
                  style={{
                    marginTop: "8px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: c.surfaceContainerHigh,
                    border: `1px solid ${c.outlineVariant}`,
                    color: c.primary,
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Start New Session
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        borderRadius: "12px",
                        border: `1px solid ${isActive ? c.primary : c.outlineVariant}`,
                        backgroundColor: isActive ? "rgba(167,139,250,0.08)" : c.surfaceContainer,
                        cursor: "pointer",
                        transition: "border 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                        <h3
                          className="truncate"
                          style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: isActive ? c.primary : c.onSurface,
                            margin: "0 0 4px",
                          }}
                        >
                          {session.title}
                        </h3>
                        <p style={{ fontSize: "12px", color: c.onSurfaceVariant, margin: 0 }}>
                          Updated: {new Date(session.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        aria-label="Delete session"
                        style={{
                          padding: "8px",
                          borderRadius: "8px",
                          color: c.onSurfaceVariant,
                          cursor: "pointer",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = c.error)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = c.onSurfaceVariant)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
