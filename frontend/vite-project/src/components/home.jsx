import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Paperclip,
  CalendarDays,
  Library,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ClipboardCheck,
  ExternalLink,
  MessageSquarePlus,
} from "lucide-react";

import { API_BASE } from "../config/api";

const c = {
  background:              "#09090b",
  surface:                 "#0c0c0f",
  surfaceContainer:        "#121215",
  surfaceContainerLow:     "#0f0f12",
  surfaceContainerLowest:  "#09090b",
  surfaceContainerHigh:    "#18181b",
  surfaceContainerHighest: "#1e1e22",
  surfaceVariant:          "#18181b",
  onSurface:               "#fafafa",
  onSurfaceVariant:        "#a1a1aa",
  outline:                 "#52525b",
  outlineVariant:          "#27272a",
  primary:                 "#a78bfa",
  onPrimary:               "#0a0012",
  primaryContainer:        "#7c3aed",
  primaryFixedDim:         "#c4b5fd",
  secondary:               "#71717a",
  tertiary:                "#34d399",
  error:                   "#ef4444",
};

const quickActions = [
  { label: "Exam Schedule", icon: CalendarDays },
  { label: "Library Hours", icon: Library },
  { label: "Course Syllabus", icon: BookOpen },
];

const defaultInitialMessages = [
  {
    id: "welcome-1",
    role: "assistant",
    intro: "Hello! I am Ask Sangam, your AI university assistant.",
    text: "How can I help you with Sangam University programmes, admissions, exam schedules, or campus resources today?",
  },
];

const styles = {
  userBubble: {
    display: "flex",
    justifyContent: "flex-end",
  },
  userBubbleInner: {
    padding: "12px 18px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "85%",
    backgroundColor: c.surfaceContainerHighest,
    color: c.onSurface,
    border: `1px solid ${c.outlineVariant}`,
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  asstRow: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: "12px",
  },
  asstAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${c.outlineVariant}`,
    backgroundColor: c.surfaceContainer,
    flexShrink: 0,
    marginTop: "4px",
  },
  asstBubble: {
    padding: "16px 18px",
    borderRadius: "4px 18px 18px 18px",
    maxWidth: "90%",
    backgroundColor: c.surfaceContainer,
    border: `1px solid ${c.outlineVariant}`,
    color: c.onSurface,
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  },
};

function UserBubble({ text }) {
  return (
    <div style={styles.userBubble}>
      <div style={styles.userBubbleInner}>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ msg }) {
  return (
    <div style={styles.asstRow}>
      <div style={styles.asstAvatar}>
        <Sparkles size={16} style={{ color: c.primary }} />
      </div>
      <div style={styles.asstBubble}>
        {msg.intro && (
          <p style={{ margin: "0 0 10px", fontSize: "14px", lineHeight: 1.6, fontWeight: 600 }}>
            {msg.intro}
          </p>
        )}

        {(msg.text || msg.content) && (
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {msg.text || msg.content}
          </p>
        )}

        {msg.sources && msg.sources.length > 0 && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: `1px solid ${c.outlineVariant}`,
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "11px", color: c.onSurfaceVariant, fontWeight: 600 }}>Sources:</span>
            {msg.sources.map((src, i) => (
              <span
                key={i}
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: c.surfaceContainerLowest,
                  border: `1px solid ${c.outlineVariant}`,
                  color: c.primary,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ExternalLink size={10} /> {src}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={styles.asstRow}>
      <div style={styles.asstAvatar}>
        <Sparkles size={16} style={{ color: c.primary }} />
      </div>
      <div
        style={{
          ...styles.asstBubble,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "16px 18px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dot-bounce"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: c.onSurfaceVariant,
              display: "inline-block",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AskSangamChat({ token, activeSessionId, setActiveSessionId, onNewSession }) {
  const [messages, setMessages] = useState(defaultInitialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Load session messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId || !token) {
      setMessages(defaultInitialMessages);
      return;
    }

    const loadSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${activeSessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.messages) {
          if (data.messages.length === 0) {
            setMessages(defaultInitialMessages);
          } else {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        console.error("Error loading session:", err);
      }
    };
    loadSession();
  }, [activeSessionId, token]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  }, [input]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let currentSessionId = activeSessionId;

    // Auto-create session if logged in and no session exists
    if (!currentSessionId && token) {
      try {
        const createRes = await fetch(`${API_BASE}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: trimmed.slice(0, 30) }),
        });
        const createData = await createRes.json();
        if (createRes.ok && createData.session) {
          currentSessionId = createData.session.id;
          setActiveSessionId(currentSessionId);
        }
      } catch (e) {
        console.error("Session creation error:", e);
      }
    }

    const userMsg = { id: Date.now(), role: "user", text: trimmed, content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: trimmed,
          session_id: currentSessionId,
          history: messages.map((m) => ({ role: m.role, content: m.text || m.content })),
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (res.ok && data.reply) {
        const asstMsg = {
          id: Date.now() + 1,
          role: "assistant",
          text: data.reply,
          content: data.reply,
          sources: data.sources || [],
        };
        setMessages((prev) => [...prev, asstMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: data.error || "Sorry, I am currently unable to answer. Please check if the backend is running.",
          },
        ]);
      }
    } catch (err) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "Unable to connect to Ask Sangam API server. Please check the backend connection.",
        },
      ]);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (label) => {
    sendMessage(`Tell me about ${label.toLowerCase()}.`);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.background,
        color: c.onSurface,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* ── Scrollable chat area ── */}
      <div
        ref={scrollRef}
        className="scroll-area hide-scrollbar"
        style={{ flex: 1, padding: "0 16px", overflowY: "auto" }}
      >
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            paddingTop: "24px",
            paddingBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontSize: "clamp(22px, 5vw, 30px)",
                fontWeight: 700,
                letterSpacing: "-0.5px",
                color: c.onSurface,
                marginBottom: "8px",
              }}
            >
              How can I assist your studies today?
            </h2>
            <p style={{ fontSize: "14px", color: c.onSurfaceVariant }}>
              Ask me anything about academics, schedules, or campus resources.
            </p>
          </div>

          {/* Quick Action Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
            {quickActions.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleQuickAction(label)}
                style={{
                  fontSize: "13px",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: c.surfaceContainer,
                  border: `1px solid ${c.outlineVariant}`,
                  color: c.onSurface,
                  cursor: "pointer",
                }}
              >
                <Icon size={16} style={{ color: c.primary }} />
                {label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {messages.map((msg, idx) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id || idx} text={msg.text || msg.content} />
              ) : (
                <AssistantBubble key={msg.id || idx} msg={msg} />
              )
            )}
            {isTyping && <TypingBubble />}
          </div>
        </div>
      </div>

      {/* ── Input Area ── */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${c.outlineVariant}`,
          backgroundColor: c.background,
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              backgroundColor: c.surfaceContainer,
              border: `1px solid ${c.outlineVariant}`,
              borderRadius: "14px",
              padding: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <button
              onClick={onNewSession}
              title="Start New Session"
              style={{
                padding: "8px",
                borderRadius: "8px",
                color: c.onSurfaceVariant,
                flexShrink: 0,
                cursor: "pointer",
              }}
              aria-label="New Session"
            >
              <MessageSquarePlus size={20} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Ask Sangam..."
              rows={1}
              className="hide-scrollbar"
              style={{
                flex: 1,
                backgroundColor: "transparent",
                fontSize: "14px",
                padding: "8px 4px",
                color: c.onSurface,
                border: "none",
                outline: "none",
                resize: "none",
                minHeight: "40px",
                maxHeight: "128px",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Send message"
              style={{
                padding: "8px",
                borderRadius: "10px",
                backgroundColor: input.trim() ? c.primary : c.surfaceContainerHigh,
                color: input.trim() ? c.onPrimary : c.onSurfaceVariant,
                flexShrink: 0,
                cursor: input.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                outline: "none",
              }}
            >
              <Send size={18} />
            </button>
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: "10px",
              marginTop: "8px",
              color: c.onSurfaceVariant,
              letterSpacing: "0.04em",
            }}
          >
            AI can make mistakes. Verify important academic deadlines.
          </p>
        </div>
      </div>
    </div>
  );
}
