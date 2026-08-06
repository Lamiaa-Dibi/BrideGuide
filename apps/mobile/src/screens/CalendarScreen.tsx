import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// ─── Countdown helper (timezone-safe) ─────────────────────────────────────────
function calcCountdown(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const weddingUTC = Date.UTC(y, m - 1, d);
  return Math.ceil((weddingUTC - todayUTC) / (1000 * 60 * 60 * 24));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [taskMarks, setTaskMarks] = useState<Record<string, boolean>>({});
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [user, setUser] = useState<any>(null);

  // Keep a ref so the dayComponent closure always sees the latest weddingDate
  const weddingDateRef = useRef<string | null>(null);

  // Fetch logged in user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, []);

  // Real-time subscription: immediately react when profile is updated
  useEffect(() => {
    if (!user) return;
    const profileChannel = supabase
      .channel('profile-calendar')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          applyProfile(payload.new);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  const applyProfile = (profile: any) => {
    // Strict null guard: safety check to prevent crashes on null/undefined profile or wedding_date, and clear stale state
    if (!profile || profile.wedding_date === null || profile.wedding_date === undefined) {
      setWeddingDate(null);
      weddingDateRef.current = null;
      setCountdown(null);
      setGuestCount(null);
      return;
    }
    const rawDate = profile.wedding_date.split('T')[0];
    setWeddingDate(rawDate);
    weddingDateRef.current = rawDate;
    setCountdown(calcCountdown(rawDate));
    setGuestCount(profile.guest_count ?? null);

    // Jump calendar to the wedding month when data arrives
    if (rawDate) setCurrentMonth(rawDate);
  };

  // Wrap the fetch logic inside a useCallback hook tracking user
  const fetchWeddingData = React.useCallback(async () => {
    setLoading(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          activeUser = authUser;
          setUser(authUser);
        }
      }

      if (!activeUser) return;

      // ── Fetch profile (date + guest count) ──
      const { data: profile } = await supabase
        .from('profiles')
        .select('wedding_date, guest_count')
        .eq('id', activeUser.id)
        .single();

      applyProfile(profile);

      // ── Fetch tasks for dot markers ──
      const { data: tasks } = await supabase
        .from('tasks')
        .select('due_date')
        .not('due_date', 'is', null);

      const marks: Record<string, boolean> = {};
      tasks?.forEach((t) => {
        if (t.due_date) marks[t.due_date.split('T')[0]] = true;
      });
      setTaskMarks(marks);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Force refresh when the tab comes into focus (e.g. after saving Profile)
  useFocusEffect(
    React.useCallback(() => {
      fetchWeddingData();
    }, [fetchWeddingData])
  );

  // Build markedDates fresh on every render so the heart always reflects current state
  const buildMarkedDates = () => {
    const result: any = {};

    // Task days — pink dot below the number
    Object.keys(taskMarks).forEach((dateKey) => {
      if (dateKey !== weddingDate) {
        result[dateKey] = { marked: true, dotColor: '#FDA4AF' };
      }
    });

    // Wedding day — custom selected style; heart drawn by dayComponent
    if (weddingDate) {
      result[weddingDate] = {
        selected: true,
        selectedColor: 'transparent', // we draw the heart ourselves
        marked: taskMarks[weddingDate] ?? false,
        dotColor: '#E11D48',
      };
    }

    return result;
  };

  // ── Day renderer ──────────────────────────────────────────────────────────────
  // Using weddingDateRef (updated synchronously) so the closure is always fresh.
  const renderDay = ({ date, state }: any) => {
    const dateStr: string = date?.dateString ?? '';
    const isWedding = dateStr === weddingDateRef.current;
    const isToday = state === 'today';
    const isDisabled = state === 'disabled';
    const isTask = taskMarks[dateStr] && !isWedding;

    if (isWedding) {
      return (
        <View style={dayStyles.heartWrap}>
          <Text style={dayStyles.heartGlyph}>❤️</Text>
          <Text style={dayStyles.heartNum}>{date.day}</Text>
        </View>
      );
    }

    return (
      <View style={[dayStyles.cell, isTask && dayStyles.taskCell]}>
        <Text
          style={[
            dayStyles.num,
            isDisabled && dayStyles.disabled,
            isToday && dayStyles.today,
            isTask && dayStyles.taskNum,
          ]}
        >
          {date.day}
        </Text>
      </View>
    );
  };

  // ── Labels ───────────────────────────────────────────────────────────────────
  const countdownLabel = () => {
    if (countdown === null) return 'Set your date in Profile';
    if (countdown > 0) return `${countdown} Days To Go! 💕`;
    if (countdown === 0) return '🎉 Today is your Wedding Day!';
    return `${Math.abs(countdown)} Days After Wedding`;
  };

  const weddingDateLabel = () => {
    if (!weddingDate) return 'Go to Profile to set a date';
    const [y, m, d] = weddingDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  const markedDates = buildMarkedDates();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Countdown Card ── */}
        <TouchableOpacity
          style={styles.countdownCard}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={32} color="#E11D48" style={styles.heartIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.countdownTitle} numberOfLines={1} adjustsFontSizeToFit>
              {countdownLabel()}
            </Text>
            <Text style={styles.weddingDateText}>{weddingDateLabel()}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Guest Count Card (only shown when set) ── */}
        {guestCount !== null && (
          <View style={styles.guestCard}>
            <Ionicons name="people" size={28} color="#E11D48" style={{ marginRight: 16 }} />
            <View>
              <Text style={styles.guestCount}>{guestCount.toLocaleString()}</Text>
              <Text style={styles.guestLabel}>Guests Invited</Text>
            </View>
          </View>
        )}

        {/* ── Calendar ── */}
        <View style={styles.calendarContainer}>
          <Calendar
            key={weddingDate ?? 'no-date'} // remount when date changes so month jumps
            current={currentMonth || weddingDate || undefined}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#FDA4AF',
              todayTextColor: '#E11D48',
              dayTextColor: '#1E293B',
              textDisabledColor: '#E2E8F0',
              arrowColor: '#E11D48',
              monthTextColor: '#E11D48',
              textMonthFontWeight: 'bold',
              textDayFontSize: 16,
              textMonthFontSize: 20,
              dotColor: '#FDA4AF',
              selectedDotColor: '#E11D48',
            }}
            markingType={'dot'}
            markedDates={markedDates}
            dayComponent={renderDay}
          />
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.pinkDot} />
            <Text style={styles.legendText}>Tasks Due</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendHeart}>❤️</Text>
            <Text style={styles.legendText}>Wedding Day</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Day-cell styles ──────────────────────────────────────────────────────────
const dayStyles = StyleSheet.create({
  heartWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartGlyph: {
    fontSize: 26,
    lineHeight: 28,
    textAlign: 'center',
  },
  heartNum: {
    fontSize: 8,
    color: '#E11D48',
    fontWeight: 'bold',
    lineHeight: 10,
    textAlign: 'center',
  },
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCell: {
    backgroundColor: '#FFE4E6',
    borderRadius: 8,
  },
  num: {
    fontSize: 16,
    color: '#1E293B',
  },
  disabled: { color: '#E2E8F0' },
  today: { color: '#E11D48', fontWeight: 'bold' },
  taskNum: { color: '#E11D48', fontWeight: '600' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF2F2' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, gap: 20 },

  countdownCard: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  heartIcon: { marginRight: 20 },
  countdownTitle: {
    fontSize: 22,
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    color: '#E11D48',
    fontWeight: 'bold',
  },
  weddingDateText: {
    fontSize: 12,
    color: '#FDA4AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '700',
  },

  guestCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  guestCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E11D48',
    lineHeight: 36,
  },
  guestLabel: {
    fontSize: 12,
    color: '#FDA4AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2,
  },

  calendarContainer: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFE4E6', borderWidth: 1, borderColor: '#FDA4AF' },
  legendHeart: { fontSize: 16 },
  legendText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
