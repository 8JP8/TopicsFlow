import React, { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import GifPicker from '../Chat/GifPicker';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  display_name: string;
  sender_username?: string;
  user_id?: string;
  is_anonymous: boolean;
  can_delete: boolean;
  chat_room_id?: string;
  gif_url?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  theme_id: string;
  owner_id: string;
  owner_username?: string;
  member_count: number;
  message_count: number;
  is_public: boolean;
}

interface ChatRoomContainerProps {
  room: ChatRoom;
  themeId: string;
  onBack?: () => void;
}

const ChatRoomContainer: React.FC<ChatRoomContainerProps> = ({
  room,
  themeId,
  onBack,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomJoined, setRoomJoined] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    if (room?.id) {
      loadMessages();
    }
  }, [room?.id]);

  // Join room via Socket.IO
  useEffect(() => {
    if (socket && room?.id && connected) {
      socket.emit('join_chat_room', { room_id: room.id });
      
      socket.on('chat_room_joined', (data: any) => {
        if (data.room_id === room.id) {
          setRoomJoined(true);
        }
      });

      socket.on('new_chat_room_message', (message: Message) => {
        if (message.chat_room_id === room.id) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
      });

      return () => {
        socket.off('chat_room_joined');
        socket.off('new_chat_room_message');
        if (room?.id) {
          socket.emit('leave_chat_room', { room_id: room.id });
        }
      };
    }
  }, [socket, room?.id, connected]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.MESSAGES(room.id), {
        limit: 50,
      });

      if (response.data.success) {
        setMessages(response.data.data || []);
        scrollToBottom();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToLoadMessages'));
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() && !selectedGifUrl) {
      return;
    }

    try {
      const response = await api.post(API_ENDPOINTS.CHAT_ROOMS.SEND_MESSAGE(room.id), {
        content: messageInput.trim() || (selectedGifUrl ? '[GIF]' : ''),
        message_type: selectedGifUrl ? 'gif' : 'text',
        gif_url: selectedGifUrl,
        use_anonymous: useAnonymous,
      });

      if (response.data.success) {
        setMessageInput('');
        setSelectedGifUrl(null);
        // Message will be added via Socket.IO event
      } else {
        toast.error(response.data.errors?.[0] || t('chat.failedToSendMessage'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.errors?.[0] || t('chat.failedToSendMessage'));
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    setSelectedGifUrl(gifUrl);
    setShowGifPicker(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {room.name}
          </h2>
          {room.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {room.description}
            </p>
          )}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('common.back')}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{t('chat.noMessages')}</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className="flex gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {message.display_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {message.gif_url ? (
                  <img
                    src={message.gif_url}
                    alt="GIF"
                    className="max-w-md rounded-lg"
                  />
                ) : (
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {selectedGifUrl && (
          <div className="mb-2 relative">
            <img
              src={selectedGifUrl}
              alt="Selected GIF"
              className="max-w-xs rounded-lg"
            />
            <button
              onClick={() => setSelectedGifUrl(null)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGifPicker(!showGifPicker)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('chat.gif')}
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={t('chat.sendMessage')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!messageInput.trim() && !selectedGifUrl}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('chat.send')}
          </button>
        </form>

        {showGifPicker && (
          <div className="mt-4 relative">
            <GifPicker 
              onSelectGif={handleGifSelect} 
              onClose={() => setShowGifPicker(false)} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoomContainer;

