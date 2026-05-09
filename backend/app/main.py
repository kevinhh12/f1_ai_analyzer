from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.f1 import router as f1_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(f1_router)


