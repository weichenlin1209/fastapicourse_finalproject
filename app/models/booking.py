import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import TSRANGE, UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("song_proposals.id"), nullable=False
    )
    booking_period: Mapped[Any] = mapped_column(TSRANGE, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False
    )

    __table_args__ = (
        ExcludeConstraint(
            ("booking_period", "&&"),
            ("status", "="),
            using="gist",
            where="status = 'active'",
            name="no_overlapping_active_bookings",
        ),
        CheckConstraint(
            "upper(booking_period) - lower(booking_period) <= INTERVAL '3 hours'",
            name="booking_max_duration",
        ),
    )
