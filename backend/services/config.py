"""Configuration settings for the Ask Sangam backend."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# JWT Settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY", "ask-sangam-jwt-secret-key-change-in-prod"))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# Google OAuth Settings
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Primary Database Settings (SQLite)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = DATA_DIR / "app.db"

# Roles
ROLE_STUDENT = "student"
ROLE_FACULTY = "faculty"
ROLE_ADMIN = "admin"
VALID_ROLES = {ROLE_STUDENT, ROLE_FACULTY, ROLE_ADMIN}
