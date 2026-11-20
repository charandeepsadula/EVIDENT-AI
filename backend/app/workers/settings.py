from urllib.parse import urlparse

from arq.connections import RedisSettings

from app.core.config import settings
from app.workers.tasks import run_investigation, run_media_investigation


def redis_settings() -> RedisSettings:
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is required to run the worker.")
    parsed = urlparse(settings.redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        username=parsed.username,
        password=parsed.password,
        ssl=parsed.scheme == "rediss",
        ssl_check_hostname=parsed.scheme == "rediss",
    )


class WorkerSettings:
    functions = [run_investigation, run_media_investigation]
    redis_settings = redis_settings()
    max_jobs = 4
    # Allows up to three attempts per configured Gemini model across both
    # structured analysis stages, including the optional verified fallback.
    job_timeout = 600
    max_tries = 3
    keep_result = 3600
