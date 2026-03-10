import dj_database_url

from .base import *  # noqa: F401,F403


DEBUG = False
DATABASES = {
    "default": dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=600)
}
ALLOWED_HOSTS = split_csv(os.environ["ALLOWED_HOSTS"])
CORS_ALLOWED_ORIGINS = [os.environ["FRONTEND_URL"]]
