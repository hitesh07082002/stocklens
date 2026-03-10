import os

import dj_database_url

from .base import split_csv
from .base import *  # noqa: F401,F403


DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]
DATABASES = {
    "default": dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=600)
}
ALLOWED_HOSTS = split_csv(os.environ["ALLOWED_HOSTS"])
CORS_ALLOWED_ORIGINS = [os.environ["FRONTEND_URL"]]
