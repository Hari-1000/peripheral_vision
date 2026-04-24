from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- Auth ---
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Password Reset ---
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# --- Training Results ---
class TrainingResultCreate(BaseModel):
    total_attempts: int
    correct_responses: int
    accuracy: float
    speed_setting: str

class TrainingResultOut(BaseModel):
    id: int
    timestamp: datetime
    total_attempts: int
    correct_responses: int
    accuracy: float
    speed_setting: str

    class Config:
        from_attributes = True
