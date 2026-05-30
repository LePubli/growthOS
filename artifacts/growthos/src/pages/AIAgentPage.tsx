import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  '📊 Analyser mon pipeline et identifier les deals à risque',
  '✉️ Rédiger un email de prospection pour une startup tech',
  '🎯 Quels prospects dois-je relancer cette semaine ?',
  '📈 Comment améliorer mon taux de conversion ?',
  '🔍 Identifier les signaux d\'achat dans mes données',
];

const MOCK_RESPONSES: Record<string, string> = {
  default: `Je suis votre assistant commercial GrowthOS. Je peux vous aider à :

**Analyse & Intelligence**
• Identifier vos deals à risque et opportunities
• Analyser vos taux de conversion par source/secteur
• Détecter les signaux d'achat dans vos prospects

**Rédaction**
• Emails de prospection personnalisés
• Relances et follow-ups
• Pitchs et présentations

**Stratégie**
• Recommandations de priorisation
• Suggestions de workflows
• Optimisation de vos séquences email

Comment puis-je vous aider ?`,

  pipeline: `**Analyse de votre pipeline :**

Votre pipeline actuel montre quelques points d'attention :

🟡 **3 deals en négociation depuis +30 jours** — risque de stagnation
• TechVision SAS — 45 000€ — dernier contact il y a 12 jours
• Innova Group — 28 000€ — aucune activité récente
• DigiCorp — 62 000€ — proposition envoyée sans réponse

🔴 **Actions recommandées :**
1. Planifier un appel de relance pour TechVision (priorité haute)
2. Envoyer un email de "break-up" à Innova Group
3. Appeler DigiCorp pour obtenir un retour sur la proposition

✅ **Points positifs :**
• 2 deals en phase de closing avec forte probabilité
• Pipeline total sain à 380k€`,

  email: `**Email de prospection — Startup Tech :**

---
**Objet :** {{first_name}}, une question sur votre stack sales

Bonjour {{first_name}},

J'ai vu que {{company}} vient de {{recent_event}}. Félicitations !

En travaillant avec des startups similaires dans votre secteur, j'ai constaté que la principale friction dans leur croissance est souvent la prospection manuelle — qui prend 60% du temps commercial pour seulement 20% des résultats.

GrowthOS automatise ce travail : scraping LinkedIn, séquences email intelligentes, et signaux d'achat en temps réel. Nos clients passent de 50 à 300 prospects qualifiés/mois en 6 semaines.

Seriez-vous disponible pour un échange de 20 minutes cette semaine ?

Je reste disponible,
{{sender_name}}

---
*Variables : first_name, company, recent_event, sender_name*`,

  relance: `**Analyse de vos prospects à relancer :**

Basé sur votre activité, voici les relances prioritaires cette semaine :

🔴 **Urgentes (>7 jours sans contact)**
• Marie Dupont — Acme Corp — Qualifiée — Dernier contact : 9 jours
• Thomas Martin — TechVision — Négociation — Proposition non répondue

🟡 **À planifier (3-7 jours)**
• 5 prospects "contacté" sans suivi

**Séquence recommandée :**
1. Jour 1 : Email de relance personnalisé (template "Relance J+7")
2. Jour 3 : LinkedIn InMail si pas de réponse
3. Jour 7 : Appel direct + email de "break-up"

Voulez-vous que je génère les emails de relance pour ces prospects ?`,
};

function getResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('pipeline') || lower.includes('deal') || lower.includes('risque')) return MOCK_RESPONSES.pipeline;
  if (lower.includes('email') || lower.includes('prospection') || lower.includes('rédiger')) return MOCK_RESPONSES.email;
  if (lower.includes('relancer') || lower.includes('relance') || lower.includes('semaine')) return MOCK_RESPONSES.relance;
  return MOCK_RESPONSES.default;
}

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: MOCK_RESPONSES.default,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: getResponse(msg),
      timestamp: new Date(),
    };
    setMessages(m => [...m, assistantMsg]);
    setLoading(false);
  };

  const reset = () => {
    setMessages([{ id: '0', role: 'assistant', content: MOCK_RESPONSES.default, timestamp: new Date() }]);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Agent IA GrowthOS</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>En ligne · Powered by GPT-4o</span>
            </div>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)', background: 'var(--body-bg)' }}>
          <RefreshCw size={12} />Nouvelle conversation
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? '' : 'bg-gray-100'}`}
              style={msg.role === 'assistant' ? { background: 'var(--color-primary)' } : {}}>
              {msg.role === 'assistant' ? <Bot size={14} color="#fff" /> : <User size={14} style={{ color: 'var(--text-secondary)' }} />}
            </div>
            <div className={`max-w-2xl rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={msg.role === 'assistant'
                ? { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }
                : { background: 'var(--color-primary)', color: '#fff' }}>
              <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
                  .replace(/•/g, '&nbsp;&nbsp;•'),
              }} />
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : ''}`} style={msg.role === 'assistant' ? { color: 'var(--text-muted)' } : {}}>
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary)' }}>
              <Bot size={14} color="#fff" />
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-primary)', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-primary)', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-primary)', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s.replace(/^[^\s]+ /, ''))}
                className="flex-shrink-0 text-xs px-3 py-2 rounded-xl border whitespace-nowrap hover:border-teal-300 transition-all"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-2xl border px-4 py-2" style={{ borderColor: 'var(--card-border)', background: 'var(--body-bg)' }}>
            <Sparkles size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Posez une question à votre agent commercial IA..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
              style={{ color: 'var(--text-primary)' }} />
          </div>
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          L'IA peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </div>
  );
}
