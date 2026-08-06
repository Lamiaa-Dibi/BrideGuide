import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { scheduleWeddingReminders } from '../utils/notifications';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Internal storage is always YYYY-MM-DD (or empty string)
  const [weddingDate, setWeddingDate] = useState('');
  const [email, setEmail] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const navigation = useNavigation<any>();

  // Force refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  useEffect(() => {
    fetchProfile();
  }, []);

  // Pretty-print YYYY-MM-DD → "15 / 10 / 2026"
  const formatDateForUI = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d} / ${m} / ${y}`;
  };

  // Determine the month the calendar should open on
  const calendarInitialDate = weddingDate || new Date().toISOString().split('T')[0];

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || '');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        // Store in canonical YYYY-MM-DD form
        setWeddingDate(data.wedding_date ? data.wedding_date.split('T')[0] : '');
      }
    } catch (err: any) {
      console.error('Fetch Profile Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day: { dateString: string }) => {
    setWeddingDate(day.dateString); // already YYYY-MM-DD
    setCalendarVisible(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Convert user's input date from DD/MM/YYYY to YYYY-MM-DD if needed
      let formattedDateForDB = weddingDate || null;
      if (formattedDateForDB && formattedDateForDB.includes('/')) {
        const parts = formattedDateForDB.split('/').map(p => p.trim());
        if (parts.length === 3) {
          const [d, m, y] = parts;
          formattedDateForDB = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }

      const updates = {
        wedding_date: formattedDateForDB,
      };

      console.log('Supabase Payload:', updates);

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select();

      console.log("Supabase Update Response:", data);
      if (error) console.error("Supabase Update Error details:", error);

      if (error) {
        throw error;
      }

      // Schedule local wedding notification reminders safely
      if (formattedDateForDB) {
        try {
          console.log("Attempting to schedule reminders for:", formattedDateForDB);
          await scheduleWeddingReminders(formattedDateForDB);
          console.log("Reminders scheduled successfully!");
        } catch (notifError) {
          console.error("Notifications failed safely, continuing flow:", notifError);
        }
      }

      // Navigate straight to Calendar before the Alert is triggered (to avoid UI locking)
      navigation.navigate('Calendar');
      Alert.alert('Success! 💕', 'Your wedding date has been saved!');
    } catch (err: any) {
      console.log("CRITICAL SAVE ERROR:", err);
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{email[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.emailText}>{email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Verified Bride</Text>
            </View>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>

            {/* Wedding Date — calendar picker */}
            <Text style={styles.label}>Wedding Date</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color="#FDA4AF" />
              <Text
                style={[
                  styles.dateText,
                  !weddingDate && styles.datePlaceholder,
                ]}
              >
                {weddingDate ? formatDateForUI(weddingDate) : 'Tap to pick a date'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#FDA4AF" />
            </TouchableOpacity>



            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.saveBtnText}>Save Wedding Details</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Calendar Picker Modal ── */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header bar */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Your Wedding Date 💕</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#E11D48" />
              </TouchableOpacity>
            </View>

            <Calendar
              current={calendarInitialDate}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={handleDayPress}
              markedDates={
                weddingDate
                  ? {
                      [weddingDate]: {
                        selected: true,
                        selectedColor: '#E11D48',
                      },
                    }
                  : {}
              }
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#FDA4AF',
                selectedDayBackgroundColor: '#E11D48',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#E11D48',
                dayTextColor: '#1E293B',
                textDisabledColor: '#E2E8F0',
                arrowColor: '#E11D48',
                monthTextColor: '#E11D48',
                textMonthFontWeight: 'bold',
                textDayFontSize: 16,
                textMonthFontSize: 18,
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF2F2' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24 },

  // Header
  header: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    shadowColor: '#E11D48',
    elevation: 8,
  },
  avatarText: { fontSize: 40, color: '#E11D48', fontWeight: 'bold' },
  emailText: { marginTop: 16, fontSize: 18, color: '#1E293B', fontWeight: '600' },
  badge: {
    marginTop: 8,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#E11D48', textTransform: 'uppercase' },

  // Form
  form: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    minHeight: 55,
  },
  input: { flex: 1, height: 55, marginLeft: 12, fontSize: 14, color: '#1E293B' },
  dateText: { flex: 1, marginLeft: 12, fontSize: 14, color: '#1E293B' },
  datePlaceholder: { color: '#FDA4AF' },

  // Save button
  saveBtn: {
    backgroundColor: '#E11D48',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E11D48',
  },
});
