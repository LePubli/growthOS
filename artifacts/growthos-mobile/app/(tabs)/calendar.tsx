import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Event {
  id: string; title: string; type: 'call' | 'meeting' | 'demo' | 'task';
  hour: number; duration: number; contact?: string; company?: string;
}

const TYPE_META = {
  call:    { label: 'Appel',   color: '#059669', icon: 'phone'     },
  meeting: { label: 'Réunion', color: '#2563EB', icon: 'users'     },
  demo:    { label: 'Demo',    color: '#7C3AED', icon: 'monitor'   },
  task:    { label: 'Tâche',   color: '#D97706', icon: 'check-square' },
} as const;

const TODAY = new Date();
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const MOCK_EVENTS: Array<Event & { day: number }> = [
  { id: '1', title: 'Demo GrowthOS', type: 'demo', day: TODAY.getDate(), hour: 10, duration: 1, contact: 'Sophie Martin', company: 'TechCorp' },
  { id: '2', title: 'Suivi proposition', type: 'call', day: TODAY.getDate(), hour: 14, duration: 1, contact: 'Paul Dupont', company: 'BigSales' },
  { id: '3', title: 'Négociation contrat', type: 'meeting', day: TODAY.getDate() + 1, hour: 9, duration: 2, contact: 'Marie Dubois', company: 'AlphaTech' },
  { id: '4', title: 'Préparer proposition', type: 'task', day: TODAY.getDate() + 1, hour: 8, duration: 1, company: 'DataInc' },
  { id: '5', title: 'Appel découverte', type: 'call', day: TODAY.getDate() + 2, hour: 16, duration: 1, contact: 'Emma Leroy', company: 'StartupX' },
];

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(TODAY.getDate());

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  const daysInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  const firstDay = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).getDay();
  const dayEvents = MOCK_EVENTS.filter(e => e.day === selectedDay).sort((a, b) => a.hour - b.hour);

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topOffset + 16, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 2 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    calGrid: { padding: 16 },
    dayHeaders: { flexDirection: 'row', marginBottom: 6 },
    dayHeaderTxt: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
    dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    dayTxt: { fontSize: 14, color: colors.text, fontFamily: 'Inter_400Regular' },
    dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    eventsSection: { paddingHorizontal: 16, paddingBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 10 },
    eventCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3 },
    eventTitle: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 4 },
    eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eventMetaTxt: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 6 },
    badgeTxt: { fontSize: 11, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
    emptyEvents: { alignItems: 'center', padding: 32 },
    emptyTxt: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 10, textAlign: 'center' },
  });

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Calendrier</Text>
        <Text style={s.subtitle}>{MONTHS_FR[TODAY.getMonth()]} {TODAY.getFullYear()}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 + bottomPad }}>
        {/* Mini calendar */}
        <View style={s.calGrid}>
          <View style={s.dayHeaders}>
            {DAYS_FR.map(d => <Text key={d} style={s.dayHeaderTxt}>{d}</Text>)}
          </View>
          <View style={s.grid}>
            {Array.from({ length: firstDay }, (_, i) => (
              <View key={`e${i}`} style={s.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isToday = day === TODAY.getDate();
              const isSelected = day === selectedDay;
              const hasEvents = MOCK_EVENTS.some(e => e.day === day);
              return (
                <Pressable key={day} style={s.dayCell} onPress={() => setSelectedDay(day)}>
                  <View style={[
                    s.dayInner,
                    isSelected && { backgroundColor: colors.primary },
                    isToday && !isSelected && { backgroundColor: `${colors.primary}20` },
                  ]}>
                    <Text style={[s.dayTxt, isSelected && { color: '#fff', fontWeight: '700', fontFamily: 'Inter_700Bold' }, isToday && !isSelected && { color: colors.primary, fontWeight: '700' }]}>
                      {day}
                    </Text>
                  </View>
                  {hasEvents && <View style={[s.dot, { backgroundColor: isSelected ? '#fff' : colors.primary }]} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Events for selected day */}
        <View style={s.eventsSection}>
          <Text style={s.sectionTitle}>
            {selectedDay === TODAY.getDate() ? "Aujourd'hui" : `Jour ${selectedDay}`} · {dayEvents.length} événement{dayEvents.length !== 1 ? 's' : ''}
          </Text>
          {dayEvents.length === 0 ? (
            <View style={s.emptyEvents}>
              <Feather name="calendar" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyTxt}>Pas d'événements ce jour</Text>
            </View>
          ) : (
            dayEvents.map(ev => {
              const meta = TYPE_META[ev.type];
              return (
                <View key={ev.id} style={[s.eventCard, { borderLeftColor: meta.color }]}>
                  <View style={[s.badge, { backgroundColor: meta.color }]}>
                    <Feather name={meta.icon as any} size={10} color="#fff" />
                    <Text style={s.badgeTxt}>{meta.label}</Text>
                  </View>
                  <Text style={s.eventTitle}>{ev.title}</Text>
                  <View style={s.eventMeta}>
                    <View style={s.eventMetaItem}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={s.eventMetaTxt}>{ev.hour}h — {ev.duration}h</Text>
                    </View>
                    {ev.contact && (
                      <View style={s.eventMetaItem}>
                        <Feather name="user" size={12} color={colors.mutedForeground} />
                        <Text style={s.eventMetaTxt}>{ev.contact}</Text>
                      </View>
                    )}
                    {ev.company && (
                      <View style={s.eventMetaItem}>
                        <Feather name="briefcase" size={12} color={colors.mutedForeground} />
                        <Text style={s.eventMetaTxt}>{ev.company}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
