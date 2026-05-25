'use client';
import { BarChart2, TrendingUp, Users, Mail, Eye, MousePointer, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const MOCK_DATA = {
  sessions: { value: 12847, change: 8.3 },
  conversion: { value: '3.8%', change: 0.4 },
  emailOpen: { value: '48.2%', change: 2.1 },
  revenue: { value: '24.6k€', change: 18.7 },
};

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin'];
const CHART = [45, 62, 78, 91, 110, 134];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30j');
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue d'ensemble de vos performances</p>
        </div>
        <div className="flex gap-2">
          {['7j','30j','90j'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                period === p ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>{p}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Sessions', ...MOCK_DATA.sessions, icon:<Users className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Conversion', ...MOCK_DATA.conversion, icon:<TrendingUp className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
          { label:'Taux ouverture email', ...MOCK_DATA.emailOpen, icon:<Eye className="w-5 h-5" />, color:'text-purple-600 bg-purple-50' },
          { label:'Revenus estimés', ...MOCK_DATA.revenue, icon:<BarChart2 className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${kpi.change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {kpi.change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(kpi.change)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</div>
            <div className="text-sm text-gray-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-6">Croissance prospects</h2>
          <div className="flex items-end gap-3 h-40">
            {CHART.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-teal-600 transition-all" style={{ height: `${(v/Math.max(...CHART))*130}px` }} />
                <span className="text-xs text-gray-400">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Canaux d'acquisition</h2>
          <div className="space-y-4">
            {[
              { label:'Email séquences', value:42, color:'bg-teal-500' },
              { label:'LinkedIn outreach', value:28, color:'bg-blue-500' },
              { label:'Référencement', value:18, color:'bg-purple-500' },
              { label:'Autres', value:12, color:'bg-gray-300' },
            ].map((c, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{c.label}</span>
                  <span className="font-medium text-gray-900">{c.value}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${c.color}`} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
