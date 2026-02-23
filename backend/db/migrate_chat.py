from backend.db.database import engine, Base
from backend.db.models import GeneralChatHistory, ChatSession

def migrate():
    print("Dropping chat tables...")
    GeneralChatHistory.__table__.drop(engine, checkfirst=True)
    ChatSession.__table__.drop(engine, checkfirst=True)
    
    print("Creating chat tables with new schema...")
    ChatSession.__table__.create(engine)
    GeneralChatHistory.__table__.create(engine)
    
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
