import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

interface ProfileContextType {
  weddingDate: string | null;
  guestCount: number | null;
  loading: boolean;
  user: any;
  setWeddingDate: (date: string | null) => void;
  updateWeddingDate: (date: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [weddingDate, setWeddingDateState] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);

  // Helper to safely format raw date string to YYYY-MM-DD
  const formatRawDate = (rawDate: string | null | undefined): string | null => {
    if (!rawDate) return null;
    return rawDate.split('T')[0];
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('wedding_date, guest_count')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('ProfileContext fetch error:', error.message);
      }

      if (profile) {
        const formatted = formatRawDate(profile.wedding_date);
        setWeddingDateState(formatted);
        setGuestCount(profile.guest_count ?? null);
      } else {
        setWeddingDateState(null);
        setGuestCount(null);
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      await fetchProfile(currentUser.id);
    } else {
      setUser(null);
      setWeddingDateState(null);
      setGuestCount(null);
      setLoading(false);
    }
  };

  // On initial mount & auth state changes
  useEffect(() => {
    refreshProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setWeddingDateState(null);
        setGuestCount(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Real-time Postgres Subscription for profiles
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-global-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            const formatted = formatRawDate(payload.new.wedding_date);
            setWeddingDateState(formatted);
            setGuestCount(payload.new.guest_count ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const updateWeddingDate = async (newDate: string | null) => {
    // 1. Immediately update global state for instantaneous UI response
    const formatted = formatRawDate(newDate);
    setWeddingDateState(formatted);

    // 2. Persist to Supabase profiles table
    if (user?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ wedding_date: formatted })
        .eq('id', user.id);

      if (error) {
        console.error('Error persisting wedding_date to Supabase:', error.message);
        throw error;
      }
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        weddingDate,
        guestCount,
        loading,
        user,
        setWeddingDate: setWeddingDateState,
        updateWeddingDate,
        refreshProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
