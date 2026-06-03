from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SongMember(Base):
    __tablename__ = "song_members"

    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("song_proposals.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    instrument: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="approved")

    proposal: Mapped["SongProposal"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(lazy="joined")

    @property
    def username(self) -> str:
        return self.user.username
