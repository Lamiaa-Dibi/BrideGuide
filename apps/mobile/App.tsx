import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import TaskList from './src/screens/TaskList';
import CommunityLounge from './src/screens/CommunityLounge';
import CalendarScreen from './src/screens/CalendarScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { Session } from '@supabase/supabase-js';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    console.log("DEBUG: App Mounted, checking session...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("DEBUG: Session found:", !!session);
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("DEBUG: Auth State Changed:", _event, !!session);
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        {session ? (
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                  let iconName: any;

                  if (route.name === 'Tasks') {
                    iconName = focused ? 'list' : 'list-outline';
                  } else if (route.name === 'Lounge') {
                    iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                  } else if (route.name === 'Calendar') {
                    iconName = focused ? 'calendar' : 'calendar-outline';
                  } else if (route.name === 'Profile') {
                    iconName = focused ? 'person' : 'person-outline';
                  }

                  return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#E11D48',
                tabBarInactiveTintColor: '#FDA4AF',
                headerShown: false,
                tabBarStyle: {
                  backgroundColor: '#FFF',
                  borderTopColor: '#FFE4E6',
                  height: 60,
                  paddingBottom: 10,
                },
              })}
            >
              <Tab.Screen name="Tasks" component={TaskList} />
              <Tab.Screen name="Calendar" component={CalendarScreen} />
              <Tab.Screen name="Lounge" component={CommunityLounge} />
              <Tab.Screen name="Profile" component={ProfileScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        ) : (
          <View style={styles.container}>
            <AuthScreen />
          </View>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF2F2',
  } as any,
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
  } as any,
});
