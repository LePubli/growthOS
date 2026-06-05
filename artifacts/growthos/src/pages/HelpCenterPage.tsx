import { useState } from 'react';
import { Search, BookOpen, Video, MessageCircle, Zap, ChevronRight, ExternalLink, HelpCircle, FileText, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';

const CATEGORIES = [
  { id: 'start', icon: '🚀', label: 'Démarrage rapide', count: 6 },
  { id: 'prospects', icon: '👥', label: 'Prospects & CRM', count: 12 },
  { id: 'pipeline', icon: '📊', label: 'Pipeline & Deals', count: 8 },
  { id: 'sequences', icon: '📧', label: 'Séquences Email', count: 10 },
  { id: 'enrichment', icon: '✨', label: 'Enrichissement', count: 7 },
  { id: 'api', icon: '🔌', label: 'API & Intégrations', count: 5 },
];

const ARTICLES: Record<string, { title: string; desc: string; time: string }[]> = {
  start: [
    { title: 'Configurer votre espace de travail', desc: 'Paramètres essentiels pour bien démarrer avec GrowthOS', time: '3 min' },
    { title: 'Importer vos premiers prospects', desc: 'Via CSV, intégration CRM ou saisie manuelle', time: '5 min' },
    { title: 'Créer votre première séquence email', desc: 'Guide pas à pas pour lancer une campagne outbound', time: '7 min' },
    { title: 'Comprendre le tableau de bord', desc: 'KPIs, widgets et personnalisation du dashboard', time: '4 min' },
    { title: 'Inviter votre équipe', desc: 'Gestion des rôles et permissions utilisateurs', time: '3 min' },
    { title: 'Connecter votre CRM existant', desc: 'Synchronisation bidirectionnelle Salesforce, HubSpot, Pipedrive', time: '10 min' },
  ],
  prospects: [
    { title: 'Score prospect — comment ça marche ?', desc: 'Algorithme de scoring et personnalisation des critères', time: '5 min' },
    { title: 'Enrichissement automatique', desc: 'Sources de données et fréquence de mise à jour', time: '4 min' },
    { title: 'Segmentation et filtres avancés', desc: 'Créer des segments intelligents et des vues personnalisées', time: '6 min' },
    { title: 'Notes et historique d\'activité', desc: 'Traçabilité complète des interactions avec vos prospects', time: '3 min' },
    { title: 'Import CSV — format et mapping', desc: 'Spécifications du fichier et correspondance des colonnes', time: '5 min' },
    { title: 'Géolocalisation et tournées', desc: 'Planifier vos visites avec la carte interactive', time: '4 min' },
  ],
  pipeline: [
    { title: 'Configurer les étapes de votre pipeline', desc: 'Personnaliser les stages et probabilités', time: '4 min' },
    { title: 'Score de santé des deals', desc: 'Comprendre et améliorer le health score de vos opportunités', time: '5 min' },
    { title: 'Vue Kanban vs Liste vs Forecast', desc: 'Choisir la meilleure visualisation selon votre contexte', time: '3 min' },
    { title: 'Deal Coach IA', desc: 'Utiliser l\'IA pour obtenir des recommandations sur vos deals', time: '6 min' },
  ],
  sequences: [
    { title: 'Créer une séquence multi-étapes', desc: 'Emails, délais, LinkedIn — construire un workflow complet', time: '8 min' },
    { title: 'Personnalisation avec variables', desc: 'Utiliser {{firstName}}, {{company}} et variables personnalisées', time: '5 min' },
    { title: 'Analyser les performances', desc: 'Taux d\'ouverture, réponse, conversion — interprétation des métriques', time: '6 min' },
    { title: 'A/B testing des objets email', desc: 'Tester différentes approches pour maximiser les ouvertures', time: '4 min' },
  ],
  enrichment: [
    { title: 'Sources d\'enrichissement disponibles', desc: 'Comparatif des 23 sources de données intégrées', time: '7 min' },
    { title: 'Enrichissement en masse', desc: 'Enrichir des listes de contacts en quelques clics', time: '5 min' },
    { title: 'Qualité des données et fraîcheur', desc: 'Comprendre les indicateurs de fiabilité', time: '4 min' },
  ],
  api: [
    { title: 'Authentification API', desc: 'Générer et gérer vos clés API', time: '3 min' },
    { title: 'Webhooks sortants', desc: 'Recevoir des événements en temps réel dans vos outils', time: '5 min' },
    { title: 'Intégration Zapier & Make', desc: 'Connecter GrowthOS à 5000+ applications', time: '6 min' },
    { title: 'Référence API complète', desc: 'Documentation de tous les endpoints disponibles', time: '20 min' },
  ],
};

const FAQS = [
  { q: 'Comment fonctionne le scoring des prospects ?', a: 'Le score (0-100) est calculé automatiquement en fonction du profil (poste, entreprise, taille), du comportement (emails ouverts, clics, réponses), et des signaux d\'intention détectés. Vous pouvez personnaliser les pondérations dans les Paramètres > Scoring.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Oui. GrowthOS utilise une architecture multi-tenant avec isolation complète des données. Toutes les communications sont chiffrées en TLS 1.3. Nos serveurs sont hébergés en Europe (RGPD-compliant).' },
  { q: 'Puis-je importer depuis mon CRM actuel ?', a: 'Absolument. GrowthOS propose des connecteurs natifs pour Salesforce, HubSpot, Pipedrive et Zoho. Pour les autres CRMs, utilisez l\'export CSV ou notre API REST.' },
  { q: 'Comment annuler mon abonnement ?', a: 'Vous pouvez annuler à tout moment depuis Paramètres > Facturation. Votre accès reste actif jusqu\'à la fin de la période payée. Aucun frais d\'annulation.' },
  { q: 'Y a-t-il une limite de prospects ?', a: 'Dépend de votre plan : Starter (500/mois), Pro (5 000/mois), Enterprise (illimité). Les prospects déjà importés ne sont pas supprimés si vous dépassez votre quota — seuls les nouveaux imports sont bloqués.' },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('start');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const articles = ARTICLES[selectedCat] ?? [];
  const filtered = search
    ? Object.values(ARTICLES).flat().filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))
    : articles;

  return (
    <div style={{ minHeight: '100vh', padding: '20px 24px', background: 'var(--body-bg)' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 24px 24px', borderRadius: 20, background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', color: '#fff', marginBottom: 28 }}>
        <HelpCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.9 }} />
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>Centre d'aide GrowthOS</h1>
        <p style={{ fontSize: 14, opacity: 0.85, margin: '0 0 20px' }}>Trouvez rapidement les réponses à vos questions</p>
        <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un article, une fonctionnalité…"
            style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: 'none', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Video size={20} />, label: 'Tutoriels vidéo', desc: '12 vidéos disponibles', color: '#EF4444', bg: '#FEF2F2' },
          { icon: <MessageCircle size={20} />, label: 'Chat support', desc: 'Réponse en < 2h', color: '#10B981', bg: '#ECFDF5' },
          { icon: <Sparkles size={20} />, label: 'AI Assistant', desc: 'Posez vos questions', color: '#8B5CF6', bg: '#F5F3FF' },
        ].map((q, i) => (
          <button key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: q.bg, color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{q.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{q.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.desc}</div>
            </div>
            <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 32 }}>
        {/* Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setSelectedCat(cat.id); setSearch(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: selectedCat === cat.id && !search ? 'var(--color-primary)' : 'transparent', color: selectedCat === cat.id && !search ? '#fff' : 'var(--text-secondary)', textAlign: 'left', fontSize: 13, fontWeight: selectedCat === cat.id ? 700 : 400 }}>
              <span>{cat.icon}</span>
              <span style={{ flex: 1 }}>{cat.label}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{cat.count}</span>
            </button>
          ))}
        </div>

        {/* Articles */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            {search ? `Résultats pour "${search}"` : CATEGORIES.find(c => c.id === selectedCat)?.label}
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>({filtered.length} articles)</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Aucun article trouvé</p>
            ) : filtered.map((art, i) => (
              <button key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', textAlign: 'left' }}>
                <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{art.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{art.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{art.time}</span>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ borderRadius: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '20px 24px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Questions fréquentes</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{faq.q}</span>
                <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: expandedFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
              </button>
              {expandedFaq === i && (
                <div style={{ padding: '0 14px 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
