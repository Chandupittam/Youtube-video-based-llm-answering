from pydantic import BaseModel

class VideoRequest(BaseModel):
    url: str

class QARequest(BaseModel):
    video_id: str
    question: str

class ChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"
    session_id: int = None
