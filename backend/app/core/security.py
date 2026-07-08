from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if the entered password matches the hash in the DB."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Transform the password in hash"""
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    """Generate a JWT valid for the period set in .env."""
    to_encode = data.copy()

    # Calculate expiry date
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    return encoded_jwt
