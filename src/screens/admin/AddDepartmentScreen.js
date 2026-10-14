import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

export default function AddDepartmentScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Form State - only Department Name and Description (Optional)
  const [departmentName, setDepartmentName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateDepartment = () => {
    if (!departmentName.trim()) {
      Alert.alert('Required Field', 'Please enter department name.');
      return;
    }

    Alert.alert(
      'Create Department',
      `Register "${departmentName.trim()}" under municipal services?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Create 🏛️',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await api.post('/departments', {
                name: departmentName.trim(),
                description: description.trim() || undefined
              });
              Alert.alert(
                'Success',
                `Department "${departmentName.trim()}" successfully registered.`,
                [{ text: 'OK', onPress: () => onSubmitSuccess() }]
              );
            } catch (err) {
              console.log('Create department error:', err.message);
              Alert.alert(
                'Error',
                err.message || 'Could not create department. Please verify the department name is unique.'
              );
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header Bar: Back Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={onBack || onCancel}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Scrollable Form Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Title & Subtitle */}
        <Text style={styles.pageTitle}>Create Department</Text>
        <Text style={styles.pageSubtitle}>
          Register a municipal functional unit to handle citizen grievances
        </Text>

        {/* ======================================================== */}
        {/* FIELD 1: DEPARTMENT NAME */}
        {/* ======================================================== */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            DEPARTMENT NAME <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Water Supply, Drainage & Sewerage"
            placeholderTextColor="#94a3b8"
            value={departmentName}
            onChangeText={setDepartmentName}
          />
          <Text style={styles.helperText}>
            Enter the official name of the municipal department.
          </Text>
        </View>

        {/* ======================================================== */}
        {/* FIELD 2: DESCRIPTION (OPTIONAL) */}
        {/* ======================================================== */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            DESCRIPTION <Text style={styles.optionalLabel}>(OPTIONAL)</Text>
          </Text>
          <TextInput
            style={[styles.textInput, styles.textAreaInput]}
            placeholder="Describe the department scope, citizen services, and directives (optional)..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
          <Text style={styles.helperText}>
            Provide brief information about the responsibilities and services handled.
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 3. Bottom Action Buttons Bar */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            activeOpacity={0.7}
            onPress={onCancel || onBack}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, isSubmitting && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleCreateDepartment}
            disabled={isSubmitting}
          >
            <Text style={styles.createButtonText}>
              {isSubmitting ? 'Creating...' : 'Create Department'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Safe Android/iOS Bottom Clearance */}
        <View style={styles.homeIndicatorWrapper}>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerBar: {
    height: 48,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#ea580c',
    fontWeight: '700',
    marginRight: 6,
    lineHeight: 20,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ea580c',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60, // 👈 Generous clearance for bottom buttons
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Titles */
  pageTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 20,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  sectionTitleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.5,
  },

  /* Form Elements */
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#ef4444',
  },
  optionalLabel: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  textInput: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  textAreaInput: {
    height: 100,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 16,
  },

  /* Bottom Actions Bar */
  bottomBarContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 26, // 👈 Generous clearance above Android system navigation
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 6,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  createButton: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ea580c', // Bright Orange
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  homeIndicatorWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
  homeIndicator: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
});
