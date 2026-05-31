import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.deps import require_officer
from app.models import User
from app.schemas import UserCreate, UserCreateResponse, UserResponse
from app.security import generate_temporary_password, hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(require_officer),
):
    return current_user


@router.get("", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_officer),
):
    result = await session.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post(
    "",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    body: UserCreate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_officer),
):
    existing = await session.execute(
        select(User).where(User.username == body.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    temp_password = generate_temporary_password()
    user = User(
        username=body.username,
        password_hash=hash_password(temp_password),
        role="member",
        requires_pw_change=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return UserCreateResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        temporary_password=temp_password,
        created_at=user.created_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_officer),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    await session.delete(user)
    await session.commit()
