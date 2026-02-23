import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Video, QAHistory, User, GeneralChatHistory
from backend.schemas.schemas import VideoRequest, QARequest, ChatRequest
from backend.services.youtube import YouTubeService
from backend.services.llm import LLMService

router = APIRouter()
llm_service = LLMService()

@router.post("/process-video")
async def process_video(request: VideoRequest, db: Session = Depends(get_db)):
    try:
        video_id = YouTubeService.extract_video_id(request.url)
        
        # Check if video already processed
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
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

        # 1. Attempt to get transcript
        transcript = YouTubeService.get_transcript(video_id)
        video_path = None
        
        # Get video metadata (title)
        video_info = YouTubeService.get_video_info(video_id)
        video_title = video_info.get('title') or f"Video {video_id}"

        if not transcript:
            # 2. Fallback to Multimodal (STT or Visual)
            try:
                video_path = YouTubeService.download_video(video_id)
                # For summary, we use the video file directly
                summary = await llm_service.get_summary(None, video_path=video_path)
                # We can also try to get a "transcript" description from the video
                transcript = await llm_service.process_multimodal(video_path, "Provide a detailed transcription or description of the video content (speech or visual).")
            except Exception as e:
                print(f"Multimodal processing failed: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")
        else:
            # Regular summary from transcript
            summary = await llm_service.get_summary(transcript)

        new_video = Video(
            video_id=video_id,
            title=video_title,
            transcript=transcript,
            summary=summary
        )
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        # Cleanup video file if it exists
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
            
        return {
            "message": "Video processed successfully", 
            "video_id": video_id,
            "transcript": transcript,
            "summary": summary
        }
    except HTTPException as e:
        raise e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/search")
async def search_videos(q: str, limit: int = 10):
    if not q:
        raise HTTPException(status_code=400, detail="Search query is required")
    try:
        results = YouTubeService.search_videos(q, limit=limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@router.get("/history")
async def get_history(db: Session = Depends(get_db)):
    videos = db.query(Video).order_by(Video.created_at.desc()).all()
    return videos

@router.get("/profile")
async def get_profile(db: Session = Depends(get_db)):
    # Simple mock user implementation
    user = db.query(User).filter(User.username == "chandu").first()
    if not user:
        user = User(
            username="chandu",
            full_name="Chandu Pttam",
            email="chandu@example.com",
            bio="AI Enthusiast and Full-stack Developer. Exploring the intersection of LLMs and Video content.",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Chandu"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

from backend.db.models import Video, QAHistory, User, GeneralChatHistory, ChatSession

# ... existing routes ...

@router.post("/chat-sessions")
async def create_chat_session(db: Session = Depends(get_db)):
    session = ChatSession(title="New Chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/chat-sessions")
async def get_chat_sessions(db: Session = Depends(get_db)):
    return db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()

@router.get("/chat-sessions/{session_id}/messages")
async def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    return db.query(GeneralChatHistory).filter(GeneralChatHistory.session_id == session_id).order_by(GeneralChatHistory.created_at.asc()).all()

@router.post("/chat")
async def general_chat(request: ChatRequest, db: Session = Depends(get_db)):
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # If no session_id, we'll create one but ONLY commit if LLM succeed
    session_id = request.session_id
    session = None
    
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch history if session exists
    history = []
    if session_id:
        history_entries = db.query(GeneralChatHistory).filter(GeneralChatHistory.session_id == session_id).order_by(GeneralChatHistory.created_at.asc()).all()
        for entry in history_entries:
            history.append({"role": "user", "content": entry.question})
            history.append({"role": "ai", "content": entry.answer})

    try:
        answer = await llm_service.general_chat(request.message, history=history, model_name=request.model)
        
        # Now create session if needed
        if not session_id:
            session = ChatSession(title="New Chat")
            db.add(session)
            db.commit()
            db.refresh(session)
            session_id = session.id
        
        # Save to history
        chat_history = GeneralChatHistory(
            session_id=session_id,
            question=request.message,
            answer=answer
        )
        db.add(chat_history)
        db.commit()

        # Update title after 5 messages (or if it's still 'New Chat')
        all_msgs = db.query(GeneralChatHistory).filter(GeneralChatHistory.session_id == session_id).all()
        if len(all_msgs) == 1 or len(all_msgs) == 5:
            # Analyze all current messages for better context
            history_context = []
            for m in all_msgs:
                history_context.append({"role": "user", "content": m.question})
                history_context.append({"role": "ai", "content": m.answer})
            
            session.title = await llm_service.generate_title(history_context)
            db.commit()
        
        return {"answer": answer, "session_id": session_id, "session_title": session.title}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat-history")
async def get_general_chat_history(db: Session = Depends(get_db)):
    # Legacy endpoint for backward compatibility if needed, but we'll use sessions now
    history = db.query(GeneralChatHistory).order_by(GeneralChatHistory.created_at.asc()).all()
    return history
