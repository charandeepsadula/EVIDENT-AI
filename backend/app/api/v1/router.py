from fastapi import APIRouter
from app.api.v1.investigations import router as investigations_router
from app.api.v1.reports import router as reports_router
from app.api.v1.system import router as system_router

api_router = APIRouter()
api_router.include_router(investigations_router)
api_router.include_router(reports_router)
api_router.include_router(system_router)
