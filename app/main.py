import os
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select, text

from app.database import Base, async_session_maker, engine
from app.models import Announcement, User
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
        await conn.execute(text("ALTER TABLE song_proposals ADD COLUMN IF NOT EXISTS description TEXT"))
        await conn.execute(text("ALTER TABLE song_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved'"))

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

    # Seed initial announcements if none exist
    async with async_session_maker() as session:
        ann_count_result = await session.execute(select(func.count()).select_from(Announcement))
        if ann_count_result.scalar() == 0:
            officer_result = await session.execute(
                select(User).where(User.role == "officer").limit(1)
            )
            officer = officer_result.scalar_one_or_none()
            if officer:
                seed_anns = [
                    Announcement(
                        author_id=officer.id,
                        title="【置頂】歡迎來到音樂性社團管理平台！",
                        content=(
                            "歡迎使用音樂性社團管理系統！\n\n"
                            "本系統提供以下功能：\n"
                            "• 📢 公告欄：幹部發布社團最新消息\n"
                            "• 🎸 歌曲提案：社員提交欲練習或演出的曲目\n"
                            "• 📅 場地預約：依據歌曲提案預約練習場地\n"
                            "• 👥 成員管理：幹部管理社員帳號（限幹部）\n\n"
                            "如有任何疑問，請於社課時間詢問幹部，或至社辦洽詢。"
                        ),
                    ),
                    Announcement(
                        author_id=officer.id,
                        title="【重要】114 學年度第 2 學期社課時間與場地公告",
                        content=(
                            "本學期社課時間與地點如下：\n\n"
                            "📅 社課時間：每週三 18:00 – 20:00\n"
                            "📍 社課地點：學生活動中心 303 室\n\n"
                            "🔔 場地使用規定：\n"
                            "• 社課結束後請協助清潔場地、歸還借用器材\n"
                            "• 樂器使用後須歸回原位\n"
                            "• 非社課時間需使用場地，請提前於系統預約\n"
                            "• 若有請假，請於社課前一天告知幹部\n\n"
                            "請各位社員配合遵守，感謝大家的合作！"
                        ),
                    ),
                    Announcement(
                        author_id=officer.id,
                        title="【活動】2025 春季音樂會報名開始！",
                        content=(
                            "🎵 音樂性社團 2025 春季成果音樂會\n\n"
                            "時間：2025 年 6 月 15 日（日）下午 14:00\n"
                            "地點：學生活動中心大禮堂\n"
                            "入場：免費開放，歡迎邀請親友蒞臨\n\n"
                            "📌 演出報名說明：\n"
                            "有意願參與演出的社員，請至「歌曲提案」頁面建立提案後，"
                            "再至「場地預約」預約彩排時段，並填寫 Google 表單報名。\n\n"
                            "演出形式包含：弦樂合奏、獨奏、室內樂小組\n"
                            "報名截止日期：2025 年 5 月 25 日（日）\n\n"
                            "期待各位的精彩演出，讓我們一起用音樂感動人心！"
                        ),
                    ),
                    Announcement(
                        author_id=officer.id,
                        title="新進社員入社指南",
                        content=(
                            "歡迎新社員加入音樂性社團！🎉\n\n"
                            "入社後請依序完成以下步驟：\n\n"
                            "1. 確認帳號：確認幹部已為您建立系統帳號\n"
                            "2. 修改密碼：首次登入時系統會要求您設定新密碼\n"
                            "3. 熟悉功能：\n"
                            "   - 歌曲提案：提交您想練習或演出的曲目\n"
                            "   - 場地預約：為您的提案預約練習時段\n"
                            "4. 出席社課：每週三 18:00 準時到達 303 室\n\n"
                            "如有任何問題，歡迎在社課時間詢問幹部，我們很樂意協助您！"
                        ),
                    ),
                ]
                session.add_all(seed_anns)
                await session.commit()
                print(" Seeded initial announcements.")
