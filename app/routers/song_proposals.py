import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.deps import get_current_user
from app.models import SongMember, SongProposal, User
from app.schemas import (
    SongMemberCreate,
    SongMemberResponse,
    SongProposalCreate,
    SongProposalResponse,
)

router = APIRouter(prefix="/song-proposals", tags=["song-proposals"])


@router.get("", response_model=list[SongProposalResponse])
async def list_proposals(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    query = select(SongProposal).order_by(SongProposal.created_at.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/{proposal_id}", response_model=SongProposalResponse)
async def get_proposal(
    proposal_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(get_current_user),
):
    result = await session.execute(
        select(SongProposal).where(SongProposal.id == proposal_id)
    )
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song proposal not found",
        )
    return proposal


@router.post(
    "",
    response_model=SongProposalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_proposal(
    body: SongProposalCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    proposal = SongProposal(
        initiator_id=current_user.id,
        song_name=body.song_name,
        description=body.description,
    )
    session.add(proposal)
    await session.flush()

    if body.instrument:
        member = SongMember(
            proposal_id=proposal.id,
            user_id=current_user.id,
            instrument=body.instrument,
            status="approved",
        )
        session.add(member)

    await session.commit()
    await session.refresh(proposal)
    return proposal


@router.post(
    "/{proposal_id}/join",
    response_model=SongMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_proposal(
    proposal_id: uuid.UUID,
    body: SongMemberCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    proposal_result = await session.execute(
        select(SongProposal).where(SongProposal.id == proposal_id)
    )
    proposal = proposal_result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song proposal not found",
        )

    existing = await session.execute(
        select(SongMember).where(
            SongMember.proposal_id == proposal_id,
            SongMember.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already joined this proposal",
        )

    member = SongMember(
        proposal_id=proposal_id,
        user_id=current_user.id,
        instrument=body.instrument,
        status="pending",
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


@router.patch(
    "/{proposal_id}/members/{user_id}/approve",
    response_model=SongMemberResponse,
)
async def approve_member(
    proposal_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    proposal_result = await session.execute(
        select(SongProposal).where(SongProposal.id == proposal_id)
    )
    proposal = proposal_result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song proposal not found")
    if proposal.initiator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the initiator can approve members")

    member_result = await session.execute(
        select(SongMember).where(
            SongMember.proposal_id == proposal_id,
            SongMember.user_id == user_id,
        )
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member is not in pending status")

    member.status = "approved"
    await session.commit()
    await session.refresh(member)
    return member


@router.patch(
    "/{proposal_id}/members/{user_id}/reject",
    response_model=SongMemberResponse,
)
async def reject_member(
    proposal_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    proposal_result = await session.execute(
        select(SongProposal).where(SongProposal.id == proposal_id)
    )
    proposal = proposal_result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song proposal not found")
    if proposal.initiator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the initiator can reject members")

    member_result = await session.execute(
        select(SongMember).where(
            SongMember.proposal_id == proposal_id,
            SongMember.user_id == user_id,
        )
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member is not in pending status")

    member.status = "rejected"
    await session.commit()
    await session.refresh(member)
    return member
