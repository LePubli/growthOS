import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Bot, User, Loader2, Crown, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: { type: string; label: string }[];
  confidence?: 'high' | 'medium' | 'low';
  ts: number;
}

const SUGGESTIONS = [
  'Quels sont nos deals à risque ?',
  'Quel est notre forecast 90 jours ?',
  'Montre-moi notre Win Rate actuel',
  'Quels sont les meilleurs signaux ?',
];

const CONFIDENCE_COLORS = { high: '#059669', medium: '#D97706', low: '#9CA3AF' };

export function AIAssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Bonjour ! Je suis votre **Assistant Exécutif**. Posez-moi n'importe quelle question sur votre business — deals à risque, forecast, signaux, Win Rate...",
      confidence: 'high',
      sources: [],
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (question: string) =>
      apiClient.post('/executive/assistant/ask', { question }) as Promise<{ answer: string; sources: { type: string; label: string }[]; confidence: 'high' | 'medium' | 'low' }>,
    onSuccess: (data, question) => {
      setMessages(prev => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: data.answer, sources: data.sources, confidence: data.confidence, ts: Date.now() },
      ]);
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', text: "Désolé, une erreur est survenue. Réessayez dans quelques instants.", ts: Date.now() },
      ]);
    },
  });

  const send = (text: string) => {
    const q = text.trim();
    if (!q || mutation.isPending) return;
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, ts: Date.now() }]);
    setInput('');
    mutation.mutate(q);
  };

  const renderText = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', background: 'linear-gradient(135deg,#1E1B4B,#312E81)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Crown size={15} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Assistant Exécutif</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
            Analyse en temps réel · Tous plugins
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: msg.role === 'user' ? '#2563EB' : 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
              {msg.role === 'user' ? <User size={13} color="#fff" /> : <Bot size={13} color="#fff" />}
            </div>
            <div style={{ maxWidth: '80%' }}>
              <div
                style={{ padding: '10px 13px', borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: msg.role === 'user' ? '#2563EB' : 'var(--body-bg)', border: msg.role === 'user' ? 'none' : '1px solid var(--card-border)', fontSize: 12, color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: renderText(msg.text) }}
              />
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {msg.sources.map((s, i) => (
                    <span key={i} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}>
                      📊 {s.label}
                    </span>
                  ))}
                  {msg.confidence && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'var(--body-bg)', color: CONFIDENCE_COLORS[msg.confidence], fontWeight: 700, border: '1px solid var(--card-border)' }}>
                      Confiance : {msg.confidence === 'high' ? 'Élevée' : msg.confidence === 'medium' ? 'Moyenne' : 'Faible'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={13} color="#fff" />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: 'var(--body-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyse en cours…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} style={{ fontSize: 10, padding: '5px 11px', borderRadius: 20, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={9} />{s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Posez une question sur votre business…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || mutation.isPending}
          style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !mutation.isPending ? '#4F46E5' : 'var(--card-border)', border: 'none', cursor: input.trim() && !mutation.isPending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Send size={14} color="#fff" />
        </button>
      </div>
    </div>
  );
}
