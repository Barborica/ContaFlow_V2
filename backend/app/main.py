import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes_auth import router as auth_router
from app.api.routes_system import router as system_router
from app.api.routes_receipts import router as receipts_router
from app.api.routes_clients import router as clients_router
from app.api.routes_ws import router as ws_router
from app.services.processing import worker as processing_worker, warmup_ocr


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up OCR model, start the background worker, cancel it on shutdown."""
    await warmup_ocr()
    task = asyncio.create_task(processing_worker())
    yield
    task.cancel()


app = FastAPI(
    title="ContaFlow API",
    description="API for automating processing for SAGA",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [
    "*",  # In future, change * with exact web address of the app
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Permit GET, POST, PUT, etc.
    allow_headers=["*"],  # Permit any headers (auth tokens)
)

# Connect routes
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autentificare"])
app.include_router(system_router, prefix="/api/v1/system", tags=["Sistem"])
app.include_router(receipts_router, prefix="/api/v1/receipts", tags=["Bonuri fiscale"])
app.include_router(clients_router, prefix="/api/v1/clients", tags=["Clienți"])
app.include_router(ws_router, tags=["WebSocket"])

# Serve temp uploaded images as static files
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "temp")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads/temp", StaticFiles(directory=UPLOAD_DIR), name="temp_uploads")


@app.get("/")
def health_check():
    return {
        "status": "online",
        "message": "Welcome to ContaFlow API!",
        "database": "connected",
    }
