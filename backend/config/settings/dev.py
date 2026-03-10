import os

import dj_database_url

from .base import *  # noqa: F401,F403


DEBUG = os.getenv("DEBUG", "True").lower() == "true"
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", "postgresql://localhost:5432/stocklens_dev"),
        conn_max_age=600,
    )
}
CORS_ALLOWED_ORIGINS = [os.getenv("FRONTEND_URL", "http://localhost:5173")]
