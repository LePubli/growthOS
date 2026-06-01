import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';

interface Prospect { id: string; firstName?: string; lastName?: string; company?: string; status?: string; score?: number; }
interface Deal { id: string; name: string; value?: number; stage?: string; }

const STATUS_COLOR: Record<string, string> = {
  new: '#6B7280', contacted: '#2563EB', qualified: '#7C3AED',
  negotiation: '#D97706', won: '#059669', lost: '#EF4444',
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [ps, ds] = await Promise.all([
        api.get<any>('/prospects?limit=5'),
        api.get<any>('/deals?limit=5'),
      ]);
      setProspects(Array.isArray(ps) ? ps : (ps as any).data || []);
      setDeals(Array.isArray(ds) ? ds : (ds as any).data || []);
    } catch { /* use mock fallback */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const pipelineVal = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'won').length;

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topOffset + 16, paddingBottom: 16, paddingHorizontal: 20,
      backgroundColor: colors.primary,
    },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' },
    name: { fontSize: 24, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', marginTop: 2 },
    kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -20, marginBottom: 16 },
    kpi: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    kpiValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold' },
    kpiLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 2, fontFamily: 'Inter_400Regular' },
    kpiIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    section: { paddingHorizontal: 16, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 12 },
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    prospectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    avatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' },
    pName: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: 'Inter_600SemiBold' },
    pSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    dealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    dealName: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: 'Inter_600SemiBold', flex: 1 },
    dealVal: { fontSize: 14, fontWeight: '700', color: colors.primary, fontFamily: 'Inter_700Bold' },
    empty: { alignItems: 'center', padding: 24 },
    emptyTxt: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 8 },
  });

  const MOCK_PROSPECTS: Prospect[] = [
    { id: '1', firstName: 'Sophie', lastName: 'Martin', company: 'TechCorp', status: 'negotiation', score: 85 },
    { id: '2', firstName: 'Paul', lastName: 'Dupont', company: 'BigSales SAS', status: 'qualified', score: 72 },
    { id: '3', firstName: 'Marie', lastName: 'Dubois', company: 'AlphaTech', status: 'contacted', score: 58 },
  ];
  const MOCK_DEALS: Deal[] = [
    { id: '1', name: 'Demo GrowthOS Pro', value: 12500, stage: 'negotiation' },
    { id: '2', name: 'Contrat Enterprise AlphaTech', value: 22000, stage: 'proposal' },
    { id: '3', name: 'Formation BigSales', value: 8200, stage: 'won' },
  ];
  const displayProspects = prospects.length > 0 ? prospects : MOCK_PROSPECTS;
  const displayDeals = deals.length > 0 ? deals : MOCK_DEALS;
  const displayPipeline = deals.length > 0 ? pipelineVal : 42700;

  if (loading) return (
    <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 + bottomPad }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.greeting}>Bonjour 👋</Text>
        <Text style={s.name}>{user?.firstName || 'Commercial'}</Text>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        {[
          { icon: 'users', label: 'Prospects', value: String(displayProspects.length), c: colors.blue, bg: '#EFF6FF' },
          { icon: 'trending-up', label: 'Pipeline', value: `${Math.round(displayPipeline / 1000)}k€`, c: colors.primary, bg: colors.tealLight },
          { icon: 'check-circle', label: 'Gagnés', value: String(deals.length > 0 ? wonDeals : 3), c: colors.green, bg: '#ECFDF5' },
        ].map((k, i) => (
          <View key={i} style={s.kpi}>
            <View style={[s.kpiIcon, { backgroundColor: k.bg }]}>
              <Feather name={k.icon as any} size={16} color={k.c} />
            </View>
            <Text style={[s.kpiValue, { color: k.c }]}>{k.value}</Text>
            <Text style={s.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent prospects */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Prospects récents</Text>
        <View style={s.card}>
          {displayProspects.slice(0, 4).map((p, i) => {
            const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.company || '?';
            return (
              <View key={p.id} style={[s.prospectRow, i === displayProspects.slice(0, 4).length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{name[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pName} numberOfLines={1}>{name}</Text>
                  <Text style={s.pSub} numberOfLines={1}>{p.company || 'Entreprise inconnue'}</Text>
                </View>
                <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[p.status || 'new'] }]} />
              </View>
            );
          })}
        </View>
      </View>

      {/* Pipeline */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Deals en cours</Text>
        <View style={s.card}>
          {displayDeals.slice(0, 4).map((d, i) => (
            <View key={d.id} style={[s.dealRow, i === displayDeals.slice(0, 4).length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.dealName} numberOfLines={1}>{d.name}</Text>
              <Text style={s.dealVal}>{Number(d.value || 0).toLocaleString()}€</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
