"""
JWT Authentication & Authorization Module

Provides:
- Token generation (access + refresh tokens)
- Token validation middleware
- Password hashing (bcrypt)
- User credential verification
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuration
SECRET_KEY = "your-secret-key-change-in-production-via-env"  # Override with env var
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token security scheme
security = HTTPBearer()


class TokenData:
    """Token payload structure."""
    def __init__(self, user_id: str, email: str):
        self.user_id = user_id
        self.email = email


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "user_id": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: str, email: str) -> str:
    """Generate JWT refresh token (longer expiry)."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "user_id": user_id,
        "email": email,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """Verify JWT token and return payload. Raise HTTPException if invalid."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        email: str = payload.get("email")
        
        if user_id is None or email is None:
            raise credentials_exception
        
        return TokenData(user_id=user_id, email=email)
    except JWTError:
        raise credentials_exception


async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)) -> TokenData:
    """Dependency for FastAPI route protection. Validates Bearer token."""
    return verify_token(credentials.credentials)
