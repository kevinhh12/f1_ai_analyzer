from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {
        "message": "F1 AI Analyzer backend is running",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health():
    return {"status": "ok"}