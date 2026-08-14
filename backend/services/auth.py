"""Authentication and Role-Based Access Control (RBAC) service using JWT and Google OAuth 2.0."""

from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable

import jwt
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from services.config import GOOGLE_CLIENT_ID, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, JWT_SECRET_KEY
from services.db import get_user_by_id


def hash_password(password: str) -> str:
    """Hash a plaintext password using Werkzeug's default PBKDF2 scheme."""
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify plaintext password against stored hash."""
    return check_password_hash(password_hash, password)


def generate_token(user_id: str, role: str) -> str:
    """Generate a signed JWT token containing user identity and role."""
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expiration,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def verify_google_token(token_string: str) -> dict[str, Any] | None:
    """Verify Google OAuth 2.0 ID Token and return user payload."""
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests

        # Verify Google token against Google's public certificates
        req = requests.Request()
        client_id = GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None
        # Clock skew tolerance allows smooth verification
        id_info = id_token.verify_oauth2_token(token_string, req, client_id, clock_skew_in_seconds=10)
        
        # Verify issuer is Google
        if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            return None

        return {
            "email": id_info.get("email", "").lower(),
            "name": id_info.get("name", ""),
            "picture": id_info.get("picture", ""),
            "sub": id_info.get("sub", ""),
        }
    except Exception as err:
        print(f"[Google Auth Error] Token verification failed: {err}")
        return None


def token_required(f: Callable) -> Callable:
    """Decorator requiring a valid JWT Bearer token in the Authorization header."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify(error="Missing or invalid Authorization header. Must be 'Bearer <token>'."), 401

        token = auth_header.split(" ", 1)[1].strip()
        payload = decode_token(token)
        if not payload:
            return jsonify(error="Token is invalid or has expired."), 401

        user = get_user_by_id(payload["sub"])
        if not user:
            return jsonify(error="User account associated with token no longer exists."), 401

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


def roles_required(*roles: str) -> Callable:
    """Decorator requiring the logged-in user to have one of the specified roles."""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        @token_required
        def decorated(*args: Any, **kwargs: Any) -> Any:
            user_role = g.current_user.get("role", "")
            if user_role not in roles:
                return jsonify(
                    error=f"Access forbidden: role '{user_role}' does not have permission. Required: {list(roles)}"
                ), 403
            return f(*args, **kwargs)

        return decorated

    return decorator
