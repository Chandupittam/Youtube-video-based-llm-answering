from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db import get_db
from models import Video, QAHistory
from youtube_service import YouTubeService
from llm_service import LLMService

router = APIRouter()
llm_service = LLMService()

class VideoRequest(BaseModel):
    url: str

class QARequest(BaseModel):
    video_id: str
    question: str

@router.post("/process-video")
async def process_video(request: VideoRequest, db: Session = Depends(get_db)):
    try:
        video_id = YouTubeService.extract_video_id(request.url)
        
        # Check if video already processed
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            # If transcript exists but summary doesn't (from previous version), generate it
            if not video.summary:
                video.summary = await llm_service.get_summary(video.transcript)
                db.commit()
                db.refresh(video)
                
            return {
                "message": "Video already processed", 
                "video_id": video_id,
                "transcript": video.transcript,
                "summary": video.summary
            }

        transcript = YouTubeService.get_transcript(video_id)
        summary = await llm_service.get_summary(transcript)
        
        new_video = Video(
            video_id=video_id,
            transcript=transcript,
            summary=summary
        )
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        return {
            "message": "Video processed successfully", 
            "video_id": video_id,
            "transcript": transcript,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ask")
async def ask_question(request: QARequest, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.video_id == request.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found. Please process the video first.")

    try:
        answer = await llm_service.get_answer(video.transcript, request.question)
        
        # Save to history
        qa_history = QAHistory(
            video_id=video.id,
            question=request.question,
            answer=answer
        )
        db.add(qa_history)
        db.commit()
        
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
