"""Flask application for the Ask Sangam API with JWT Auth, Google OAuth, SQLite & Session History."""

import os
import re
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from services.auth import (
    generate_token,
    hash_password,
    roles_required,
    token_required,
    verify_google_token,
    verify_password,
)
from services.db import (
    add_message,
    create_session,
    create_user,
    delete_session,
    get_db_type,
    get_session_by_id,
    get_session_messages,
    get_user_by_email_or_username,
    get_user_sessions,
    init_db,
    update_session_title,
)
from services.rag_pipeline import RagPipeline
from services.web_loader import PublicWebsiteLoader


def create_app() -> Flask:
    """Create and configure the Flask application."""
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY", "change-me-in-production"),
        JSON_SORT_KEYS=False,
    )

    allowed_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    CORS(app, resources={r"/api/*": {"origins": allowed_origins, "allow_headers": ["Content-Type", "Authorization"]}})

    # Initialize SQLite database (with automatic schema/indexes and default demo users)
    init_db()

    rag = RagPipeline(app.root_path)

    @app.get("/")
    def index():
        """Describe the running API for users who open its base URL."""
        return jsonify(
            service="ask-sangam-api",
            status="ok",
            database=get_db_type(),
            endpoints={
                "health": "/api/health",
                "login": "/api/auth/login",
                "register": "/api/auth/register",
                "google_auth": "/api/auth/google",
                "me": "/api/auth/me",
                "sessions": "/api/sessions",
                "chat": "/api/chat",
                "crawl_website": "/api/sources/crawl (admin)",
                "reindex_local_files": "/api/documents/reindex (admin)",
            },
            frontend="http://localhost:5173",
        )

    @app.get("/api/health")
    def health_check():
        """Return service health status."""
        return jsonify(status="ok", service="ask-sangam-api", database=get_db_type())

    # ==================== AUTHENTICATION ENDPOINTS ====================

    @app.post("/api/auth/register")
    def register():
        """Register a new user (default role: student)."""
        payload = request.get_json(silent=True) or {}
        username = payload.get("username", "").strip()
        email = payload.get("email", "").strip().lower()
        password = payload.get("password", "").strip()
        role = payload.get("role", "student").strip().lower()

        if not username or not email or not password:
            return jsonify(error="Username, email, and password are required."), 400

        if get_user_by_email_or_username(email) or get_user_by_email_or_username(username):
            return jsonify(error="User with this username or email already exists."), 409

        try:
            user = create_user(username, email, hash_password(password), role)
            token = generate_token(user["id"], user["role"])
            return jsonify(token=token, user=user), 201
        except ValueError as err:
            return jsonify(error=str(err)), 400

    @app.post("/api/auth/login")
    def login():
        """Authenticate user and return a JWT access token."""
        payload = request.get_json(silent=True) or {}
        identifier = payload.get("identifier", "").strip() or payload.get("email", "").strip()
        password = payload.get("password", "").strip()

        if not identifier or not password:
            return jsonify(error="Identifier (email or username) and password are required."), 400

        user = get_user_by_email_or_username(identifier)
        if not user or not verify_password(user["password_hash"], password):
            return jsonify(error="Invalid credentials."), 401

        token = generate_token(user["id"], user["role"])
        user_info = {"id": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]}
        return jsonify(token=token, user=user_info)

    @app.post("/api/auth/google")
    def google_auth():
        """Authenticate or register user using Google OAuth 2.0 Credential Token."""
        payload = request.get_json(silent=True) or {}
        credential = payload.get("credential", "").strip() or payload.get("id_token", "").strip()

        if not credential:
            return jsonify(error="'credential' or 'id_token' is required."), 400

        google_user = verify_google_token(credential)
        if not google_user or not google_user.get("email"):
            return jsonify(error="Google authentication failed or token is invalid."), 401

        email = google_user["email"]
        user = get_user_by_email_or_username(email)

        if not user:
            # Generate a clean username from Google name or email prefix
            base_name = google_user.get("name") or email.split("@")[0]
            clean_username = re.sub(r"[^a-zA-Z0-9_]", "_", base_name).lower().strip("_")
            if not clean_username:
                clean_username = f"user_{email.split('@')[0]}"

            # Ensure unique username
            count = 1
            final_username = clean_username
            while get_user_by_email_or_username(final_username):
                final_username = f"{clean_username}_{count}"
                count += 1

            # Auto-create user account with role student
            random_pwd_hash = hash_password(os.urandom(24).hex())
            user = create_user(final_username, email, random_pwd_hash, role="student")

        token = generate_token(user["id"], user["role"])
        user_info = {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "picture": google_user.get("picture", ""),
        }
        return jsonify(token=token, user=user_info)

    @app.get("/api/auth/me")
    @token_required
    def get_me():
        """Return details of current authenticated user."""
        return jsonify(user=g.current_user)

    # ==================== SESSIONS & HISTORY ENDPOINTS ====================

    @app.get("/api/sessions")
    @token_required
    def list_sessions():
        """List all chat sessions for the current user."""
        sessions = get_user_sessions(g.current_user["id"])
        return jsonify(sessions=sessions)

    @app.post("/api/sessions")
    @token_required
    def new_session():
        """Create a new chat session."""
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "New Conversation").strip()
        session = create_session(g.current_user["id"], title)
        return jsonify(session=session), 201

    @app.get("/api/sessions/<session_id>")
    @token_required
    def fetch_session(session_id: str):
        """Fetch session metadata and message history."""
        session = get_session_by_id(session_id, g.current_user["id"])
        if not session:
            return jsonify(error="Session not found or access denied."), 404
        messages = get_session_messages(session_id)
        return jsonify(session=session, messages=messages)

    @app.delete("/api/sessions/<session_id>")
    @token_required
    def remove_session(session_id: str):
        """Delete a chat session."""
        success = delete_session(session_id, g.current_user["id"])
        if not success:
            return jsonify(error="Session not found or access denied."), 404
        return jsonify(status="deleted", session_id=session_id)

    # ==================== CHAT ENDPOINT ====================

    @app.post("/api/chat")
    def chat():
        """Answer question using RAG pipeline, appending to session history if session_id is provided."""
        payload = request.get_json(silent=True) or {}
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            return jsonify(error="'message' must be a non-empty string."), 400

        user_message = message.strip()
        session_id = payload.get("session_id")
        history = payload.get("history", [])

        # If a session_id is supplied, load history from database
        if session_id:
            session = get_session_by_id(session_id)
            if session:
                existing_messages = get_session_messages(session_id)
                history = [{"role": m["role"], "content": m["content"]} for m in existing_messages]

        try:
            response = rag.answer(user_message, history)

            # Save conversation turn to database session if session_id is present
            if session_id and get_session_by_id(session_id):
                add_message(session_id, "user", user_message)
                add_message(session_id, "assistant", response["reply"], response.get("sources", []))
                
                # Auto-update session title based on first user question if title is default
                session = get_session_by_id(session_id)
                if session and session["title"] == "New Conversation":
                    auto_title = user_message[:40] + ("..." if len(user_message) > 40 else "")
                    update_session_title(session_id, auto_title)

            return jsonify({
                "reply": response["reply"],
                "sources": response.get("sources", []),
                "model": response.get("model"),
                "session_id": session_id
            })
        except RuntimeError as error:
            return jsonify(error=str(error)), 503

    # ==================== ADMIN ENDPOINTS (RBAC PROTECTED) ====================

    @app.post("/api/documents")
    @roles_required("admin")
    def ingest_documents():
        """Create FAISS index from documents payload (Admin only)."""
        payload = request.get_json(silent=True)
        documents = payload.get("documents") if isinstance(payload, dict) else None
        if not isinstance(documents, list) or not documents:
            return jsonify(error="'documents' must be a non-empty array."), 400
        try:
            return jsonify(indexed_chunks=rag.ingest_payload(documents)), 201
        except (ValueError, RuntimeError) as error:
            return jsonify(error=str(error)), 400

    @app.post("/api/documents/reindex")
    @roles_required("admin")
    def reindex_documents():
        """Rebuild FAISS index from backend/documents (Admin only)."""
        try:
            return jsonify(indexed_chunks=rag.rebuild_index())
        except (ValueError, RuntimeError) as error:
            return jsonify(error=str(error)), 400

    @app.post("/api/sources/crawl")
    @roles_required("admin")
    def crawl_public_website():
        """Crawl website and replace knowledge base (Admin only)."""
        payload = request.get_json(silent=True) or {}
        url = payload.get("url", os.getenv("UNIVERSITY_WEBSITE_URL", "https://sangamuniversity.ac.in/"))
        max_pages = payload.get("max_pages", 40)
        if not isinstance(url, str) or not isinstance(max_pages, int):
            return jsonify(error="'url' must be a string and 'max_pages' must be an integer."), 400
        try:
            pages = PublicWebsiteLoader(url, max_pages=max_pages).load()
            return jsonify(indexed_chunks=rag.rebuild_index(pages), indexed_pages=len(pages), source=url), 201
        except (ValueError, RuntimeError) as error:
            return jsonify(error=str(error)), 400

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="Endpoint not found."), 404

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
