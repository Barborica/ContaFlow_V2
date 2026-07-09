from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes_auth import router as auth_router
from app.api.routes_system import router as system_router
from app.api.routes_receipts import router as receipts_router

app = FastAPI(
    title="ContaFlow API",
    description="API for automating processing for SAGA",
    version="1.0.0",
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

# Connect routes to auth, system ip and receipts
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autentificare"])
app.include_router(system_router, prefix="/api/v1/system", tags=["Sistem"])
app.include_router(receipts_router, prefix="/api/v1/receipts", tags=["Bonuri fiscale"])


@app.get("/")
def health_check():
    return {
        "status": "online",
        "message": "Welcome to ContaFlow API!",
        "database": "connected",
    }
