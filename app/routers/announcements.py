import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.deps import require_officer
from app.models import Announcement, User
from app.schemas import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementResponse])
async def list_announcements(
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(Announcement).order_by(Announcement.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    return announcement


@router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    body: AnnouncementCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_officer),
):
    announcement = Announcement(
        author_id=current_user.id,
        title=body.title,
        content=body.content,
    )
    session.add(announcement)
    await session.commit()
    await session.refresh(announcement)
    return announcement


@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: uuid.UUID,
    body: AnnouncementUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_officer),
):
    result = await session.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    if body.title is not None:
        announcement.title = body.title
    if body.content is not None:
        announcement.content = body.content
    await session.commit()
    await session.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_officer),
):
    result = await session.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    await session.delete(announcement)
    await session.commit()
