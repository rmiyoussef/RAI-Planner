from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
import hashlib
import base64
import os
import bcrypt as _bcrypt

from .config import get_settings

def hash_password(password: str) -> str:
    # bcrypt limit 72 bytes - truncate if needed (common workaround)
    pw = password.encode()[:72]
    salt = _bcrypt.gensalt()
    return _bcrypt.hashpw(pw, salt).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        pw = plain.encode()[:72]
        return _bcrypt.checkpw(pw, hashed.encode())
    except Exception:
        return False

def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Optional[str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# Simple secret encryption for API keys (Fernet-like but lightweight without extra dep)
# Use base64 + xor with derived key if ENCRYPTION_KEY not set, else use provided
# For production, recommend Fernet. Here we implement reversible obfuscation suitable for demo.

def _get_enc_key() -> bytes:
    settings = get_settings()
    raw = settings.ENCRYPTION_KEY or settings.JWT_SECRET
    return hashlib.sha256(raw.encode()).digest()

def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    key = _get_enc_key()
    data = plain.encode()
    enc = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return base64.urlsafe_b64encode(enc).decode()

def decrypt_secret(cipher: str) -> str:
    if not cipher:
        return ""
    try:
        key = _get_enc_key()
        enc = base64.urlsafe_b64decode(cipher.encode())
        dec = bytes(b ^ key[i % len(key)] for i, b in enumerate(enc))
        return dec.decode()
    except Exception:
        return ""

def mask_secret(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 4:
        return "••••" + secret
    return "••••••••••••" + secret[-4:]

def mask_api_key_encrypted(encrypted: str) -> str:
    plain = decrypt_secret(encrypted)
    return mask_secret(plain) if plain else ""
