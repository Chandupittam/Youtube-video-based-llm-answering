import re
from youtube_transcript_api import YouTubeTranscriptApi
# print(f"DEBUG: YouTubeTranscriptApi type: {type(YouTubeTranscriptApi)}")
# print(f"DEBUG: YouTubeTranscriptApi dir: {dir(YouTubeTranscriptApi)}")

class YouTubeService:
    @staticmethod
    def extract_video_id(url: str) -> str:
        """
        Extracts the video ID from a YouTube URL.
        """
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'(?:be\/)([0-9A-Za-z_-]{11}).*'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        raise ValueError("Invalid YouTube URL")

    @staticmethod
    def get_transcript(video_id: str) -> str:
        """
        Fetches the transcript for a given video ID using list_transcripts.
        """
        try:
            # Instantiate the API because 'list' seems to be an instance method in this version
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            
            # Find the first available transcript (English or otherwise)
            transcript = transcript_list.find_transcript(['en', 'en-US'])
            
            # Fetch the actual data
            data = transcript.fetch()
            
            # The data might be a list of dicts or objects depending on the version
            text_parts = []
            for item in data:
                if isinstance(item, dict):
                    text_parts.append(item.get('text', ''))
                else:
                    # Try attribute access
                    text_parts.append(getattr(item, 'text', ''))
            
            return " ".join(text_parts)
        except Exception as e:
            raise Exception(f"Could not retrieve transcript: {str(e)}")
