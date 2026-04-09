import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
}

export default function CommunityLounge() {
  console.log("DEBUG: Lounge Component Mounted");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchUserAndMessages();

    // Set up Realtime listener
    channelRef.current = supabase
      .channel('lounge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages'
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const fetchUserAndMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("DEBUG: Current User:", user);
      setCurrentUser(user);

      const { data, error } = await supabase
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Fetch Error:', error.message);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      // Initial scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 500);
    }
  };

  const getBrideColor = (email: string) => {
    const colors = ['#E11D48', '#D4AF37', '#8E44AD', '#EC4899', '#3B82F6', '#10B981'];
    let hash = 0;
    const cleanEmail = email || 'bride@brideguide.com';
    for (let i = 0; i < cleanEmail.length; i++) {
      hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase
      .from('community_messages')
      .insert([
        {
          user_id: currentUser.id,
          user_email: currentUser.email,
          content: messageContent,
        }
      ]);

    if (error) {
      console.error('Send Error:', error.message);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageContent); // Restore message
    }
    setSending(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.user_id === currentUser?.id;
    const brideColor = getBrideColor(item.user_email || 'bride@brideguide.com');
    const initial = item.user_email?.[0]?.toUpperCase() || 'B';

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
      ]}>
        <View style={isCurrentUser ? styles.bubbleRowReverse : styles.bubbleRow}>
          <View style={[styles.avatarCircle, { backgroundColor: brideColor }]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.bubbleColumn}>
            {!isCurrentUser && (
              <Text style={styles.senderEmail}>{item.user_email?.split('@')[0] || 'Bride'}</Text>
            )}
            <View style={[
              styles.bubble,
              isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
            ]}>
              <Text style={[
                styles.messageText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText
              ]}>
                {item.content}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Lounge</Text>
        <Text style={styles.headerSubtitle}>Chat with fellow brides</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading || !currentUser ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E11D48" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Share a bridal tip..."
            placeholderTextColor="#FDA4AF"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FDF2F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FDF2F2', // Soft Rose background
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    color: '#E11D48',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#FDA4AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderEmail: {
    fontSize: 10,
    color: '#FDA4AF',
    marginBottom: 4,
    marginLeft: 0,
    fontWeight: 'bold',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleRowReverse: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
  },
  bubbleColumn: {
    flexDirection: 'column',
    maxWidth: '85%',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 14,
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  currentUserBubble: {
    backgroundColor: '#E11D48',
    borderBottomRightRadius: 2,
  },
  otherUserBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentUserText: {
    color: '#FFF',
  },
  otherUserText: {
    color: '#1E293B',
  },
  timestamp: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    marginHorizontal: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#FFE4E6',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 15,
    color: '#E11D48',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: '#E11D48',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#FDA4AF',
  },
});
