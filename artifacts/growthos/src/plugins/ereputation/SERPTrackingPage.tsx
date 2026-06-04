import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, TrendingDown, Minus, Loader2, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import apiClient from '@/lib/api-client';

interface Campaign { id: string; name: string; targetName: string; }
interface SerpEntry { keyword: string; position: number | null; url: string | null; volume: number; date: string; }

const MOCK_HISTORY = (keyword: string) =>
  Array.from({ length: 10 }, (_, i) => ({
    date: new Date(Date.now() - (9 - i) * 86400000 * 3).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    [keyword]: Math.max(1, Math.floor(Math.random() * 20 + 3)),
  }));

const PosDiff = ({ diff }: { diff: number }) => {
  if (diff === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  if (diff < 0) return <span className="flex items-center gap-0.5 text-green-600 font-medium"><TrendingUp size={12} />+{Math.abs(diff)}</span>;
  return <span className="flex items-center gap-0.5 text-red-500 font-medium"><TrendingDown size={12} />-{Math.abs(diff)}</span>;
};

export default function SERPTrackingPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['erep-campaigns'],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<Campaign[]>,
    onSuccess: (data) => { if (!selectedCampaign && data.length) setSelectedCampaign(data[0]!.id); },
  });

  const { data: serpData = [], isLoading } = useQuery({
    queryKey: ['erep-serp', selectedCampaign],
    queryFn: () => selectedCampaign ? apiClient.get(`/ereputation/campaigns/${selectedCampaign}/serp`) as Promise<SerpEntry[]> : Promise.resolve([]),
    enabled: !!selectedCampaign,
  });

  const mockData: SerpEntry[] = serpData.length ? serpData : [
    { keyword: 'GrowthOS CRM', position: 3, url: 'https://growthos.io', volume: 1200, date: new Date().toISOString() },
    { keyword: 'outil growth hacking', position: 8, url: 'https://growthos.io/growth', volume: 3400, date: new Date().toISOString() },
    { keyword: 'logiciel prospection B2B', position: 15, url: 'https://growthos.io/b2b', volume: 5600, date: new Date().toISOString() },
    { keyword: 'CRM intelligence artificielle', position: 24, url: 'https://growthos.io/ai', volume: 2100, date: new Date().toISOString() },
    { keyword: 'Sales automation France', position: 11, url: 'https://growthos.io/sales', volume: 890, date: new Date().toISOString() },
  ];

  const historyData = selectedKeyword ? MOCK_HISTORY(selectedKeyword) : MOCK_HISTORY('Position avg').map(r => ({ ...r, 'Position avg': Object.values(r)[1] }));
  const historyKey = selectedKeyword || 'Position avg';

  const posColor = (pos: number | null) => {
    if (!pos) return '#6B7280';
    if (pos <= 3) return '#059669';
    if (pos <= 10) return '#D97706';
    return '#DC2626';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Suivi SERP</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Positions Google par mot-clé</p>
        </div>
        <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
          className="px-3 py-2 border rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
          <option value="">Toutes les campagnes</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* History chart */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            HISTORIQUE {selectedKeyword ? `— "${selectedKeyword}"` : '— POSITION MOYENNE'}
          </h2>
          {selectedKeyword && (
            <button onClick={() => setSelectedKeyword('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Réinitialiser
            </button>
          )}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis reversed domain={[1, 30]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => [`Position ${val}`, '']}
            />
            <Line type="monotone" dataKey={historyKey} stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Cliquez sur un mot-clé pour filtrer son historique</p>
      </div>

      {/* SERP table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
              {['Mot-clé', 'Position', 'Variation', 'URL', 'Volume/mois'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10"><Loader2 size={24} className="animate-spin mx-auto" style={{ color: 'var(--color-primary)' }} /></td></tr>
            ) : mockData.map((row, i) => (
              <tr key={i} onClick={() => setSelectedKeyword(row.keyword)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                style={{ borderBottom: i < mockData.length - 1 ? '1px solid var(--card-border)' : undefined }}>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.keyword}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ color: posColor(row.position), background: posColor(row.position) + '15' }}>
                    #{row.position ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <PosDiff diff={Math.floor(Math.random() * 6) - 3} />
                </td>
                <td className="px-4 py-3 text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                  {row.url ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {(row.volume ?? 0).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
