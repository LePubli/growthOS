import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';

interface Deal {
  id: string; name: string; company?: string; value?: number;
  stage?: string; probability?: number;
}

const STAGES = [
  { id: 'lead',        label: 'Leads',       color: '#6B7280', icon: 'user' },
  { id: 'qualified',   label: 'Qualifiés',   color: '#2563EB', icon: 'check-circle' },
  { id: 'proposal',    label: 'Proposal',    color: '#7C3AED', icon: 'file-text' },
  { id: 'negotiation', label: 'Négo.',       color: '#D97706', icon: 'message-square' },
  { id: 'won',         label: 'Gagnés',      color: '#059669', icon: 'award' },
] as const;

const MOCK_DEALS: Deal[] = [
  { id: '1', name: 'Demo GrowthOS Pro', company: 'TechCorp', value: 12500, stage: 'negotiation', probability: 80 },
  { id: '2', name: 'Enterprise AlphaTech', company: 'AlphaTech', value: 22000, stage: 'proposal', probability: 60 },
  { id: '3', name: 'Formation BigSales', company: 'BigSales SAS', value: 8200, stage: 'won', probability: 100 },
  { id: '4', name: 'Licence StartupX', company: 'StartupX', value: 5400, stage: 'qualified', probability: 45 },
  { id: '5', name: 'Audit GrowthCo', company: 'GrowthCo', value: 3200, stage: 'lead', probability: 20 },
  { id: '6', name: 'Intégration DataInc', company: 'DataInc', value: 15800, stage: 'proposal', probability: 65 },
];

export default function PipelineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = async () => {
    try {
      const data = await api.get<any>('/deals?limit=50');
      const ds = Array.isArray(data) ? data : (data as any).data || [];
      if (ds.length > 0) setDeals(ds);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchDeals(); }, []);

  const total = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const won = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (Number(d.value) || 0), 0);

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topOffset + 16, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 12 },
    kpiRow: { flexDirection: 'row', gap: 10 },
    kpi: { flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
    kpiV: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_700Bold' },
    kpiL: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
    scroll: { padding: 16 },
    stageBlock: { marginBottom: 18 },
    stageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    stageDot: { width: 8, height: 8, borderRadius: 4 },
    stageLabel: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    stageCount: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    dealCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3 },
    dealName: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
    dealSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    dealVal: { fontSize: 16, fontWeight: '800', fontFamily: 'Inter_700Bold', marginTop: 6 },
    probBar: { height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 8, overflow: 'hidden' },
    probFill: { height: 3, borderRadius: 2 },
  });

  if (loading) return (
    <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Pipeline</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={[s.kpiV, { color: colors.primary }]}>{Math.round(total / 1000)}k€</Text>
            <Text style={s.kpiL}>Total pipeline</Text>
          </View>
          <View style={s.kpi}>
            <Text style={[s.kpiV, { color: colors.green }]}>{Math.round(won / 1000)}k€</Text>
            <Text style={s.kpiL}>CA gagné</Text>
          </View>
          <View style={s.kpi}>
            <Text style={[s.kpiV, { color: colors.text }]}>{deals.length}</Text>
            <Text style={s.kpiL}>Deals</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 90 + bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDeals(); }} tintColor={colors.primary} />}
      >
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          if (stageDeals.length === 0) return null;
          const stageTotal = stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
          return (
            <View key={stage.id} style={s.stageBlock}>
              <View style={s.stageHeader}>
                <View style={[s.stageDot, { backgroundColor: stage.color }]} />
                <Text style={[s.stageLabel, { color: stage.color }]}>{stage.label}</Text>
                <Text style={s.stageCount}>{stageDeals.length} deal{stageDeals.length > 1 ? 's' : ''} · {Math.round(stageTotal / 1000)}k€</Text>
              </View>
              {stageDeals.map(deal => (
                <View key={deal.id} style={[s.dealCard, { borderLeftColor: stage.color }]}>
                  <Text style={s.dealName} numberOfLines={1}>{deal.name}</Text>
                  <Text style={s.dealSub} numberOfLines={1}>{deal.company || ''}</Text>
                  <Text style={[s.dealVal, { color: stage.color }]}>{Number(deal.value || 0).toLocaleString()}€</Text>
                  <View style={s.probBar}>
                    <View style={[s.probFill, { width: `${deal.probability || 50}%` as any, backgroundColor: stage.color }]} />
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
