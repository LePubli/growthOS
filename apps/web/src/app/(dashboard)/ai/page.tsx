'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Target, Mail, Users, BarChart2, Zap, RefreshCw, Copy, CheckCircle, ChevronDown } from 'lucide-react';

interface Message { id: string; role: 'user' | 'assistant'; content: string; createdAt: Date; }

const SUGGESTIONS = [
  { icon: <Target className="w-4 h-4" />, label: 'Qualifier un prospect', prompt: 'Aide-moi à qualifier ce prospect : entreprise SaaS de 50 employés, responsable marketing, a visité notre page pricing 3 fois cette semaine.' },
  { icon: <Mail className="w-4 h-4" />, label: 'Rédiger un email de prospection', prompt: 'Rédige un email de prospection B2B pour une agence digitale qui cible des PME industrielles. Ton : professionnel mais accessible, 150 mots max.' },
  { icon: <Users className="w-4 h-4" />, label: 'Stratégie de séquence', prompt: 'Propose une séquence email en 5 étapes pour convertir des leads froids en rendez-vous commerciaux dans le secteur IT.' },
  { icon: <BarChart2 className="w-4 h-4" />, label: 'Analyser mon pipeline', prompt: 'J\'ai 47 prospects en phase "Contacté", 12 en "Qualifié" et 3 en "Négociation". Mon taux de conversion est de 3.8%. Que me conseilles-tu pour améliorer ces chiffres ?' },
  { icon: <Zap className="w-4 h-4" />, label: 'Automatisation workflow', prompt: 'Je veux automatiser le suivi des prospects qui ouvrent mes emails sans répondre. Quels triggers et actions me conseilles-tu dans GrowthOS ?' },
  { icon: <Target className="w-4 h-4" />, label: 'Script d\'appel commercial', prompt: 'Génère un script d\'appel commercial de 2 minutes pour présenter une solution de prospection B2B à un directeur commercial d\'une PME de 20 personnes.' },
];

const SYSTEM_PROMPT = `Tu es l'Agent IA de GrowthOS, une plateforme B2B de prospection commerciale et growth intelligence.

Tu aides les équipes commerciales et marketing avec :
- Qualification et scoring de prospects B2B
- Rédaction d'emails de prospection personnalisés et de séquences email
- Stratégies de pipeline commercial et CRM
- Analyse de données de vente et recommandations
- Automatisation des workflows commerciaux
- Scripts d'appel et techniques de closing
- Recherche d'entreprises cibles (ICP, TAM)
- Optimisation des taux de conversion

Tu as accès au contexte de GrowthOS : prospects, deals, séquences email, signaux d'intention, plugins.
Réponds en français, de manière concise et actionnable. Fournis des exemples concrets quand c'est utile.
Ne réponds qu'aux sujets liés à la prospection B2B, au sales, au marketing et à l'utilisation de GrowthOS.`;

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0', role: 'assistant',
      content: 'Bonjour ! Je suis votre Agent IA GrowthOS, spécialisé en prospection B2B et growth commercial.\n\nJe peux vous aider à :\n- **Qualifier et scorer** vos prospects\n- **Rédiger** des emails et séquences de prospection\n- **Analyser** votre pipeline et suggérer des améliorations\n- **Automatiser** vos workflows commerciaux\n- **Créer** des scripts d\'appel et stratégies commerciales\n\nQue souhaitez-vous faire aujourd\'hui ?',
      createdAt: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [showModel, setShowModel] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: content.trim(), createdAt: new Date() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg].filter(m => m.id !== '0').map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: history.length > 0 ? history : [{ role: 'user', content: content.trim() }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || 'Désolé, je n\'ai pas pu générer une réponse.';
      setMessages(m => [...m, { id: (Date.now()+1).toString(), role: 'assistant', content: text, createdAt: new Date() }]);
    } catch (err) {
      setMessages(m => [...m, { id: (Date.now()+1).toString(), role: 'assistant', content: 'Une erreur s\'est produite. Vérifiez votre connexion et réessayez.', createdAt: new Date() }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Agent IA GrowthOS</h1>
            <p className="text-xs text-gray-400">Spécialiste B2B Prospecting & Sales Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Model selector */}
          <div className="relative">
            <button onClick={() => setShowModel(!showModel)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-xl text-xs text-gray-600 hover:bg-gray-200">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              {model.includes('sonnet') ? 'Sonnet 4' : 'Opus 4'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModel && (
              <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-10 w-48 overflow-hidden">
                {[
                  { id:'claude-sonnet-4-20250514', label:'Claude Sonnet 4', desc:'Rapide & équilibré' },
                  { id:'claude-opus-4-5', label:'Claude Opus 4', desc:'Plus puissant' },
                ].map(m => (
                  <button key={m.id} onClick={() => { setModel(m.id); setShowModel(false); }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${model === m.id ? 'bg-teal-50' : ''}`}>
                    <div className="text-sm font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-400">{m.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setMessages([messages[0]])}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-gradient-to-br from-teal-500 to-blue-600' : 'bg-gray-200'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-600" />}
            </div>
            <div className={`group max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}
                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
              />
              <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-gray-400">
                  {msg.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && (
                  <button onClick={() => copyMsg(msg.id, msg.content)} className="text-gray-400 hover:text-gray-600">
                    {copied === msg.id ? <CheckCircle className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-400 mb-2">Suggestions rapides</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-teal-300 hover:text-teal-600 transition-all">
                {s.icon}{s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey} placeholder="Demandez à l'Agent IA... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
              rows={1}
              style={{ resize: 'none', minHeight: '44px', maxHeight: '120px' }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              onInput={e => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="w-11 h-11 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition-all flex-shrink-0">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Propulsé par Claude (Anthropic) · Spécialisé B2B prospecting</p>
      </div>
    </div>
  );
}
