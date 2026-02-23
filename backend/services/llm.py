import os
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# We take the first key from the list in .env
api_keys = os.getenv("GOOGLE_API_KEYS", "").split(",")
api_key = api_keys[0].strip() if api_keys else os.getenv("GEMINI_API_KEY")

class LLMService:
    def __init__(self, model_name="gemini-flash-latest"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def get_answer(self, transcript: str, question: str, video_path: str = None) -> str:
        """
        Generates an answer based on transcript or video file.
        """
        if video_path and not transcript:
            return await self.process_multimodal(video_path, f"Based on this video, answer the following question: {question}")

        prompt = f"""
        You are an expert video content assistant. Your goal is to answer questions based on the video content provided below.
        
        Transcript/Content:
        {transcript}
        
        Question:
        {question}
        
        Instructions for Response:
        1. Provide a well-formatted and professional response using Markdown.
        2. Use clear spacing, bullet points, and appropriate headings (e.g., ###) to capture different aspects of the information.
        3. Bold key terms or important highlights.
        4. If the information is not in the content, provide a relevant helpful response with a temperature of 0.7.
        5. Ensure the answer is structured and easy to read at a glance.
        """
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7)
        )
        return response.text

    async def get_summary(self, transcript: str, video_path: str = None) -> str:
        """
        Generates a comprehensive summary based on transcript or video file with dynamic styles.
        """
        import random
        
        styles = [
            "an educational deep dive",
            "a storytelling narrative",
            "a technical architectural review",
            "a comprehensive investigative report",
            "a detailed chronological breakdown"
        ]
        selected_style = random.choice(styles)

        if video_path and not transcript:
            prompt = f"Provide a long, comprehensive and informative summary of this video in the style of {selected_style}. Cover all key moments and details."
            return await self.process_multimodal(video_path, prompt)

        prompt = f"""
        You are an expert content analyzer. Your task is to provide a LONG, COMPREHENSIVE, and HIGHLY DETAILED summary of the YouTube video content provided below.
        
        Style Recommendation: Write this as {selected_style}.
        
        Transcript/Content:
        {transcript}
        
        Instructions:
        1. Ensure the summary is long enough to understand every major point and nuance of the video.
        2. Do NOT follow a rigid template. Use Markdown headers (###), bold text, and lists where they naturally fit to make the content deep and readable.
        3. Cover the introduction, all middle sections, and the final conclusions or takeaways.
        4. Focus on providing maximum value and clarity.
        
        Write the comprehensive summary now:
        """
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        return response.text

    async def process_multimodal(self, video_path: str, prompt: str) -> str:
        """
        Processes a video file using Gemini 1.5 Flash multimodal capabilities.
        """
        print(f"Uploading file: {video_path}")
        video_file = self.client.files.upload(path=video_path)
        
        # Wait for file to be processed
        while video_file.state.name == "PROCESSING":
            time.sleep(2)
            video_file = self.client.files.get(name=video_file.name)

        if video_file.state.name == "FAILED":
            raise Exception("Video processing failed.")

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[video_file, prompt]
        )
        
        # Cleanup: Files are stored for 48 hours by default
        return response.text

    async def general_chat(self, prompt: str, history: list = None, model_name: str = "gemini-flash-latest") -> str:
        """
        Handles general conversational questions not tied to a specific video.
        Uses the specified model. Supports multi-turn conversation history.
        """
        try:
            system_instruction = """
            You are Insight AI, a highly capable, professional, and helpful assistant. 
            Provide clear, well-structured, and easy-to-read responses using Markdown.
            Use headings (###), bold text, and bullet points where appropriate for clarity and spacing.
            """
            
            # Format history for Gemini API
            # New SDK history expects [{'role': 'user', 'parts': [{'text': ...}]}, {'role': 'model', 'parts': [{'text': ...}]}]
            formatted_history = []
            if history:
                for msg in history:
                    formatted_history.append(
                        types.Content(
                            role="user" if msg["role"] == "user" else "model",
                            parts=[types.Part.from_text(text=msg["content"])]
                        )
                    )
            
            chat = self.client.chats.create(
                model=model_name,
                history=formatted_history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7
                )
            )
            response = chat.send_message(prompt)
            return response.text
        except Exception as e:
            print(f"General chat failed: {str(e)}")
            return "I apologize, but I am currently unable to process that request."

    async def generate_title(self, history: list) -> str:
        """
        Generates a short, catchy 3-5 word title for a chat session based on conversation history.
        """
        try:
            # Format the conversation for the prompt
            context = ""
            for msg in history[:10]: # Look at first 10 messages max
                role = "User" if msg["role"] == "user" else "Assistant"
                context += f"{role}: {msg['content']}\n"

            prompt = f"Based on the following conversation snippets, create a short, catchy, and highly relevant title (3-5 words) that summarizes the main topic. Return only the title text without quotes.\n\nConversation:\n{context}\n\nTitle:"
            
            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt
            )
            return response.text.strip().replace('"', '')
        except Exception as e:
            print(f"Title generation failed: {str(e)}")
            return "General Chat"

