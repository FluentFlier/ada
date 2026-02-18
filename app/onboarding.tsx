/**
 * Onboarding — sign in, sign up, or verify email.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useAuthStore } from '@/stores/auth';

export default function OnboardingScreen() {
  const {
    signIn,
    signUp,
    verifyEmail,
    resendCode,
    resetVerification,
    loading,
    error,
    clearError,
    needsEmailVerification,
    pendingEmail,
  } = useAuthStore();

  if (needsEmailVerification) {
    return (
      <VerifyStep
        email={pendingEmail ?? ''}
        loading={loading}
        error={error}
        onVerify={verifyEmail}
        onResend={resendCode}
        onBack={resetVerification}
        onClearError={clearError}
      />
    );
  }

  return (
    <AuthStep
      loading={loading}
      error={error}
      onSignIn={signIn}
      onSignUp={signUp}
      onClearError={clearError}
    />
  );
}

// ─── Auth Step ───────────────────────────────────────────────────────

function AuthStep({
  loading,
  error,
  onSignIn,
  onSignUp,
  onClearError,
}: {
  loading: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onClearError: () => void;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (isSignUp) {
      await onSignUp(email.trim(), password);
    } else {
      await onSignIn(email.trim(), password);
    }
  };

  const toggleMode = () => {
    onClearError();
    setIsSignUp((prev) => !prev);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Ada</Text>
        <Text style={styles.tagline}>
          Share anything. It&apos;s handled.
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={toggleMode} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Verify Step ─────────────────────────────────────────────────────

function VerifyStep({
  email,
  loading,
  error,
  onVerify,
  onResend,
  onBack,
  onClearError,
}: {
  email: string;
  loading: boolean;
  error: string | null;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  onClearError: () => void;
}) {
  const [code, setCode] = useState('');

  const handleVerify = async () => {
    if (code.trim().length < 6) return;
    onClearError();
    await onVerify(code.trim());
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Verify Email</Text>
        <Text style={styles.tagline}>
          We sent a 6-digit code to {email}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#6B7280"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || code.trim().length < 6}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onResend}
          style={styles.toggle}
          disabled={loading}
        >
          <Text style={styles.toggleText}>Resend code</Text>
        </Pressable>

        <Pressable onPress={onBack} style={styles.toggle}>
          <Text style={[styles.toggleText, { color: '#6B7280' }]}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '600',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    color: '#6366F1',
    fontSize: 14,
  },
});
