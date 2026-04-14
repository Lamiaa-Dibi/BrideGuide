import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weddingDate, setWeddingDate] = useState('');
  const [weddingTheme, setWeddingTheme] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [email, setEmail] = useState('');

  // 1. Force refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDateForUI = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return dateStr;
    const [y, m, d] = dateStr.split('-');
    return `${d} / ${m} / ${y}`; // Pretty format for the bride
  };

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
        // Populate the form with the "Pretty" version
        setWeddingDate(formatDateForUI(data.wedding_date) || '');
        setWeddingTheme(data.wedding_theme || '');
        setGuestCount(data.guest_count?.toString() || '');
      }
    } catch (err: any) {
      console.error('Fetch Profile Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeDate = (input: string) => {
    if (!input) return null;
    
    const parts = input.match(/(\d+)/g);
    if (!parts || parts.length < 3) return input;

    let year, month, day;
    
    if (parts[0].length === 4) { // YYYY-MM-DD
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    } else { 
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    }

    return `${year}-${month}-${day}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const formattedDate = normalizeDate(weddingDate);

      const updates = {
        id: user.id,
        email: user.email,
        wedding_date: formattedDate,
        wedding_theme: weddingTheme,
        guest_count: guestCount ? parseInt(guestCount) : null,
        updated_at: new Date().toISOString(),
      };

      console.log("Supabase Payload:", updates);

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        console.error("Supabase Error Details:", error);
        throw error;
      }
      
      // PERSISTENCE LOCK: Update local UI state immediately to prevent resetting
      if (formattedDate) {
        setWeddingDate(formatDateForUI(formattedDate));
      }
      
      Alert.alert('Success', 'Your profile has been updated!');
    } catch (err: any) {
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
          <View style={styles.header}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{email[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.emailText}>{email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Verified Bride</Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Wedding Date (DD / MM / YYYY)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={20} color="#FDA4AF" />
              <TextInput
                style={styles.input}
                placeholder="15 / 10 / 2026"
                placeholderTextColor="#FDA4AF"
                value={weddingDate}
                onChangeText={setWeddingDate}
              />
            </View>

            <Text style={styles.label}>Wedding Theme</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="color-palette-outline" size={20} color="#FDA4AF" />
              <TextInput
                style={styles.input}
                placeholder="e.g. Modern Rose"
                placeholderTextColor="#FDA4AF"
                value={weddingTheme}
                onChangeText={setWeddingTheme}
              />
            </View>

            <Text style={styles.label}>Guest Count</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={20} color="#FDA4AF" />
              <TextInput
                style={styles.input}
                placeholder="Number of guests"
                placeholderTextColor="#FDA4AF"
                value={guestCount}
                onChangeText={setGuestCount}
                keyboardType="numeric"
              />
            </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF2F2' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24 },
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
  badge: { marginTop: 8, backgroundColor: '#FFE4E6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#E11D48', textTransform: 'uppercase' },
  form: { backgroundColor: '#FFF', padding: 24, borderRadius: 32, borderWidth: 1, borderColor: '#FFE4E6' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF2F2', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FFE4E6' },
  input: { flex: 1, height: 55, marginLeft: 12, fontSize: 14, color: '#1E293B' },
  saveBtn: { backgroundColor: '#E11D48', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 10 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
