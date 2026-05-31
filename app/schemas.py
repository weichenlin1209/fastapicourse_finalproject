import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class UserRole(str, Enum):
    MEMBER = "member"
    OFFICER = "officer"


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# --- User ---
class UserCreate(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v


class UserCreateResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    temporary_password: str
    created_at: datetime


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Announcement ---
class AnnouncementCreate(BaseModel):
    title: str
    content: str


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class AnnouncementResponse(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    title: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Song Proposal ---
class SongProposalCreate(BaseModel):
    song_name: str


class SongProposalResponse(BaseModel):
    id: uuid.UUID
    initiator_id: uuid.UUID
    song_name: str
    created_at: datetime
    members: list["SongMemberResponse"] = []

    model_config = ConfigDict(from_attributes=True)


class SongMemberCreate(BaseModel):
    instrument: str


class SongMemberResponse(BaseModel):
    proposal_id: uuid.UUID
    user_id: uuid.UUID
    instrument: str

    model_config = ConfigDict(from_attributes=True)


# --- Booking ---
class BookingCreate(BaseModel):
    proposal_id: uuid.UUID
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def validate_duration(self):
        duration = self.end_time - self.start_time
        total_seconds = duration.total_seconds()
        if total_seconds <= 0:
            raise ValueError("end_time must be after start_time")
        if total_seconds > 3 * 3600:
            raise ValueError("Booking duration cannot exceed 3 hours")
        return self


class BookingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    proposal_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)
