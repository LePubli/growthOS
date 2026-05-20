'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bot, Cpu, Globe, Zap, RefreshCw, ChevronDown, Settings } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Provider {
  name: string; label: string; available: boolean;
  models: string[]; defaultModel: string; isLocal: boolean;
}

interface Agent {
  id: string; name: string; description: string; icon: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
}

export default function AIAgentPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>('sdr-agent');
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['ai-providers'],
    queryFn: () => apiClient.get('/ai/providers'),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['ai-agents'],
    queryFn: () => apiClient.get('/ai/agents'),
  });

  const chatMutation = useMutation({
    mutationFn: (data: any) => apiClient.post<any>('/ai/agents/run', data),
    onSuccess: (response, variables) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
      }]);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur IA'),
  });

  const pullMutation = useMutation({
    mutationFn: (model: string) => apiClient.post('/ai/providers/ollama/pull', { model }),
    onSuccess: () => { toast.success('Modèle téléchargé !'); },
    onError: (e: any) => toast.error(e.message),
  });

  const availableProviders = providers.filter(p => p.available);
  const currentProvider = providers.find(p => p.name === selectedProvider);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);

    chatMutation.mutate({
      agentId: selectedAgent,
      message: input,
      context: context ? { info: context } : undefined,
    });
    setInput('');
  };

  const PROVIDER_COLORS: Record<string, string> = {
    ollama: '#017E84',
    anthropic: '#714B67',
    openai: '#28A745',
    mistral: '#F0AD4E',
  };

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Sidebar agents */}
      <div style={{ width: 260, borderRight: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Agents IA</h2>
        </div>

        {/* Agents list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {agents.map((agent: Agent) => (
            <button key={agent.id}
              onClick={() => { setSelectedAgent(agent.id); setMessages([]); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', width: '100%', border: 'none',
                background: selectedAgent === agent.id ? 'rgba(1,126,132,.1)' : 'transparent',
                borderLeft: `3px solid ${selectedAgent === agent.id ? 'var(--color-primary)' : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
              }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{agent.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: selectedAgent === agent.id ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.description?.slice(0, 45)}...
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Providers status */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Providers
          </div>
          {providers.map((p: Provider) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.available ? PROVIDER_COLORS[p.name] || '#28A745' : '#dee2e6', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: p.available ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {p.label}
              </span>
              {p.isLocal && p.available && (
                <span style={{ fontSize: 10, background: 'rgba(1,126,132,.1)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>LOCAL</span>
              )}
            </div>
          ))}

          {/* Pull Ollama model */}
          {providers.find((p: Provider) => p.name === 'ollama' && !p.available) && (
            <div style={{ marginTop: 8, padding: 8, background: 'rgba(1,126,132,.06)', borderRadius: 6, border: '1px solid rgba(1,126,132,.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--color-primary)', margin: '0 0 6px', fontWeight: 500 }}>
                Ollama non configuré
              </p>
              <a href="https://ollama.ai" target="_blank" style={{ fontSize: 11, color: 'var(--color-primary)', textDecoration: 'underline' }}>
                Installer Ollama →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{agents.find((a: Agent) => a.id === selectedAgent)?.icon || '🤖'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {agents.find((a: Agent) => a.id === selectedAgent)?.name || 'Agent IA'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {availableProviders.length > 0
                  ? `Actif — ${availableProviders[0].isLocal ? '⚡ Local (Ollama)' : availableProviders[0].label}`
                  : 'Aucun provider configuré'
                }
              </div>
            </div>
          </div>

          {/* Provider selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selectedProvider}
              onChange={e => { setSelectedProvider(e.target.value); setSelectedModel(''); }}
              className="o-form-control o-form-control-sm"
              style={{ width: 'auto', fontSize: 12 }}
            >
              <option value="auto">🤖 Auto (Ollama → Cloud)</option>
              {availableProviders.map((p: Provider) => (
                <option key={p.name} value={p.name}>
                  {p.isLocal ? '⚡ ' : '☁️ '}{p.label}
                </option>
              ))}
            </select>

            {currentProvider && (
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="o-form-control o-form-control-sm"
                style={{ width: 'auto', fontSize: 12 }}
              >
                <option value="">{currentProvider.defaultModel} (défaut)</option>
                {currentProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}

            <button onClick={() => setMessages([])} className="o-btn o-btn-ghost o-btn-sm" title="Vider la conversation">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Context */}
        <div style={{ padding: '8px 20px', background: '#f8f9fa', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Contexte optionnel — ex: nom de l'entreprise, secteur, données prospect..."
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {agents.find((a: Agent) => a.id === selectedAgent)?.icon || '🤖'}
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {agents.find((a: Agent) => a.id === selectedAgent)?.name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400 }}>
                {agents.find((a: Agent) => a.id === selectedAgent)?.description}
              </p>
              {availableProviders.find(p => p.isLocal) && (
                <div style={{ marginTop: 16, padding: '8px 16px', background: 'rgba(1,126,132,.08)', borderRadius: 20, border: '1px solid rgba(1,126,132,.2)', fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>
                  ⚡ Mode local (Ollama) — Gratuit & Privé
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800, margin: '0 auto' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--color-secondary)' : PROVIDER_COLORS[msg.provider || ''] || 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: msg.role === 'user' ? 12 : 16, fontWeight: 700,
                  }}>
                    {msg.role === 'user' ? 'U' : agents.find((a: Agent) => a.id === selectedAgent)?.icon || '🤖'}
                  </div>

                  <div style={{ flex: 1, maxWidth: '80%' }}>
                    <div style={{
                      padding: '12px 16px', borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                      background: msg.role === 'user' ? 'var(--color-secondary)' : 'var(--bg-card)',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                      border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                      boxShadow: msg.role === 'assistant' ? 'var(--shadow-card)' : 'none',
                      fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                    {msg.provider && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLORS[msg.provider] || '#ccc' }} />
                        {msg.provider === 'ollama' ? '⚡ Local' : '☁️ Cloud'} · {msg.model}
                        {msg.latencyMs && ` · ${msg.latencyMs}ms`}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
                    {agents.find((a: Agent) => a.id === selectedAgent)?.icon || '🤖'}
                  </div>
                  <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '2px 12px 12px 12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', animation: `bounce 1s ease ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, maxWidth: 800, margin: '0 auto' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message à ${agents.find((a: Agent) => a.id === selectedAgent)?.name || "l'agent"}... (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)`}
              rows={2}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
            <button
              onClick={send}
              disabled={!input.trim() || chatMutation.isPending || !availableProviders.length}
              className="o-btn o-btn-primary"
              style={{ alignSelf: 'flex-end', padding: '10px 16px' }}
            >
              <Send size={15} />
            </button>
          </div>
          {!availableProviders.length && (
            <p style={{ fontSize: 11, color: 'var(--color-danger)', textAlign: 'center', marginTop: 6 }}>
              ⚠️ Aucun provider IA configuré — ajoutez OLLAMA_HOST ou une API key dans les paramètres
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
