import { useState, useEffect, useRef } from 'react';
import { type Race } from '../data';

type Role = 'user' | 'ai';

interface Message {
  id: number;
  role: Role;
  content: string;
  insights?: string[];
  highlight?: { label: string; value: string } | null;
}

interface Props {
  race: Race;
  sessionKey: number;
  currentLap: number;
}

const STORAGE_KEY = 'f1-chat-messages';

const INITIAL_MESSAGE: Message = {
  id: 0,
  role: 'ai',
  content: "Hi! I'm your F1 race analyst. Ask me anything about the current race — strategy, gaps, lap times, or standings.",
};

const SUGGESTIONS = [
  'Who is leading right now?',
  'Explain the tyre strategy for VER',
  'Who has pitted the most?',
  'Who has the fastest lap so far?',
];

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Message[];
  } catch {
    // corrupted — fall through
  }
  return [INITIAL_MESSAGE];
}

let idCounter = Date.now();

export default function AiChat({ race, sessionKey, currentLap }: Props) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function buildContext() {
    return {
      session_key: sessionKey,
      race: {
        name: race.name,
        year: race.year,
        round: race.round,
        total_laps: race.laps,
      },
      current_lap: currentLap,
    };
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const userMsg: Message = { id: ++idCounter, role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          context: buildContext(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          id: ++idCounter,
          role: 'ai',
          content: data.answer,
          insights: data.insights ?? [],
          highlight: data.highlight ?? null,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: ++idCounter,
          role: 'ai',
          content: 'Could not reach the AI backend. Make sure the server is running on port 8000.',
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="ai-chat">
      {/* Header */}
      <div className="ai-chat__header">
        <div className="ai-chat__header-dot" />
        <span className="ai-chat__header-title">RACE ANALYST</span>
        <span className="ai-chat__header-badge">AI</span>
        <button
          className="ai-chat__clear"
          onClick={() => setMessages([INITIAL_MESSAGE])}
          title="Clear chat history"
        >
          CLEAR
        </button>
      </div>

      {/* Messages */}
      <div className="ai-chat__messages">
        {messages.map(msg => (
          <div key={msg.id} className={`ai-chat__msg ai-chat__msg--${msg.role}`}>
            {msg.role === 'ai' && <span className="ai-chat__avatar">AI</span>}
            <div className="ai-chat__bubble">
              <span>{msg.content}</span>

              {/* Highlight stat */}
              {msg.highlight && (
                <div className="ai-chat__highlight">
                  <span className="ai-chat__highlight-label">{msg.highlight.label}</span>
                  <span className="ai-chat__highlight-value">{msg.highlight.value}</span>
                </div>
              )}

              {/* Insight bullet points */}
              {msg.insights && msg.insights.length > 0 && (
                <ul className="ai-chat__insights">
                  {msg.insights.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="ai-chat__msg ai-chat__msg--ai">
            <span className="ai-chat__avatar">AI</span>
            <div className="ai-chat__bubble ai-chat__bubble--thinking">
              <span className="ai-chat__dot" />
              <span className="ai-chat__dot" />
              <span className="ai-chat__dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="ai-chat__suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} className="ai-chat__chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="ai-chat__input-row">
        <input
          className="ai-chat__input"
          placeholder="Ask about the race…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          disabled={thinking}
        />
        <button
          className="ai-chat__send"
          onClick={() => send(input)}
          disabled={!input.trim() || thinking}
          aria-label="Send"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
