import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bot, Sparkles, Mail, Linkedin, ListChecks, Copy, Send,
  Check, ChevronDown, Loader2, Cpu, Zap, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */
type Tone = 'formal' | 'casual' | 'friendly';
type Tab  = 'email' | 'linkedin' | 'sequence';

interface EmailDraft    { subject: string; body: string; tone: string; generatedBy: string; model?: string; contextUsed: { signals: number; memories: number; account: string } }
interface LinkedInDraft { message: string; characterCount: number; generatedBy: string; model?: string; contextUsed: { signals: number; memories: number; account: string } }
interface SequenceStep  { step: number; day: number; channel: string; subject?: string; body: string }
interface SequenceDraft { name: string; steps: SequenceStep[]; generatedBy: string; model?: string; contextUsed: { signals: number; memories: number; account: string } }
interface Template      { id: string; name: string; goal: string; tone: Tone; description: string; emoji: string }
interface OllamaStatus  { available: boolean; model: string; baseUrl: string }

/* ─── Helpers ────────────────────────────────────────────── */
function LLMBadge({ by, model }: { by: string; model?: string }) {
  const isOllama = by === 'ollama';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700,
      padding: '3px 9px', borderRadius: 9999,
      background: isOllama ? '#F0FDF4' : '#F5F3FF',
      color: isOllama ? '#059669' : '#7C3AED',
      border: `1px solid ${isOllama ? '#BBF7D0' : '#DDD6FE'}`,
    }}>
      {isOllama ? <Cpu size={9} /> : <Sparkles size={9} />}
      {isOllama ? `Ollama · ${model ?? 'llama3.2'}` : 'Mock LLM'}
    </span>
  );
}

function ContextBadge({ used }: { used: { signals: number; memories: number } }) {
  return (
    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Zap size={9} />{used.signals} signal{used.signals !== 1 ? 's' : ''}
      · {used.memories} mémoire{used.memories !== 1 ? 's' : ''}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copié dans le presse-papier');
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
      border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)',
    }}>
      {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  );
}

function SendToWorkflowButton({ draft }: { draft: string }) {
  const [sent, setSent] = useState(false);
  const send = async () => {
    try {
      await apiClient.post('/workflows', { name: 'AI SDR — Draft', trigger: 'manual', steps: [{ type: 'send_email', content: draft }] });
      setSent(true);
      toast.success('Draft envoyé au Workflow Engine');
    } catch {
      toast.error('Impossible d\'envoyer au Workflow');
    }
  };
  return (
    <button onClick={send} disabled={sent} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      padding: '6px 14px', borderRadius: 9, cursor: sent ? 'default' : 'pointer',
      border: 'none', background: sent ? '#ECFDF5' : 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: sent ? '#059669' : '#fff',
    }}>
      {sent ? <Check size={13} /> : <Send size={13} />}
      {sent ? 'Envoyé !' : 'Envoyer au Workflow'}
    </button>
  );
}

/* ─── Channel icon ───────────────────────────────────────── */
const CHANNEL_CONFIG = {
  email:    { icon: '📧', label: 'Email',    color: '#2563EB', bg: '#EFF6FF' },
  linkedin: { icon: '💼', label: 'LinkedIn', color: '#0A66C2', bg: '#E8F4FD' },
  call:     { icon: '📞', label: 'Appel',    color: '#059669', bg: '#ECFDF5' },
};

/* ─── Main page ──────────────────────────────────────────── */
export default function AISDRPage() {
  const [account, setAccount]   = useState('');
  const [goal, setGoal]         = useState('');
  const [tone, setTone]         = useState<Tone>('friendly');
  const [activeTab, setActiveTab] = useState<Tab>('email');
  const [emailDraft, setEmailDraft]   = useState<EmailDraft | null>(null);
  const [linkedInDraft, setLinkedInDraft] = useState<LinkedInDraft | null>(null);
  const [sequenceDraft, setSequenceDraft] = useState<SequenceDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  /* Templates */
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['ai-sdr-templates'],
    queryFn: () => apiClient.get('/ai-sdr/templates'),
  });

  /* Ollama status */
  const { data: ollamaStatus } = useQuery<OllamaStatus>({
    queryKey: ['ollama-status'],
    queryFn: () => apiClient.get('/ai-sdr/status'),
    refetchInterval: 30000,
  });

  const applyTemplate = (tpl: Template) => {
    setGoal(tpl.goal);
    setTone(tpl.tone);
  };

  const generateAll = async () => {
    if (!account.trim() || !goal.trim()) {
      toast.error('Veuillez renseigner un compte et un objectif');
      return;
    }
    setGenerating(true);
    setHasGenerated(false);
    const payload = { accountId: account.trim(), goal: goal.trim(), tone };
    try {
      const [email, linkedin, sequence] = await Promise.all([
        apiClient.post('/ai-sdr/draft/email', payload),
        apiClient.post('/ai-sdr/draft/linkedin', payload),
        apiClient.post('/ai-sdr/sequence', payload),
      ]);
      setEmailDraft(email as EmailDraft);
      setLinkedInDraft(linkedin as LinkedInDraft);
      setSequenceDraft(sequence as SequenceDraft);
      setHasGenerated(true);
      const via = (email as EmailDraft).generatedBy === 'ollama' ? `Ollama (${(email as EmailDraft).model})` : 'Mock LLM';
      toast.success(`Drafts générés via ${via}`);
    } catch {
      toast.error('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'email',    label: 'Email',    icon: <Mail size={13} />    },
    { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={13} /> },
    { id: 'sequence', label: 'Séquence', icon: <ListChecks size={13} /> },
  ];

  const TONES: { value: Tone; label: string; emoji: string }[] = [
    { value: 'friendly', label: 'Chaleureux',   emoji: '😊' },
    { value: 'casual',   label: 'Décontracté',  emoji: '✌️' },
    { value: 'formal',   label: 'Professionnel', emoji: '🎩' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#4C1D95,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>AI SDR — Copilot</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Drafts hyper-personnalisés en synthétisant Memory, Account Intelligence & Signals</p>
        </div>

        {/* Ollama status indicator */}
        {ollamaStatus && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
            background: ollamaStatus.available ? '#F0FDF4' : '#F9FAFB',
            border: `1px solid ${ollamaStatus.available ? '#BBF7D0' : 'var(--card-border)'}`,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaStatus.available ? '#059669' : '#9CA3AF', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ollamaStatus.available ? '#059669' : '#6B7280' }}>
                {ollamaStatus.available ? 'Ollama connecté' : 'Ollama hors ligne'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ollamaStatus.model}</div>
            </div>
            <Cpu size={12} color={ollamaStatus.available ? '#059669' : '#9CA3AF'} />
          </div>
        )}
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* LEFT — Input panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick templates */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Templates rapides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    border: '1px solid var(--card-border)', background: 'var(--body-bg)', textAlign: 'left', transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#7C3AED55')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                >
                  <span style={{ fontSize: 18 }}>{tpl.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{tpl.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tpl.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Input form */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ciblage</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Compte cible</label>
              <input
                value={account}
                onChange={e => setAccount(e.target.value)}
                placeholder="Ex: Acme Corp, TechStartup SAS…"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13,
                  border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Objectif</label>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="Ex: book a demo meeting, upsell feature X, re-engage cold prospect…"
                rows={3}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13, resize: 'vertical',
                  border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Ton</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TONES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${tone === t.value ? '#7C3AED' : 'var(--card-border)'}`,
                      background: tone === t.value ? '#F5F3FF' : 'var(--body-bg)',
                      color: tone === t.value ? '#7C3AED' : 'var(--text-muted)',
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateAll}
              disabled={generating || !account.trim() || !goal.trim()}
              style={{
                width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer',
                border: 'none', background: 'linear-gradient(135deg,#4C1D95,#7C3AED)', color: '#fff',
                opacity: (generating || !account.trim() || !goal.trim()) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
              {generating ? 'Génération en cours…' : 'Générer les drafts'}
            </button>

            {!ollamaStatus?.available && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                <AlertCircle size={12} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>
                  Ollama hors ligne — mode Mock LLM actif. Lancez <code style={{ background: '#FEF3C7', padding: '0 3px', borderRadius: 3 }}>ollama serve</code> pour activer la génération IA locale.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Output panel */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '13px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? '#7C3AED' : 'transparent'}`,
                  background: activeTab === tab.id ? '#F5F3FF' : 'transparent',
                  color: activeTab === tab.id ? '#7C3AED' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                {tab.icon}{tab.label}
                {tab.id === 'email' && emailDraft && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', marginLeft: 2 }} />}
                {tab.id === 'linkedin' && linkedInDraft && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', marginLeft: 2 }} />}
                {tab.id === 'sequence' && sequenceDraft && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', marginLeft: 2 }} />}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
            {!hasGenerated && !generating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={32} color="#7C3AED" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Votre Copilot SDR est prêt</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                    Renseignez un compte et un objectif, puis cliquez sur<br />"Générer les drafts" pour voir la magie opérer.
                  </p>
                </div>
              </div>
            )}

            {generating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 16 }}>
                <Loader2 size={40} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Génération en cours…</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Analyse signals · Lecture mémoire · Rédaction draft</p>
                </div>
              </div>
            )}

            {/* EMAIL TAB */}
            {hasGenerated && !generating && activeTab === 'email' && emailDraft && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LLMBadge by={emailDraft.generatedBy} model={emailDraft.model} />
                    <ContextBadge used={emailDraft.contextUsed} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CopyButton text={`Sujet: ${emailDraft.subject}\n\n${emailDraft.body}`} />
                    <SendToWorkflowButton draft={emailDraft.body} />
                  </div>
                </div>

                <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Sujet</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{emailDraft.subject}</div>
                </div>

                <div style={{ padding: '14px', borderRadius: 9, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {emailDraft.body}
                </div>
              </div>
            )}

            {/* LINKEDIN TAB */}
            {hasGenerated && !generating && activeTab === 'linkedin' && linkedInDraft && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LLMBadge by={linkedInDraft.generatedBy} model={linkedInDraft.model} />
                    <ContextBadge used={linkedInDraft.contextUsed} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CopyButton text={linkedInDraft.message} />
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: 9, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                  {linkedInDraft.message}
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    flex: 1, height: 5, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 9999, transition: 'width 0.3s',
                      width: `${Math.min(100, Math.round(linkedInDraft.characterCount / 300 * 100))}%`,
                      background: linkedInDraft.characterCount > 280 ? '#DC2626' : linkedInDraft.characterCount > 200 ? '#D97706' : '#059669',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50 }}>{linkedInDraft.characterCount}/300</span>
                </div>
              </div>
            )}

            {/* SEQUENCE TAB */}
            {hasGenerated && !generating && activeTab === 'sequence' && sequenceDraft && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{sequenceDraft.name}</span>
                    <LLMBadge by={sequenceDraft.generatedBy} model={sequenceDraft.model} />
                  </div>
                  <ContextBadge used={sequenceDraft.contextUsed} />
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 17, top: 0, bottom: 0, width: 2, background: 'var(--card-border)', zIndex: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sequenceDraft.steps.map(step => {
                      const ch = CHANNEL_CONFIG[step.channel as keyof typeof CHANNEL_CONFIG] ?? CHANNEL_CONFIG.email;
                      return (
                        <div key={step.step} style={{ display: 'flex', gap: 14, position: 'relative', zIndex: 1 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', background: ch.bg, color: ch.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                            border: '2px solid var(--card-bg)',
                          }}>
                            {ch.icon}
                          </div>
                          <div style={{ flex: 1, paddingBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Étape {step.step}</span>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: ch.bg, color: ch.color, fontWeight: 700 }}>{ch.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>J+{step.day}</span>
                            </div>
                            {step.subject && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>📌 {step.subject}</div>
                            )}
                            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 12, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                              {step.body}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                              <CopyButton text={step.body} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
