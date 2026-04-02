import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, 
      },
    });

    if (error) {
      if (error.message.includes('rate limit')) {
        Alert.alert('Rate Limit Hit', 'Supabase limits emails to 3 per hour on the free tier. Please check your spam folder for previous codes.');
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      setSent(true);
      Alert.alert('Success', 'Check your email for the 6-digit code!');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    // 1. Try 'signup' (for new users since 'Confirm email' is disabled)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup', 
    });

    if (error) {
       // 2. Fallback to 'magiclink' (for returning users)
       const { error: error2 } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'magiclink',
       });
       if (error2) {
          Alert.alert('Verification Failed', 'Invalid or expired code. Please try resending it.');
       }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.logoText}>BrideGuide</Text>
        <Text style={styles.title}>Welcome back, Bride-to-be</Text>
        <Text style={styles.subtitle}>
          {sent 
            ? "We've sent a 6-digit code to your email." 
            : "Enter your email to receive a login code."}
        </Text>

        {!sent ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#FDA4AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>SEND CODE</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#FDA4AF"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.button,
                (otp.length !== 6 || loading) && styles.buttonDisabled
              ]}
              onPress={handleVerifyOtp}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>VERIFY CODE</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.linkRow}>
              <TouchableOpacity 
                onPress={() => setSent(false)} 
                style={styles.linkButton}
                disabled={loading}
              >
                <Text style={styles.linkText}>Change Email</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSendOtp} 
                style={styles.linkButton}
                disabled={loading}
              >
                <Text style={styles.linkText}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  } as any,
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
  } as any,
  logoText: {
    fontSize: 48,
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
    color: '#E11D48',
    marginBottom: 8,
  } as any,
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  } as any,
  subtitle: {
    fontSize: 14,
    color: '#FDA4AF',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
    lineHeight: 20,
  } as any,
  inputContainer: {
    width: '100%',
  } as any,
  input: {
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#E11D48',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    fontWeight: '600',
  } as any,
  button: {
    backgroundColor: '#E11D48',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  } as any,
  buttonDisabled: {
    backgroundColor: '#FDA4AF',
    shadowOpacity: 0,
    elevation: 0,
  } as any,
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  } as any,
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  } as any,
  linkButton: {
    padding: 10,
  } as any,
  linkText: {
    color: '#FDA4AF',
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  } as any
});
