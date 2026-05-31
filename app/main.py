import os
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select, text

from app.database import Base, async_session_maker, engine
from app.models import User
from app.routers import announcements, auth, bookings, song_proposals, users
from app.security import decode_token, hash_password

app = FastAPI(title="Music Club API", version="1.0.0")

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1234", "http://127.0.0.1:1234"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

    #allow_origins=["*"],
    #allow_credentials=True,
    #allow_methods=["*"],
    #allow_headers=["*"],
)

# API routes under /api/v1 prefix so the catch-all never interferes
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(announcements.router, prefix=API_PREFIX)
app.include_router(song_proposals.router, prefix=API_PREFIX)
app.include_router(bookings.router, prefix=API_PREFIX)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Never let API paths fall through to the frontend
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    file_path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.middleware("http")
async def enforce_password_change(request: Request, call_next):
    open_paths = {
        f"{API_PREFIX}/auth/login",
        f"{API_PREFIX}/auth/change-password",
        "/docs",
        "/redoc",
        "/openapi.json",
    }
    if request.url.path in open_paths or (
        request.method == "GET"
        and request.url.path.startswith(f"{API_PREFIX}/announcements")
    ):
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                async with async_session_maker() as session:
                    result = await session.execute(
                        select(User).where(User.id == uuid.UUID(user_id))
                    )
                    user = result.scalar_one_or_none()
                    if user and user.requires_pw_change:
                        return JSONResponse(
                            status_code=403,
                            content={
                                "detail": "Password change required. Please update your password before accessing this resource."
                            },
                        )
        except Exception:
            pass

    return await call_next(request)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        await conn.run_sync(Base.metadata.create_all)

    # Seed initial officer account if no users exist
    async with async_session_maker() as session:
        result = await session.execute(select(func.count()).select_from(User))
        if result.scalar() == 0:
            officer_username = os.getenv("FIRST_OFFICER_USERNAME", "admin")
            officer_password = os.getenv("FIRST_OFFICER_PASSWORD", "admin123456")
            user = User(
                username=officer_username,
                password_hash=hash_password(officer_password),
                role="officer",
                requires_pw_change=True,
            )
            session.add(user)
            await session.commit()
            print(
                f" Seeded initial officer account: "
                f"username={officer_username} / password={officer_password}"
            )
