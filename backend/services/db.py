"""SQLite primary database manager for Ask Sangam (Auth, Sessions & History)."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any
from werkzeug.security import generate_password_hash

from services.config import (
    DATABASE_PATH,
    ROLE_ADMIN,
    ROLE_FACULTY,
    ROLE_STUDENT,
    VALID_ROLES,
)


def get_db_connection() -> sqlite3.Connection:
    """Return a thread-safe SQLite connection with Row factory and WAL mode."""
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Initialize database tables and seed default users if empty."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                created_at TEXT NOT NULL
            )
        """)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)

        # Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
            )
        """)
        conn.commit()

    seed_default_users()


def seed_default_users() -> None:
    """Seed initial default accounts if database has no users."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            default_accounts = [
                ("usr-admin", "admin", "admin@sangam.edu.in", generate_password_hash("AdminPass123!"), ROLE_ADMIN, now),
                ("usr-faculty", "faculty_user", "faculty@sangam.edu.in", generate_password_hash("FacultyPass123!"), ROLE_FACULTY, now),
                ("usr-student", "alex_mercer", "alex@sangam.edu.in", generate_password_hash("StudentPass123!"), ROLE_STUDENT, now),
            ]
            cursor.executemany(
                "INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                default_accounts
            )
            conn.commit()
            print(f"[Database] SQLite DB initialized at {DATABASE_PATH} with seeded demo users.")


def get_db_type() -> str:
    """Return primary database engine name."""
    return "SQLite"


# ==================== USER OPERATIONS ====================

def create_user(username: str, email: str, password_hash: str, role: str = ROLE_STUDENT) -> dict[str, Any]:
    role = role.lower()
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of {list(VALID_ROLES)}")

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    created_at = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, username, email, password_hash, role, created_at)
        )
        conn.commit()

    return {"id": user_id, "username": username, "email": email, "role": role, "created_at": created_at}


def get_user_by_email_or_username(identifier: str) -> dict[str, Any] | None:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? OR username = ?", (identifier, identifier))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, role, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# ==================== SESSION OPERATIONS ====================

def create_session(user_id: str, title: str = "New Conversation") -> dict[str, Any]:
    session_id = f"ses-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, user_id, title, now, now)
        )
        conn.commit()
    return {"id": session_id, "user_id": user_id, "title": title, "created_at": now, "updated_at": now}


def get_user_sessions(user_id: str) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_session_by_id(session_id: str, user_id: str | None = None) -> dict[str, Any] | None:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("SELECT * FROM sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        else:
            cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_session_title(session_id: str, title: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?", (title, now, session_id))
        conn.commit()


def delete_session(session_id: str, user_id: str) -> bool:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


# ==================== MESSAGE OPERATIONS ====================

def add_message(session_id: str, role: str, content: str, sources: list[str] | None = None) -> dict[str, Any]:
    msg_id = f"msg-{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()
    sources_json = json.dumps(sources or [])

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (id, session_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, session_id, role, content, sources_json, created_at)
        )
        cursor.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (created_at, session_id))
        conn.commit()

    return {
        "id": msg_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "sources": sources or [],
        "created_at": created_at
    }


def get_session_messages(session_id: str) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
        messages = []
        for row in cursor.fetchall():
            m = dict(row)
            m["sources"] = json.loads(m["sources"]) if m.get("sources") else []
            messages.append(m)
        return messages
