import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# We take the first key from the list in .env
api_keys = os.getenv("GOOGLE_API_KEYS", "").split(",")
if api_keys:
    genai.configure(api_key=api_keys[0].strip())

class LLMService:
    def __init__(self, model_name="gemini-pro-latest"):
        self.model = genai.GenerativeModel(model_name)

    async def get_answer(self, transcript: str, question: str) -> str:
        """
        Generates an answer based on the provided transcript and question.
        """
        prompt = f"""
        You are a helpful assistant that answers questions based on a YouTube video transcript.
        
        Transcript:
        {transcript}
        
        Question:
        {question}
        
        Answer the question accurately based ONLY on the provided transcript. If the information is not in the transcript, say that you don't know.
        """
        response = self.model.generate_content(prompt)
        return response.text

    async def get_summary(self, transcript: str) -> str:
        """
        Generates a concise summary of the provided transcript.
        """
        prompt = f"""
        You are a helpful assistant that summarizes YouTube video transcripts.
        
        Transcript:
        {transcript}
        
        Provide a concise and informative summary of the video based on the transcript above. Use bullet points for key takeaways.
        """
        response = self.model.generate_content(prompt)
        return response.text
