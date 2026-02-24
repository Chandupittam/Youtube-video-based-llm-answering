const API_BASE = "http://localhost:8000";

export interface ProcessVideoResponse {
    message: string;
    video_id: string;
    title: string;
    transcript: string;
    summary: string;
}

export interface AskQuestionResponse {
    answer: string;
}

export const processVideo = async (url: string): Promise<ProcessVideoResponse> => {
    const response = await fetch(`${API_BASE}/process-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            throw new Error("Processing failed: " + response.statusText);
        }
        throw new Error(errorData.detail || "Processing failed");
    }

    return response.json();
};

export interface ProcessStatusResponse {
    status: string;
}

export const getProcessStatus = async (url: string): Promise<ProcessStatusResponse> => {
    const response = await fetch(`${API_BASE}/process-status?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error("Failed to fetch status");
    }
    return response.json();
};

export const askQuestion = async (videoId: string, question: string): Promise<AskQuestionResponse> => {
    const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            video_id: videoId, 
            question: question 
        })
    });

    if (!response.ok) {
        throw new Error("Failed to get answer");
    }

    return response.json();
};

export interface SearchVideo {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    url: string;
}

export const searchVideos = async (query: string, limit: number = 10): Promise<SearchVideo[]> => {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) {
        throw new Error("Search failed");
    }
    return response.json();
};

export interface HistoryVideo extends ProcessVideoResponse {
    title: string;
    created_at: string;
}

export const getHistory = async (): Promise<HistoryVideo[]> => {
    const response = await fetch(`${API_BASE}/history`);
    if (!response.ok) {
        throw new Error("Failed to fetch history");
    }
    return response.json();
};

export interface UserProfile {
    username: string;
    full_name: string;
    email: string;
    bio: string;
    avatar_url: string;
}

export const getProfile = async (): Promise<UserProfile> => {
    const response = await fetch(`${API_BASE}/profile`);
    if (!response.ok) {
        throw new Error("Failed to fetch profile");
    }
    return response.json();
};

export interface ChatSession {
    id: number;
    title: string;
    created_at: string;
}

export const createChatSession = async (): Promise<ChatSession> => {
    const response = await fetch(`${API_BASE}/chat-sessions`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error("Failed to create session");
    return response.json();
};

export const getChatSessions = async (): Promise<ChatSession[]> => {
    const response = await fetch(`${API_BASE}/chat-sessions`);
    if (!response.ok) throw new Error("Failed to fetch sessions");
    return response.json();
};

export const getSessionMessages = async (sessionId: number): Promise<GeneralChatHistoryItem[]> => {
    const response = await fetch(`${API_BASE}/chat-sessions/${sessionId}/messages`);
    if (!response.ok) throw new Error("Failed to fetch messages");
    return response.json();
};

export const sendGeneralMessage = async (
    message: string, 
    model: string = "gemini-2.5-flash", 
    sessionId?: number
): Promise<{answer: string, session_id: number, session_title: string}> => {
    const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model, session_id: sessionId })
    });
    if (!response.ok) {
        throw new Error("Failed to send message");
    }
    return response.json();
};

export interface GeneralChatHistoryItem {
    id: number;
    session_id: number;
    question: string;
    answer: string;
    created_at: string;
}

export const getGeneralChatHistory = async (): Promise<GeneralChatHistoryItem[]> => {
    const response = await fetch(`${API_BASE}/chat-history`);
    if (!response.ok) {
        throw new Error("Failed to fetch general chat history");
    }
    return response.json();
};
export const deleteVideo = async (videoId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/videos/${videoId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error("Failed to delete video");
};

export const deleteChatSession = async (sessionId: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/chat-sessions/${sessionId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error("Failed to delete chat session");
};
