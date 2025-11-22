import { useEffect, useState } from 'react';
import axios from 'axios';
import './EventNotification.css';

interface TeamEvent {
  id: number;
  event_type: string;
  title: string;
  description: string;
  effect_type: string;
  effect_value: number;
  player_name: string;
  player2_name: string | null;
  is_read: boolean;
  created_at: string;
}

interface EventNotificationProps {
  onClose: () => void;
}

export default function EventNotification({ onClose }: EventNotificationProps) {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events');
      setEvents(response.data);

      // 읽음 처리
      await axios.post('/api/events/mark-read');
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'CONFLICT': return '갈등';
      case 'CELEBRATION': return '축하';
      case 'PRANK': return '장난';
      case 'INJURY': return '부상';
      case 'BONUS': return '보너스';
      case 'SCANDAL': return '스캔들';
      case 'INTERVIEW': return '인터뷰';
      case 'TEAMBUILDING': return '팀빌딩';
      default: return type;
    }
  };

  const getEventTypeClass = (type: string) => {
    switch (type) {
      case 'CONFLICT':
      case 'SCANDAL':
        return 'event-negative';
      case 'CELEBRATION':
      case 'BONUS':
      case 'INTERVIEW':
      case 'TEAMBUILDING':
        return 'event-positive';
      case 'PRANK':
        return 'event-neutral';
      case 'INJURY':
        return 'event-warning';
      default:
        return '';
    }
  };

  const getEffectDescription = (effectType: string, effectValue: number) => {
    const sign = effectValue > 0 ? '+' : '';
    switch (effectType) {
      case 'MORALE':
        return `팀 사기 ${sign}${effectValue}%`;
      case 'CONDITION':
        return `컨디션 ${sign}${effectValue}%`;
      case 'GOLD':
        return `${sign}${effectValue.toLocaleString()}원`;
      case 'FAN':
        return `팬 ${sign}${effectValue.toLocaleString()}명`;
      default:
        return '';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) {
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  return (
    <div className="event-notification-overlay" onClick={onClose}>
      <div className="event-notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-header">
          <h2>팀 이벤트</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="event-list">
          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : events.length === 0 ? (
            <div className="empty-message">이벤트가 없습니다</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className={`event-item ${getEventTypeClass(event.event_type)}`}>
                <div className="event-type-badge">{getEventTypeLabel(event.event_type)}</div>
                <div className="event-content">
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <div className="event-footer">
                    <span className={`event-effect ${event.effect_value > 0 ? 'positive' : event.effect_value < 0 ? 'negative' : ''}`}>
                      {getEffectDescription(event.effect_type, event.effect_value)}
                    </span>
                    <span className="event-time">{formatDate(event.created_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
