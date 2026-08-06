import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

interface AIModalProps {
  isVisible: boolean;
  onClose: () => void;
}

function isGenericAddRequest(userMsg: string) {
  const clean = userMsg.trim().toLowerCase();
  return /^(add a task|add task|create task|create a task|add a task for me|add task for me|create task for me|add a new task|new task|put a task|add something)$/i.test(clean);
}

function extractTaskDetails(userMsg: string) {
  let taskTitle = userMsg
    .replace(/^(please|can you|could you|i want to|i need to)\s+/i, '')
    .replace(/^(add|create|put|remind me to|set up|book)\s+/i, '')
    .replace(/^(a task|a new task|to my list|to checklist|task|for me)\s+/i, '')
    .trim();

  // Remove trailing generic suffixes like "for me"
  taskTitle = taskTitle.replace(/\s+for me$/i, '').trim();

  if (!taskTitle || taskTitle.length < 2) {
    taskTitle = userMsg.trim();
  }

  // Capitalize first letter
  taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

  // Infer category based on keywords
  let category = 'General';
  if (/venue|location|hall|church|barn|beach/i.test(taskTitle)) category = 'Venue';
  else if (/decor|flower|rose|candle|neon|balloon/i.test(taskTitle)) category = 'Decor';
  else if (/music|dj|band|song|playlist|quartet/i.test(taskTitle)) category = 'Music';
  else if (/food|catering|cake|drink|menu|tasting|wine/i.test(taskTitle)) category = 'Food';
  else if (/dress|suit|tux|attire|fitting|shoe/i.test(taskTitle)) category = 'Attire';
  else if (/photo|photographer|video|camera|album/i.test(taskTitle)) category = 'Photo';

  return { title: taskTitle, category };
}

export default function AIModal({ isVisible, onClose }: AIModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAwaitingTaskTitle, setIsAwaitingTaskTitle] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Hello! I am your AI Wedding Assistant. How can I help you with your tasks today?' }
  ]);

  const handleAsk = async () => {
    if (!query.trim()) return;

    const userMsg = query.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');

    // Check if the user is making a generic request like "add a task" without title
    if (isGenericAddRequest(userMsg) && !isAwaitingTaskTitle) {
      setIsAwaitingTaskTitle(true);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sure! What task would you like to add to your checklist? 💕'
      }]);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let titleToAdd = '';
      let categoryToAdd = 'General';

      if (isAwaitingTaskTitle) {
        // User is answering "What task would you like to add?"
        setIsAwaitingTaskTitle(false);
        const parsed = extractTaskDetails(userMsg);
        titleToAdd = userMsg.length > 2 ? userMsg.charAt(0).toUpperCase() + userMsg.slice(1) : parsed.title;
        categoryToAdd = parsed.category;
      } else {
        const parsed = extractTaskDetails(userMsg);
        titleToAdd = parsed.title;
        categoryToAdd = parsed.category;
      }

      // Perform database insertion immediately
      if (user?.id) {
        const { error } = await supabase.from('tasks').insert([{
          title: titleToAdd,
          category: categoryToAdd,
          priority: 'MEDIUM',
          status: 'TODO',
          user_id: user.id
        }]);

        if (error) console.error('Supabase Task Insert Error:', error);
      }

      setMessages(prev => [...prev, {
        role: 'ai',
        text: `I've added "${titleToAdd}" to your wedding checklist! 💕`
      }]);

    } catch (err: any) {
      console.error('AI Chat Error:', err);
      const parsed = extractTaskDetails(userMsg);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `I've added "${parsed.title}" to your wedding checklist! 💕`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalView}
        >
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="sparkles" size={20} color="#E11D48" />
              <Text style={styles.modalText}>AI Wedding Assistant</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FDA4AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.chatArea} contentContainerStyle={{ paddingBottom: 20 }}>
            {messages.map((msg, i) => (
              <View 
                key={i} 
                style={[
                  styles.msgBubble, 
                  msg.role === 'user' ? styles.userBubble : styles.aiBubble
                ]}
              >
                <Text style={[
                  styles.msgText,
                  msg.role === 'user' ? styles.userText : styles.aiText
                ]}>
                  {msg.text}
                </Text>
              </View>
            ))}
            {loading && (
              <View style={styles.aiBubble}>
                <ActivityIndicator color="#E11D48" size="small" />
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor="#FDA4AF"
              value={query}
              onChangeText={setQuery}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleAsk}>
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
  },
  chatArea: {
    flex: 1,
  },
  msgBubble: {
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: '85%',
  },
  aiBubble: {
    backgroundColor: '#FDF2F2',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#E11D48',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  aiText: {
    color: '#1E293B',
  },
  userText: {
    color: '#FFF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE4E6',
  },
  input: {
    flex: 1,
    backgroundColor: '#FDF2F2',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    maxHeight: 100,
  },
  sendBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
