import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, User, GitBranch, ArrowRight, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface NavItem { href: string; label: string; icon?: React.ReactNode; }
interface NavSection { label: string; items: NavItem[]; }
interface CommandPaletteProps { onClose: () => void; navSections: NavSection[]; }

interface SearchResults {
  prospects: Array<{ id: string; firstName?: string; lastName?: string; email?: string; company?: string; jobTitle?: string; status?: string; }>;
  deals: Array<{ id: string; name: string; company?: string; stage?: string; value?: number; }>;
}

const STATUS_DOT: Record<string, string> = {
  new: '#6B7280', contacted: '#2563EB', qualified: '#7C3AED',
  negotiation: '#D97706', won: '#059669', lost: '#DC2626',
};

export function CommandPalette({ onClose, navSections }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const allItems = navSections.flatMap(s => s.items);
  const filteredNav = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  // Debounced live API search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const data = await apiClient.get('/search', { params: { q } }) as SearchResults;
      setResults(data);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const hasApiResults = results && (results.prospects.length > 0 || results.deals.length > 0);

  const go = (href: string) => { navigate(href); onClose(); };

  // Keyboard: press Enter to navigate to first result
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') {
      if (results?.prospects[0]) { go(`/prospects/${results.prospects[0].id}`); return; }
      if (results?.deals[0]) { go(`/pipeline`); return; }
      if (filteredNav[0]) { go(filteredNav[0].href); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
          {loading
            ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            : <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          }
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Rechercher prospects, deals, pages…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd
            onClick={onClose}
            className="text-xs cursor-pointer px-2 py-0.5 rounded"
            style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
          >Esc</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {/* — API results — */}
          {hasApiResults && (
            <>
              {results!.prospects.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Prospects
                  </div>
                  {results!.prospects.map(p => {
                    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.company || p.email || 'Sans nom';
                    const dot = STATUS_DOT[p.status || ''] || '#6B7280';
                    return (
                      <button
                        key={p.id}
                        onClick={() => go(`/prospects/${p.id}`)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'var(--color-primary)' }}>
                          {(name[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {p.jobTitle ? `${p.jobTitle} · ` : ''}{p.company || p.email || ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {results!.deals.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Deals
                  </div>
                  {results!.deals.map(d => (
                    <button
                      key={d.id}
                      onClick={() => go('/pipeline')}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: '#7C3AED18', color: '#7C3AED' }}>
                        <GitBranch size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{d.name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {d.company ? `${d.company} · ` : ''}{d.value ? `${Number(d.value).toLocaleString()}€` : d.stage || ''}
                        </div>
                      </div>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t my-2" style={{ borderColor: 'var(--card-border)' }} />
            </>
          )}

          {/* — No API results but query typed — */}
          {query.length >= 2 && !loading && !hasApiResults && (
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Aucun prospect ou deal correspondant
            </div>
          )}

          {/* — Nav pages — */}
          {filteredNav.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {query ? 'Pages' : 'Navigation rapide'}
              </div>
              {filteredNav.slice(0, query ? undefined : 8).map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--text-secondary)', fontSize: 14 }}
                >
                  {item.icon && (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
              {!query && allItems.length > 8 && (
                <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  +{allItems.length - 8} autres pages — tapez pour filtrer
                </div>
              )}
            </div>
          )}

          {!query && (
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Tapez au moins 2 caractères pour chercher dans vos données
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-xs" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>↵</kbd> ouvrir</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>Esc</kbd> fermer</span>
          <span className="ml-auto">Cmd+K depuis n'importe où</span>
        </div>
      </div>
    </div>
  );
}
