import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';

interface Prospect {
  id: string; firstName?: string; lastName?: string;
  email?: string; phone?: string; company?: string;
  jobTitle?: string; status?: string; score?: number; isStarred?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nouveau', contacted: 'Contacté', qualified: 'Qualifié',
  negotiation: 'Négo.', won: 'Gagné', lost: 'Perdu',
};
const STATUS_COLOR: Record<string, string> = {
  new: '#6B7280', contacted: '#2563EB', qualified: '#7C3AED',
  negotiation: '#D97706', won: '#059669', lost: '#EF4444',
};

const MOCK: Prospect[] = [
  { id: '1', firstName: 'Sophie', lastName: 'Martin', company: 'TechCorp', jobTitle: 'DGA', status: 'negotiation', score: 85, isStarred: true, email: 'sophie@techcorp.fr', phone: '06 12 34 56 78' },
  { id: '2', firstName: 'Paul', lastName: 'Dupont', company: 'BigSales SAS', jobTitle: 'CEO', status: 'qualified', score: 72, isStarred: false, email: 'paul@bigsales.fr' },
  { id: '3', firstName: 'Marie', lastName: 'Dubois', company: 'AlphaTech', jobTitle: 'COO', status: 'contacted', score: 58, isStarred: false, email: 'marie@alphatech.io' },
  { id: '4', firstName: 'Luc', lastName: 'Moreau', company: 'GrowthCo', jobTitle: 'VP Sales', status: 'new', score: 41, isStarred: false, email: 'luc@growthco.fr' },
  { id: '5', firstName: 'Emma', lastName: 'Leroy', company: 'StartupX', jobTitle: 'Founder', status: 'won', score: 95, isStarred: true, email: 'emma@startupx.io' },
];

function ProspectCard({ item, colors, onStar }: { item: Prospect; colors: any; onStar: (id: string) => void }) {
  const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.company || '?';
  const statusC = STATUS_COLOR[item.status || 'new'];

  const s = StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 17, fontFamily: 'Inter_700Bold' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' },
    sub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 5, alignSelf: 'flex-start' },
    badgeTxt: { fontSize: 11, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
    score: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
    starBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  });

  return (
    <View style={s.card}>
      <View style={s.avatar}><Text style={s.avatarTxt}>{name[0].toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.sub} numberOfLines={1}>{item.jobTitle ? `${item.jobTitle} · ` : ''}{item.company || ''}</Text>
        <View style={[s.badge, { backgroundColor: statusC }]}>
          <Text style={s.badgeTxt}>{STATUS_LABEL[item.status || 'new']}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={[s.score, { color: (item.score || 0) >= 70 ? colors.green : (item.score || 0) >= 40 ? colors.amber : colors.red }]}>
          {item.score || 0}
        </Text>
        <Pressable style={s.starBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onStar(item.id); }}>
          <Feather name="star" size={18} color={item.isStarred ? '#F59E0B' : colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ProspectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [prospects, setProspects] = useState<Prospect[]>(MOCK);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProspects = async () => {
    try {
      const data = await api.get<any>('/prospects?limit=50');
      const ps = Array.isArray(data) ? data : (data as any).data || [];
      if (ps.length > 0) setProspects(ps);
    } catch { /* keep mock */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchProspects(); }, []);

  const toggleStar = async (id: string) => {
    setProspects(ps => ps.map(p => p.id === id ? { ...p, isStarred: !p.isStarred } : p));
    try {
      const p = prospects.find(x => x.id === id);
      await api.patch(`/prospects/${id}`, { isStarred: !p?.isStarred });
    } catch { }
  };

  const filtered = search
    ? prospects.filter(p => `${p.firstName} ${p.lastName} ${p.company} ${p.email}`.toLowerCase().includes(search.toLowerCase()))
    : prospects;

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topOffset + 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8, borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, fontSize: 14, color: colors.text, fontFamily: 'Inter_400Regular' },
    listContent: { paddingTop: 14, paddingBottom: insets.bottom + 90 + bottomPad },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTxt: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 10, textAlign: 'center' },
  });

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Prospects</Text>
        <View style={s.searchRow}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Rechercher..." placeholderTextColor={colors.mutedForeground} />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}><Feather name="x" size={15} color={colors.mutedForeground} /></Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ProspectCard item={item} colors={colors} onStar={toggleStar} />}
          contentContainerStyle={[s.listContent, filtered.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProspects(); }} tintColor={colors.primary} />}
          scrollEnabled={filtered.length > 0}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={s.emptyTxt}>Aucun prospect trouvé{search ? ` pour "${search}"` : ''}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
