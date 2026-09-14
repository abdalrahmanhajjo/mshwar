from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    bookings,
    businesses,
    catalogue,
    favorites,
    health,
    locations,
    notifications,
    planner,
    portal,
    privacy,
    profile,
    trips,
)

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(profile.router, prefix="/profile", tags=["profile"])
router.include_router(privacy.router, prefix="/privacy", tags=["privacy"])
router.include_router(locations.router, prefix="/locations", tags=["locations"])
router.include_router(planner.router, prefix="/planner", tags=["planner"])
router.include_router(catalogue.router, prefix="/catalogue", tags=["catalogue"])
router.include_router(portal.router, prefix="/portal", tags=["portal"])
router.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(trips.router, prefix="/trips", tags=["trips"])
router.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
