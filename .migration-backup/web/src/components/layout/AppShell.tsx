'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, GitBranch, Search, Bell, Settings, Puzzle,
  Palette, Mail, Target, RefreshCw, Bot, User, Webhook, BarChart2, Download,
  Zap, ChevronDown, ChevronRight, LogOut, Plus, HelpCircle, Globe, Activity,
  Store, FileText, X, Users, Map, Phone, Calendar, BookOpen, MessageSquare,
  TrendingUp, DollarSign, Filter, Loader2, Command,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { CommandPalette } from '@/components/command/CommandPalette';

/* ══ STRUCTURE MENU (sections + sous-menus) ═════════════════════════════ */
interface SubItem { href: string; label: string; }
interface NavItem  {
  href?: string; label: string; icon: React.ReactNode;
  badge?: number; exact?: boolean;
  children?: SubItem[];
}
interface NavSection { label: string; items: NavItem[]; }

const NAV: NavSection[] = [
  {
    label: 'Tableau de bord',
    items: [
      { href:'/dashboard', label:'Dashboard', icon:<LayoutDashboard size={15}/>, exact:true },
      { href:'/analytics', label:'Analytics', icon:<BarChart2 size={15}/> },
    ],
  },
  {
    label: 'CRM & Pipeline',
    items: [
      {
        label:'Prospects', icon:<Building2 size={15}/>,
        children:[
          { href:'/prospects', label:'Tous les prospects' },
          { href:'/prospects?status=new', label:'Nouveaux' },
          { href:'/prospects?status=qualified', label:'Qualifiés' },
          { href:'/contacts', label:'Contact Intel' },
        ],
      },
      {
        label:'Pipeline', icon:<GitBranch size={15}/>,
        children:[
          { href:'/pipeline', label:'Vue Kanban' },
          { href:'/pipeline?view=list', label:'Vue liste' },
        ],
      },
    ],
  },
  {
    label: 'Acquisition',
    items: [
      {
        label:'Scraping', icon:<Search size={15}/>,
        children:[
          { href:'/sourcing', label:'Tous les scrapers' },
          { href:'/sourcing/google-maps', label:'Google Maps' },
          { href:'/sourcing/pages-jaunes', label:'Pages Jaunes' },
          { href:'/sourcing/insee', label:'INSEE / SIRENE' },
          { href:'/sourcing/societe-com', label:'Societe.com' },
          { href:'/sourcing/pappers', label:'Pappers' },
          { href:'/sourcing/linkedin', label:'LinkedIn' },
        ],
      },
      { href:'/signals', label:'Signaux', icon:<Zap size={15}/>, badge:3 },
      { href:'/inbound', label:'Inbound', icon:<Download size={15}/> },
      { href:'/abm', label:'ABM / TAM', icon:<Target size={15}/> },
    ],
  },
  {
    label: 'Marketing & Vente',
    items: [
      {
        label:'Séquences', icon:<Mail size={15}/>,
        children:[
          { href:'/sequences', label:'Toutes les séquences' },
          { href:'/sequences/new', label:'+ Nouvelle séquence' },
          { href:'/templates', label:'Templates email' },
        ],
      },
      {
        label:'Workflows', icon:<Globe size={15}/>,
        children:[
          { href:'/workflows', label:'Tous les workflows' },
          { href:'/workflows/new', label:'+ Nouveau workflow' },
        ],
      },
      { href:'/crm-sync', label:'CRM Sync', icon:<RefreshCw size={15}/> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label:'Agent IA', icon:<Bot size={15}/>,
        children:[
          { href:'/ai', label:'Conversation' },
          { href:'/ai?agent=prospecting', label:'Agent Prospection' },
          { href:'/ai?agent=email', label:'Agent Email' },
          { href:'/ai?agent=scoring', label:'Agent Scoring' },
        ],
      },
    ],
  },
  {
    label: 'Système',
    items: [
      { href:'/marketplace', label:'Marketplace', icon:<Store size={15}/> },
      { href:'/plugins', label:'Plugins', icon:<Puzzle size={15}/> },
      { href:'/themes', label:'Thèmes', icon:<Palette size={15}/> },
      { href:'/webhooks', label:'Webhooks', icon:<Webhook size={15}/> },
      {
        label:'Paramètres', icon:<Settings size={15}/>,
        children:[
          { href:'/settings/profile', label:'Profil' },
          { href:'/settings/team', label:'Équipe' },
          { href:'/settings/api', label:'API & Clés' },
          { href:'/settings/billing', label:'Facturation' },
          { href:'/settings/integrations', label:'Intégrations' },
        ],
      },
    ],
  },
];

/* ══ Bouton Nouveau — contextuel selon la page ══════════════════════════ */
function getNewAction(pathname: string): { label: string; href: string } {
  if (pathname.startsWith('/prospects'))  return { label:'Nouveau prospect',  href:'/prospects?new=1' };
  if (pathname.startsWith('/pipeline'))   return { label:'Nouveau deal',      href:'/pipeline?new=1' };
  if (pathname.startsWith('/sequences'))  return { label:'Nouvelle séquence', href:'/sequences/new' };
  if (pathname.startsWith('/workflows'))  return { label:'Nouveau workflow',   href:'/workflows/new' };
  if (pathname.startsWith('/signals'))    return { label:'Nouveau signal',     href:'/signals' };
  if (pathname.startsWith('/sourcing'))   return { label:'Nouveau scraper',    href:'/sourcing?new=1' };
  if (pathname.startsWith('/abm'))        return { label:'Nouveau compte',     href:'/abm?new=1' };
  if (pathname.startsWith('/contacts'))   return { label:'Nouveau contact',    href:'/prospects?new=1' };
  if (pathname.startsWith('/inbound'))    return { label:'Nouvelle source',    href:'/inbound?new=1' };
  if (pathname.startsWith('/templates'))  return { label:'Nouveau template',   href:'/templates?new=1' };
  if (pathname.startsWith('/plugins'))    return { label:'Installer plugin',   href:'/plugins?upload=1' };
  return { label:'Nouveau', href:'/prospects?new=1' };
}

/* ══ Modal Aide ═════════════════════════════════════════════════════════ */
function HelpModal({ onClose }: { onClose:()=>void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Aide & Documentation</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="space-y-3">
          {[
            { icon:'📚', label:'Documentation complète', href:'#', desc:'Guides détaillés de chaque fonctionnalité' },
            { icon:'🎥', label:'Tutoriels vidéo', href:'#', desc:'Démarrage rapide en 5 minutes' },
            { icon:'💬', label:'Support chat', href:'#', desc:'Réponse en moins de 2h en jours ouvrés' },
            { icon:'⌨️', label:'Raccourcis clavier', href:'#', desc:'⌘K Recherche · ⌘N Nouveau · ⌘P Pipeline' },
            { icon:'🔌', label:'Développer un plugin', href:'#', desc:'Guide SDK plugins GrowthOS' },
          ].map((h,i) => (
            <a key={i} href={h.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all">
              <span className="text-2xl">{h.icon}</span>
              <div><div className="font-medium text-gray-900 text-sm">{h.label}</div><div className="text-xs text-gray-400">{h.desc}</div></div>
            </a>
          ))}
        </div>
        <div className="mt-4 p-3 bg-teal-50 rounded-xl text-xs text-teal-700">
          <strong>GrowthOS</strong> · Version 2.0 · Contacter : support@le-publicitaire.fr
        </div>
      </div>
    </div>
  );
}

/* ══ COMPONENT PRINCIPAL ════════════════════════════════════════════════ */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, logout } = useAuthStore();
  const { theme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string,boolean>>({ 'Prospects':true, 'Séquences':true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const h = (e:KeyboardEvent) => {
      if ((e.metaKey||e.ctrlKey)&&e.key==='k') { e.preventDefault(); setSearchOpen(o=>!o); }
      if (e.key==='Escape') { setCmdOpen(false); setUserMenuOpen(false); setNotifOpen(false); setHelpOpen(false); setSearchOpen(false); }
      if ((e.metaKey||e.ctrlKey)&&e.key==='n') { e.preventDefault(); const a=getNewAction(pathname); router.push(a.href); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 100);
  }, [searchOpen]);

  // Recherche live
  useEffect(() => {
    if (!searchVal.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/prospects?search=${encodeURIComponent(searchVal)}&limit=5`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) {
          const d = await res.json();
          const list = (Array.isArray(d)?d:d.data||[]).map((p:any) => ({
            type:'prospect', label:`${p.firstName||''} ${p.lastName||''}`.trim()||p.company||p.email,
            sub:p.company||p.email||'', href:`/prospects/${p.id}`,
          }));
          setSearchResults(list);
        }
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchVal]);

  const isItemActive = (item: NavItem) => {
    if (item.href) return item.exact ? pathname===item.href : pathname.startsWith(item.href);
    if (item.children) return item.children.some(c => pathname.startsWith(c.href));
    return false;
  };

  const toggleSection = (label: string) => setOpenSections(o => ({...o,[label]:!o[label]}));

  const userInitials = [user?.firstName?.[0],user?.lastName?.[0]].filter(Boolean).join('').toUpperCase()||user?.email?.[0]?.toUpperCase()||'U';
  const newAction = getNewAction(pathname);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--body-bg)', fontFamily:'var(--font-sans)' }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside data-sidebar style={{
        width: sidebarCollapsed ? 48 : 200, display:'flex', flexDirection:'column',
        height:'100vh', flexShrink:0, overflow:'hidden',
        transition:'width 0.2s ease',
        background:'var(--sidebar-bg)',
        borderRight:'1px solid rgba(255,255,255,.06)',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 10px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0, cursor:'pointer' }} onClick={() => setSidebarCollapsed(c=>!c)}>
          <div style={{ width:26, height:26, borderRadius:5, flexShrink:0, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:13 }}>G</div>
          {!sidebarCollapsed && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--sidebar-text)', lineHeight:1.2, whiteSpace:'nowrap' }}>GrowthOS</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', lineHeight:1 }}>{user?.email?.split('@')[1]||'workspace'}</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'4px 0' }}>
          {NAV.map(section => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <div style={{ padding:'10px 10px 2px', fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,.25)' }}>{section.label}</div>
              )}
              {section.items.map(item => {
                const active = isItemActive(item);
                const hasChildren = !!item.children?.length;
                const isOpen = openSections[item.label];

                if (hasChildren && !sidebarCollapsed) {
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => toggleSection(item.label)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', margin:'1px 4px', borderRadius:6, width:'calc(100% - 8px)', border:'none', cursor:'pointer', background:active?'var(--color-primary)':'transparent', color:active?'#fff':'var(--sidebar-text)', textAlign:'left' }}
                        onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='var(--sidebar-hover)';}}
                        onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='transparent';}}
                      >
                        <span style={{ flexShrink:0, opacity:0.8 }}>{item.icon}</span>
                        <span style={{ flex:1, fontSize:12, fontWeight:active?600:400 }}>{item.label}</span>
                        <ChevronDown size={11} style={{ transform:isOpen?'rotate(0)':'rotate(-90deg)', transition:'transform 0.2s', opacity:0.5 }}/>
                      </button>
                      {isOpen && (
                        <div style={{ paddingLeft:8 }}>
                          {item.children!.map(child => {
                            const childActive = pathname===child.href||pathname.startsWith(child.href+'?');
                            return (
                              <Link key={child.href} href={child.href} style={{ display:'block', padding:'5px 10px 5px 22px', margin:'1px 4px', borderRadius:5, fontSize:11, textDecoration:'none', color:childActive?'var(--color-primary)':'rgba(255,255,255,.55)', background:childActive?'var(--color-primary-light)':'transparent', fontWeight:childActive?600:400, borderLeft:'2px solid', borderLeftColor:childActive?'var(--color-primary)':'rgba(255,255,255,.1)' }}
                                onMouseEnter={e=>{if(!childActive)(e.currentTarget as HTMLElement).style.color='var(--sidebar-text)';}}
                                onMouseLeave={e=>{if(!childActive)(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,.55)';}}
                              >{child.label}</Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Item simple (ou collapsed)
                return (
                  <Link key={item.href||item.label} href={item.href||item.children?.[0]?.href||'/'} title={sidebarCollapsed?item.label:undefined} data-sidebar-item data-sidebar-item-active={active?'':undefined}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:sidebarCollapsed?'7px 0':'6px 10px', margin:'1px 4px', borderRadius:6, textDecoration:'none', justifyContent:sidebarCollapsed?'center':'flex-start', background:active?'var(--color-primary)':'transparent', color:active?'#fff':'var(--sidebar-text)', position:'relative' }}
                    onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='var(--sidebar-hover)';}}
                    onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='transparent';}}>
                    <span style={{ flexShrink:0, opacity:active?1:0.8 }}>{item.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex:1, fontSize:12, fontWeight:active?600:400 }}>{item.label}</span>
                        {item.badge!==undefined&&item.badge>0&&(
                          <span style={{ background:'#EF4444', color:'#fff', borderRadius:9999, padding:'1px 5px', fontSize:10, fontWeight:700 }}>{item.badge}</span>
                        )}
                      </>
                    )}
                    {sidebarCollapsed&&item.badge!==undefined&&item.badge>0&&(
                      <span style={{ position:'absolute', top:4, right:4, width:7, height:7, borderRadius:'50%', background:'#EF4444' }}/>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
          <button onClick={()=>setUserMenuOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', background:'rgba(255,255,255,.05)', border:'none', borderRadius:7, padding:sidebarCollapsed?'7px':'7px 8px', cursor:'pointer', color:'var(--sidebar-text)', justifyContent:sidebarCollapsed?'center':'flex-start' }}>
            <div style={{ width:26, height:26, borderRadius:5, flexShrink:0, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:11 }}>{userInitials}</div>
            {!sidebarCollapsed && (
              <>
                <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--sidebar-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.firstName||user?.email?.split('@')[0]}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,.35)' }}>En ligne</div>
                </div>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', flexShrink:0 }}/>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* ── TOPBAR ──────────────────────────────────────────────────── */}
        <header style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:46, flexShrink:0, background:'var(--card-bg)', borderBottom:'1px solid var(--card-border)' }}>

          {/* Breadcrumb page courante */}
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
            {NAV.flatMap(s=>s.items).flatMap(i=>[...(i.children||[]),i]).find(i=>i.href&&pathname.startsWith(i.href))?.label||'Dashboard'}
          </span>

          <div style={{ flex:1 }}/>

          {/* ─ Recherche ─ */}
          {searchOpen ? (
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Search size={13} style={{ position:'absolute', left:10, color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input ref={searchRef} value={searchVal} onChange={e=>setSearchVal(e.target.value)}
                placeholder="Rechercher prospects, deals..." autoFocus
                style={{ width:280, paddingLeft:32, paddingRight:36, paddingTop:6, paddingBottom:6, borderRadius:8, border:'1px solid var(--color-primary)', outline:'none', fontSize:13, background:'var(--body-bg)', color:'var(--text-primary)' }}
              />
              <button onClick={()=>{setSearchOpen(false);setSearchVal('');setSearchResults([]);}} style={{ position:'absolute', right:8, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={13}/></button>
              {/* Résultats dropdown */}
              {(searchResults.length>0||searching) && (
                <div style={{ position:'absolute', top:38, left:0, right:0, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', zIndex:300, overflow:'hidden' }}>
                  {searching && <div style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:8 }}><Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/>Recherche...</div>}
                  {searchResults.map((r,i)=>(
                    <a key={i} href={r.href} onClick={()=>{setSearchOpen(false);setSearchVal('');setSearchResults([]);}}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', textDecoration:'none', borderBottom:'1px solid var(--card-border)' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <Users size={13} style={{ color:'var(--color-primary)', flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{r.label}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.sub}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={()=>setSearchOpen(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', background:'var(--body-bg)', border:'1px solid var(--card-border)', borderRadius:8, cursor:'pointer', color:'var(--text-muted)', fontSize:12 }}>
              <Search size={13}/><span>Rechercher...</span>
              <kbd style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:4, padding:'1px 5px', fontSize:10, color:'var(--text-muted)' }}>⌘K</kbd>
            </button>
          )}

          {/* ─ Bouton Nouveau contextuel ─ */}
          <Link href={newAction.href} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', fontSize:12, fontWeight:600, background:'var(--color-primary)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', textDecoration:'none', whiteSpace:'nowrap' }}>
            <Plus size={13}/>{newAction.label}
          </Link>

          {/* ─ Activités (icône) ─ */}
          <Link href="/activities" title="Journal d'activités" style={{ width:32, height:32, borderRadius:8, background:'var(--body-bg)', border:'1px solid var(--card-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', textDecoration:'none' }}>
            <Activity size={15}/>
          </Link>

          {/* ─ Notifications ─ */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>{setNotifOpen(o=>!o);setUserMenuOpen(false);}} style={{ width:32, height:32, borderRadius:8, background:'var(--body-bg)', border:'1px solid var(--card-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', position:'relative' }}>
              <Bell size={15}/>
              <span style={{ position:'absolute', top:6, right:6, width:6, height:6, borderRadius:'50%', background:'var(--color-primary)', border:'2px solid var(--card-bg)' }}/>
            </button>
            {notifOpen && (
              <div style={{ position:'absolute', top:40, right:0, width:300, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.12)', zIndex:200 }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>Notifications</span>
                  <button style={{ background:'none', border:'none', color:'var(--color-primary)', fontSize:11, cursor:'pointer' }}>Tout lire</button>
                </div>
                {[
                  { icon:<Search size={13}/>, text:'Scraping terminé — 47 prospects', time:'Il y a 5 min', unread:true, href:'/sourcing' },
                  { icon:<Zap size={13}/>, text:'3 nouveaux signaux détectés', time:'Il y a 12 min', unread:true, href:'/signals' },
                  { icon:<Mail size={13}/>, text:'8 emails envoyés', time:'Il y a 1h', unread:false, href:'/sequences' },
                ].map((n,i)=>(
                  <a key={i} href={n.href} onClick={()=>setNotifOpen(false)} style={{ display:'flex', gap:10, padding:'9px 14px', background:n.unread?'rgba(135,90,123,.04)':'transparent', borderBottom:'1px solid var(--card-border)', textDecoration:'none', cursor:'pointer' }}>
                    <div style={{ width:26, height:26, borderRadius:6, background:'var(--color-primary-light)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-primary)', flexShrink:0 }}>{n.icon}</div>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:12, color:'var(--text-primary)', lineHeight:1.4 }}>{n.text}</p>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{n.time}</span>
                    </div>
                    {n.unread&&<div style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)', marginTop:6, flexShrink:0 }}/>}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ─ Aide ─ */}
          <button onClick={()=>setHelpOpen(true)} title="Aide & Documentation" style={{ width:32, height:32, borderRadius:8, background:'var(--body-bg)', border:'1px solid var(--card-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)' }}>
            <HelpCircle size={15}/>
          </button>

          {/* ─ User menu ─ */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>{setUserMenuOpen(o=>!o);setNotifOpen(false);}} style={{ display:'flex', alignItems:'center', gap:7, padding:'3px 8px 3px 3px', background:'var(--body-bg)', border:'1px solid var(--card-border)', borderRadius:8, cursor:'pointer' }}>
              <div style={{ width:26, height:26, borderRadius:5, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:11 }}>{userInitials}</div>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{user?.firstName||user?.email?.split('@')[0]}</span>
              <ChevronDown size={11} color="var(--text-muted)"/>
            </button>
            {userMenuOpen && (
              <div style={{ position:'absolute', top:40, right:0, width:200, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.12)', zIndex:200, overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--card-border)' }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{user?.email}</div>
                </div>
                {[
                  { label:'Mon profil', href:'/settings/profile', icon:<User size={13}/> },
                  { label:'Plugins', href:'/plugins', icon:<Puzzle size={13}/> },
                  { label:'Thèmes', href:'/themes', icon:<Palette size={13}/> },
                  { label:'Paramètres', href:'/settings', icon:<Settings size={13}/> },
                ].map(item=>(
                  <Link key={item.href} href={item.href} onClick={()=>setUserMenuOpen(false)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', textDecoration:'none', color:'var(--text-secondary)', fontSize:13, borderBottom:'1px solid var(--card-border)' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--body-bg)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    {item.icon}<span>{item.label}</span>
                  </Link>
                ))}
                <button onClick={()=>{logout();window.location.href='/login';}} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', width:'100%', background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:13 }}>
                  <LogOut size={13}/><span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────────── */}
        <main style={{ flex:1, overflow:'auto', minHeight:0 }}>
          {children}
        </main>
      </div>

      {/* ── Modals globaux ─────────────────────────────────────────── */}
      {helpOpen && <HelpModal onClose={()=>setHelpOpen(false)}/>}
      {cmdOpen && <CommandPalette onClose={()=>setCmdOpen(false)}/>}

      {/* ── User menu overlay ─────────────────────────────────────── */}
      {(userMenuOpen||notifOpen) && (
        <div style={{ position:'fixed', inset:0, zIndex:100 }} onClick={()=>{setUserMenuOpen(false);setNotifOpen(false);}}/>
      )}
    </div>
  );
}
