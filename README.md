# Music Club API

一個大學音樂社團的管理系統，採用前後端分離架構。

- 後端：FastAPI + SQLAlchemy 2.0 (async) + asyncpg + PostgreSQL
- 前端：Vanilla JS ES Modules（無框架）+ sessionStorage JWT
- 部署：Docker Compose (API + PostgreSQL)

---

## 目錄結構

```
project-root/
├── app/
│   ├── main.py              # FastAPI entry, CORS, middleware, catch-all SPA routing
│   ├── config.py            # Pydantic BaseSettings 讀取 .env
│   ├── database.py          # async engine, session factory, Base
│   ├── deps.py              # get_current_user(), require_officer()
│   ├── security.py          # bcrypt hash, JWT create/decode, temp password generator
│   ├── schemas.py           # 所有 Pydantic request/response models
│   ├── models/              # SQLAlchemy ORM models（5 tables）
│   └── routers/             # 5 個 APIRouter（auth, users, announcements, song_proposals, bookings）
├── frontend/
│   ├── index.html           # SPA entry point（navbar, modals, <main>）
│   ├── css/style.css
│   └── js/
│       ├── app.js           # SPA controller（navigateTo, auth state, modal handlers）
│       ├── api.js           # fetch wrapper（JWT injection, 401/403 handling）
│       ├── utils.js         # decodeToken, sessionStorage, h() DOM helper, formatDate
│       └── components/      # 4 個 page components（announcements, proposals, bookings, users）
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .env                     #（不提交至版本控制）
```

---

## 開發環境設定

### 前置需求

- Docker + Docker Compose

### 快速啟動

```bash
# 1. 建立 .env（參考下方環境變數表格）
# 2. 啟動
sudo docker compose up --build
# 3. 開啟 http://localhost:1234
# 4. 用 admin / admin123456 登入（首次登入會被強制改密碼）
```

### 環境變數 (.env)

| 變數 | 預設值 | 說明 |
|---|---|---|
| `POSTGRES_USER` | musicclub | PostgreSQL 使用者 |
| `POSTGRES_PASSWORD` | musicclub_secret | PostgreSQL 密碼 |
| `POSTGRES_DB` | musicclub | 資料庫名稱 |
| `DATABASE_URL` |（自動組成） | SQLAlchemy async connection string |
| `SECRET_KEY` | change-me-in-production | JWT 簽章密鑰（上線前必改） |
| `JWT_ALGORITHM` | HS256 | JWT 演算法 |
| `JWT_EXPIRATION_MINUTES` | 60 | Token 有效期限（分鐘） |
| `FIRST_OFFICER_USERNAME` | admin | 初始管理員帳號 |
| `FIRST_OFFICER_PASSWORD` | admin123456 | 初始管理員密碼 |

> 初始管理員帳號會在 startup 事件自動建立（僅在 users 表為空時）。

---

## API 路由總表

所有 API 前綴為 `/api/v1`。

### 認證 (Auth)

| Method | Path | Auth | 說明 |
|---|---|---|---|
| POST | /auth/login | Public | 登入，回傳 JWT |
| POST | /auth/change-password | Bearer | 修改密碼（清除 `requires_pw_change` flag） |

### 使用者管理 (Users) — 僅 officer

| Method | Path | Auth | 說明 |
|---|---|---|---|
| GET | /users/me | officer | 取得當前使用者資訊 |
| GET | /users | officer | 列出所有使用者 |
| POST | /users | officer | 建立使用者（回傳一次性臨時密碼） |
| DELETE | /users/{id} | officer | 刪除使用者（禁止自刪） |

### 公告 (Announcements) — 公開讀取

| Method | Path | Auth | 說明 |
|---|---|---|---|
| GET | /announcements | Public | 列出所有公告 |
| GET | /announcements/{id} | Public | 取得單一公告 |
| POST | /announcements | officer | 新增公告 |
| PATCH | /announcements/{id} | officer | 更新公告 |
| DELETE | /announcements/{id} | officer | 刪除公告 |

### 歌曲提案 (Song Proposals)

| Method | Path | Auth | 說明 |
|---|---|---|---|
| GET | /song-proposals | Bearer | 列出提案（member 只看自己的，officer 看全部） |
| GET | /song-proposals/{id} | Bearer | 取得單一提案 |
| POST | /song-proposals | Bearer | 新增提案 |
| POST | /song-proposals/{id}/join | Bearer | 加入提案（指定樂器） |

### 預約 (Bookings)

| Method | Path | Auth | 說明 |
|---|---|---|---|
| GET | /bookings | Bearer | 列出所有預約 |
| GET | /bookings/{id} | Bearer | 取得單一預約 |
| POST | /bookings | Bearer | 新增預約（只能約自己的提案、不可重疊時間） |
| PATCH | /bookings/{id}/cancel | Bearer | 取消預約（本人或 officer） |

---

## 資料庫模型

### User

| 欄位 | 型態 | 備註 |
|---|---|---|
| id | UUID | PK |
| username | VARCHAR(50) | UNIQUE, INDEX |
| password_hash | VARCHAR(128) | bcrypt |
| role | VARCHAR(10) | 'member' 或 'officer' |
| requires_pw_change | BOOLEAN | 首次登入／被建立時為 true |
| created_at | TIMESTAMPTZ | server_default now() |

### Announcement

| 欄位 | 型態 | 備註 |
|---|---|---|
| id | UUID | PK |
| author_id | UUID | FK → users.id |
| title | VARCHAR(200) | |
| content | TEXT | |
| created_at | TIMESTAMPTZ | |

### SongProposal

| 欄位 | 型態 | 備註 |
|---|---|---|
| id | UUID | PK |
| initiator_id | UUID | FK → users.id |
| song_name | VARCHAR(200) | |
| created_at | TIMESTAMPTZ | |

### SongMember（多對多關聯表）

| 欄位 | 型態 | 備註 |
|---|---|---|
| proposal_id | UUID | PK, FK → song_proposals.id, ON DELETE CASCADE |
| user_id | UUID | PK, FK → users.id, ON DELETE CASCADE |
| instrument | VARCHAR(100) | |

### Booking

| 欄位 | 型態 | 備註 |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| proposal_id | UUID | FK → song_proposals.id |
| booking_period | TSRANGE | PostgreSQL 範圍型別 |
| status | VARCHAR(20) | 'active' / 'cancelled' |

**Constraints:**

- `ExcludeConstraint` — 使用 GiST index 禁止重疊的 active booking，防止重複預約
- `CheckConstraint` — `upper(booking_period) - lower(booking_period) <= INTERVAL '3 hours'`

---

## 認證與授權機制

### JWT 驗證流程（無 Cookie）

1. `POST /auth/login` → 回傳 JWT（payload 包含 `sub`=user_id, `role`, `exp`）
2. 前端存入 `sessionStorage`（非 Cookie）
3. 每次請求由 `api.js` 自動帶入 `Authorization: Bearer <token>` Header
4. 後端 `deps.py` 解碼驗證簽章 → 查出 User → 回傳給 endpoint

### 兩層授權 Dependency

- `get_current_user()` — 只要有有效 JWT 即可通行
- `require_officer()` — 必須 `role == 'officer'`

### 強制改密碼 Middleware

位置：`app/main.py:59-96`

- 攔截所有請求（排除 login、change-password、docs、GET announcements）
- 若 `user.requires_pw_change == True` → 回傳 403，前端 `api.js` 偵測到後彈出重置密碼 Modal

---

## 前端 SPA 架構

### Component Pattern

每個頁面元件 export 兩個 function：

- `init(user)` — 注入當前使用者（存於 module-level `currentUser`）
- `render(container)` — 清空 container、fetch API、建立 DOM

### SPA Routing (`app.js`)

- 導航列按鈕觸發 `navigateTo(view)`，沒有 hash-based routing
- `setAuthenticated()` / `setUnauthenticated()` 只處理狀態與 UI 切換，不主動 render，避免 race condition
- 初始載入時先檢查 token 再 render，確保 officer 按鈕正常顯示

### API Client (`api.js`)

- 自動注入 JWT 到所有請求 Header
- 401 → 清除 token + 重整頁面（強制重新登入）
- 403 + "password change required" → 觸發強制改密碼 Modal
- 422 array error 格式化為可讀訊息（`msg` 欄位 join）

---

## 資料安全設計

- **Password** — bcrypt hash（使用 passlib + bcrypt 4.0.1）
- **JWT** — HS256 with server secret key
- **Song Proposal 隔離** — member 只能看到自己的 proposal（後端 SQL WHERE 過濾，非前端過濾）
- **Booking 限制** — 只能約自己發起的 proposal（後端檢查 `initiator_id`）
- **防止自刪** — DELETE /users/{id} 禁止刪除自己的帳號
- **時段防撞** — PostgreSQL GiST ExcludeConstraint（booking_period 不重疊 + status='active'）

---

## 開發注意事項

### 已知問題與解決方案

| 問題 | 原因 | 解法 |
|---|---|---|
| bcrypt 不相容 | passlib 1.7.4 不相容 bcrypt>=4.1 | 鎖定 `bcrypt==4.0.1` |
| datetime-local 時間跑掉 | `toISOString()` 將 local time 轉為 UTC | 直接傳送原始 `datetime-local` 字串 |
| TSRANGE + 時區錯誤 | asyncpg.Range 不接受 offset-aware datetime | 傳入前 `.replace(tzinfo=None)` |
| POST 路由 307 redirect | FastAPI trailing slash 預設行為 | 根路徑使用空字串 `@router.get("")` |
| 頁面 reload 後按鈕消失 | render 順序在 auth check 之前 | 先檢查 token 再 render，auth state 變更不主動 render |

### 常用指令

#### 完整啟動（含建構）
```bash
sudo docker compose up --build
```

#### 僅啟動資料庫（開發時用外部 Python 跑）
```bash
sudo docker compose up db -d
uvicorn app.main:app --reload --port 1234
```

#### 清除資料庫 volume（重建從零開始）
```bash
sudo docker compose down -v
```
