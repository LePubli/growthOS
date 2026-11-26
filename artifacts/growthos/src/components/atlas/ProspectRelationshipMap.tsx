import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Building2, CircleHelp, ExternalLink, History, Maximize, Minus, Plus, UserRound, Users, ZoomIn } from 'lucide-react';

type Node = {
  id: string; name: string; kind: 'company' | 'person'; x: number; y: number;
  subtitle: string; url: string; note?: string; historical?: boolean;
};
type Edge = { from: string; to: string; label: string; historical?: boolean };
export type RelationshipData = { nodes: Node[]; edges: Edge[]; source: string; capturedAt: string };

/** Référence documentaire publique, et non une réponse en direct de l'API Pappers. */
const SOLUTION_ENR_REFERENCE: RelationshipData = {
  source: 'https://www.pappers.fr/entreprise/solution-enr-981075252',
  capturedAt: '26/11/2026',
  nodes: [
    {id:'solution',name:'SOLUTION ENR',kind:'company',x:510,y:260,subtitle:'SIREN 981 075 252',url:'https://www.pappers.fr/entreprise/solution-enr-981075252',note:'SAS · Roubaix · active'},
    {id:'soheyb',name:'Soheyb BETKA',kind:'person',x:270,y:105,subtitle:'Président',url:'https://www.pappers.fr/dirigeant/soheyb_betka_1990-07'},
    {id:'abdel',name:'Abdelwahid BOUSSADIA',kind:'person',x:760,y:105,subtitle:'Directeur général',url:'https://www.pappers.fr/dirigeant/abdelwahid_boussadia_1997-02'},
    {id:'melio',name:'MELIO HABITAT',kind:'company',x:90,y:290,subtitle:'SIREN 103 990 768',url:'https://www.pappers.fr/entreprise/melio-habitat-103990768',note:'Présidence de Soheyb BETKA'},
    {id:'soheyb_ei',name:'Soheyb Betka (EI)',kind:'company',x:160,y:475,subtitle:'SIREN 898 568 886',url:'https://www.pappers.fr/entreprise/soheyb-betka-898568886'},
    {id:'boussadia_ei',name:'Abdelwahid Boussadia (EI)',kind:'company',x:850,y:475,subtitle:'SIREN 928 529 486',url:'https://www.pappers.fr/recherche?q=928529486',note:'Activité indiquée cessée sur Pappers'},
    {id:'epc',name:'EPC PAC',kind:'company',x:500,y:490,subtitle:'SIREN 901 933 549',url:'https://www.pappers.fr/entreprise/epc-pac-901933549',historical:true},
    {id:'gne',name:'GROUPE NORD ENERGIE',kind:'company',x:65,y:105,subtitle:'SIREN 878 417 914',url:'https://www.pappers.fr/recherche?q=878417914',historical:true},
  ],
  edges: [
    {from:'soheyb',to:'solution',label:'Président'},
    {from:'abdel',to:'solution',label:'Directeur général'},
    {from:'soheyb',to:'melio',label:'Président'},
    {from:'soheyb',to:'soheyb_ei',label:'Entrepreneur individuel'},
    {from:'abdel',to:'boussadia_ei',label:'Entrepreneur individuel'},
    {from:'soheyb',to:'epc',label:'Ancien président',historical:true},
    {from:'abdel',to:'epc',label:'Ancien directeur général',historical:true},
    {from:'soheyb',to:'gne',label:'Ancien président',historical:true},
  ],
};

type Props = { siren?: string | null; siret?: string | null; company?: string | null; data?: RelationshipData | null };
const WIDTH = 1020;
const HEIGHT = 590;
const clamp = (v: number) => Math.max(0.55, Math.min(2.6, v));

export function ProspectRelationshipMap({ siren, siret, company, data }: Props) {
  const referenceId = (siren || siret || '').replace(/\D/g, '').slice(0,9);
  const graph = data || (referenceId === '981075252' ? SOLUTION_ENR_REFERENCE : null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const cameraRef = useRef({zoom:1, panX:0, panY:0});
  const [camera,setCamera] = useState(cameraRef.current);
  const [showHistory,setShowHistory] = useState(true);
  const [perspective,setPerspective] = useState<'company'|'directors'>('company');
  const [selected,setSelected] = useState('solution');
  const setView = (next: typeof camera) => {cameraRef.current=next;setCamera(next);};
  const zoomAt = (next: number, point?: {x:number;y:number}) => {
    const current=cameraRef.current;
    const scale=clamp(next);
    const box=viewportRef.current?.getBoundingClientRect();
    const x=point && box ? point.x-box.left-box.width/2 : 0;
    const y=point && box ? point.y-box.top-box.height/2 : 0;
    const factor=scale/current.zoom;
    setView({zoom:scale,panX:current.panX+(x-current.panX)*(1-factor),panY:current.panY+(y-current.panY)*(1-factor)});
  };
  useEffect(()=>{
    const el=viewportRef.current;
    if(!el)return;
    const onWheel=(e:WheelEvent)=>{
      e.preventDefault();
      const zoom=cameraRef.current.zoom*(e.deltaY<0?1.12:0.89);
      const box=el.getBoundingClientRect();
      const x=e.clientX-box.left-box.width/2;
      const y=e.clientY-box.top-box.height/2;
      const scale=clamp(zoom);
      const c=cameraRef.current;
      const factor=scale/c.zoom;
      const next={zoom:scale,panX:c.panX+(x-c.panX)*(1-factor),panY:c.panY+(y-c.panY)*(1-factor)};
      cameraRef.current=next;setCamera(next);
    };
    el.addEventListener('wheel',onWheel,{passive:false});
    return()=>el.removeEventListener('wheel',onWheel);
  },[graph]);
  const visibleNodes=graph?.nodes.filter(n=>showHistory||!n.historical)||[];
  const visibleIds=new Set(visibleNodes.map(n=>n.id));
  const visibleEdges=graph?.edges.filter(e=>(showHistory||!e.historical)&&visibleIds.has(e.from)&&visibleIds.has(e.to))||[];
  const currentNode=visibleNodes.find(n=>n.id===selected) || visibleNodes[0];
  const focusNode=(node:Node)=>{
    setSelected(node.id);
    // Le centre du viewport est aligné sur le nœud choisi.
    const c=cameraRef.current;
    setView({...c,panX:(WIDTH/2-node.x)*c.zoom,panY:(HEIGHT/2-node.y)*c.zoom});
  };

  if(!graph) return (
    <div className="atlas-graph-empty">
      <div className="atlas-preview-avatar"><Users size={30}/></div>
      <h3>Cartographie en attente de données vérifiées</h3>
      <p>Les relations ne sont jamais déduites du nom de l’entreprise. Connectez une source juridique qui renvoie des mandats avec leurs identifiants et dates.</p>
      {referenceId && <a href={'https://www.pappers.fr/recherche?q='+encodeURIComponent(referenceId)} target="_blank" rel="noopener noreferrer">
        Consulter Pappers pour ce SIREN <ExternalLink size={14}/>
      </a>}
      {!referenceId && <p>Commencez par identifier un SIREN ou un SIRET fiable.</p>}
    </div>
  );

  return (
    <section className="atlas-graph-card" aria-label="Cartographie des relations">
      <header className="atlas-graph-header">
        <div><div className="atlas-overline">RÉSEAU D’ENTREPRISE</div><h2>Cartographie des relations</h2>
          <p>Vue interactive des sociétés et dirigeants liés à {company||'cette entreprise'}.</p></div>
        <a href={graph.source} target="_blank" rel="noopener noreferrer" className="atlas-source-link">
          <ExternalLink size={15}/> Source Pappers
        </a>
      </header>
      <div className="atlas-graph-toolbar">
        <div className="atlas-segmented">
          <button className={perspective==='company'?'selected':''} onClick={()=>{setPerspective('company');setView({zoom:1,panX:0,panY:0});setSelected('solution');}}><Building2 size={15}/> Entreprise</button>
          <button className={perspective==='directors'?'selected':''} onClick={()=>{setPerspective('directors');focusNode(graph.nodes.find(n=>n.id==='soheyb')||graph.nodes[0]);}}><UserRound size={15}/> Dirigeants</button>
        </div>
        <label className="atlas-history-toggle"><input type="checkbox" checked={showHistory} onChange={e=>setShowHistory(e.target.checked)}/> <History size={14}/> Anciens mandats</label>
        <span className="atlas-graph-count">{visibleNodes.length} entités · {visibleEdges.length} liens</span>
      </div>
      {perspective==='directors' && <div className="atlas-director-pills">
        {visibleNodes.filter(n=>n.kind==='person').map(n=><button key={n.id} onClick={()=>focusNode(n)} className={selected===n.id?'selected':''}><UserRound size={14}/>{n.name}</button>)}
      </div>}
      <div className="atlas-graph-stage">
        <div ref={viewportRef} className="atlas-graph-viewport"
          onPointerDown={e=>{
            if(e.button!==0 || (e.target as HTMLElement).closest('button')) return;
            dragRef.current={x:e.clientX,y:e.clientY,panX:cameraRef.current.panX,panY:cameraRef.current.panY};
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e=>{
            if(!dragRef.current)return;
            const drag=dragRef.current;
            setView({...cameraRef.current,panX:drag.panX+e.clientX-drag.x,panY:drag.panY+e.clientY-drag.y});
          }}
          onPointerUp={()=>{dragRef.current=null;}}
          onPointerCancel={()=>{dragRef.current=null;}}>
          <div className="atlas-graph-canvas" style={{width:WIDTH,height:HEIGHT,transform:'translate('+camera.panX+'px,'+camera.panY+'px) scale('+camera.zoom+')'}}>
            <svg viewBox={'0 0 '+WIDTH+' '+HEIGHT} className="atlas-graph-lines" aria-hidden="true">
              {visibleEdges.map((edge,i)=>{
                const a=graph.nodes.find(n=>n.id===edge.from)!;
                const b=graph.nodes.find(n=>n.id===edge.to)!;
                return <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={edge.historical?'historical':''}/>
                  <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-7} textAnchor="middle">{edge.label}</text>
                </g>;
              })}
            </svg>
            {visibleNodes.map(n=><button key={n.id} type="button" onClick={()=>setSelected(n.id)}
              className={'atlas-graph-node '+n.kind+(n.historical?' historical':'')+(currentNode?.id===n.id?' active':'')}
              style={{left:n.x,top:n.y}} aria-pressed={currentNode?.id===n.id}>
              <span className="atlas-graph-node-icon">{n.kind==='company'?<Building2 size={18}/>:<UserRound size={18}/>}</span>
              <span className="atlas-graph-node-text"><strong>{n.name}</strong><small>{n.subtitle}</small></span>
            </button>)}
          </div>
        </div>
        <div className="atlas-graph-zoom">
          <button onClick={()=>zoomAt(camera.zoom*1.2)} aria-label="Zoomer" title="Zoomer"><Plus size={18}/></button>
          <span>{Math.round(camera.zoom*100)}%</span>
          <button onClick={()=>zoomAt(camera.zoom/1.2)} aria-label="Dézoomer" title="Dézoomer"><Minus size={18}/></button>
          <button onClick={()=>setView({zoom:1,panX:0,panY:0})} aria-label="Recentrer" title="Recentrer"><Maximize size={18}/></button>
        </div>
        <span className="atlas-graph-hint"><ZoomIn size={15}/> Molette : zoom · Glisser : déplacer</span>
      </div>
      <footer className="atlas-graph-footer">
        <div className="atlas-graph-detail">
          <div className="atlas-graph-detail-icon">{currentNode?.kind==='person'?<UserRound size={20}/>:<Building2 size={20}/>}</div>
          <div><strong>{currentNode?.name}</strong><p>{currentNode?.subtitle} {currentNode?.note && ' · '+currentNode.note}</p></div>
          {currentNode && <a href={currentNode.url} target="_blank" rel="noopener noreferrer" aria-label={'Voir la fiche Pappers de '+currentNode.name}><ArrowUpRight size={18}/></a>}
        </div>
        <div className="atlas-graph-legend"><span><i/> Lien actuel</span><span><i className="historical"/> Ancien mandat</span></div>
      </footer>
      <p className="atlas-documentation-notice"><CircleHelp size={15}/> Capture documentaire du {graph.capturedAt}, non synchronisée automatiquement. Les liens représentent des mandats publiés, pas des participations capitalistiques présumées. Une API et ses droits d'accès seront nécessaires pour les autres entreprises.</p>
    </section>
  );
}

export function ProspectPappersDossier({ siren, siret }: { siren?: string|null; siret?: string|null }) {
  if ((siren||siret||'').replace(/\D/g,'').slice(0,9)!=='981075252') return null;
  const facts=[
    ['Forme juridique','SAS'],['Siège','141 rue Jules Guesde, 59100 Roubaix'],
    ['Création','01/11/2023'],['Capital social','1 000 €'],
    ['Résultat net 2024','3,53 k€'],['Fonds propres 2024','4,53 k€'],
    ['Trésorerie 2024','101 €'],['Dépôt de comptes','12/02/2026 (BODACC)'],
  ];
  return <section className="atlas-pappers-dossier">
    <div className="atlas-preview-section-header"><div><span className="atlas-overline">DOSSIER DE RÉFÉRENCE</span><h3>Données légales et financières · Pappers</h3></div>
      <a href="https://www.pappers.fr/entreprise/solution-enr-981075252" target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Voir la source</a>
    </div>
    <div className="atlas-pappers-facts">{facts.map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
    <div className="atlas-documentation-notice"><CircleHelp size={15}/> Exemple spécifique à SOLUTION ENR, relevé le 26/11/2026. Les comptes 2024 sont partiellement confidentiels. Ces valeurs ne sont pas injectées dans le CRM et doivent être revérifiées avant usage opérationnel.</div>
  </section>;
}
