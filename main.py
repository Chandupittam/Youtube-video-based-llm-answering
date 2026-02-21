from fastapi import FastAPI
from db import engine, Base
from router import router
import uvicorn

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="YouTube Q&A API")

app.include_router(router)

@app.get("/")
async def root():
    return {"message": "Welcome to YouTube Q&A API. Use /process-video and /ask endpoints."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
