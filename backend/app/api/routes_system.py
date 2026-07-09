from fastapi import APIRouter
import socket

router = APIRouter()


@router.get("/network-info")
def get_network_info():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()

    return {"local_ip": ip, "port": 8000}
