from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


def _credentials(admin: bool) -> tuple[str, str]:
    if not settings.supabase_url:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_NOT_CONFIGURED", "message": "Database service is not configured."})
    key = settings.supabase_service_role_key if admin else settings.supabase_publishable_key
    if not key:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_NOT_CONFIGURED", "message": "Database credentials are not configured."})
    return settings.supabase_url.rstrip("/"), key


async def rest_request(
    method: str,
    table: str,
    *,
    token: str | None = None,
    admin: bool = False,
    params: dict[str, str] | None = None,
    payload: Any = None,
    prefer: str | None = None,
) -> Any:
    base_url, key = _credentials(admin)
    auth_token = settings.supabase_service_role_key if admin else token
    if not auth_token:
        raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Authentication is required."})
    headers = {"apikey": key, "Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.request(method, f"{base_url}/rest/v1/{table}", headers=headers, params=params, json=payload)
        if response.is_error:
            # Never echo database/provider internals to API callers.
            raise HTTPException(status_code=502, detail={"code": "DATABASE_REQUEST_FAILED", "message": "Database request failed."})
        if response.status_code == 204 or not response.content:
            return None
        return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Database service could not be reached."}) from exc
