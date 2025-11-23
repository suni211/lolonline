import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import './GlobalChat.css';

interface ChatMessage {
  type: 'user' | 'system';
  username: string;
  message: string;
  timestamp: number;
}

export default function GlobalChat() {
  const { user, team } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [viewers, setViewers] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const username = team?.name || user?.username || `Guest_${socket.id?.slice(0, 4)}`;

    // 글로벌 채팅방 참가
    socket.emit('join_global_chat', { username });

    socket.on('global_chat_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-100), msg]);
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('global_viewers_update', (viewerList: string[]) => {
      setViewers(viewerList);
    });

    return () => {
      socket.emit('leave_global_chat');
      socket.off('global_chat_message');
      socket.off('global_viewers_update');
    };
  }, [socket, user, team]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const sendMessage = () => {
    if (!socket || !input.trim()) return;
    socket.emit('send_global_chat', { message: input.trim() });
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* 채팅 토글 버튼 */}
      <button
        className={`chat-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="chat-icon">💬</span>
        {unreadCount > 0 && !isOpen && (
          <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* 채팅 팝업 */}
      <div className={`global-chat-popup ${isOpen ? 'open' : ''}`}>
        <div className="chat-popup-header">
          <h3>전체 채팅</h3>
          <span className="viewer-count">{viewers.length}명 접속</span>
          <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
        </div>

        <div className="chat-popup-messages" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="no-messages">메시지가 없습니다</div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`chat-msg ${msg.type}`}>
                {msg.type === 'user' ? (
                  <>
                    <div className="msg-header">
                      <span className="msg-username">{msg.username}</span>
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="msg-text">{msg.message}</div>
                  </>
                ) : (
                  <div className="msg-system">{msg.message}</div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="chat-popup-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지 입력..."
            maxLength={200}
          />
          <button onClick={sendMessage}>전송</button>
        </div>
      </div>
    </>
  );
}
