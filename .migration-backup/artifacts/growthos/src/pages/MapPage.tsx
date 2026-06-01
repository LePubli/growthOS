import { useState } from 'react';
import { MapPin, Navigation, Phone, Mail, Building2, Route, Plus, X, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';

const REGIONS = [
  { id: 'idf',     label: 'Île-de-France',     x: 340, y: 200, count: 42, color: '#0F766E' },
  { id: 'aura',    label: 'Auvergne-Rhône-Alpes', x: 360, y: 330, count: 28, color: '#2563EB' },
  { id: 'occ',     label: 'Occitanie',          x: 290, y: 410, count: 19, color: '#7C3AED' },
  { id: 'naq',     label: 'Nouvelle-Aquitaine', x: 200, y: 360, count: 23, color: '#D97706' },
  { id: 'pdl',     label: 'Pays de la Loire',   x: 160, y: 260, count: 15, color: '#059669' },
  { id: 'hdf',     label: 'Hauts-de-France',    x: 310, y: 100, count: 18, color: '#DC2626' },
  { id: 'bre',     label: 'Bretagne',            x: 90,  y: 220, count: 11, color: '#0284C7' },
  { id: 'norm',    label: 'Normandie',           x: 210, y: 150, count: 14, color: '#CA8A04' },
  { id: 'ge',      label: 'Grand Est',           x: 430, y: 170, count: 20, color: '#9333EA' },
  { id: 'bfc',     label: 'Bourgogne-Franche-C.',x: 400, y: 270, count: 12, color: '#0891B2' },
  { id: 'paca',    label: 'PACA',               x: 400, y: 420, count: 24, color: '#E11D48' },
];

const MOCK_PROSPECTS_MAP = [
  { id:'1', name:'Sophie Martin',   company:'TechCorp',       city:'Paris',     region:'idf',  email:'s.martin@techcorp.fr',  phone:'+33 6 12 34 56 78', status:'qualified', value:12500, lat:48.8566, lng:2.3522 },
  { id:'2', name:'Emma Leroy',      company:'StartupX',       city:'Lyon',      region:'aura', email:'e.leroy@startupx.io',   phone:'+33 6 23 45 67 89', status:'proposal',  value:4800,  lat:45.7640, lng:4.8357 },
  { id:'3', name:'Paul Dupont',     company:'BigSales',       city:'Bordeaux',  region:'naq',  email:'p.dupont@bigsales.fr',  phone:'+33 6 34 56 78 90', status:'negotiation',value:8200, lat:44.8378, lng:-0.5792 },
  { id:'4', name:'Camille Bernard', company:'DataInc',        city:'Paris',     region:'idf',  email:'c.bernard@datainc.com', phone:'',                  status:'lead',      value:3600,  lat:48.8606, lng:2.3376 },
  { id:'5', name:'Luc Moreau',      company:'GrowthCo',       city:'Nantes',    region:'pdl',  email:'l.moreau@growthco.fr',  phone:'+33 6 45 67 89 01', status:'won',       value:9600,  lat:47.2184, lng:-1.5536 },
  { id:'6', name:'Marie Dubois',    company:'AlphaTech',      city:'Marseille', region:'paca', email:'m.dubois@alphatech.fr', phone:'+33 6 56 78 90 12', status:'proposal',  value:22000, lat:43.2965, lng:5.3698 },
  { id:'7', name:'Thomas Leclerc',  company:'WebAgency',      city:'Toulouse',  region:'occ',  email:'t.leclerc@webagency.fr',phone:'+33 6 67 89 01 23', status:'lead',      value:5500,  lat:43.6047, lng:1.4442 },
  { id:'8', name:'Alice Fontaine',  company:'InnovaTech',     city:'Paris',     region:'idf',  email:'a.fontaine@innova.io',  phone:'+33 6 78 90 12 34', status:'qualified', value:7800,  lat:48.8490, lng:2.3470 },
  { id:'9', name:'Marc Rousseau',   company:'FinancePlus',    city:'Strasbourg',region:'ge',   email:'m.r@financeplus.fr',   phone:'+33 6 89 01 23 45', status:'contacted', value:4200,  lat:48.5734, lng:7.7521 },
  { id:'10', name:'Julie Simon',    company:'SaaScraft',      city:'Rennes',    region:'bre',  email:'j.simon@saascraft.io', phone:'',                  status:'new',       value:2800,  lat:48.1173, lng:-1.6778 },
  { id:'11', name:'Antoine Petit',  company:'ScaleUp',        city:'Strasbourg',region:'ge',   email:'a.petit@scaleup.fr',   phone:'+33 6 01 23 45 67', status:'qualified', value:6100,  lat:48.5840, lng:7.7489 },
  { id:'12', name:'Claire Girard',  company:'CloudWave',      city:'Lyon',      region:'aura', email:'c.girard@cloudwave.eu',phone:'+33 6 12 34 56 78', status:'proposal',  value:9100,  lat:45.7500, lng:4.8500 },
];

const STATUS_COLORS: Record<string,string> = {
  new:'#6B7280', contacted:'#3B82F6', qualified:'#8B5CF6',
  negotiation:'#F59E0B', proposal:'#8B5CF6', won:'#10B981', lost:'#EF4444',
};

const STATUS_LABELS: Record<string,string> = {
  new:'Nouveau', contacted:'Contacté', qualified:'Qualifié',
  negotiation:'Négociation', proposal:'Proposition', won:'Gagné', lost:'Perdu',
};

function FranceSVG({ onRegionClick, selectedRegion, regionCounts }: { onRegionClick:(r:string)=>void; selectedRegion:string|null; regionCounts:Record<string,number> }) {
  return (
    <svg viewBox="0 0 520 500" className="w-full h-full" style={{maxHeight:480}}>
      {/* Simple France outline approximation */}
      <path d="M 120 80 L 200 60 L 290 55 L 370 70 L 440 100 L 470 160 L 460 220 L 440 270 L 430 330 L 410 380 L 390 430 L 350 460 L 300 470 L 250 465 L 200 450 L 160 420 L 120 390 L 90 350 L 70 290 L 60 230 L 70 170 L 90 120 Z"
        fill="#F0FDF4" stroke="#D1FAE5" strokeWidth="2"/>

      {/* Corsica */}
      <ellipse cx="470" cy="430" rx="18" ry="28" fill="#F0FDF4" stroke="#D1FAE5" strokeWidth="1.5"/>
      <text x="470" y="434" textAnchor="middle" fontSize="7" fill="#6B7280">Corse</text>

      {/* Region circles */}
      {REGIONS.map(r => {
        const count = regionCounts[r.id] || r.count;
        const isSelected = selectedRegion === r.id;
        return (
          <g key={r.id} onClick={() => onRegionClick(r.id)} style={{cursor:'pointer'}}>
            <circle cx={r.x} cy={r.y} r={isSelected ? 26 : 20}
              fill={isSelected ? r.color : `${r.color}22`}
              stroke={r.color} strokeWidth={isSelected ? 2.5 : 1.5}
              style={{transition:'all 0.2s'}}/>
            <text x={r.x} y={r.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="12" fontWeight="700" fill={isSelected ? '#fff' : r.color}>
              {count}
            </text>
            <text x={r.x} y={r.y + 14} textAnchor="middle" dominantBaseline="hanging"
              fontSize="7.5" fill={isSelected ? r.color : '#6B7280'} fontWeight={isSelected?'600':'400'}>
              {r.label.length > 12 ? r.label.slice(0,12)+'…' : r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function MapPage() {
  const [selectedRegion, setSelectedRegion] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [route, setRoute] = useState<string[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);

  const regionCounts = MOCK_PROSPECTS_MAP.reduce((acc, p) => {
    acc[p.region] = (acc[p.region]||0)+1; return acc;
  }, {} as Record<string,number>);

  const filteredProspects = MOCK_PROSPECTS_MAP.filter(p => {
    const matchRegion = !selectedRegion || p.region === selectedRegion;
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.company} ${p.city}`.toLowerCase().includes(q);
    return matchRegion && matchSearch;
  });

  const toggleRoute = (id: string) => {
    setRoute(r => r.includes(id) ? r.filter(x=>x!==id) : [...r, id]);
  };

  const totalRouteValue = route.reduce((s,id) => {
    const p = MOCK_PROSPECTS_MAP.find(x=>x.id===id);
    return s + (p?.value||0);
  }, 0);

  const selectedRegionInfo = REGIONS.find(r => r.id === selectedRegion);
  const totalPipeline = filteredProspects.reduce((s,p)=>s+p.value,0);

  return (
    <div className="h-screen flex overflow-hidden" style={{background:'var(--body-bg)'}}>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r overflow-hidden" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="p-4 border-b flex-shrink-0" style={{borderColor:'var(--card-border)'}}>
          <h1 className="text-lg font-bold mb-1" style={{color:'var(--text-primary)'}}>Carte & Tournée</h1>
          <p className="text-xs" style={{color:'var(--text-muted)'}}>
            {selectedRegion ? selectedRegionInfo?.label : 'Toute la France'} · {filteredProspects.length} prospects
          </p>
        </div>

        {/* Search */}
        <div className="p-3 border-b flex-shrink-0" style={{borderColor:'var(--card-border)'}}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              style={{background:'var(--body-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b flex-shrink-0" style={{borderColor:'var(--card-border)'}}>
          <div className="rounded-xl p-2.5" style={{background:'var(--body-bg)'}}>
            <div className="text-sm font-bold" style={{color:'var(--text-primary)'}}>{filteredProspects.length}</div>
            <div className="text-xs" style={{color:'var(--text-muted)'}}>Prospects</div>
          </div>
          <div className="rounded-xl p-2.5" style={{background:'var(--body-bg)'}}>
            <div className="text-sm font-bold" style={{color:'var(--text-primary)'}}>{(totalPipeline/1000).toFixed(0)}k€</div>
            <div className="text-xs" style={{color:'var(--text-muted)'}}>Pipeline</div>
          </div>
        </div>

        {/* Region filter */}
        {selectedRegion && (
          <div className="px-3 py-2 flex-shrink-0">
            <button onClick={()=>setSelectedRegion(null)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-colors"
              style={{background:`${selectedRegionInfo?.color}18`,color:selectedRegionInfo?.color}}>
              <X size={12}/>{selectedRegionInfo?.label}
            </button>
          </div>
        )}

        {/* Prospect list */}
        <div className="flex-1 overflow-y-auto">
          {filteredProspects.map(p => {
            const inRoute = route.includes(p.id);
            return (
              <div key={p.id} className="px-3 py-3 border-b flex gap-3 hover:opacity-80 transition-opacity"
                style={{borderColor:'var(--card-border)'}}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold truncate" style={{color:'var(--text-primary)'}}>{p.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{background:`${STATUS_COLORS[p.status]}18`,color:STATUS_COLORS[p.status]}}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs mb-1.5" style={{color:'var(--text-muted)'}}>
                    <Building2 size={10}/><span className="truncate">{p.company}</span>
                    <span className="mx-0.5">·</span>
                    <MapPin size={10}/><span>{p.city}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-xs" style={{color:'var(--color-primary)'}} onClick={e=>e.stopPropagation()}><Mail size={10}/></a>}
                    {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs" style={{color:'var(--text-muted)'}} onClick={e=>e.stopPropagation()}><Phone size={10}/></a>}
                    <span className="text-xs font-bold" style={{color:'var(--color-primary)'}}>{p.value.toLocaleString()}€</span>
                  </div>
                </div>
                <button onClick={()=>toggleRoute(p.id)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={inRoute?{background:'var(--color-primary)',color:'#fff'}:{background:'var(--body-bg)',color:'var(--text-muted)',border:'1px solid var(--card-border)'}}>
                  <Route size={14}/>
                </button>
              </div>
            );
          })}
        </div>

        {/* Route bar */}
        {route.length > 0 && (
          <div className="p-3 border-t flex-shrink-0" style={{borderColor:'var(--card-border)',background:'var(--body-bg)'}}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{color:'var(--text-primary)'}}>
                Tournée · {route.length} étape{route.length>1?'s':''} · {(totalRouteValue/1000).toFixed(0)}k€
              </span>
              <button onClick={()=>setRoute([])} className="text-xs" style={{color:'var(--text-muted)'}}>Effacer</button>
            </div>
            <button onClick={()=>{toast.success('Tournée exportée vers votre GPS ✓');}}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{background:'var(--color-primary)'}}>
              <Navigation size={14}/>Lancer la navigation
            </button>
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <div className="flex items-center gap-1.5">
            {REGIONS.slice(0,5).map(r=>(
              <button key={r.id} onClick={()=>setSelectedRegion(s=>s===r.id?null:r.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={selectedRegion===r.id?{background:r.color,color:'#fff'}:{background:`${r.color}18`,color:r.color}}>
                {r.label.split('-')[0].split(' ')[0]}
              </button>
            ))}
            <span className="text-xs" style={{color:'var(--text-muted)'}}>+{REGIONS.length-5} régions</span>
          </div>
          <div style={{flex:1}}/>
          <div className="flex items-center gap-3 text-xs" style={{color:'var(--text-muted)'}}>
            {Object.entries(STATUS_COLORS).slice(0,4).map(([s,c])=>(
              <div key={s} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{background:c}}/>
                {STATUS_LABELS[s]}
              </div>
            ))}
          </div>
        </div>

        {/* Map + pins */}
        <div className="flex-1 relative overflow-hidden" style={{background:'#F8FAFC'}}>
          {/* SVG France map */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <FranceSVG onRegionClick={r=>setSelectedRegion(s=>s===r?null:r)} selectedRegion={selectedRegion} regionCounts={regionCounts}/>
          </div>

          {/* Prospect pins overlay (positioned roughly by region) */}
          {filteredProspects.slice(0,12).map((p, i) => {
            const region = REGIONS.find(r=>r.id===p.region);
            if (!region) return null;
            const jitter = { x: ((i%3)-1)*18, y: ((Math.floor(i/3)%3)-1)*16 };
            const inRoute = route.includes(p.id);
            const color = STATUS_COLORS[p.status];
            return (
              <div key={p.id}
                className="absolute"
                style={{
                  left: `calc(${(region.x/520)*100}% + ${jitter.x}px)`,
                  top: `calc(${(region.y/500)*100}% + ${jitter.y}px)`,
                  transform:'translate(-50%,-100%)',
                  zIndex: inRoute ? 20 : 10,
                }}>
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-125"
                  style={{background: inRoute ? '#0F766E' : color}}
                  title={`${p.name} · ${p.company}`}
                  onClick={()=>toggleRoute(p.id)}>
                  <span className="text-white text-xs font-bold">{p.name[0]}</span>
                </div>
                <div className="w-0 h-0 mx-auto" style={{borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`6px solid ${inRoute?'#0F766E':color}`}}/>
              </div>
            );
          })}

          {/* Info card for selected region */}
          {selectedRegion && (
            <div className="absolute bottom-4 right-4 rounded-2xl shadow-lg p-4 w-56"
              style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{selectedRegionInfo?.label}</div>
                <button onClick={()=>setSelectedRegion(null)}><X size={14} style={{color:'var(--text-muted)'}}/></button>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{color:'var(--text-muted)'}}>Prospects</span>
                  <span className="font-semibold" style={{color:'var(--text-primary)'}}>{filteredProspects.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{color:'var(--text-muted)'}}>Pipeline</span>
                  <span className="font-semibold" style={{color:'var(--color-primary)'}}>{(totalPipeline/1000).toFixed(0)}k€</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{color:'var(--text-muted)'}}>En tournée</span>
                  <span className="font-semibold" style={{color:'var(--text-primary)'}}>{route.filter(id=>filteredProspects.find(p=>p.id===id)).length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-4 left-4 rounded-xl px-3 py-2" style={{background:'rgba(255,255,255,0.9)',border:'1px solid var(--card-border)'}}>
            <div className="text-xs font-semibold mb-2" style={{color:'var(--text-muted)'}}>Taille = nb. prospects</div>
            <div className="flex items-center gap-2 text-xs" style={{color:'var(--text-muted)'}}>
              <Route size={12} style={{color:'var(--color-primary)'}}/>
              <span>Cliquer une épingle pour ajouter à la tournée</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
