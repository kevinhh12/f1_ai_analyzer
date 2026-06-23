import { useEffect, useState, useRef } from 'react';

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

const POPUP_DURATION = 5000;
const OUTRO_DURATION = 400;

export default function PopUps({ messages, currentTimeMs, raceStartEpoch }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'leaving'>('hidden');
  const [text, setText] = useState('');
  const [flag, setFlag] = useState('');
  const [countdown, setCountdown] = useState(100);
  const lastDateRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outroRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAllTimers() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (outroRef.current) {
      clearTimeout(outroRef.current);
      outroRef.current = null;
    }
  }

  function startOutro() {
    clearAllTimers();
    setPhase('leaving');
    outroRef.current = setTimeout(() => {
      setPhase('hidden');
    }, OUTRO_DURATION);
  }

  function dismiss() {
    startOutro();
  }

  function startCountdown() {
    clearAllTimers();
    setCountdown(100);
    setPhase('visible');

    const tickMs = 50;
    const step = (tickMs / POPUP_DURATION) * 100;
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const next = prev - step;
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, tickMs);

    timerRef.current = setTimeout(() => {
      startOutro();
    }, POPUP_DURATION);
  }

  useEffect(() => {
    if (!messages.length || !raceStartEpoch) return;

    const targetEpoch = raceStartEpoch + currentTimeMs;

    let latest: RaceControlMsg | null = null;
    for (const m of messages) {
      if (!m.date) continue;
      const epoch = new Date(m.date).getTime();
      if (epoch > targetEpoch) continue;
      if (!latest || epoch > new Date(latest.date!).getTime()) {
        latest = m;
      }
    }

    if (!latest) return;
    if (latest.date === lastDateRef.current) return;

    lastDateRef.current = latest.date!;
    setText(latest.message ?? '');
    setFlag(latest.flag ?? '');
    startCountdown();
  }, [messages, currentTimeMs, raceStartEpoch]);

  if (phase === 'hidden' || !text) return null;

  let flagColor: string;
  if (flag === 'RED') {
    flagColor = '#e10600';
  } else if (flag === 'YELLOW') {
    flagColor = '#ffd400';
  } else if (flag === 'GREEN') {
    flagColor = '#00d27a';
  } else {
    flagColor = 'rgba(255,255,255,0.6)';
  }

  let popupClass = 'rc-popup';
  if (phase === 'leaving') {
    popupClass += ' rc-popup--leaving';
  }

  return (
    <div className={popupClass} style={{ borderLeftColor: flagColor }}>
      <div className="rc-popup__content">
        {flag && <span className="rc-popup__flag" style={{ color: flagColor }}>{flag}</span>}
        <span className="rc-popup__text">{text}</span>
        <button className="rc-popup__dismiss" onClick={dismiss}>✕</button>
      </div>
      <div className="rc-popup__bar-track">
        <div
          className="rc-popup__bar-fill"
          style={{ width: `${countdown}%`, backgroundColor: flagColor }}
        />
      </div>
    </div>
  );
}
