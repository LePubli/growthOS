import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, demoLogin } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('Email et mot de passe requis'); return; }
    setLoading(true);
    try {
      await login(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Identifiants incorrects');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  const handleDemo = async () => {
    setLoading(true);
    await demoLogin();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)');
    setLoading(false);
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { alignItems: 'center', marginBottom: 40 },
    logoBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    logoLetter: { color: '#fff', fontSize: 30, fontWeight: '800', fontFamily: 'Inter_700Bold' },
    appName: { fontSize: 26, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
    tagline: { fontSize: 14, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular' },
    tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabBtnActive: { backgroundColor: colors.primary },
    tabTxt: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
    tabTxtActive: { color: '#fff' },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text, backgroundColor: colors.background, fontFamily: 'Inter_400Regular', marginBottom: 14 },
    inputFocused: { borderColor: colors.primary },
    btn: { height: 52, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
    btnDemo: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    btnDemoTxt: { color: colors.primary, fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
    err: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    errTxt: { color: '#DC2626', fontSize: 13, flex: 1, fontFamily: 'Inter_400Regular' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerTxt: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' },
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logo}>
          <View style={s.logoBox}>
            <Text style={s.logoLetter}>G</Text>
          </View>
          <Text style={s.appName}>GrowthOS</Text>
          <Text style={s.tagline}>Plateforme B2B Growth Intelligence</Text>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['login', 'register'] as const).map(t => (
            <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Form */}
        <View style={s.card}>
          {error && (
            <View style={s.err}>
              <Feather name="alert-circle" size={15} color="#DC2626" />
              <Text style={s.errTxt}>{error}</Text>
            </View>
          )}

          {tab === 'register' && (
            <>
              <Text style={s.label}>Prénom</Text>
              <TextInput style={[s.input, focusedField === 'firstName' && s.inputFocused]} value={firstName}
                onChangeText={setFirstName} placeholder="Prénom" placeholderTextColor={colors.mutedForeground}
                onFocus={() => setFocusedField('firstName')} onBlur={() => setFocusedField(null)} />
              <Text style={s.label}>Nom</Text>
              <TextInput style={[s.input, focusedField === 'lastName' && s.inputFocused]} value={lastName}
                onChangeText={setLastName} placeholder="Nom" placeholderTextColor={colors.mutedForeground}
                onFocus={() => setFocusedField('lastName')} onBlur={() => setFocusedField(null)} />
            </>
          )}

          <Text style={s.label}>Email</Text>
          <TextInput style={[s.input, focusedField === 'email' && s.inputFocused]} value={email}
            onChangeText={setEmail} placeholder="john@acme.fr" keyboardType="email-address"
            autoCapitalize="none" placeholderTextColor={colors.mutedForeground}
            onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} />

          <Text style={s.label}>Mot de passe</Text>
          <TextInput style={[s.input, focusedField === 'pass' && s.inputFocused]} value={password}
            onChangeText={setPassword} placeholder="••••••••" secureTextEntry
            placeholderTextColor={colors.mutedForeground}
            onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField(null)} />

          <Pressable style={({ pressed }) => [s.btn, { opacity: pressed || loading ? 0.8 : 1 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{tab === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>}
          </Pressable>
        </View>

        {/* Demo */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerTxt}>ou</Text>
          <View style={s.dividerLine} />
        </View>
        <Pressable style={({ pressed }) => [s.btnDemo, { opacity: pressed ? 0.7 : 1 }]} onPress={handleDemo} disabled={loading}>
          <Text style={s.btnDemoTxt}>🚀 Connexion démo (sans compte)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
