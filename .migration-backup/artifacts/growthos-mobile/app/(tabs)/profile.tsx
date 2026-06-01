import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

interface MenuItem { icon: string; label: string; sub?: string; onPress?: () => void; danger?: boolean; }

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: async () => { await logout(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); router.replace('/login'); } },
      ]);
    } else {
      logout().then(() => router.replace('/login'));
    }
  };

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'DU';
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Demo User';

  const SECTIONS: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Mon compte',
      items: [
        { icon: 'user', label: 'Profil', sub: user?.email || 'demo@growthos.fr' },
        { icon: 'bell', label: 'Notifications', sub: 'Alertes & rappels' },
        { icon: 'shield', label: 'Sécurité', sub: 'Mot de passe & 2FA' },
      ],
    },
    {
      title: 'Équipe & Accès',
      items: [
        { icon: 'users', label: 'Mon équipe', sub: 'Gérer les membres' },
        { icon: 'key', label: 'Clés API', sub: 'Intégrations externes' },
        { icon: 'webhook', label: 'Webhooks', sub: 'Connexions tierces' },
      ],
    },
    {
      title: 'GrowthOS',
      items: [
        { icon: 'help-circle', label: 'Aide & Support', sub: 'Documentation & chat' },
        { icon: 'star', label: 'Évaluer l\'app', sub: 'Votre avis compte' },
        { icon: 'log-out', label: 'Déconnexion', danger: true, onPress: handleLogout },
      ],
    },
  ];

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    avatarSection: { paddingTop: topOffset + 20, paddingBottom: 24, alignItems: 'center', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarTxt: { color: '#fff', fontSize: 30, fontWeight: '800', fontFamily: 'Inter_700Bold' },
    name: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold' },
    email: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 4 },
    badge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: `${colors.primary}15`, borderRadius: 999 },
    badgeTxt: { fontSize: 12, fontWeight: '600', color: colors.primary, fontFamily: 'Inter_600SemiBold' },
    section: { marginTop: 20, marginHorizontal: 16 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text, fontFamily: 'Inter_500Medium' },
    menuSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  });

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 + bottomPad }}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
          <Text style={s.name}>{fullName}</Text>
          <Text style={s.email}>{user?.email || 'demo@growthos.fr'}</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>✓ Compte Pro</Text></View>
        </View>

        {/* Sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.card}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [s.menuItem, i < section.items.length - 1 && s.menuItemBorder, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress?.(); }}
                >
                  <View style={[s.menuIcon, { backgroundColor: item.danger ? '#FEF2F2' : `${colors.primary}12` }]}>
                    <Feather name={item.icon as any} size={18} color={item.danger ? colors.red : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuLabel, item.danger && { color: colors.red }]}>{item.label}</Text>
                    {item.sub && <Text style={s.menuSub}>{item.sub}</Text>}
                  </View>
                  {!item.danger && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={{ textAlign: 'center', fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 28, marginBottom: 8 }}>
          GrowthOS Mobile v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
