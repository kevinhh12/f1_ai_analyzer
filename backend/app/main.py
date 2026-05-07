from fastapi import FastAPI
from app.routers.f1 import router as f1_router

app = FastAPI()
app.include_router(f1_router, prefix="/api")


