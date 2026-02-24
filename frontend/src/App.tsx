import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, MessageSquare, Loader2, 
  Search, ChevronRight, Layout, Trash2,
  Youtube, History, User as UserIcon, LogOut,
  Calendar, Mail, BookOpen, Play, Home, X, Bot,
  ExternalLink, ArrowLeft, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  processVideo, askQuestion, searchVideos, getHistory, getProfile,
  ProcessVideoResponse, SearchVideo, HistoryVideo, UserProfile, sendGeneralMessage,
  getChatSessions, getSessionMessages, ChatSession,
  deleteVideo, deleteChatSession, getProcessStatus
} from './api';

interface ChatMessage {
  text: string;
  type: 'user' | 'ai';
}

type ViewState = 'workspace' | 'history' | 'profile';
type TabState = 'general_chat' | 'youtube_analysis';

interface SearchState {
  query: string;
  results: SearchVideo[];
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('workspace');
  const [activeTab, setActiveTab] = useState<TabState>('youtube_analysis');

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<ProcessVideoResponse | null>(null);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { text: "Ready for analysis! Please provide a YouTube link to begin.", type: 'ai' }
  ]);
  const [asking, setAsking] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchVideo[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchState[]>([]);
  const [searching, setSearching] = useState(false);
  
  // History and Profile state
  const [userHistory, setUserHistory] = useState<HistoryVideo[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'chats' | 'videos'>('chats');

  // General Chat state
  const [generalChatHistory, setGeneralChatHistory] = useState<ChatMessage[]>([
    { text: "Hello! I'm Insight AI. How can I assist you with your questions today?", type: 'ai' }
  ]);
  const [generalQuestion, setGeneralQuestion] = useState('');
  const [sendingGeneral, setSendingGeneral] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(() => {
    const saved = localStorage.getItem('insight_ai_session_id');
    return saved ? parseInt(saved, 10) : null;
  });
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('insight_ai_session_id', currentSessionId.toString());
    } else {
      localStorage.removeItem('insight_ai_session_id');
    }
  }, [currentSessionId]);

  const generalChatEndRef = useRef<HTMLDivElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    generalChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generalChatHistory]);

  useEffect(() => {
    if (activeView === 'history') fetchHistory();
    if (activeView === 'profile') fetchProfile();
  }, [activeView]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const [videos, sessions] = await Promise.all([
        getHistory(),
        getChatSessions()
      ]);
      setUserHistory(videos);
      setChatSessions(sessions);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleProcess = async (targetUrl?: string, reloadData?: any) => {
    if (reloadData) {
        setVideoData(reloadData);
        setChatHistory([{ text: "Reloaded from history. What would you like to know?", type: 'ai' }]);
        setActiveView('workspace');
        return;
    }

    const finalUrl = targetUrl || url;
    if (!finalUrl.trim()) return;
    
    setLoading(true);
    setProcessStatus('Initializing...');
    setError(null);
    setVideoData(null);
    if (targetUrl) setUrl(targetUrl);
    
    let pollInterval: any;
    try {
      // Start polling for progress status
      pollInterval = setInterval(async () => {
          try {
              const res = await getProcessStatus(finalUrl);
              if (res.status && res.status !== "Idle" && res.status !== "Unknown") {
                  setProcessStatus(res.status);
              }
          } catch (e) {
              // Ignore polling errors to not interrupt the main flow
          }
      }, 1500);

      const data = await processVideo(finalUrl);
      setVideoData(data);
      setChatHistory([{ text: "Analysis complete. I'm ready for your questions!", type: 'ai' }]);
      setActiveTab('youtube_analysis');
      setActiveView('workspace');

      // Dynamically populate Discover Videos sidebar based on the analyzed video
      if (data.title) {
          try {
              // Optionally update the search bar to reflect the current context
              setSearchQuery(data.title); 
              setSearching(true);
              const relatedResults = await searchVideos(data.title, 10);
              setSearchResults(relatedResults);
              // Add to history so user can navigate back
              setSearchHistory(prev => [...prev, { query: data.title, results: relatedResults }]);
          } catch (searchErr) {
              console.error("Failed to fetch related videos for sidebar:", searchErr);
          } finally {
              setSearching(false);
          }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error processing video. Make sure the backend is running.");
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setLoading(false);
      setProcessStatus('');
    }
  };

  const handleDeleteVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video from your history?')) return;
    
    try {
      await deleteVideo(videoId);
      setUserHistory(prev => prev.filter(v => v.video_id !== videoId));
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Error deleting video from history');
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      await deleteChatSession(sessionId);
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setGeneralChatHistory([{ text: "Hello! I'm Insight AI. How can I assist you with your questions today?", type: 'ai' }]);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error deleting chat session');
    }
  };

  const handleSearch = async (isNewSearch = true) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchVideos(searchQuery, 10);
      setSearchResults(results);
      if (isNewSearch) {
        setSearchHistory(prev => [...prev, { query: searchQuery, results: results }]);
      }
      setActiveTab('youtube_analysis');
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleBackSearch = () => {
    if (searchHistory.length <= 1) {
      setSearchHistory([]);
      setSearchResults([]);
      setSearchQuery('');
      return;
    }
    const newHistory = [...searchHistory];
    newHistory.pop(); // Remove current
    const previous = newHistory[newHistory.length - 1];
    setSearchHistory(newHistory);
    setSearchQuery(previous.query);
    setSearchResults(previous.results);
  };

  const handleLoadMore = async () => {
    if (searching) return;
    setSearching(true);
    try {
      const moreResults = await searchVideos(searchQuery, 10);
      setSearchResults(prev => [...prev, ...moreResults]);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      handleLoadMore();
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    localStorage.removeItem('insight_ai_session_id');
    setGeneralChatHistory([{ text: "New conversation started. How can I help you today?", type: 'ai' }]);
    setActiveTab('general_chat');
    setActiveView('workspace');
  };

  const loadSession = async (sessionId: number) => {
    setLoadingHistory(true);
    try {
      const messages = await getSessionMessages(sessionId);
      const formattedMessages: ChatMessage[] = [];
      messages.forEach(m => {
        formattedMessages.push({ text: m.question, type: 'user' });
        formattedMessages.push({ text: m.answer, type: 'ai' });
      });
      setGeneralChatHistory(formattedMessages);
      setCurrentSessionId(sessionId);
      setActiveTab('general_chat');
      setActiveView('workspace');
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendGeneral = async () => {
    if (!generalQuestion.trim() || sendingGeneral) return;

    const userQuestion = generalQuestion;
    setGeneralChatHistory(prev => [...prev, { text: userQuestion, type: 'user' }]);
    setGeneralQuestion('');
    setSendingGeneral(true);

    try {
      const data = await sendGeneralMessage(userQuestion, selectedModel, currentSessionId || undefined);
      if (!currentSessionId) setCurrentSessionId(data.session_id);
      
      setGeneralChatHistory(prev => [...prev, { text: data.answer, type: 'ai' }]);
    } catch (error) {
      setGeneralChatHistory(prev => [...prev, { text: 'Sorry, I encountered an error. Please try again later.', type: 'ai' }]);
    } finally {
      setSendingGeneral(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || !videoData) return;
    const currentQuestion = question;
    setQuestion('');
    setChatHistory(prev => [...prev, { text: currentQuestion, type: 'user' }]);
    setAsking(true);

    try {
      const data = await askQuestion(videoData.video_id, currentQuestion);
      setChatHistory(prev => [...prev, { text: data.answer, type: 'ai' }]);
    } catch (error) {
      console.error(error);
      setChatHistory(prev => [...prev, { text: "Sorry, I encountered an error answering your question.", type: 'ai' }]);
    } finally {
      setAsking(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderWorkspace = () => (
    <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Analysis */}
        <div className="flex-1 flex flex-col border-r border-white/5 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                {loading && !videoData ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin relative z-10" />
                        </div>
                        <div>
                            <h3 className="outfit text-xl font-bold text-slate-200 tracking-tight">Processing Intelligence</h3>
                            <p className="text-blue-400/80 mt-2 font-medium">{processStatus || "Decoding video signals..."}</p>
                        </div>
                    </div>
                ) : videoData ? (
                    <div className="max-w-2xl mx-auto pb-20">
                        <header className="mb-8 flex items-start justify-between border-b border-white/5 pb-6">
                          <div>
                            <h3 className="outfit text-2xl font-bold text-slate-200">Video Analysis Summary</h3>
                          </div>
                          <a 
                            href={`https://www.youtube.com/watch?v=${videoData?.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                          >
                            <ExternalLink className="w-3 h-3" /> YouTube
                          </a>
                        </header>

                        <div className="prose prose-invert prose-purple max-w-none">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h3: ({node, ...props}) => <h3 className="outfit text-xl font-bold mt-6 mb-3 text-purple-400" {...props} />,
                                    p: ({node, ...props}) => <p className="text-slate-300 leading-relaxed mb-4 text-sm font-light" {...props} />,
                                    li: ({node, ...props}) => <li className="text-slate-300 mb-2 list-disc ml-4 text-sm" {...props} />,
                                }}
                            >
                                {videoData?.summary || ''}
                            </ReactMarkdown>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-6 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/10">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                            <h3 className="outfit text-xl font-bold text-slate-200 mb-2">Analysis Failed</h3>
                            <p className="text-red-400/80 text-sm leading-relaxed font-medium bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                                {error}
                            </p>
                            <button 
                                onClick={() => { setError(null); setUrl(''); }}
                                className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/5 active:scale-95"
                            >
                                Try Another Video
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-6">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                            <Youtube className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="outfit text-xl font-bold text-slate-200 mb-2">How to use AI Analysis</h3>
                            <p className="text-slate-400 text-sm leading-relaxed font-light">
                                To start analyzing, paste a YouTube URL in the search bar above or search for a video in the sidebar. 
                                Once processed, the summary will appear here and you can ask specific questions in the chat panel.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right Side: Chat */}
        <div className="w-[600px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-700 bg-slate-900/10">
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-slate-950/20">
            {chatHistory.map((msg, i) => (
            <div 
                key={i} 
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                <div 
              className={`max-w-[85%] p-3.5 rounded-[20px] text-sm leading-relaxed shadow-sm transition-all hover:scale-[1.01] ${
                  msg.type === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-slate-900/80 border border-white/5 text-slate-300 rounded-tl-none'
              }`}
              >
              {msg.type === 'user' ? msg.text : (
                <div className="prose prose-invert prose-p:text-sm prose-p:leading-relaxed text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>
              )}
              </div>
            </div>
            ))}
            <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-slate-900/40 border-t border-white/5">
            <div className="relative">
            <input 
                type="text" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-5 pr-14 py-2.5 text-sm focus:outline-none focus:border-purple-600 transition-all placeholder:text-slate-700 shadow-inner"
                placeholder="Consult the AI about this video..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                disabled={asking || !videoData}
            />
            <button 
                className="absolute right-2 top-2 bottom-2 aspect-square bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:scale-100 active:scale-95 shadow-lg shadow-purple-600/20"
                onClick={handleAsk}
                disabled={asking || !question.trim() || !videoData}
            >
                {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
            </div>
        </div>
        </div>
    </div>
  );

  const renderHistory = () => (
    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="outfit text-4xl font-bold mb-2">Workspace History</h2>
                <p className="text-slate-400 text-sm">Review your previously analyzed video insights and past AI chats.</p>
            </div>
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setActiveView('workspace')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-lg border border-white/5"
                    title="Close History"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* History Tabs & Search bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-white/10">
            <div className="flex gap-4">
                <button
                    onClick={() => setHistoryTab('chats')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                        historyTab === 'chats' 
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                        : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" /> Chats
                </button>
                <button
                    onClick={() => setHistoryTab('videos')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                        historyTab === 'videos' 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                        : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                    }`}
                >
                    <Youtube className="w-4 h-4" /> Videos
                </button>
            </div>
            
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                    type="text"
                    placeholder={`Search ${historyTab === 'chats' ? 'chats' : 'videos'}...`}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-600"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
            </div>
        </div>

        {loadingHistory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-64 bg-slate-900/40 border border-white/5 rounded-3xl animate-pulse" />
                ))}
            </div>
        ) : historyTab === 'videos' ? (
            userHistory.filter(v => v.title.toLowerCase().includes(historySearchQuery.toLowerCase()) || v.video_id.toLowerCase().includes(historySearchQuery.toLowerCase())).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userHistory
                        .filter(v => v.title.toLowerCase().includes(historySearchQuery.toLowerCase()) || v.video_id.toLowerCase().includes(historySearchQuery.toLowerCase()))
                        .map(item => (
                        <div 
                            key={item.video_id} 
                            className="group glass-panel rounded-3xl overflow-hidden hover:border-purple-500/30 transition-all flex flex-col cursor-pointer"
                            onClick={() => handleProcess(undefined, item)}
                        >
                            <div className="p-6 flex-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest">
                                    <Calendar className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString()}
                                </div>
                                <h3 className="font-semibold text-slate-200 line-clamp-2 mb-4 group-hover:text-purple-400 transition-colors">
                                    {item.title || item.video_id}
                                </h3>
                                <p className="text-xs text-slate-400 line-clamp-4 font-light leading-relaxed">
                                    {item.summary?.substring(0, 150)}...
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-blue-400">ANALYZED</span>
                                    <button 
                                        onClick={(e) => handleDeleteVideo(e, item.video_id)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-all"
                                        title="Delete History"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <Play className="w-3 h-3 text-slate-400 group-hover:text-purple-400 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-40 bg-slate-900/20 rounded-3xl border border-dashed border-white/10">
                    <History className="w-16 h-16 text-slate-800 mb-6" />
                    <p className="text-slate-500">
                        {historySearchQuery ? "No matching videos found." : "Your video history is empty. Try analyzing a video first!"}
                    </p>
                </div>
            )
        ) : (
            chatSessions.filter(s => s.title.toLowerCase().includes(historySearchQuery.toLowerCase())).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {chatSessions
                        .filter(s => s.title.toLowerCase().includes(historySearchQuery.toLowerCase()))
                        .map(session => (
                        <div 
                            key={session.id} 
                            className="group glass-panel rounded-3xl overflow-hidden hover:border-blue-500/40 transition-all flex flex-col cursor-pointer bg-slate-900/40"
                            onClick={() => loadSession(session.id)}
                        >
                            <div className="p-6 flex-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest">
                                    <MessageSquare className="w-3 h-3 text-purple-400" /> {new Date(session.created_at).toLocaleDateString()}
                                </div>
                                <h3 className="font-semibold text-slate-200 line-clamp-2 mb-4 group-hover:text-blue-400 transition-colors">
                                    {session.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                    <Clock className="w-3 h-3" /> {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-purple-400">CHAT SESSION</span>
                                    <button 
                                        onClick={(e) => handleDeleteSession(e, session.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-all"
                                        title="Delete Session"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-40 bg-slate-900/20 rounded-3xl border border-dashed border-white/10">
                    <MessageSquare className="w-16 h-16 text-slate-800 mb-6" />
                    <p className="text-slate-500">
                        {historySearchQuery ? "No matching chats found." : "No chat history found. Start a new conversation!"}
                    </p>
                </div>
            )
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar animate-in zoom-in-95 duration-500">
        <div className="max-w-3xl mx-auto">
            <div className="glass-panel rounded-[40px] p-12 border-white/5 relative overflow-hidden">
                <div className="absolute top-8 right-8 z-20">
                    <button 
                        onClick={() => setActiveView('workspace')}
                        className="p-2 rounded-xl bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-white/5 backdrop-blur-md"
                        title="Close Profile"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[100px] -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] -ml-32 -mb-32" />
                
                <div className="relative flex flex-col items-center">
                    <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-tr from-purple-600 to-blue-600 mb-8">
                        <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden border-4 border-slate-950">
                            <img src={profile?.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <h2 className="outfit text-4xl font-extrabold mb-2 tracking-tight">{profile?.full_name}</h2>
                    <p className="text-purple-400 font-medium mb-8">@{profile?.username}</p>

                    <div className="grid grid-cols-3 gap-8 w-full mb-12 border-y border-white/5 py-8">
                        <div className="text-center">
                            <div className="text-2xl font-bold outfit mb-1">{userHistory.length}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Videos Analyzed</div>
                        </div>
                        <div className="text-center border-x border-white/5">
                            <div className="text-2xl font-bold outfit mb-1">PRO</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plan Status</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold outfit mb-1">2026</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Member Since</div>
                        </div>
                    </div>

                    <div className="w-full space-y-8">
                        <section>
                            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                <BookOpen className="w-4 h-4 text-blue-400" /> Biography
                            </h4>
                            <p className="text-slate-300 leading-relaxed font-light bg-white/5 p-6 rounded-2xl border border-white/5">
                                {profile?.bio}
                            </p>
                        </section>

                        <section>
                            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                <Mail className="w-4 h-4 text-purple-400" /> Account Details
                            </h4>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="text-xs text-slate-500">Email Address</span>
                                    <span className="text-xs text-slate-200 font-medium">{profile?.email}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="text-xs text-slate-500">Language</span>
                                    <span className="text-xs text-slate-200 font-medium">English (US)</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="mt-12 flex gap-4">
                        <button className="px-8 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold shadow-lg shadow-purple-600/20 hover:scale-105 transition-all">
                            Edit Profile
                        </button>
                        <button className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-50 font-sans selection:bg-purple-500/30 overflow-hidden flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
        
        :root {
          --primary: #8a2be2;
          --primary-light: #a64dff;
          --secondary: #00d2ff;
          --glass-border: rgba(255, 255, 255, 0.08);
          --glass-bg: rgba(15, 23, 42, 0.6);
        }

        body {
          font-family: 'Inter', sans-serif;
          background: radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617);
        }

        .outfit { font-family: 'Outfit', sans-serif; }
        
        .glass-panel {
          background: var(--glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255, 255, 255, 0.1); 
          border-radius: 10px; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .float { animation: float 6s ease-in-out infinite; }
      `}</style>

      {/* Navigation / Header */}
      <nav className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-slate-950/40 backdrop-blur-md z-50">
        <div 
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => setActiveView('workspace')}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
            <Youtube className="text-white w-6 h-6" />
          </div>
          <h1 className="outfit text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Insight <span className="text-purple-500">AI</span>
          </h1>
        </div>

        <div className="flex items-center bg-slate-900/40 backdrop-blur-md rounded-full p-1 shadow-lg border border-white/5">
            <button
                onClick={() => setActiveTab('general_chat')}
                className={`flex items-center py-1.5 px-4 rounded-full text-xs font-semibold transition-all ${
                    activeTab === 'general_chat'
                    ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "text-slate-400 hover:text-white"
                }`}
            >
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                Chat
            </button>
            <button
                onClick={() => setActiveTab('youtube_analysis')}
                className={`flex items-center py-1.5 px-4 rounded-full text-xs font-semibold transition-all ${
                    activeTab === 'youtube_analysis'
                    ? "bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "text-slate-400 hover:text-white"
                }`}
            >
                <Youtube className="w-3.5 h-3.5 mr-2" />
                Analysis
            </button>
        </div>

        <div className="flex-1 max-w-xl mx-8">
            <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
            </div>
            <input 
              type="text" 
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-11 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-slate-900 transition-all placeholder:text-slate-600"
              placeholder="Search YouTube or paste URL..."
              value={searchQuery || url}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setUrl(e.target.value);
              }}
              onKeyPress={(e) => e.key === 'Enter' && (searchQuery.includes('http') ? (handleProcess(), setActiveView('workspace'), setActiveTab('youtube_analysis')) : handleSearch())}
            />
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm font-medium">
          <button 
            onClick={() => setActiveView('workspace')}
            className={`transition-colors flex items-center gap-2 ${activeView === 'workspace' ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={() => setActiveView('history')}
            className={`transition-colors flex items-center gap-2 ${activeView === 'history' ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`}
          >
            <History className="w-4 h-4" /> History
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={() => setActiveView('profile')}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all overflow-hidden ${activeView === 'profile' ? 'border-purple-500 scale-110' : 'bg-slate-800 border-white/10 hover:border-slate-500'}`}
          >
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
                <UserIcon className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Search Results - Only show in YouTube Analysis tab */}
        {activeTab === 'youtube_analysis' && (
          <aside className="w-80 flex flex-col border-r border-white/5 bg-slate-950/20 animate-in slide-in-from-left duration-300">
            <div className="p-6 pb-2 flex items-center justify-between">
              <h2 className="outfit font-semibold text-slate-300 text-sm flex items-center gap-2">
                <Layout className="w-4 h-4 text-blue-400" />
                DISCOVER VIDEOS
              </h2>
              {searchHistory.length > 0 && (
                <button 
                  onClick={handleBackSearch}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  title="Back to previous search"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          
          <div 
            className="flex-1 overflow-y-auto px-4 custom-scrollbar" 
            onScroll={handleScroll}
          >
            {searching && searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <p className="text-xs text-slate-500">Retrieving results...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col gap-3 pb-8">
                {searchResults.map((video) => (
                  <div 
                    key={video.id + Math.random()} 
                    className="group bg-slate-900/30 hover:bg-slate-800/50 border border-white/5 hover:border-purple-500/20 rounded-2xl p-2 transition-all cursor-pointer"
                    onClick={() => handleProcess(video.url)}
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-2">
                      <img src={video.thumbnail || ''} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm">
                        {formatDuration(video.duration)}
                      </div>
                      <a 
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        onClick={(e) => e.stopPropagation()}
                        title="Open on YouTube"
                      >
                        <ExternalLink className="w-3 h-3 text-white" />
                      </a>
                    </div>
                    <div className="px-1">
                      <h3 className="text-[11px] font-medium text-slate-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">
                        {video.title}
                      </h3>
                    </div>
                  </div>
                ))}
                {searching && (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center px-4">
                <Search className="w-12 h-12 opacity-10 mb-4" />
                <p className="text-xs">Start a search to explore videos infinitely.</p>
              </div>
            )}
          </div>
        </aside>
        )}

        {/* Dynamic Content Area */}
        <section className="flex-1 flex flex-col relative bg-slate-900/10">
            
            {/* Top Navigation Toggle */}
            {activeView === 'workspace' && (
                <div />
            )}

            {activeView === 'history' ? renderHistory() : 
             activeView === 'profile' ? renderProfile() : 
             activeTab === 'youtube_analysis' ? renderWorkspace() :
             (
                <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                    {/* General Chat Header Area with Model Selection */}
                    <div className="flex items-center justify-end w-full px-8 py-4 mb-4 z-20 sticky top-0 bg-[#020617]/80 backdrop-blur border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleNewChat}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
                            >
                                <X className="w-3 h-3 rotate-45" /> New Chat
                            </button>
                            <div className="flex items-center gap-2 text-sm bg-slate-900 border border-white/5 rounded-xl px-2">
                                <span className="text-slate-400 pl-2">Model:</span>
                                <select 
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-transparent text-white focus:outline-none p-2 rounded-lg cursor-pointer appearance-none pr-4"
                                >
                                    <option value="gemini-2.5-flash" className="bg-slate-900">Gemini 2.5 Flash</option>
                                    <option value="gemini-2.0-flash" className="bg-slate-900">Gemini 2.0 Flash</option>
                                    <option value="gemini-2.5-pro" className="bg-slate-900">Gemini 2.5 Pro</option>
                                </select>
                                <ChevronRight className="w-4 h-4 text-slate-500 mr-2 -ml-3 pointer-events-none rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 w-full px-8 relative z-10 pb-32">

                        {generalChatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                                <div className={`flex items-start gap-4 max-w-[85%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-2xl transition-transform hover:scale-110 ${
                                        msg.type === 'user' 
                                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20' 
                                        : 'bg-gradient-to-br from-purple-600 to-fuchsia-600 shadow-purple-500/20'
                                    }`}>
                                        {msg.type === 'user' ? <UserIcon className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                                    </div>
                                    <div className={`p-3.5 rounded-[18px] shadow-2xl transition-all hover:shadow-white/5 ${
                                        msg.type === 'user' 
                                        ? 'bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 text-blue-50 rounded-tr-none' 
                                        : 'bg-slate-900/40 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md'
                                    }`}>
                                        <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:my-1 prose-pre:bg-slate-950/50 prose-pre:border prose-pre:border-white/10 prose-headings:text-slate-100 prose-strong:text-white prose-li:text-slate-300">
                                            {msg.type === 'ai' ? (
                                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                            ) : (
                                              msg.text
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sendingGeneral && (
                            <div className="flex justify-start">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>
                            </div>
                        )}
                        <div ref={generalChatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="absolute py-4 bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-20">
                        <div className="w-full relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-[20px] blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-focus-within:duration-200"></div>
                            <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-700 p-1.5 pl-6 rounded-[18px] shadow-2xl">
                                <textarea
                                    className="flex-1 bg-transparent border-none border-0 focus:border-0 text-sm focus:ring-0 focus:outline-none outline-none resize-none py-3 placeholder:text-slate-500 text-slate-200 leading-relaxed custom-scrollbar h-auto max-h-32"
                                    style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                                    placeholder="Message Insight AI..."
                                    rows={1}
                                    value={generalQuestion}
                                    onChange={(e) => {
                                        setGeneralQuestion(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendGeneral())}
                                />
                                <button 
                                    onClick={handleSendGeneral}
                                    disabled={sendingGeneral || !generalQuestion.trim()}
                                    className={`p-3 rounded-xl transition-all flex-shrink-0 mb-1 ${!generalQuestion.trim() ? 'bg-slate-800 text-slate-500' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/30'}`}
                                >
                                    {sendingGeneral ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-slate-500 mt-4 tracking-wide">Insight AI can make mistakes. Consider verifying important information.</p>
                    </div>

                    {/* Abstract Backgrounds */}
                    <div className="absolute top-1/4 -right-64 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-1/4 -left-64 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
                </div>
            )}
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="h-8 border-t border-white/5 flex items-center justify-between px-8 bg-slate-950/60 backdrop-blur-md z-50 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
        <span>© 2026 ANTIGRAVITY SYSTEMS</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 anim-pulse" /> NETWORK CONNECTED</span>
          <span className="text-purple-500/50">ENCRYPTED SESSION</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
