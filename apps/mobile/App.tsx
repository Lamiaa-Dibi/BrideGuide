import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, SafeAreaView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTasks();

    // Set up real-time listener for tasks
    const channel = supabase
      .channel('public:tasks')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks' 
        }, 
        (payload) => {
          console.log('Database Change Detected:', payload.eventType);
          fetchTasks(); // Simplified Refresh on change
        }
      )
      .subscribe((status) => {
        console.log('Real-time Task Channel Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    if (!refreshing) setLoading(true);
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch Tasks Error:', error.message, error.details);
    } else {
      console.log('Successfully fetched tasks:', data?.length || 0);
      setTasks(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const renderItem = ({ item }: { item: Task }) => (
    <View style={styles.card}>
       <View style={styles.cardHeader}>
          <View style={[styles.priorityBadge, item.priority === 'HIGH' ? styles.priorityHigh : styles.priorityMed]}>
             <Text style={styles.priorityText}>{item.priority}</Text>
          </View>
          <Text style={styles.statusText}>{item.status}</Text>
       </View>
       <Text style={styles.taskTitle}>{item.title}</Text>
       <Text style={styles.categoryText}>{item.category || 'General'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logoText}>BrideGuide</Text>
        <Text style={styles.subLogoText}>Wedding Planner</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E11D48" />
          <Text style={styles.loadingText}>Syncing your wedding plan...</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
               <Text style={styles.emptyText}>Your wedding plan is waitng for you.</Text>
               <Text style={styles.emptySubText}>Add tasks in your Admin Dashboard!</Text>
            </View>
          }
          refreshControl={
            <RefreshControl 
               refreshing={refreshing} 
               onRefresh={onRefresh} 
               tintColor="#E11D48"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF2F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#E11D48',
    fontFamily: 'serif',
    fontStyle: 'italic',
  },
  header: {
    paddingTop: 30,
    paddingBottom: 25,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
  },
  logoText: {
    fontSize: 42,
    fontFamily: 'serif',
    color: '#E11D48',
    letterSpacing: 2,
  },
  subLogoText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FDA4AF',
    textTransform: 'uppercase',
    letterSpacing: 5,
    marginTop: 2,
  },
  listContent: {
    padding: 24,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priorityHigh: {
    backgroundColor: '#FFF1F2',
  },
  priorityMed: {
    backgroundColor: '#FFF7ED',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'black',
    color: '#E11D48',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 28,
  },
  categoryText: {
    fontSize: 10,
    color: '#FDA4AF',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    fontFamily: 'serif',
    fontStyle: 'italic',
  },
  emptySubText: {
    marginTop: 10,
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
