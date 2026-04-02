import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, SafeAreaView, RefreshControl, TouchableOpacity, Platform, TextInput, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  
  // 1. Persist the channel across re-renders
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Get current user info
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
    });

    fetchTasks();

    // 2. Setup the robust channel
    channelRef.current = supabase
      .channel('tasks-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks' 
        }, 
        (payload) => {
          console.log("Realtime event received:", payload);
          fetchTasks(); // Immediate refresh from source of truth
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const fetchTasks = async () => {
    if (!refreshing) setLoading(true);
    
    // RLS handles the isolation automatically
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch Tasks Error:', error.message);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    setAddingTask(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Auth Error', 'No active session found.');
      setAddingTask(false);
      return;
    }

    const { error } = await supabase.from('tasks').insert([
      {
        title: newTaskTitle,
        user_id: user.id,
        status: 'TODO',
        priority: 'MEDIUM',
        category: 'General'
      }
    ]);

    if (error) {
       console.error('Add Task Error:', error.message);
       Alert.alert('Permission Denied', error.message);
    } else {
      setNewTaskTitle('');
    }
    setAddingTask(false);
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    setTasks(prevTasks => 
      prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    );

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      fetchTasks();
      Alert.alert('Sync Error', 'Failed to update task.');
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      fetchTasks();
      Alert.alert('Sync Error', 'Failed to delete task.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const renderItem = ({ item }: { item: Task }) => (
    <View style={[styles.card, item.status === 'DONE' && styles.cardDone]}>
       <TouchableOpacity 
         style={styles.cardContent} 
         onPress={() => toggleTaskStatus(item.id, item.status)}
         activeOpacity={0.7}
       >
         <View style={styles.cardHeader}>
            <View style={[styles.priorityBadge, item.priority === 'HIGH' ? styles.priorityHigh : styles.priorityMed]}>
               <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              item.status === 'DONE' ? styles.statusDone : styles.statusTodo
            ]}>
              <Text style={[
                styles.statusText, 
                item.status === 'DONE' && styles.statusTextDone
              ]}>
                {item.status}
              </Text>
            </View>
         </View>
         <Text style={[
           styles.taskTitle, 
           item.status === 'DONE' && styles.taskTitleDone
         ]}>
           {item.status === 'DONE' ? '✓ ' : ''}{item.title}
         </Text>
         <Text style={styles.categoryText}>{item.category || 'General'}</Text>
       </TouchableOpacity>
       
       <TouchableOpacity 
         style={styles.inlineDelete} 
         onPress={() => deleteTask(item.id)}
       >
         <Text style={styles.inlineDeleteText}>✕</Text>
       </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logoText}>BrideGuide</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subLogoText}>Wedding Planner</Text>
        {userEmail && (
          <Text style={styles.loggedInLabel}>Logged in as: {userEmail}</Text>
        )}
      </View>

      <View style={styles.addInputContainer}>
        <TextInput 
          style={styles.addInput}
          placeholder="New wedding task..."
          placeholderTextColor="#FDA4AF"
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          editable={!addingTask}
        />
        <TouchableOpacity 
          style={[styles.addButton, addingTask && { opacity: 0.7 }]} 
          onPress={handleAddTask}
          disabled={addingTask}
        >
          {addingTask ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.addButtonText}>+</Text>
          )}
        </TouchableOpacity>
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
               <Text style={styles.emptySubText}>Add tasks above!</Text>
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
    </View>
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
  } as any,
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#E11D48',
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    fontStyle: 'italic',
  } as any,
  header: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
    backgroundColor: '#FFF',
  } as any,
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as any,
  logoText: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    color: '#E11D48',
    letterSpacing: 2,
  } as any,
  subLogoText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FDA4AF',
    textTransform: 'uppercase',
    letterSpacing: 5,
    marginTop: 2,
    textAlign: 'center',
  } as any,
  signOutBtn: {
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  } as any,
  signOutText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E11D48',
    letterSpacing: 1,
  } as any,
  listContent: {
    padding: 24,
    paddingBottom: 60,
  } as any,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as any,
  cardContent: {
    flex: 1,
  } as any,
  cardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.8,
  } as any,
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as any,
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  } as any,
  priorityHigh: {
    backgroundColor: '#FFF1F2',
  } as any,
  priorityMed: {
    backgroundColor: '#FFF7ED',
  } as any,
  priorityText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E11D48',
    letterSpacing: 1,
  } as any,
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  } as any,
  statusTodo: {
    backgroundColor: '#FFF1F2',
  } as any,
  statusDone: {
    backgroundColor: '#F0FDF4',
  } as any,
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#E11D48',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  } as any,
  statusTextDone: {
    color: '#16A34A',
  } as any,
  taskTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 28,
  } as any,
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  } as any,
  categoryText: {
    fontSize: 10,
    color: '#FDA4AF',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 10,
  } as any,
  inlineDelete: {
    padding: 10,
    marginLeft: 15,
  } as any,
  inlineDeleteText: {
    color: '#FDA4AF',
    fontSize: 20,
    fontWeight: 'bold',
  } as any,
  loggedInLabel: {
    fontSize: 12,
    color: '#E11D48',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  } as any,
  addInputContainer: {
    flexDirection: 'row',
    padding: 24,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
  } as any,
  addInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#E11D48',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  } as any,
  addButton: {
    width: 50,
    height: 50,
    backgroundColor: '#E11D48',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  } as any,
  addButtonText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  } as any,
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    padding: 40,
  } as any,
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    fontStyle: 'italic',
  } as any,
  emptySubText: {
    marginTop: 10,
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as any
});
