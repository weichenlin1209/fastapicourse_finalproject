import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.database import get_async_session
from app.deps import get_current_user
from app.models import Booking, SongProposal, User
from app.schemas import BookingCreate, BookingResponse

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _booking_to_response(booking: Booking) -> BookingResponse:
    return BookingResponse(
        id=booking.id,
        user_id=booking.user_id,
        proposal_id=booking.proposal_id,
        start_time=booking.booking_period.lower,
        end_time=booking.booking_period.upper,
        status=booking.status,
    )


@router.get("", response_model=list[BookingResponse])
async def list_bookings(
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(get_current_user),
):
    result = await session.execute(
        select(Booking).order_by(Booking.booking_period)
    )
    return [_booking_to_response(b) for b in result.scalars().all()]


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(get_current_user),
):
    result = await session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )
    return _booking_to_response(booking)


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    body: BookingCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    proposal_result = await session.execute(
        select(SongProposal).where(SongProposal.id == body.proposal_id)
    )
    proposal = proposal_result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song proposal not found",
        )
    if proposal.initiator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only book time for your own song proposals",
        )

    booking = Booking(
        user_id=current_user.id,
        proposal_id=body.proposal_id,
        booking_period=asyncpg.Range(
            body.start_time.replace(tzinfo=None),
            body.end_time.replace(tzinfo=None),
        ),
        status="active",
    )
    session.add(booking)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This time slot is already occupied",
        )
    await session.refresh(booking)
    return _booking_to_response(booking)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.user_id != current_user.id and current_user.role != "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bookings",
        )

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is already cancelled",
        )

    booking.status = "cancelled"
    await session.commit()
    await session.refresh(booking)
    return _booking_to_response(booking)
