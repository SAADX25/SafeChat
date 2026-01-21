import React, { useState, useEffect, useRef, Suspense } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
// Lazy load EmojiPicker to prevent main bundle crash if import fails
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));
import { 
  Send, Settings, LogOut, Hash, Plus, User, Lock, Mail, Server, 
  MessageSquare, ChevronRight, Menu, Image as ImageIcon, Film, File, 
  Smile, Trash2, X, Mic, Music, StopCircle
} from 'lucide-react';

// Error Boundary Component to catch crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Emoji Picker Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm">
          ⚠️ Failed to load emojis.
          <button 
            className="block mt-2 text-xs underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

const SOCKET_URL = 'http://localhost:5000';
const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true
});

axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled }) => (
  <motion.button
    whileHover={{ scale: disabled ? 1 : 1.02 }}
    whileTap={{ scale: disabled ? 1 : 0.98 }}
    onClick={onClick}
    disabled={disabled}
    className={`
      w-full py-3 px-4 rounded-xl font-medium transition-all duration-200
      ${variant === 'primary' 
        ? 'bg-gradient-to-r from-neon-blue to-neon-pink text-white shadow-lg shadow-neon-blue/20' 
        : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${className}
    `}
  >
    {children}
  </motion.button>
);

const Input = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
      <Icon size={18} />
    </div>
    <input
      {...props}
      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all"
    />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await axios.post(endpoint, data);
      
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-md p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-neon-blue to-neon-pink" />
        
        <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          SafeChat X
        </h2>
        <p className="text-center text-gray-400 mb-8">
          {isLogin ? 'Welcome back, Agent.' : 'Join the network.'}
        </p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-xl mb-4 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <Input icon={User} name="username" placeholder="Username" required />
          {!isLogin && <Input icon={Mail} name="email" type="email" placeholder="Email" />}
          <Input icon={Lock} name="password" type="password" placeholder="Password" required />
          
          <Button className="mt-4" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Access System' : 'Initialize Account')}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isLogin ? "Need an account? Sign Up" : "Already have access? Login"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ProfileSettingsModal = ({ isOpen, onClose, user, onUpdate }) => {
  const [username, setUsername] = useState(user.username);
  const [color, setColor] = useState(user.color || '#ffffff');
  const [avatar, setAvatar] = useState(user.avatar);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await axios.post('/api/upload', formData);
      setAvatar(res.data.url);
    } catch (err) {
      console.error('Avatar upload failed', err);
      alert('Failed to upload avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/user/update', {
        username,
        color,
        avatar
      });
      onUpdate(res.data);
      onClose();
    } catch (err) {
      console.error('Update failed', err);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <img 
              src={avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${username}`} 
              className="w-24 h-24 rounded-full border-2 border-neon-blue object-cover" 
              alt="Profile" 
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ImageIcon className="text-white" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>
          <p className="text-sm text-gray-400">Click to change avatar</p>
        </div>

        {/* Username Section */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
          <Input 
            icon={User} 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
        </div>

        {/* Color Section */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Username Color (RGB)</label>
          <div className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <input 
              type="color" 
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border-none"
            />
            <div className="flex-1">
              <div className="text-white font-mono">{color}</div>
              <div className="text-xs text-gray-500">Pick any color from the spectrum</div>
            </div>
            <div className="px-3 py-1 rounded bg-black/20 text-sm font-bold" style={{ color: color }}>
              Preview
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  );
};

const ChannelList = ({ user, channels, activeChannel, onSelectChannel, onCreateChannel, onOpenSettings, onDeleteChannel, onLogout }) => {
  return (
    <div className="w-64 glass-panel h-full flex flex-col border-r-0 z-10">
      <div className="p-4 font-bold text-lg flex items-center gap-2">
        <Server size={18} className="text-neon-blue" />
        <span>SafeChat Hub</span>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="flex justify-between items-center px-2 mt-4 mb-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Channels</div>
          <button 
            onClick={onCreateChannel}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
            title="Create Channel"
          >
            <Plus size={14} />
          </button>
        </div>
        
        {channels.map(channel => (
          <div 
            key={channel._id || channel.name} 
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group transition-all duration-200 mb-1
              ${activeChannel?._id === channel._id 
                ? 'bg-neon-blue/10 text-white shadow-[0_0_15px_rgba(0,243,255,0.1)] border border-neon-blue/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'}
            `}
          >
            <div 
              className="flex items-center gap-2 flex-1 overflow-hidden"
              onClick={() => onSelectChannel(channel)}
            >
              <Hash size={16} className={`${activeChannel?._id === channel._id ? 'text-neon-blue' : 'text-gray-600 group-hover:text-gray-400'}`} />
              <span className="truncate">{channel.name}</span>
            </div>
            
            {channel.name !== 'general' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChannel(channel._id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded transition-all"
                title="Delete Channel"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-3 bg-black/20 flex items-center gap-3">
        <div className="relative">
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full border border-neon-blue/30 object-cover" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="font-bold text-sm truncate" style={{ color: user.color }}>{user.username}</div>
          <div className="text-xs text-gray-500 truncate">Online</div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={onOpenSettings}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button 
            onClick={onLogout}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const AttachmentMenu = ({ onSelect, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="absolute bottom-16 left-4 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/5 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1 min-w-[160px]"
    >
      <button onClick={() => onSelect('image')} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all text-left group">
        <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
          <ImageIcon size={18} className="text-purple-400" />
        </div>
        <span className="font-medium">Image</span>
      </button>
      <button onClick={() => onSelect('video')} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all text-left group">
        <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
          <Film size={18} className="text-red-400" />
        </div>
        <span className="font-medium">Video</span>
      </button>
      <button onClick={() => onSelect('audio')} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all text-left group">
        <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
          <Music size={18} className="text-green-400" />
        </div>
        <span className="font-medium">Audio</span>
      </button>
      <button onClick={() => onSelect('file')} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all text-left group">
        <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
          <File size={18} className="text-blue-400" />
        </div>
        <span className="font-medium">File</span>
      </button>
    </motion.div>
  );
};

const ChatArea = ({ user, socket, activeChannel }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (!activeChannel) return;

    const loadMessages = async () => {
      try {
        const res = await axios.get(`/api/messages?channelId=${activeChannel._id}`);
        setMessages(res.data);
      } catch (err) { console.error(err); }
    };
    loadMessages();
  }, [activeChannel]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg) => {
      if (msg.channelId === activeChannel?._id) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    const handleMessageDeleted = (msgId) => {
      setMessages(prev => prev.filter(m => m._id !== msgId));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('system_message', (msg) => {
      setMessages(prev => [...prev, { ...msg, _id: Date.now(), type: 'system' }]);
    });

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('system_message');
    };
  }, [socket, activeChannel]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChannel) return;
    
    socket.emit('send_message', { 
      text: input,
      channelId: activeChannel._id 
    });
    setInput('');
    setShowEmoji(false);
  };

  const handleFileSelect = (type) => {
    if (fileInputRef.current) {
      switch(type) {
        case 'image': fileInputRef.current.accept = "image/*"; break;
        case 'video': fileInputRef.current.accept = "video/*"; break;
        case 'audio': fileInputRef.current.accept = "audio/*"; break;
        default: fileInputRef.current.accept = "*";
      }
      fileInputRef.current.click();
    }
    setShowAttachments(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChannel) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData);
      socket.emit('send_message', {
        text: '',
        fileUrl: res.data.url,
        fileName: res.data.name,
        type: res.data.type,
        channelId: activeChannel._id
      });
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const audioFile = new File([audioBlob], "voice-message.mp3", { type: 'audio/mp3' });
        
        const formData = new FormData();
        formData.append('file', audioFile);

        try {
          const res = await axios.post('/api/upload', formData);
          socket.emit('send_message', {
            text: '',
            fileUrl: res.data.url,
            fileName: 'Voice Message',
            type: 'audio',
            channelId: activeChannel._id
          });
        } catch (err) {
          console.error('Voice upload failed', err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteMessage = (msgId) => {
    if (confirm('Are you sure you want to delete this message?')) {
      socket.emit('delete_message', msgId);
    }
  };

  const onEmojiClick = (emojiData) => {
    setInput(prev => prev + emojiData.emoji);
  };

  if (!activeChannel) return (
    <div className="flex-1 flex items-center justify-center text-gray-500">
      Select a channel to start chatting
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-black/20 relative">
      {/* Header */}
      <div className="h-14 flex items-center px-4 justify-between backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Hash size={20} className="text-gray-400" />
          <span className="font-bold text-white">{activeChannel.name}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-xs">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div 
            key={msg._id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-4 group ${msg.type === 'system' ? 'justify-center' : ''}`}
          >
            {msg.type === 'system' ? (
              <div className="flex items-center gap-2 text-neon-pink/80 text-sm py-2 px-4 rounded-full bg-neon-pink/5 border border-neon-pink/10">
                <span>🚀</span>
                {msg.text}
              </div>
            ) : (
              <>
                <img 
                  src={msg.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${msg.username}`} 
                  className="w-10 h-10 rounded-xl bg-white/5 object-cover" 
                  alt="" 
                />
                <div className="flex-1 max-w-2xl">
                  <div className="flex items-baseline gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold hover:underline cursor-pointer" style={{ color: msg.color || '#fff' }}>
                        {msg.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {user._id === msg.userId && (
                      <button 
                        onClick={() => deleteMessage(msg._id)}
                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-1 text-gray-300 leading-relaxed">
                    {msg.text && <p>{msg.text}</p>}
                    
                    {msg.fileUrl && (
                      <div className="mt-2">
                        {msg.type === 'image' ? (
                          <img 
                            src={msg.fileUrl} 
                            alt="Uploaded content" 
                            className="max-w-sm rounded-lg border border-white/10 hover:border-neon-blue/50 transition-colors" 
                          />
                        ) : msg.type === 'video' || msg.fileName?.match(/\.(mp4|webm|ogg)$/i) ? (
                           <video 
                             src={msg.fileUrl} 
                             controls 
                             className="max-w-sm rounded-lg border border-white/10"
                           />
                        ) : msg.type === 'audio' || msg.fileName?.match(/\.(mp3|wav|ogg)$/i) ? (
                          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 max-w-sm">
                            <div className="p-2 bg-neon-blue/10 rounded-full">
                              <Music size={20} className="text-neon-blue" />
                            </div>
                            <audio src={msg.fileUrl} controls className="h-8 w-64" />
                          </div>
                        ) : (
                          <a 
                            href={msg.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors max-w-xs"
                          >
                            <File size={24} className="text-neon-blue" />
                            <span className="truncate flex-1">{msg.fileName}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 pb-6 relative">
        {showEmoji && (
          <div className="absolute bottom-20 left-4 z-50">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-4 bg-black/80 rounded-xl text-white border border-white/10">Loading Emojis...</div>}>
                <EmojiPicker theme="dark" onEmojiClick={onEmojiClick} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
        {showAttachments && <AttachmentMenu onSelect={handleFileSelect} onClose={() => setShowAttachments(false)} />}
        
        <form 
          onSubmit={sendMessage}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-2 flex items-center gap-2 shadow-lg transition-all focus-within:shadow-neon-blue/10"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
          />
          
          <button 
            type="button" 
            onClick={() => setShowAttachments(!showAttachments)}
            className={`p-2 rounded-xl transition-all duration-200 ${showAttachments ? 'text-neon-blue bg-white/10 rotate-45' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
          >
            <Plus size={22} />
          </button>
          
          <button 
            type="button" 
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-xl transition-all duration-200 ${showEmoji ? 'text-yellow-400 bg-white/10' : 'text-gray-400 hover:text-yellow-400 hover:bg-white/10'}`}
          >
            <Smile size={22} />
          </button>

          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Message #${activeChannel.name}`}
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-gray-500 text-lg"
          />

          <button 
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-xl transition-all duration-200 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-gray-400 hover:text-red-400 hover:bg-white/10'}`}
          >
            {isRecording ? <StopCircle size={22} /> : <Mic size={22} />}
          </button>

          <button 
            type="submit" 
            disabled={!input.trim()}
            className={`p-2 rounded-xl transition-all duration-200 ${input.trim() ? 'bg-gradient-to-r from-neon-blue to-neon-blue/80 text-black shadow-lg shadow-neon-blue/20 hover:scale-105' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
          >
            <Send size={22} />
          </button>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // Initial Auth Check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch Channels
  useEffect(() => {
    if (user) {
      axios.get('/api/channels')
        .then(res => {
          setChannels(res.data);
          if (res.data.length > 0) setActiveChannel(res.data[0]);
        })
        .catch(console.error);
    }
  }, [user]);

  // Socket Connection
  useEffect(() => {
    if (user && activeChannel) {
      const handleJoin = () => {
        console.log('Joining channel:', activeChannel.name);
        socket.emit('join', { 
          userId: user._id, 
          channelId: activeChannel._id 
        });
      };

      if (!socket.connected) {
        socket.connect();
      } else {
        handleJoin();
      }

      socket.on('connect', handleJoin);

      const handleChannelCreated = (channel) => {
        setChannels(prev => [...prev, channel]);
      };

      const handleChannelDeleted = (channelId) => {
        setChannels(prev => prev.filter(c => c._id !== channelId));
        if (activeChannel?._id === channelId) {
          setActiveChannel(channels.find(c => c.name === 'general') || null);
        }
      };

      socket.on('channel_created', handleChannelCreated);
      socket.on('channel_deleted', handleChannelDeleted);

      return () => {
        socket.off('connect', handleJoin);
        socket.off('channel_created', handleChannelCreated);
        socket.off('channel_deleted', handleChannelDeleted);
      };
    }
  }, [user, activeChannel]);

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const res = await axios.post('/api/channels', { name: newChannelName });
      setNewChannelName('');
      setIsCreateChannelOpen(false);
      // Socket event will handle adding it to the list
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create channel');
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      await axios.delete(`/api/channels/${channelId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete channel');
    }
  };

  const handleUpdateProfile = (updatedUser) => {
    setUser({ ...user, ...updatedUser });
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      socket.disconnect();
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-10 h-10 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a16] text-white font-sans">
      <ChannelList 
        user={user} 
        channels={channels} 
        activeChannel={activeChannel}
        onSelectChannel={setActiveChannel}
        onCreateChannel={() => setIsCreateChannelOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDeleteChannel={handleDeleteChannel}
        onLogout={handleLogout}
      />
      <ChatArea user={user} socket={socket} activeChannel={activeChannel} />
      
      <Modal 
        isOpen={isCreateChannelOpen} 
        onClose={() => setIsCreateChannelOpen(false)}
        title="Create New Channel"
      >
        <form onSubmit={handleCreateChannel}>
          <Input 
            icon={Hash} 
            placeholder="Channel Name (e.g. random)" 
            value={newChannelName}
            onChange={e => setNewChannelName(e.target.value)}
            autoFocus
          />
          <Button className="mt-4">Create Channel</Button>
        </form>
      </Modal>

      <ProfileSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUpdate={handleUpdateProfile}
      />
    </div>
  );
};

export default App;