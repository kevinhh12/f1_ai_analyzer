from fastapi import FastAPI
from app.controllers.f1_data_controller import router as f1_router

app = FastAPI()
app.include_router(f1_router, prefix="/api")


