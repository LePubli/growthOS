import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Sparkles, Loader2, RefreshCw, Settings, X,
  ChevronDown, Plus, Trash2, CheckCircle, Zap, Search, UserPlus,
  Mail, BarChart2, Database, Server, Copy, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────── types ─────────────── */

interface Message {
  id: string; role: 'user'|'assistant'|'tool'; content: string;
  timestamp: Date; toolCalls?: ToolCall[]; model?: string;
}

interface ToolCall {
  name: string; status: 'running'|'done'|'error'; result?: string;
  args?: Record<string,any>;
}

interface McpServer {
  id: string; name: string; url: string; status: 'connected'|'disconnected'|'testing';
  tools?: string[];
}

/* ─────────────── model catalogue ─────────────── */

const MODELS = [
  { id:'gpt-4o',           provider:'openai',    label:'GPT-4o',          badge:'Rapide',   color:'#059669' },
  { id:'gpt-4-turbo',      provider:'openai',    label:'GPT-4 Turbo',     badge:'Puissant', color:'#2563EB' },
  { id:'o3-mini',          provider:'openai',    label:'o3-mini',         badge:'Raison.',  color:'#7C3AED' },
  { id:'claude-3-5-sonnet',provider:'claude',    label:'Claude 3.5 Sonnet',badge:'Expert',  color:'#D97706' },
  { id:'claude-3-haiku',   provider:'claude',    label:'Claude 3 Haiku',  badge:'Rapide',   color:'#D97706' },
  { id:'claude-3-opus',    provider:'claude',    label:'Claude 3 Opus',   badge:'Max',      color:'#DC2626' },
  { id:'qwen-max',         provider:'qwen',      label:'Qwen Max',        badge:'Puissant', color:'#7C3AED' },
  { id:'qwen-turbo',       provider:'qwen',      label:'Qwen Turbo',      badge:'Rapide',   color:'#6B7280' },
  { id:'llama3.2',         provider:'ollama',    label:'Llama 3.2',       badge:'Local',    color:'#059669' },
  { id:'mistral',          provider:'ollama',    label:'Mistral 7B',      badge:'Local',    color:'#059669' },
  { id:'codellama',        provider:'ollama',    label:'Code Llama',      badge:'Code',     color:'#2563EB' },
  { id:'deepseek-r1',      provider:'ollama',    label:'DeepSeek R1',     badge:'Raison.',  color:'#7C3AED' },
];

const PROVIDERS = [
  { id:'openai', label:'OpenAI',     icon:'🟢', desc:'GPT-4o, o3-mini...' },
  { id:'claude', label:'Anthropic',  icon:'🟠', desc:'Claude 3.5 Sonnet, Opus...' },
  { id:'qwen',   label:'Qwen',       icon:'🟣', desc:'Qwen Max, Turbo...' },
  { id:'ollama', label:'Ollama',     icon:'🖥️', desc:'Local — Llama, Mistral...' },
  { id:'mcp',    label:'MCP',        icon:'🔌', desc:'Custom MCP endpoints' },
];

/* ─────────────── mock responses ─────────────── */

const TOOL_SEQUENCES: Record<string, ToolCall[]> = {
  pipeline: [
    { name:'search_deals', status:'done', args:{filter:'at_risk'}, result:'3 deals identifiés' },
    { name:'get_deal_details', status:'done', args:{ids:['d1','d2','d3']}, result:'Données récupérées' },
    { name:'analyze_risk', status:'done', args:{deals:3}, result:'Analyse terminée' },
  ],
  prospect: [
    { name:'search_prospects', status:'done', args:{query:'startup tech Paris'}, result:'12 prospects trouvés' },
    { name:'score_prospects', status:'done', args:{count:12}, result:'Scores calculés' },
  ],
  email: [
    { name:'get_prospect_context', status:'done', args:{prospect:'target'}, result:'Contexte récupéré' },
    { name:'generate_email', status:'done', args:{tone:'professional'}, result:'Email généré' },
  ],
  create_deal: [
    { name:'create_deal', status:'done', args:{title:'Nouveau deal',value:15000,stage:'lead'}, result:'Deal créé (ID: d_new)' },
  ],
};

const MOCK_RESPONSES: Record<string,{content:string;tools?:ToolCall[]}> = {
  pipeline: {
    content:`**Analyse de votre pipeline — 3 deals à risque identifiés :**

🔴 **TechVision SAS** — 45 000€ — Négociation
→ Dernier contact il y a 12 jours, proposition sans réponse. **Action : appel de relance J+1**

🟡 **Innova Group** — 28 000€ — Qualification
→ Aucune activité depuis 3 semaines. **Action : email de rupture pour qualifier l'intérêt**

🟡 **DigiCorp** — 62 000€ — Proposition
→ Proposition envoyée il y a 8 jours. RDV de présentation à planifier.

✅ **Reste du pipeline :** 380k€ pondéré, bonne santé globale.

Voulez-je que je génère les emails de relance pour ces 3 deals ?`,
    tools: TOOL_SEQUENCES.pipeline,
  },
  email: {
    content:`**Email généré — Startup Tech :**

---
**Objet :** {{first_name}}, une question sur votre stack sales

Bonjour {{first_name}},

J'ai vu que {{company}} vient de {{recent_event}}. Félicitations !

En travaillant avec des startups similaires, j'ai constaté que la prospection manuelle prend 60% du temps commercial pour 20% des résultats.

GrowthOS automatise ce travail : scraping LinkedIn, séquences intelligentes, signaux d'achat temps réel. Nos clients passent de 50 à 300 prospects qualifiés/mois en 6 semaines.

Disponible pour 20 minutes cette semaine ?

{{sender_name}}

---
*Variables : first_name, company, recent_event, sender_name*

Voulez-vous que je l'ajoute directement à une séquence ?`,
    tools: TOOL_SEQUENCES.email,
  },
  prospect: {
    content:`**Relances prioritaires cette semaine :**

🔴 **Urgentes (>7 jours sans contact)**
• Marie Dupont — Acme Corp — Qualifiée — Dernier contact : 9j
• Thomas Martin — TechVision — Négociation — Proposition sans réponse

🟡 **À planifier (3-7 jours)**
• 5 prospects "contacté" sans suivi

**Séquence recommandée :**
1. Jour 1 : Email relance personnalisé
2. Jour 3 : LinkedIn InMail si pas de réponse
3. Jour 7 : Appel + email break-up

Voulez-vous que je lance la séquence automatiquement ?`,
    tools: TOOL_SEQUENCES.prospect,
  },
  default: {
    content:`Je suis votre **Agent Commercial IA GrowthOS**. Je peux agir directement sur votre CRM :

**📊 Analyse**
• Identifier les deals à risque dans votre pipeline
• Analyser les taux de conversion par source et secteur
• Détecter les signaux d'achat dans vos prospects

**✍️ Rédaction**
• Générer des emails personnalisés avec contexte prospect
• Créer des séquences de relance optimisées
• Rédiger des pitchs et propositions commerciales

**⚡ Actions directes**
• Créer des deals et prospects dans le CRM
• Lancer des séquences email depuis le chat
• Planifier des relances et activités

**🔌 Outils connectés**
• Accès pipeline, prospects, signaux, analytics
• Intégration MCP pour vos outils externes

Comment puis-je vous aider ?`,
  },
};

function getResponse(message:string):{content:string;tools?:ToolCall[]} {
  const lower = message.toLowerCase();
  if (lower.includes('pipeline')||lower.includes('deal')||lower.includes('risque')) return MOCK_RESPONSES.pipeline;
  if (lower.includes('email')||lower.includes('rédiger')||lower.includes('prospection')) return MOCK_RESPONSES.email;
  if (lower.includes('relancer')||lower.includes('relance')||lower.includes('semaine')) return MOCK_RESPONSES.prospect;
  return MOCK_RESPONSES.default;
}

const SUGGESTIONS = [
  { icon:'📊', text:'Analyser mon pipeline et identifier les deals à risque' },
  { icon:'✉️', text:'Rédiger un email de prospection pour une startup tech' },
  { icon:'🎯', text:'Quels prospects dois-je relancer cette semaine ?' },
  { icon:'📈', text:'Comment améliorer mon taux de conversion ?' },
  { icon:'⚡', text:'Créer un deal pour AlphaTech — 18 000€' },
];

/* ─────────────── MCP panel ─────────────── */

function McpPanel({ servers, onAdd, onRemove, onTest }: {
  servers: McpServer[]; onAdd:(s:McpServer)=>void; onRemove:(id:string)=>void; onTest:(id:string)=>void;
}) {
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const add = () => {
    if (!newUrl||!newName) return;
    onAdd({ id:crypto.randomUUID(), name:newName, url:newUrl, status:'disconnected' });
    setNewUrl(''); setNewName('');
  };
  return (
    <div>
      <h3 style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Serveurs MCP</h3>
      {servers.map(s=>(
        <div key={s.id} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)', marginBottom:7 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:s.status==='connected'?'#22C55E':s.status==='testing'?'#D97706':'#EF4444', flexShrink:0 }}/>
            <span style={{ fontWeight:600, fontSize:12, color:'var(--text-primary)', flex:1 }}>{s.name}</span>
            <button onClick={()=>onTest(s.id)} style={{ fontSize:10, padding:'2px 7px', borderRadius:6, border:'1px solid var(--card-border)', background:'transparent', cursor:'pointer', color:'var(--text-muted)' }}>
              {s.status==='testing'?'..':'Test'}
            </button>
            <button onClick={()=>onRemove(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', display:'flex', padding:2 }}><X size={11}/></button>
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.url}</div>
          {s.tools && <div style={{ marginTop:5, display:'flex', gap:4, flexWrap:'wrap' }}>
            {s.tools.map(t=><span key={t} style={{ fontSize:9, padding:'1px 6px', borderRadius:9999, background:'var(--card-bg)', color:'var(--text-muted)', border:'1px solid var(--card-border)' }}>{t}</span>)}
          </div>}
        </div>
      ))}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nom du serveur"
          style={{ width:'100%', padding:'6px 10px', border:'1px solid var(--card-border)', borderRadius:8, fontSize:12, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}/>
        <input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://mcp.example.com/sse"
          style={{ width:'100%', padding:'6px 10px', border:'1px solid var(--card-border)', borderRadius:8, fontSize:12, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}/>
        <button onClick={add} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          <Plus size={11} style={{ display:'inline', marginRight:4 }}/>Ajouter
        </button>
      </div>
    </div>
  );
}

/* ─────────────── main ─────────────── */

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id:'0', role:'assistant', content:MOCK_RESPONSES.default.content, timestamp:new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    { id:'1', name:'GrowthOS Internal', url:'https://api.growthos.io/mcp/sse', status:'connected', tools:['search_prospects','create_deal','send_email','get_signals'] },
  ]);
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('Tu es un expert commercial B2B SaaS. Réponds en français, de façon concise et actionnable. Tu as accès au CRM GrowthOS.');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  const send = async (text?:string) => {
    const msg = text||input.trim();
    if (!msg||loading) return;
    setInput('');

    const userMsg:Message = { id:crypto.randomUUID(), role:'user', content:msg, timestamp:new Date() };
    setMessages(m=>[...m,userMsg]);
    setLoading(true);

    const resp = getResponse(msg);

    // Simulate tool calls streaming
    if (resp.tools?.length) {
      const toolMsg:Message = { id:crypto.randomUUID(), role:'tool', content:'', timestamp:new Date(), toolCalls:resp.tools.map(t=>({...t,status:'running' as const})) };
      setMessages(m=>[...m,toolMsg]);
      await new Promise(r=>setTimeout(r,600));
      // Mark done one by one
      for (let i=0; i<resp.tools.length; i++) {
        await new Promise(r=>setTimeout(r,400));
        setMessages(m=>m.map(msg=>msg.id===toolMsg.id?{...msg,toolCalls:msg.toolCalls?.map((tc,j)=>j===i?{...tc,status:'done' as const}:tc)}:msg));
      }
    } else {
      await new Promise(r=>setTimeout(r,800+Math.random()*600));
    }

    const assistantMsg:Message = { id:crypto.randomUUID(), role:'assistant', content:resp.content, timestamp:new Date(), model:selectedModel.label };
    setMessages(m=>[...m,assistantMsg]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const reset = () => {
    setMessages([{ id:'0', role:'assistant', content:MOCK_RESPONSES.default.content, timestamp:new Date() }]);
    toast.success('Nouvelle conversation démarrée');
  };

  const copy = (text:string) => { navigator.clipboard.writeText(text); toast.success('Copié'); };

  const addMcp = (s:McpServer) => setMcpServers(p=>[...p,s]);
  const removeMcp = (id:string) => setMcpServers(p=>p.filter(s=>s.id!==id));
  const testMcp = (id:string) => {
    setMcpServers(p=>p.map(s=>s.id===id?{...s,status:'testing'}:s));
    setTimeout(()=>setMcpServers(p=>p.map(s=>s.id===id?{...s,status:'connected',tools:['search','create','update']}:s)), 1500);
  };

  const providerModels = MODELS.filter(m=>m.provider===selectedProvider||(selectedProvider==='mcp'&&false));

  return (
    <div style={{ height:'100vh', display:'flex', background:'var(--body-bg)', overflow:'hidden' }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width:260, flexShrink:0, borderRight:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid var(--card-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Bot size={16} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>Agent IA</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>GrowthOS · {selectedModel.label}</div>
            </div>
          </div>
          <button onClick={reset} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 0', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Plus size={12}/>Nouvelle conversation
          </button>
        </div>

        {/* Provider tabs */}
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--card-border)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Fournisseur</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {PROVIDERS.map(p=>(
              <button key={p.id} onClick={()=>{setSelectedProvider(p.id);if(p.id!=='mcp'){const m=MODELS.find(m=>m.provider===p.id);if(m)setSelectedModel(m);}}}
                style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:9, border:'none', cursor:'pointer', background:selectedProvider===p.id?'var(--color-primary)':'transparent', color:selectedProvider===p.id?'#fff':'var(--text-secondary)', textAlign:'left', transition:'all .12s' }}>
                <span style={{ fontSize:14 }}>{p.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{p.label}</div>
                  <div style={{ fontSize:10, opacity:.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Model selection */}
        {selectedProvider!=='mcp' && (
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--card-border)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Modèle</div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {providerModels.map(m=>(
                <button key={m.id} onClick={()=>setSelectedModel(m)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:9, border:`1px solid ${selectedModel.id===m.id?m.color:'transparent'}`, cursor:'pointer', background:selectedModel.id===m.id?`${m.color}12`:'transparent', textAlign:'left', transition:'all .12s' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:m.color, flexShrink:0 }}/>
                  <span style={{ fontSize:12, fontWeight:selectedModel.id===m.id?700:500, color:'var(--text-secondary)', flex:1 }}>{m.label}</span>
                  <span style={{ fontSize:9, padding:'1px 6px', borderRadius:9999, background:`${m.color}15`, color:m.color, fontWeight:700, whiteSpace:'nowrap' }}>{m.badge}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MCP config */}
        {selectedProvider==='mcp' && (
          <div style={{ padding:'10px 12px', flex:1, overflowY:'auto' }}>
            <McpPanel servers={mcpServers} onAdd={addMcp} onRemove={removeMcp} onTest={testMcp}/>
          </div>
        )}

        {/* Settings */}
        {selectedProvider!=='mcp' && (
          <div style={{ padding:'10px 12px', borderTop:'1px solid var(--card-border)', marginTop:'auto' }}>
            <button onClick={()=>setShowSettings(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', width:'100%' }}>
              <Settings size={12}/>Paramètres avancés
              <ChevronDown size={11} style={{ marginLeft:'auto', transform:showSettings?'rotate(180deg)':'none', transition:'transform .2s' }}/>
            </button>
            {showSettings && (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Température : <strong style={{ color:'var(--color-primary)' }}>{temperature}</strong></label>
                  <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e=>setTemperature(+e.target.value)} style={{ width:'100%', accentColor:'var(--color-primary)' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>System prompt</label>
                  <textarea value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)} rows={3}
                    style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--card-border)', borderRadius:8, fontSize:11, background:'var(--body-bg)', color:'var(--text-primary)', outline:'none', resize:'none', boxSizing:'border-box' }}/>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CENTER CHAT ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Chat header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--card-border)', background:'var(--card-bg)', flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>{selectedModel.label}</span>
              <span style={{ fontSize:10, padding:'1px 7px', borderRadius:9999, background:`${selectedModel.color}15`, color:selectedModel.color, fontWeight:700 }}>{selectedModel.badge}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E' }}/>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>En ligne</span>
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {mcpServers.filter(s=>s.status==='connected').length} serveur{mcpServers.filter(s=>s.status==='connected').length>1?'s':''} MCP · temp {temperature}
            </div>
          </div>
          <button onClick={()=>setShowTools(v=>!v)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:`1px solid ${showTools?'var(--color-primary)':'var(--card-border)'}`, background:showTools?'var(--color-primary)':'var(--card-bg)', color:showTools?'#fff':'var(--text-secondary)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            <Zap size={12}/>Outils
          </button>
          <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
            <RefreshCw size={12}/>Reset
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
          {messages.map(msg=>{
            if (msg.role==='tool') return (
              <div key={msg.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:28, height:28, borderRadius:9, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Zap size={12} color="#7C3AED"/>
                </div>
                <div style={{ flex:1, padding:'10px 14px', borderRadius:12, background:'var(--card-bg)', border:'1px solid #EDE9FE' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#7C3AED', marginBottom:8 }}>APPELS D'OUTILS</div>
                  {msg.toolCalls?.map((tc,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:7, background:'var(--body-bg)', marginBottom:4 }}>
                      {tc.status==='running' ? <Loader2 size={11} color="#7C3AED" className="animate-spin"/> : <CheckCircle size={11} color="#059669"/>}
                      <code style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'monospace' }}>{tc.name}</code>
                      {tc.args && <span style={{ fontSize:10, color:'var(--text-muted)' }}>{JSON.stringify(tc.args).slice(0,40)}…</span>}
                      {tc.status==='done'&&tc.result && <span style={{ fontSize:10, color:'#059669', marginLeft:'auto', whiteSpace:'nowrap' }}>{tc.result}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );

            return (
              <div key={msg.id} style={{ display:'flex', gap:10, flexDirection:msg.role==='user'?'row-reverse':'row', alignItems:'flex-start' }}>
                <div style={{ width:30, height:30, borderRadius:9, background:msg.role==='assistant'?'var(--color-primary)':'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {msg.role==='assistant' ? <Bot size={15} color="#fff"/> : <User size={15} color="#6B7280"/>}
                </div>
                <div style={{ maxWidth:'72%' }}>
                  <div style={{ padding:'12px 16px', borderRadius:msg.role==='user'?'16px 4px 16px 16px':'4px 16px 16px 16px', background:msg.role==='assistant'?'var(--card-bg)':'var(--color-primary)', border:msg.role==='assistant'?'1px solid var(--card-border)':'none', color:msg.role==='user'?'#fff':'var(--text-primary)' }}>
                    <div style={{ fontSize:13, lineHeight:1.65, whiteSpace:'pre-wrap' }} dangerouslySetInnerHTML={{ __html:msg.content.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>') }}/>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, paddingLeft:msg.role==='user'?0:4 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{msg.timestamp.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                    {msg.model && <span style={{ fontSize:10, color:'var(--text-muted)' }}>· {msg.model}</span>}
                    {msg.role==='assistant' && (
                      <button onClick={()=>copy(msg.content)} style={{ display:'flex', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:11 }}>
                        <Copy size={10}/>Copier
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:9, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Bot size={15} color="#fff"/>
              </div>
              <div style={{ padding:'12px 16px', borderRadius:'4px 16px 16px 16px', background:'var(--card-bg)', border:'1px solid var(--card-border)', display:'flex', gap:5, alignItems:'center' }}>
                {[0,150,300].map(d=><div key={d} style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)', animation:'bounce 1s infinite', animationDelay:`${d}ms` }}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestions */}
        {messages.length<=1 && (
          <div style={{ padding:'0 24px 10px', flexShrink:0 }}>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
              {SUGGESTIONS.map((s,i)=>(
                <button key={i} onClick={()=>send(s.text)}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
                  <span>{s.icon}</span>{s.text.slice(0,35)}…
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'12px 20px 16px', borderTop:'1px solid var(--card-border)', background:'var(--card-bg)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, borderRadius:14, border:'1px solid var(--card-border)', background:'var(--body-bg)', padding:'10px 14px' }}>
              <Sparkles size={14} style={{ color:'var(--color-primary)', flexShrink:0 }}/>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
                placeholder={`Demandez quelque chose à ${selectedModel.label}…`}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-primary)' }}/>
            </div>
            <button onClick={()=>send()} disabled={!input.trim()||loading}
              style={{ width:42, height:42, borderRadius:12, border:'none', background:'var(--color-primary)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:(!input.trim()||loading)?0.5:1, transition:'opacity .15s' }}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            </button>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, paddingLeft:2 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Entrée pour envoyer · Shift+Entrée pour saut de ligne</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{selectedModel.label} · temp {temperature}</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Tools ── */}
      {showTools && (
        <div style={{ width:240, flexShrink:0, borderLeft:'1px solid var(--card-border)', background:'var(--card-bg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--card-border)' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:2 }}>Outils disponibles</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Actions que l'IA peut exécuter</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12 }}>
            {[
              { icon:<Search size={12}/>, name:'search_prospects', desc:'Recherche dans le CRM', c:'#2563EB', bg:'#EFF6FF' },
              { icon:<UserPlus size={12}/>, name:'create_prospect', desc:'Créer un prospect', c:'#059669', bg:'#ECFDF5' },
              { icon:<BarChart2 size={12}/>, name:'get_pipeline', desc:'Analyse pipeline', c:'#7C3AED', bg:'#F5F3FF' },
              { icon:<Database size={12}/>, name:'create_deal', desc:'Créer un deal', c:'#D97706', bg:'#FFFBEB' },
              { icon:<Mail size={12}/>, name:'send_email', desc:'Envoyer un email', c:'#DC2626', bg:'#FEF2F2' },
              { icon:<Zap size={12}/>, name:'get_signals', desc:'Signaux d\'intention', c:'#F59E0B', bg:'#FFFBEB' },
              { icon:<Server size={12}/>, name:'run_sequence', desc:'Lancer une séquence', c:'#0891B2', bg:'#ECFEFF' },
            ].map(t=>(
              <div key={t.name} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, background:'var(--body-bg)', marginBottom:6 }}>
                <div style={{ width:26, height:26, borderRadius:7, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', color:t.c, flexShrink:0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', fontFamily:'monospace' }}>{t.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{t.desc}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Serveurs MCP</div>
              {mcpServers.map(s=>(
                <div key={s.id} style={{ padding:'7px 10px', borderRadius:9, background:'var(--body-bg)', marginBottom:5 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:s.status==='connected'?'#22C55E':'#EF4444', flexShrink:0 }}/>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                  </div>
                  {s.tools && <div style={{ marginTop:4, display:'flex', gap:3, flexWrap:'wrap' }}>
                    {s.tools.slice(0,3).map(t=><span key={t} style={{ fontSize:9, padding:'1px 5px', borderRadius:5, background:'var(--card-bg)', color:'var(--text-muted)' }}>{t}</span>)}
                    {s.tools.length>3 && <span style={{ fontSize:9, color:'var(--text-muted)' }}>+{s.tools.length-3}</span>}
                  </div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
