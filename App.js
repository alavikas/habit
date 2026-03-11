import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = 'hourly-tracker-entries-v1';
const CATEGORY_ID = 'hourly-tracker-category';
const OPTIONS = [
  { key: 'work', label: 'Work', color: '#2e7d32' },
  { key: 'deep-work', label: 'Deep Work', color: '#1565c0' },
  { key: 'wasted', label: 'Wasted', color: '#c62828' },
  { key: 'job', label: 'Job', color: '#6a1b9a' },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function formatHour(dateString) {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${String(date.getHours()).padStart(2, '0')}:00`;
}

function toCurrentHourIso() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString();
}

function hoursSinceWake(wakeHour, entries) {
  const now = new Date();
  const wake = new Date();
  wake.setHours(wakeHour, 0, 0, 0);
  if (wake > now) {
    wake.setDate(wake.getDate() - 1);
  }
  const msDiff = now.getTime() - wake.getTime();
  const totalHours = Math.max(1, Math.floor(msDiff / (1000 * 60 * 60)) + 1);
  return Math.max(totalHours, entries.length);
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [note, setNote] = useState('');
  const [selectedOption, setSelectedOption] = useState('work');
  const [wakeHour, setWakeHour] = useState('7');

  useEffect(() => {
    const boot = async () => {
      await loadEntries();
      await setupNotifications();
    };
    boot();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const action = response.actionIdentifier;
      const tapped = OPTIONS.find((o) => o.key === action);
      if (!tapped) {
        return;
      }
      await saveEntry({
        option: tapped.key,
        note: 'Logged from notification',
        hour: toCurrentHourIso(),
      });
      Alert.alert('Saved', `Marked the last hour as ${tapped.label}.`);
    });

    return () => subscription.remove();
  }, [entries]);

  const summary = useMemo(() => {
    const count = OPTIONS.reduce((acc, option) => ({ ...acc, [option.key]: 0 }), {});
    entries.forEach((entry) => {
      count[entry.option] = (count[entry.option] || 0) + 1;
    });
    const totalAwakeHours = hoursSinceWake(Number(wakeHour || 7), entries);
    const wastedHours = count.wasted || 0;
    return {
      count,
      totalAwakeHours,
      wastedHours,
      productive: (count.work || 0) + (count['deep-work'] || 0) + (count.job || 0),
    };
  }, [entries, wakeHour]);

  async function setupNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please enable notifications to receive hourly reminders.');
      return;
    }

    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, OPTIONS.map((option) => ({
      identifier: option.key,
      buttonTitle: option.label,
      options: {
        opensAppToForeground: true,
      },
    })));

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hourly check-in',
        body: 'What did you do in the last hour?',
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: {
        seconds: 60 * 60,
        repeats: true,
      },
    });
  }

  async function loadEntries() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    setEntries(parsed);
  }

  async function saveEntries(nextEntries) {
    setEntries(nextEntries);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
  }

  async function saveEntry(entry) {
    const dedupeHour = entry.hour;
    const next = entries.filter((existing) => existing.hour !== dedupeHour);
    next.unshift(entry);
    await saveEntries(next);
  }

  async function handleManualSave() {
    await saveEntry({
      option: selectedOption,
      note: note.trim() || 'No details added',
      hour: toCurrentHourIso(),
    });
    setNote('');
  }

  const maxCount = Math.max(...Object.values(summary.count), 1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Hourly Activity Tracker</Text>
        <Text style={styles.subtitle}>Get a reminder every hour and quickly log what you did.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual check-in</Text>
          <Text style={styles.label}>Category</Text>
          <View style={styles.optionWrap}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setSelectedOption(option.key)}
                style={[
                  styles.optionButton,
                  selectedOption === option.key && { borderColor: option.color, backgroundColor: '#f1f5f9' },
                ]}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>What exactly did you do?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Example: fixed critical bug, 25 min scrolling, 45 min learning"
            style={styles.textArea}
          />
          <Pressable style={styles.primaryButton} onPress={handleManualSave}>
            <Text style={styles.primaryButtonText}>Save last hour</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily overview</Text>
          <TextInput
            keyboardType="number-pad"
            value={wakeHour}
            onChangeText={setWakeHour}
            style={styles.input}
            placeholder="Wake hour (0-23)"
          />
          <Text style={styles.metaText}>Awake hours today: {summary.totalAwakeHours}</Text>
          <Text style={styles.metaText}>Wasted hours: {summary.wastedHours}</Text>
          <Text style={styles.metaText}>Productive hours: {summary.productive}</Text>

          {OPTIONS.map((option) => {
            const count = summary.count[option.key] || 0;
            const widthPct = (count / maxCount) * 100;
            return (
              <View key={option.key} style={styles.barRow}>
                <Text style={styles.barLabel}>{option.label}</Text>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: option.color }]} />
                </View>
                <Text style={styles.barValue}>{count}h</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent logs</Text>
          <FlatList
            data={entries}
            keyExtractor={(item) => item.hour}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.logRow}>
                <Text style={styles.logHour}>{formatHour(item.hour)}</Text>
                <Text style={styles.logTag}>{item.option}</Text>
                <Text style={styles.logNote}>{item.note}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#334155',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    minHeight: 90,
    textAlignVertical: 'top',
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  metaText: {
    color: '#334155',
    marginBottom: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  barLabel: {
    width: 80,
    fontWeight: '600',
  },
  barBackground: {
    flex: 1,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
  },
  barValue: {
    width: 40,
    textAlign: 'right',
    fontWeight: '700',
  },
  empty: {
    color: '#64748b',
    marginTop: 4,
  },
  logRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  logHour: {
    fontWeight: '700',
  },
  logTag: {
    marginTop: 4,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  logNote: {
    marginTop: 4,
    color: '#475569',
  },
});
