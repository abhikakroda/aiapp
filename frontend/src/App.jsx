import { useEffect, useMemo, useRef, useState } from 'react';

const THEME_KEY = 'quanta-theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const initialMessages = [
  {
    id: 'assistant-intro',
    role: 'assistant',
    content: "Hello! I'm Quanta AI. Ask me anything and I'll respond right away.",
  },
];

export default function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messageEndRef = useRef(null);

  const canSubmit = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);
  const showIntro = useMemo(() => !messages.some((message) => message.role === 'user'), [messages]);
  const [theme, setTheme] = useState(() => window.localStorage.getItem(THEME_KEY) || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);


  const statusMessage = useMemo(() => {
    if (isLoading) {
      return 'Quanta AI is composing a reply…';
    }
    if (error) {
      return `Error: ${error}`;
    }
    return 'Press Enter to send';
  }, [isLoading, error]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;

    const timestamp = Date.now();
    const userMessage = {
      id: `user-${timestamp}`,
      role: 'user',
      content: prompt,
    };

    const placeholderId = `assistant-pending-${timestamp}`;
    const placeholderMessage = {
      id: placeholderId,
      role: 'assistant',
      content: 'Quanta AI is thinking…',
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, placeholderMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const payloadMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: payloadMessages,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Request failed');
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderId
            ? { ...message, content: payload.reply, pending: false }
            : message,
        ),
      );
    } catch (err) {
      console.error('[chat] Failed to fetch response', err);
      const errorMessage = err?.message || 'Unknown error';
      const fallbackText = errorMessage.toLowerCase().includes('overloaded')
        ? 'Quanta AI is experiencing high traffic. Please try again in a few seconds.'
        : 'Quanta AI had trouble reaching Gemini. Please try again in a moment.';

      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderId
            ? { ...message, content: fallbackText, pending: false, error: true }
            : message,
        ),
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        handleSubmit(event);
      }
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div className="shell">
      {showIntro ? (
        <IntroScreen
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          canSubmit={canSubmit}
          statusMessage={statusMessage}
          isLoading={isLoading}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <ChatScreen
          messages={messages}
          messageEndRef={messageEndRef}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          canSubmit={canSubmit}
          statusMessage={statusMessage}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

function IntroScreen({ input, setInput, handleSubmit, handleKeyDown, canSubmit, statusMessage, isLoading, theme, toggleTheme }) {
  return (
    <div className="stage stage--intro">
      <header className="intro-bar">
        <Logo />
        <ThemeSwitch theme={theme} toggleTheme={toggleTheme} />
      </header>

      <div className="intro-body">
        <h1 className="intro-title">Ask anything.</h1>
        <p className="intro-text">Quanta AI is ready whenever you are.</p>
      </div>

      <Composer
        variant="intro"
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        canSubmit={canSubmit}
        statusMessage={statusMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

function ChatScreen({
  messages,
  messageEndRef,
  input,
  setInput,
  handleSubmit,
  handleKeyDown,
  canSubmit,
  statusMessage,
  isLoading,
}) {
  return (
    <div className="stage stage--chat">
      <header className="chat-header">
        <Logo compact />
      </header>

      <section className="chat-log" aria-live="polite">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messageEndRef} />
      </section>

      <Composer
        variant="chat"
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        canSubmit={canSubmit}
        statusMessage={statusMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

function Composer({
  variant,
  input,
  setInput,
  handleSubmit,
  handleKeyDown,
  canSubmit,
  statusMessage,
  isLoading,
}) {
  const placeholder = variant === 'intro' ? 'Ask Quanta AI anything…' : 'Send a message…';
  const statusCopy = variant === 'intro' ? 'Ready when you are' : statusMessage;

  return (
    <form className={`composer composer--${variant}`} onSubmit={handleSubmit}>
      <textarea
        id={`prompt-${variant}`}
        className="composer__input"
        placeholder={placeholder}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={variant === 'intro' ? 2 : Math.min(6, Math.max(2, input.split('\n').length))}
        disabled={isLoading}
      />

      <div className="composer__footer">
        <span className="composer__status">{statusCopy}</span>
        <button type="submit" className="composer__send" disabled={!canSubmit} aria-label="Send message">
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const bubbleClassName = [
    'bubble',
    isUser ? 'bubble--user' : 'bubble--assistant',
    message.pending ? 'bubble--pending' : '',
    message.error ? 'bubble--error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={bubbleClassName} aria-busy={message.pending ? 'true' : undefined}>
      <div className="bubble__avatar" aria-hidden="true">
        {isUser ? '🧑' : '✨'}
      </div>
      <div className="bubble__body">
        <div className="bubble__author">{isUser ? 'You' : 'Quanta AI'}</div>
        {message.pending ? (
          <TypingIndicator />
        ) : (
          <ReactMarkdown className="bubble__markdown" remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div className="bubble__typing" aria-label="Quanta AI is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

function ThemeSwitch({ theme, toggleTheme }) {
  const isLight = theme === 'light';
  const next = isLight ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="theme-switch"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
    >
      <span aria-hidden="true">{isLight ? '🌙' : '☀️'}</span>
      <span className="visually-hidden">Switch theme</span>
    </button>
  );
}

function Logo({ compact = false }) {
  return (
    <div className={`logo${compact ? ' logo--compact' : ''}`}>
      Quanta <span>AI</span>
    </div>
  );
}
