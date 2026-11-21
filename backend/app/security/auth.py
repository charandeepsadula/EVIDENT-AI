from typing import Annotated
from uuid import UUID

import httpx
import secrets
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings


class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr | None = None
    access_token: str = Field(exclude=True)


async def get_current_user(authorization: Annotated[str | None, Header()] = None) -> AuthenticatedUser:
    if settings.local_dev_mode:
        if settings.local_dev_token and len(settings.local_dev_token) >= 32:
            if not authorization or not authorization.startswith("Bearer ") or not secrets.compare_digest(authorization[7:], settings.local_dev_token):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "AUTH_REQUIRED", "message": "Local workspace access token is missing or invalid."})
            token = authorization[7:]
        else:
            token = authorization[7:] if (authorization and authorization.startswith("Bearer ")) else "local-workspace-token"
        return AuthenticatedUser(id=UUID("00000000-0000-4000-8000-000000000001"), email="local@example.com", access_token=token)
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(status_code=503, detail={"code": "AUTH_NOT_CONFIGURED", "message": "Authentication service is not configured."})
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "AUTH_REQUIRED", "message": "A valid bearer token is required."})

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={"apikey": settings.supabase_publishable_key, "Authorization": authorization},
            )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail={"code": "AUTH_INVALID", "message": "The session is invalid or expired."})
        data = response.json()
        return AuthenticatedUser(id=data["id"], email=data.get("email"), access_token=authorization[7:])
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=503, detail={"code": "AUTH_UNAVAILABLE", "message": "Authentication service could not be reached."}) from exc


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
