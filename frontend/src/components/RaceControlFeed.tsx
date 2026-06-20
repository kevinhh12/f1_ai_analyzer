import { useMemo, useEffect, useRef } from 'react';

interface RaceControlMsg {
  date?: string;
  category?: string;
  flag?: string;
  message?: string;
  lap_number?: number;
  driver_number?: number;
}

interface Props {
  messages: RaceControlMsg[];
  currentTimeMs: number;
  raceStartEpoch: number;
}

const FLAG_COLORS: Record<string, string> = {
  RED: '#e10600',
  YELLOW: '#ffd400',
  GREEN: '#00d27a',
  CLEAR: '#00d27a',
  BLUE: '#3b82f6',
};

const CAT_LABELS: Record<string, string> = {
  SafetyCar: 'SC',
  Flag: 'FLAG',
  Drs: 'DRS',
  Other: '',
};

export default function RaceControlFeed({ messages, currentTimeMs, raceStartEpoch }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(() => {
    if (!messages.length || !raceStartEpoch) return [];
    const targetEpoch = raceStartEpoch + currentTimeMs;
    return messages
      .filter(m => m.date && new Date(m.date).getTime() <= targetEpoch)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  }, [messages, currentTimeMs, raceStartEpoch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  const fmtTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="rc-feed">
      <div className="rc-feed__header">
        <div className="rc-feed__header-dot" />
        <span className="rc-feed__header-title">RACE CONTROL</span>
        <span className="rc-feed__header-badge">LIVE</span>
      </div>

      <div className="rc-feed__messages">
        {visibleMessages.length === 0 && (
          <div className="rc-feed__empty">No messages yet</div>
        )}
        {visibleMessages.map((msg, i) => {
          const flag = msg.flag ?? '';
          const cat = msg.category ?? '';
          const accentColor = FLAG_COLORS[flag] ?? 'rgba(255,255,255,0.15)';
          const catLabel = CAT_LABELS[cat] ?? cat;

          return (
            <div
              key={i}
              className="rc-feed__msg"
              style={{ borderLeftColor: accentColor }}
            >
              <div className="rc-feed__msg-meta">
                <span className="rc-feed__msg-lap">LAP {msg.lap_number ?? '—'}</span>
                <span className="rc-feed__msg-time">{msg.date ? fmtTime(msg.date) : ''}</span>
                {catLabel && (
                  <span
                    className="rc-feed__msg-cat"
                    style={{ color: accentColor }}
                  >
                    {catLabel}
                  </span>
                )}
              </div>
              <div className="rc-feed__msg-text">{msg.message ?? ''}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
