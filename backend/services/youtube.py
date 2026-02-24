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
        Fetches the transcript for a given video ID.
        Returns None if no transcript is available.
        """
        try:
            # In version 1.2.4, we need to instantiate the API
            api = YouTubeTranscriptApi()
            
            # Use .list() instead of .list_transcripts() if available, 
            # or fallback to standard methods if it's a different version
            if hasattr(api, 'list'):
                transcript_list = api.list(video_id)
            elif hasattr(YouTubeTranscriptApi, 'list_transcripts'):
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            else:
                # Direct fetch fallback
                data = YouTubeTranscriptApi.get_transcript(video_id)
                return " ".join([item.get('text', '') for item in data])

            # Try to find English manual or auto-generated transcript
            try:
                transcript = transcript_list.find_transcript(['en', 'en-US'])
            except:
                # Fallback to the first available transcript
                transcript = next(iter(transcript_list))
            
            data = transcript.fetch()
            text_parts = [item.get('text', '') for item in data if isinstance(item, dict)]
            return " ".join(text_parts)
        except Exception as e:
            print(f"Transcript fetch failed for {video_id}: {str(e)}")
            return None

    @staticmethod
    def download_video(video_id: str, progress_hooks: list = None) -> str:
        """
        Downloads a low-quality version of the video for processing.
        Returns the path to the downloaded file.
        """
        import yt_dlp
        import os

        # Create downloads directory if it doesn't exist
        os.makedirs("downloads", exist_ok=True)
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        output_template = f"downloads/{video_id}.%(ext)s"
        
        ydl_opts = {
            'format': 'best[height<=480]', # Lower resolution to save bandwidth/time
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
        }
        
        if progress_hooks:
            ydl_opts['progress_hooks'] = progress_hooks
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=True)
                return ydl.prepare_filename(info)
            except Exception as e:
                error_msg = str(e)
                if "not available" in error_msg or "Video unavailable" in error_msg or "Incomplete YouTube ID" in error_msg or "deleted" in error_msg.lower():
                    raise ValueError(f"YouTube video '{video_id}' is unavailable or invalid.")
                raise e

    @staticmethod
    def get_video_info(video_id: str) -> dict:
        """
        Fetches metadata for a given video ID using yt-dlp.
        """
        import yt_dlp
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnails', [{}])[0].get('url') if info.get('thumbnails') else None,
                    'duration': info.get('duration')
                }
            except Exception as e:
                error_msg = str(e)
                print(f"Failed to fetch video info: {error_msg}")
                if "not available" in error_msg or "Video unavailable" in error_msg or "Incomplete YouTube ID" in error_msg or "deleted" in error_msg.lower():
                    raise ValueError(f"YouTube video '{video_id}' is unavailable or invalid.")
                return {}

    @staticmethod
    def search_videos(query: str, limit: int = 5) -> list:
        """
        Searches for videos on YouTube using yt-dlp, with randomization for variety.
        """
        import yt_dlp
        import random
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'force_generic_extractor': False,
        }
        
        # Fetch a larger pool of results to allow for randomization
        fetch_limit = 20
        search_query = f"ytsearch{fetch_limit}:{query}"
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                result = ydl.extract_info(search_query, download=False)
                
                videos = []
                if 'entries' in result:
                    for entry in result['entries']:
                        if entry:
                            videos.append({
                                'id': entry.get('id'),
                                'title': entry.get('title'),
                                'thumbnail': entry.get('thumbnails', [{}])[0].get('url') if entry.get('thumbnails') else None,
                                'duration': entry.get('duration'),
                                'url': f"https://www.youtube.com/watch?v={entry.get('id')}"
                            })
                
                # Shuffle the results and return the requested limit
                random.shuffle(videos)
                return videos[:limit]
            except Exception as e:
                print(f"Search failed: {str(e)}")
                return []
