from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
def health_check():
    return {
        "status": "online",
        "message": "Welcome to ContaFlow API!",
        "database": "connected",
    }
