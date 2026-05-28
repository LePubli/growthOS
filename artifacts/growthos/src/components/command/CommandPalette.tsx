import React, { useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface CommandPaletteProps {
  onClose: () => void;
  navSections: NavSection[];
}

export function CommandPalette({ onClose, navSections }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const allItems = navSections.flatMap(s => s.items);
  const filtered = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une page..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd
            onClick={onClose}
            className="text-xs cursor-pointer px-2 py-0.5 rounded"
            style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
          >
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
              style={{ color: 'var(--text-secondary)', fontSize: 14 }}
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              Aucun résultat
            </div>
          )}
        </div>
      </div>
      <div className="fixed inset-0 bg-black/40 -z-10" />
    </div>
  );
}
