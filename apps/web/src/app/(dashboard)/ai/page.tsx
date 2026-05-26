'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Target, Mail, Users, BarChart2, Zap, RefreshCw, Copy, CheckCircle, ChevronDown, Lightbulb } from 'lucide-react';

interface Message { id: string; role: 'user'|'assistant'; content: string; ts: Date; }

const SUGGESTIONS = [
  { icon:<Target className="w-4 h-4"/>, label:'Qualifier un prospect', prompt:'Aide-moi à qualifier ce prospect : DG d\'une PME SaaS 50 employés, a visité notre page pricing 3 fois. Comment approcher ?' },
  { icon:<Mail className="w-4 h-4"/>, label:'Email de prospection', prompt:'Rédige un email de prospection B2B percutant pour une agence digitale ciblant des PME industrielles. 150 mots max, ton professionnel.' },
  { icon:<Users className="w-4 h-4"/>, label:'Séquence 5 étapes', prompt:'Crée une séquence email en 5 étapes pour convertir des leads froids B2B en rendez-vous commerciaux. Inclus les délais et objets.' },
  { icon:<BarChart2 className="w-4 h-4"/>, label:'Analyser mon pipeline', prompt:'J\'ai 47 prospects "Contactés", 12 "Qualifiés", 3 "En négociation", taux de conversion 3.8%. Quels leviers pour améliorer ?' },
  { icon:<Zap className="w-4 h-4"/>, label:'Script appel commercial', prompt:'Génère un script d\'appel de 2 minutes pour présenter une solution de prospection B2B à un directeur commercial de PME.' },
  { icon:<Lightbulb className="w-4 h-4"/>, label:'ICP & Persona', prompt:'Aide-moi à définir mon ICP (Ideal Customer Profile) pour une solution de prospection B2B SaaS. Quels critères utiliser ?' },
];

const SYSTEM = `Tu es l'Agent IA de GrowthOS, expert en prospection B2B et sales intelligence.

Tu aides les équipes commerciales à :
- Qualifier et scorer les prospects B2B (ICP, BANT, MEDDIC)
- Rédiger des emails de prospection personnalisés et percutants
- Créer des séquences email multiétapes avec timing optimal
- Analyser et optimiser les pipelines commerciaux
- Construire des scripts d'appel et techniques de closing
- Définir leur ICP et stratégies d'acquisition
- Automatiser leurs workflows commerciaux avec GrowthOS
- Interpréter les signaux d'intention d'achat

Réponds UNIQUEMENT sur ces sujets. Sois concis, actionnable, avec des exemples concrets.
Utilise des listes et du formatage markdown quand c'est utile. Réponds en français.`;

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id:'0', role:'assistant', ts: new Date(),
    content: '## Bonjour ! Je suis votre Agent IA GrowthOS 👋\n\nSpécialisé en **prospection B2B** et **sales intelligence**, je peux vous aider à :\n\n- 🎯 **Qualifier** vos prospects et définir votre ICP\n- ✉️ **Rédiger** des emails et séquences de prospection\n- 📊 **Analyser** votre pipeline et améliorer vos taux\n- 📞 **Créer** des scripts d\'appel et stratégies commerciales\n- ⚡ **Automatiser** vos workflows dans GrowthOS\n\nChoisissez une suggestion ou posez votre question directement.',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string|null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role:'user', content:content.trim(), ts:new Date() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token') || '';
      // Appel via le backend proxy (clé API côté serveur)
      const res = await fetch(`${API}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({
          messages: [...messages, userMsg]
            .filter(m => m.id !== '0')
            .map(m => ({ role:m.role, content:m.content })),
          systemPrompt: SYSTEM,
          provider: 'anthropic',
          maxTokens: 1024,
        }),
      });

      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      const text = data.content || data.text || 'Désolé, pas de réponse.';
      setMessages(m => [...m, { id:(Date.now()+1).toString(), role:'assistant', content:text, ts:new Date() }]);
    } catch {
      setMessages(m => [...m, { id:(Date.now()+1).toString(), role:'assistant', content:'❌ Erreur de connexion. Vérifiez que `ANTHROPIC_API_KEY` est configuré dans Coolify et réessayez.', ts:new Date() }]);
    } finally { setLoading(false); }
  };

  const fmt = (text: string) => text
    .replace(/^## (.*)/gm, '<h2 class="text-base font-bold text-gray-900 mt-3 mb-1">$1</h2>')
    .replace(/^### (.*)/gm, '<h3 class="text-sm font-semibold text-gray-800 mt-2 mb-1">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
          <div><h1 className="font-bold text-gray-900">Agent IA GrowthOS</h1><p className="text-xs text-gray-400">Expert B2B Prospecting & Sales Intelligence · Claude by Anthropic</p></div>
        </div>
        <button onClick={() => setMessages([messages[0]])} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role==='user'?'flex-row-reverse':''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role==='assistant'?'bg-gradient-to-br from-teal-500 to-blue-600':'bg-gray-200'}`}>
              {msg.role==='assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-600" />}
            </div>
            <div className={`group max-w-[78%] flex flex-col ${msg.role==='user'?'items-end':''}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role==='user'?'bg-teal-600 text-white rounded-tr-sm':'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}
                dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
              <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-gray-400">{msg.ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                {msg.role==='assistant' && <button onClick={() => copyMsg(msg.id, msg.content)} className="text-gray-400 hover:text-gray-600">
                  {copied===msg.id ? <CheckCircle className="w-3.5 h-3.5 text-teal-600"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-white" /></div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0,150,300].map(d => <div key={d} className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3">
          <p className="text-xs text-gray-400 mb-2 font-medium">Suggestions rapides</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s,i) => (
              <button key={i} onClick={() => sendMessage(s.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-teal-300 hover:text-teal-600 transition-all shadow-sm">
                {s.icon}{s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-end gap-3">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input);} }}
            placeholder="Posez votre question B2B... (Entrée pour envoyer)"
            rows={1} style={{resize:'none',minHeight:'44px',maxHeight:'120px'}}
            onInput={e => { const el=e.target as HTMLTextAreaElement; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim()||loading}
            className="w-11 h-11 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 flex-shrink-0">
            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Propulsé par Claude (Anthropic) · Données traitées côté serveur</p>
      </div>
    </div>
  );
}
