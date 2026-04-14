import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AIModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function AIModal({ isVisible, onClose }: AIModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Hello! I am your AI Wedding Assistant. How can I help you with your tasks today?' }
  ]);

  const handleAsk = async () => {
    if (!query.trim()) return;

    const userMsg = query.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      // For this demo, we'll simulate a connection to the generated-tasks logic or a mock response
      // In a real app, this would hit process.env.EXPO_PUBLIC_API_URL + '/api/chat'
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          text: `Based on your request "${userMsg}", I suggest focusing on your category priority and booking your vendors at least 6 months in advance. Should I add some specific tasks for you?` 
        }]);
        setLoading(false);
      }, 1500);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am having trouble connecting right now. Please try again!' }]);
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
