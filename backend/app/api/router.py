from fastapi import APIRouter

from app.api.routes import analytics, admin, auth, chats, comments, communities, notifications, posts, saved, search, system, users

api_router = APIRouter()

for router in (
    system.router,
    analytics.router,
    auth.router,
    users.router,
    posts.router,
    comments.router,
    communities.router,
    search.router,
    notifications.router,
    chats.router,
    saved.router,
    admin.router,
):
    api_router.include_router(router)
