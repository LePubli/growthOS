'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RefreshCw, Copy, CheckCircle, ChevronDown, X, Plus, Settings, Zap, Brain, Target, Mail, BarChart2, Users, Lightbulb } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Message { id:string; role:'user'|'assistant'; content:string; ts:Date; provider?:string; }
interface Agent { id:string; name:string; icon:string; system:string; suggestions:{ label:string; prompt:string }[]; }

const PROVIDERS = [
  { id:'anthropic', name:'Claude (Anthropic)', model:'claude-sonnet-4-20250514', color:'#8B5CF6', available:true },
  { id:'openai', name:'GPT-4o (OpenAI)', model:'gpt-4o', color:'#10A37F', available:false },
  { id:'ollama', name:'Ollama (local)', model:'llama3.3', color:'#FF6B35', available:false },
  { id:'groq', name:'Groq / Llama 3.3', model:'llama-3.3-70b-versatile', color:'#E63946', available:false },
  { id:'qwen', name:'Qwen Turbo', model:'qwen-turbo', color:'#0070F3', available:false },
];

const AGENTS: Agent[] = [
  { id:'general', name:'Agent Général', icon:'🤖',
    system:'Tu es l\'Agent IA de GrowthOS, expert en prospection B2B et sales intelligence. Réponds en français, sois concis et actionnable.',
    suggestions:[
      { label:'Qualifier un prospect', prompt:'Aide-moi à qualifier ce prospect : DG d\'une PME SaaS 50 employés, a visité notre page pricing 3 fois. Comment approcher ?' },
      { label:'Email de prospection', prompt:'Rédige un email de prospection B2B percutant pour une agence digitale ciblant des PME industrielles. 150 mots max.' },
    ],
  },
  { id:'prospecting', name:'Agent Prospection', icon:'🎯',
    system:'Tu es un expert en prospection B2B. Tu aides à trouver et qualifier des leads, construire des ICP, définir des stratégies d\'acquisition. Réponds en français.',
    suggestions:[
      { label:'Définir mon ICP', prompt:'Aide-moi à définir mon ICP (Ideal Customer Profile) pour une solution de prospection B2B SaaS.' },
      { label:'Script appel', prompt:'Génère un script d\'appel de 2 minutes pour présenter une solution de prospection B2B à un directeur commercial.' },
    ],
  },
  { id:'email', name:'Agent Email', icon:'📧',
    system:'Tu es un copywriter expert en email marketing B2B. Tu rédiges des emails de prospection, séquences, et messages de suivi qui convertissent. Réponds en français.',
    suggestions:[
      { label:'Séquence 5 étapes', prompt:'Crée une séquence email en 5 étapes pour convertir des leads froids B2B en rendez-vous. Inclus délais et objets.' },
      { label:'Email relance', prompt:'Rédige un email de relance J+3 après un email sans réponse. Ton professionnel mais direct.' },
    ],
  },
  { id:'scoring', name:'Agent Scoring', icon:'📊',
    system:'Tu es un analyste commercial expert en scoring de prospects. Tu analyses des données pour évaluer la probabilité de conversion. Réponds en français.',
    suggestions:[
      { label:'Analyser pipeline', prompt:'J\'ai 47 prospects "Contactés", 12 "Qualifiés", 3 "En négociation", taux de conversion 3.8%. Quels leviers pour améliorer ?' },
      { label:'Critères scoring', prompt:'Quels sont les 10 meilleurs critères de scoring pour qualifier des leads B2B SaaS ?' },
    ],
  },
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [agent, setAgent] = useState(AGENTS[0]);
  const [showProviders, setShowProviders] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [copied, setCopied] = useState<string|null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  

  // Vérifier le provider depuis l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agentId = params.get('agent');
    if (agentId) {
      const found = AGENTS.find(a=>a.id===agentId);
      if (found) { setAgent(found); }
    }
    initMessages(agent);
  }, []);

  function initMessages(ag: Agent) {
    setMessages([{
      id:'0', role:'assistant', ts:new Date(), provider:provider.id,
      content:`## ${ag.icon} ${ag.name}\n\nJe suis votre **${ag.name}** GrowthOS, propulsé par **${provider.name}**.\n\nComment puis-je vous aider aujourd'hui ?`,
    }]);
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const copyMsg = (id:string, content:string) => { navigator.clipboard.writeText(content); setCopied(id); setTimeout(()=>setCopied(null),2000); };

  const sendMessage = async (content: string) => {
    if (!content.trim()||loading) return;
    const userMsg: Message = { id:Date.now().toString(), role:'user', content:content.trim(), ts:new Date() };
    setMessages(m=>[...m,userMsg]);
    setInput('');
    setLoading(true);
    try {
       
      const history = [...messages, userMsg].filter(m=>m.id!=='0').map(m=>({role:m.role,content:m.content}));
      const res = await fetch(`${API}/api/v1/ai/chat`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ messages:history, systemPrompt:agent.system, provider:provider.id, model:provider.model, maxTokens:1024 }),
      });
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      const text = data.content||data.text||data.message||'Désolé, pas de réponse.';
      setMessages(m=>[...m,{id:(Date.now()+1).toString(),role:'assistant',content:text,ts:new Date(),provider:provider.id}]);
    } catch(e:any) {
      setMessages(m=>[...m,{id:(Date.now()+1).toString(),role:'assistant',content:`❌ **Erreur** : ${e.message}\n\nVérifiez que \`ANTHROPIC_API_KEY\` est configuré dans Coolify.`,ts:new Date()}]);
    } finally { setLoading(false); }
  };

  const fmt = (text:string) => text
    .replace(/^## (.*)/gm,'<h2 class="text-sm font-bold text-gray-900 mt-3 mb-1">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/^- (.*)/gm,'<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/`(.*?)`/g,'<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n\n/g,'<br/><br/>').replace(/\n/g,'<br/>');

  return (
    <div className="flex flex-col h-screen" style={{background:'var(--body-bg)'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{background:'var(--color-primary-light)'}}>{agent.icon}</div>
          <div>
            <div className="font-bold text-sm" style={{color:'var(--text-primary)'}}>{agent.name}</div>
            <div className="text-xs" style={{color:'var(--text-muted)'}}>GrowthOS Intelligence · {provider.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sélecteur agent */}
          <div className="relative">
            <button onClick={()=>{setShowAgents(o=>!o);setShowProviders(false);}}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border" style={{background:'var(--body-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
              <Brain className="w-3.5 h-3.5"/>{agent.name}<ChevronDown className="w-3 h-3"/>
            </button>
            {showAgents && (
              <div className="absolute right-0 top-9 rounded-xl shadow-lg z-10 w-56 overflow-hidden border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
                {AGENTS.map(a=>(
                  <button key={a.id} onClick={()=>{setAgent(a);setShowAgents(false);initMessages(a);}}
                    className="w-full text-left px-4 py-2.5 hover:opacity-80 border-b flex items-center gap-2" style={{background:agent.id===a.id?'var(--color-primary-light)':'transparent',borderColor:'var(--card-border)',color:'var(--text-primary)'}}>
                    <span>{a.icon}</span>
                    <div><div className="text-sm font-medium">{a.name}</div></div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Sélecteur provider */}
          <div className="relative">
            <button onClick={()=>{setShowProviders(o=>!o);setShowAgents(false);}}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border" style={{background:'var(--body-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:provider.color,display:'inline-block'}}/>
              {provider.name}<ChevronDown className="w-3 h-3"/>
            </button>
            {showProviders && (
              <div className="absolute right-0 top-9 rounded-xl shadow-lg z-10 w-56 overflow-hidden border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
                {PROVIDERS.map(p=>(
                  <button key={p.id} onClick={()=>{if(p.available){setProvider(p);setShowProviders(false);}}}
                    className="w-full text-left px-4 py-2.5 border-b" style={{background:provider.id===p.id?'var(--color-primary-light)':'transparent',borderColor:'var(--card-border)',cursor:p.available?'pointer':'not-allowed',opacity:p.available?1:0.5}}>
                    <div className="flex items-center gap-2">
                      <span style={{width:8,height:8,borderRadius:'50%',background:p.color,display:'inline-block',flexShrink:0}}/>
                      <div>
                        <div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{p.name}</div>
                        {!p.available && <div className="text-xs" style={{color:'var(--text-muted)'}}>Configurer dans Paramètres → API</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>initMessages(agent)} className="p-1.5 rounded-lg" style={{color:'var(--text-muted)'}} title="Nouvelle conversation">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map(msg=>(
          <div key={msg.id} className={`flex gap-3 ${msg.role==='user'?'flex-row-reverse':''}`}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:msg.role==='assistant'?'var(--color-primary)':'var(--card-border)'}}>
              {msg.role==='assistant'?<span style={{fontSize:14}}>{agent.icon}</span>:<User className="w-4 h-4" style={{color:'var(--text-secondary)'}}/>}
            </div>
            <div className={`group max-w-[78%] flex flex-col ${msg.role==='user'?'items-end':''}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role==='user'?'rounded-tr-sm':'rounded-tl-sm'}`}
                style={msg.role==='user'?{background:'var(--color-primary)',color:'#fff'}:{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}
                dangerouslySetInnerHTML={{ __html: fmt(msg.content) }}/>
              <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs" style={{color:'var(--text-muted)'}}>{msg.ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                {msg.role==='assistant'&&<button onClick={()=>copyMsg(msg.id,msg.content)} style={{color:'var(--text-muted)'}}>
                  {copied===msg.id?<CheckCircle className="w-3.5 h-3.5 text-green-500"/>:<Copy className="w-3.5 h-3.5"/>}
                </button>}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--color-primary)'}}><span style={{fontSize:14}}>{agent.icon}</span></div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
              <div className="flex items-center gap-1.5">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{background:'var(--color-primary)',animationDelay:`${d}ms`}}/>)}</div>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Suggestions */}
      {messages.length<=1 && (
        <div className="px-5 pb-3">
          <p className="text-xs mb-2 font-medium" style={{color:'var(--text-muted)'}}>Suggestions rapides</p>
          <div className="flex flex-wrap gap-2">
            {agent.suggestions.map((s,i)=>(
              <button key={i} onClick={()=>sendMessage(s.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border hover:opacity-80 transition-all"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 flex-shrink-0 border-t" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="flex items-end gap-3">
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input);}}}
            placeholder={`Parler à ${agent.name}...`}
            rows={1} style={{resize:'none',minHeight:'44px',maxHeight:'120px',flex:1,padding:'10px 14px',borderRadius:12,border:'1px solid var(--card-border)',outline:'none',fontSize:13,background:'var(--body-bg)',color:'var(--text-primary)',fontFamily:'var(--font-sans)'}}
            onInput={e=>{const el=e.target as HTMLTextAreaElement;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}}
          />
          <button onClick={()=>sendMessage(input)} disabled={!input.trim()||loading}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            style={{background:'var(--color-primary)',color:'#fff'}}>
            {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Send className="w-5 h-5"/>}
          </button>
        </div>
        <p className="text-xs mt-2" style={{color:'var(--text-muted)'}}>Propulsé par {provider.name} · {agent.name}</p>
      </div>

      {/* Close dropdowns */}
      {(showProviders||showAgents)&&<div className="fixed inset-0 z-0" onClick={()=>{setShowProviders(false);setShowAgents(false);}}/>}
    </div>
  );
}
