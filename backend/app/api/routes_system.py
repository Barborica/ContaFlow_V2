import json
import socket
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from fastapi import status
from fastapi.exceptions import HTTPException

from app.api.deps import get_current_user
from app.db.models import User

router = APIRouter()


def _get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


@router.get("/network-info")
def get_network_info():
    return {"local_ip": _get_local_ip(), "port": 8000}


@router.get("/qr")
def get_qr_code(
    request: Request,
    server_url: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """Generate a QR code containing server URL and auth token for the mobile app."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    if not server_url:
        server_url = f"http://{_get_local_ip()}:8000"

    payload = json.dumps({"server_url": server_url, "token": token})
    img = qrcode.make(payload)

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")
