import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/api';
import { getBackendServerUrl } from '../../config/env';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Top Brand Emblem Component
const PortalBrandHeader = () => (
  <View style={styles.brandHeader}>
    <Image
      source={require('../../../assets/icon.png')}
      style={{ width: 48, height: 48, resizeMode: 'contain', marginBottom: 6 }}
    />
    <Text style={styles.brandTitle}>
      <Text style={styles.brandTitleBold}>Office of Kunal Tilak</Text> Portal
    </Text>
    <Text style={styles.brandSubtitle}>Politician Portal</Text>
  </View>
);

export default function LoginScreen({
  onLoginSuccess = () => {},
  onNavigateTrack = () => {}
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load saved identifier / remember preferences on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const saved = await authService.getSavedCredentials();
        if (saved) {
          setRememberMe(saved.rememberMe);
          if (saved.identifier) {
            setIdentifier(saved.identifier);
          }
        }
      } catch (e) {}
    };
    loadSaved();
  }, []);

  const handleLogin = async () => {
    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setErrorMsg('Please enter your username.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const response = await authService.login(trimmedId, password, rememberMe);
      const userProfile = response.user || {
        name: trimmedId === 'admin' ? 'Office of Kunal Tilak' : trimmedId,
        role: response.user?.role || 'SUPERADMIN',
        username: trimmedId,
        avatar: response.user?.avatar || null
      };
      onLoginSuccess(userProfile);
    } catch (err) {
      console.warn('Login failed:', err.message);
      setErrorMsg(
        err.message || 'Authentication failed. Please verify credentials or connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'For security and administrative verification, password resets are processed by your Pune PMC System Administrator.\n\nPlease contact: admin@municipal.gov.in or the IT Cell Desk.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Brand Header */}
          <PortalBrandHeader />

          {/* Heading Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to manage and track your municipal reports
            </Text>
          </View>

          {/* Main White Card Container */}
          <View style={styles.loginCard}>
            {/* Error Notification */}
            {errorMsg ? (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInputField}
                  placeholder="Enter your username"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    setErrorMsg('');
                  }}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInputField}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setErrorMsg('');
                  }}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              activeOpacity={0.8}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkboxBox, rememberMe && styles.checkboxBoxActive]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Remember me on this Pune PMC device
              </Text>
            </TouchableOpacity>

            {/* Sign In Primary Action Button */}
            <TouchableOpacity
              style={styles.signInButton}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Citizen Tracking Navigation Link */}
          <View style={styles.citizenTrackSection}>
            <TouchableOpacity
              style={styles.citizenTrackBtn}
              activeOpacity={0.7}
              onPress={onNavigateTrack}
            >
              <Text style={styles.citizenTrackText}>
                Citizens: Track Grievance Status &rarr;
              </Text>
            </TouchableOpacity>
          </View>

          {/* Connected Backend Indicator */}
          <View style={styles.serverInfoSection}>
            <View style={styles.serverStatusDot} />
            <Text style={styles.serverInfoText}>
              Backend: {getBackendServerUrl().replace(/^https?:\/\//, '')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  keyboardView: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Math.max(SCREEN_HEIGHT * 0.02, 14),
    paddingBottom: 40,
    justifyContent: 'center'
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16
  },
  brandIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  brandTitle: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '400',
    letterSpacing: -0.2
  },
  brandTitleBold: {
    fontWeight: '800',
    color: '#0f172a'
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 20
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    textAlign: 'center'
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 19
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12.5,
    color: '#dc2626',
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  forgotPasswordText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ea580c'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48
  },
  textInputField: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a'
  },
  eyeToggleBtn: {
    padding: 6
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 2
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  checkboxBoxActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316'
  },
  checkboxLabel: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500'
  },
  signInButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  signInButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2
  },
  citizenTrackSection: {
    marginTop: 18,
    alignItems: 'center'
  },
  citizenTrackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  citizenTrackText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2563eb'
  },
  serverInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    alignSelf: 'center'
  },
  serverStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6
  },
  serverInfoText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  }
});
