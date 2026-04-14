import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, Platform, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function CalendarScreen() {
  const [loading, setLoading] = useState(false);
  const [weddingDate, setWeddingDate] = useState<string | null>('2027-07-07'); 
  const [countdown, setCountdown] = useState<number | null>(448); 
  const [markedDates, setMarkedDates] = useState<any>({});

  // 1. Force refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchWeddingData();
    }, [])
  );

  // 2. Real-time Subscription to Profiles
  useEffect(() => {
    let profileChannel: any;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      profileChannel = supabase
        .channel('profile-changes')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${user.id}` 
          }, 
          (payload) => {
            console.log("DEBUG: Realtime Profile update received:", payload.new?.wedding_date);
            // GHOST UPDATE FIX: Only update if the incoming data actually has a date
            if (payload.new && payload.new.wedding_date) {
              processProfileData(payload.new);
            } else {
              console.log("DEBUG: Ignored null/empty wedding_date update to prevent ghosting.");
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  const processProfileData = (profile: any) => {
    // PERSISTENCE LOCK: Only extract if it's a valid date string
    let rawDate = profile?.wedding_date; 
    
    if (rawDate) {
      // SANITIZE: Ensure it's only YYYY-MM-DD (slice if ISO string)
      rawDate = rawDate.split('T')[0];
      
      console.log("Persistence Lock - Accepted Date:", rawDate);
      setWeddingDate(rawDate);
      const diff = new Date(rawDate).getTime() - new Date().getTime();
      setCountdown(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else {
      console.log("Persistence Lock - Blocked null/empty update");
      // Only clear if explicitly intended (we don't clear here to prevent ghosting)
    }
  };

  const fetchWeddingData = async () => {
    // Only show loader on initial mount if data is missing
    if (!weddingDate) setLoading(true);
    
    // HARDCODE TEST: Uncomment the line below to test if RENDERING works
    // const testProfile = { wedding_date: '2027-07-07' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('wedding_date')
      .eq('id', user.id)
      .single();

    // Verification of the property name
    console.log("DEBUG: Fetched profile property wedding_date:", profile?.wedding_date);

    processProfileData(profile);

    // Fetch Tasks for markers
    const { data: tasks } = await supabase
      .from('tasks')
      .select('due_date, title')
      .not('due_date', 'is', null);

    const marked: any = {};
    if (tasks) {
      tasks.forEach(task => {
        marked[task.due_date] = {
          customStyles: {
            container: { backgroundColor: '#FFE4E6', borderRadius: 10 },
            text: { color: '#E11D48', fontWeight: 'bold' }
          }
        };
      });
    }

    if (profile?.wedding_date) {
      marked[profile.wedding_date] = {
        selected: true,
        selectedColor: '#E11D48',
        customStyles: {
            container: { backgroundColor: '#E11D48', elevation: 4 },
            text: { color: '#FFF', fontWeight: 'bold' }
        }
      };
    }

    setMarkedDates(marked);
    setLoading(false);
  };

  if (loading && !weddingDate) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.countdownCard}>
          <Ionicons name="heart" size={32} color="#E11D48" style={styles.heartIcon} />
          <View>
            {loading && !weddingDate ? (
              <ActivityIndicator color="#E11D48" size="small" style={{ alignSelf: 'flex-start' }} />
            ) : (
              <>
                <Text style={styles.countdownTitle}>
                  {countdown !== null && countdown > 0 ? `${countdown} Days To Go!` : countdown === 0 ? 'Wedding Day!' : 'Set your date'}
                </Text>
                <Text style={styles.weddingDateText}>
                  {weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Go to Profile Screen'}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <Calendar
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#FDA4AF',
              selectedDayBackgroundColor: '#E11D48',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#E11D48',
              dayTextColor: '#1E293B',
              textDisabledColor: '#E2E8F0',
              dotColor: '#E11D48',
              selectedDotColor: '#ffffff',
              arrowColor: '#E11D48',
              monthTextColor: '#E11D48',
              indicatorColor: '#E11D48',
              textDayFontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
              textMonthFontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
              textMonthFontWeight: 'bold',
              textDayFontSize: 16,
              textMonthFontSize: 20
            }}
            markingType={'custom'}
            markedDates={markedDates}
          />
        </View>

        <View style={styles.legend}>
           <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#FFE4E6' }]} />
              <Text style={styles.legendText}>Tasks Due</Text>
           </View>
           <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#E11D48' }]} />
              <Text style={styles.legendText}>Wedding Day</Text>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF2F2' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24 },
  countdownCard: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 24,
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
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#64748B', fontWeight: '600' }
});
