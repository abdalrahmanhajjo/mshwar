from fastapi import APIRouter

from app.api.v1.endpoints import bookings, businesses, health, trips

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(trips.router, prefix="/trips", tags=["trips"])
