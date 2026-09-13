from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, bookings, businesses, health, trips

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(trips.router, prefix="/trips", tags=["trips"])
