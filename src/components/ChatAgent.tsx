import { useState, useRef, useEffect } from 'react';
import { X, Trash2, Send, Loader2, MessageCircle, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, BrandIdentity, Post, MatrixIdea, AppLanguage } from '../types';
import * as analytics from '../lib/analytics';

interface ChatAgentProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  brandIdentity: BrandIdentity;
  themes: string[];
  contentTypes: string[];
  posts: Post[];
  matrixIdeas: MatrixIdea[];
  language: AppLanguage;
  onSendMessage: (content: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
}

// ── Reasoning Parser ──────────────────────────────────────────────────────────
function parseContent(content: string): { mainText: string; reasoning: string | null } {
  const match = content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  if (!match) return { mainText: content.trim(), reasoning: null };
  const reasoning = match[1].trim();
  const mainText = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
  return { mainText, reasoning };
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const { mainText, reasoning } = parseContent(message.content);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            code: ({ children }) => (
              <code className={`px-1 py-0.5 rounded text-xs font-mono ${isUser ? 'bg-indigo-500' : 'bg-slate-200 text-slate-800'}`}>
                {children}
              </code>
            ),
            h1: ({ children }) => <p className="font-bold mb-1">{children}</p>,
            h2: ({ children }) => <p className="font-bold mb-1">{children}</p>,
            h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
          }}
        >
          {mainText}
        </ReactMarkdown>
      </div>

      {!isUser && reasoning && (
        <div className="max-w-[85%] w-full">
          <button
            onClick={() => setReasoningOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-0.5"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${reasoningOpen ? 'rotate-180' : ''}`}
            />
            {reasoningOpen ? 'Hide' : 'Show'} reasoning
          </button>
          {reasoningOpen && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-[11px] text-amber-800 leading-relaxed whitespace-pre-wrap mt-0.5">
              {reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatAgent({
  isOpen,
  onToggle,
  messages,
  onSendMessage,
  onClearHistory,
}: ChatAgentProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  useEffect(() => {
    if (isOpen) analytics.trackAgentOpened();
    else analytics.trackAgentClosed();
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    setError('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);
    try {
      await onSendMessage(trimmed);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
    await onClearHistory();
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          aria-label="Open Content Agent"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Agent</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl bg-white border border-slate-200 overflow-hidden"
          style={{ width: 380, height: 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold text-white">Content Agent</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/20 transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/20 transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 shrink-0">
              {error}
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2 px-4">
                <MessageCircle className="w-8 h-8 opacity-30" />
                <p className="text-xs font-medium">Ask me anything about your content strategy.</p>
                <p className="text-xs opacity-70">I know your brand identity, themes, recent posts, and ideas.</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="shrink-0 border-t border-slate-200 px-3 py-3 bg-slate-50">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your content strategy..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white leading-relaxed disabled:opacity-50 transition-shadow"
                style={{ minHeight: 40, maxHeight: 120 }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
                aria-label="Send message"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
