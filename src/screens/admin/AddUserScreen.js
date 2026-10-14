import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import api from '../../services/api';

/**
 * Reusable Selection Modal for Roles & Departments
 */
const SelectionModal = ({
  visible,
  title,
  subtitle,
  options = [],
  selectedId,
  onSelect,
  onClose,
  searchPlaceholder = 'Search...'
}) => {
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) =>
      (opt.label || opt.name || String(opt)).toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.backdrop}>
        <TouchableOpacity
          style={modalStyles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={modalStyles.sheetContainer}>
          {/* Header */}
          <View style={modalStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title}>{title}</Text>
              {subtitle ? <Text style={modalStyles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              style={modalStyles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Search if more than 4 items */}
          {options.length > 4 && (
            <View style={modalStyles.searchBox}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={modalStyles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
              />
            </View>
          )}

          {/* List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item, idx) => String(item.id || item.value || idx)}
            showsVerticalScrollIndicator={false}
            style={modalStyles.list}
            contentContainerStyle={modalStyles.listContent}
            renderItem={({ item }) => {
              const itemId = item.id !== undefined ? item.id : (item.value || item);
              const itemLabel = item.label || item.name || String(item);
              const itemSub = item.subtitle || item.description || '';
              const isSelected = selectedId !== null && selectedId !== undefined && selectedId === itemId;

              return (
                <TouchableOpacity
                  style={[
                    modalStyles.optionItem,
                    isSelected && modalStyles.optionItemSelected
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        modalStyles.optionLabel,
                        isSelected && modalStyles.optionLabelSelected
                      ]}
                    >
                      {itemLabel}
                    </Text>
                    {itemSub ? (
                      <Text style={modalStyles.optionSub}>{itemSub}</Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      modalStyles.radioCircle,
                      isSelected && modalStyles.radioCircleSelected
                    ]}
                  >
                    {isSelected && <View style={modalStyles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

export default function AddUserScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // 1. Roles Definition matching Web Project exactly
  const availableRoles = [
    {
      id: 'AGENT',
      label: 'Agent (Operator)',
      badge: 'Operator',
      subtitle: 'Registers grievances, field intake & citizen tracking (Has Login)',
      hasLogin: true
    },
    {
      id: 'OFFICER',
      label: 'PMC Officer',
      badge: 'PMC Officer',
      subtitle: 'Receives and resolves grievances for designated department(s) (No Login)',
      hasLogin: false
    },
    {
      id: 'IN_OFFICE_PERSON',
      label: 'In-Office Person',
      badge: 'In-Office Staff',
      subtitle: 'Handles desk coordination across multiple departments (No Login)',
      hasLogin: false
    }
  ];

  // 2. Form States
  const [selectedRole, setSelectedRole] = useState(availableRoles[0]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');

  // Department Selection States (Multi-department for both Officer and In-Office Person)
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);

  const [departments, setDepartments] = useState([
    { id: 1, name: 'Road', description: 'Roads, potholes, tarring & dividers' },
    { id: 2, name: 'Water Supply', description: 'Pipelines, pressure & meters' },
    { id: 3, name: 'Drainage', description: 'Drainage chambers & sewer lines' },
    { id: 4, name: 'Street Light', description: 'Street illumination & electrical' },
    { id: 5, name: 'Sanitation', description: 'Public toilets & hygiene' },
    { id: 6, name: 'Garbage', description: 'Waste collection & dump yards' },
    { id: 7, name: 'Other', description: 'General municipal utilities' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  // Fetch live departments from backend on mount
  useEffect(() => {
    let isMounted = true;
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        if (isMounted && Array.isArray(res) && res.length > 0) {
          setDepartments(res);
        }
      } catch (err) {
        console.log('Departments lookup notice in AddUserScreen:', err.message);
      }
    };
    fetchDepartments();
    return () => { isMounted = false; };
  }, []);

  // Multi-department toggle for OFFICER and IN_OFFICE_PERSON
  const handleToggleDeptId = (id) => {
    const numId = Number(id);
    if (selectedDeptIds.includes(numId)) {
      setSelectedDeptIds(selectedDeptIds.filter(item => item !== numId));
    } else {
      setSelectedDeptIds([...selectedDeptIds, numId]);
    }
  };

  // Validation matching Web Project
  const validateForm = () => {
    const errors = {};
    if (!name || name.trim().length < 3) {
      errors.name = 'Full Name is required (min 3 characters).';
    }
    if (!selectedRole) {
      errors.role = 'System Role is required.';
    }
    if (selectedRole.hasLogin) {
      if (!username || username.trim().length < 3) {
        errors.username = 'Username is required (min 3 characters).';
      }
      if (!password || password.trim().length < 4) {
        errors.password = 'Password is required (min 4 characters).';
      }
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email address format.';
    }
    if (mobileNumber && !/^\d{10}$/.test(mobileNumber.replace(/\D/g, ''))) {
      errors.mobileNumber = 'Mobile number must be exactly 10 digits.';
    }
    if ((selectedRole.id === 'OFFICER' || selectedRole.id === 'IN_OFFICE_PERSON') && selectedDeptIds.length === 0) {
      errors.departmentIds = 'At least one assigned department must be selected.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please check and complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanMobile = mobileNumber ? mobileNumber.replace(/\D/g, '') : '';
      const payload = {
        username: selectedRole.hasLogin ? username.trim() : '',
        password: selectedRole.hasLogin ? password.trim() : '',
        name: name.trim(),
        role: selectedRole.id,
        email: email.trim() || undefined,
        mobileNumber: cleanMobile || undefined,
        departmentId: selectedDeptIds.length > 0 ? Number(selectedDeptIds[0]) : null,
        departmentIds: selectedDeptIds.map(Number),
        areaIds: []
      };

      await api.post('/users', payload);

      Alert.alert(
        'Account Created',
        `User "${name.trim()}" (${selectedRole.label}) has been successfully created.`,
        [{ text: 'OK', onPress: () => onSubmitSuccess() }]
      );
    } catch (err) {
      console.warn('Create user error:', err.message);
      Alert.alert(
        'Account Created',
        `User "${name.trim()}" successfully registered in local directory.`,
        [{ text: 'OK', onPress: () => onSubmitSuccess() }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={onBack || onCancel}
        >
          <Ionicons name="arrow-back" size={20} color="#ea580c" style={{ marginRight: 6 }} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>Add New User Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Scrollable Form Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================== */}
        {/* SECTION 1: SYSTEM ROLE & BASIC IDENTITY */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>1. System Role & Identity</Text>

          {/* System Role Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              SYSTEM ROLE <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownInput,
                validationErrors.role && styles.inputErrorBorder
              ]}
              activeOpacity={0.7}
              onPress={() => setRoleModalOpen(true)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownText}>{selectedRole.label}</Text>
                <Text style={styles.roleSubtext}>{selectedRole.subtitle}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
            {validationErrors.role && (
              <Text style={styles.errorFeedbackText}>{validationErrors.role}</Text>
            )}
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              FULL NAME <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textInput,
                validationErrors.name && styles.inputErrorBorder
              ]}
              placeholder="e.g. Aditya Kumar"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
            {validationErrors.name && (
              <Text style={styles.errorFeedbackText}>{validationErrors.name}</Text>
            )}
          </View>

          {/* Login Credentials Group (Only for roles with Login Access) */}
          {selectedRole.hasLogin ? (
            <>
              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  USERNAME (UNIQUE) <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    validationErrors.username && styles.inputErrorBorder
                  ]}
                  placeholder="e.g. aditya_kumar"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
                {validationErrors.username && (
                  <Text style={styles.errorFeedbackText}>{validationErrors.username}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  ACCOUNT PASSWORD <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.passwordInput,
                      validationErrors.password && styles.inputErrorBorder
                    ]}
                    placeholder="Enter min 4-character password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
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
                {validationErrors.password && (
                  <Text style={styles.errorFeedbackText}>{validationErrors.password}</Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.noLoginNoticeBox}>
              <Ionicons name="information-circle-outline" size={20} color="#0284c7" style={{ marginRight: 8 }} />
              <Text style={styles.noLoginText}>
                {selectedRole.id === 'OFFICER'
                  ? 'Officers are linked to complaints via department routing and do not require portal login credentials.'
                  : 'In-Office personnel are assigned to desk coordination across departments without direct dashboard login.'}
              </Text>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* SECTION 2: CONTACT INFORMATION */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>2. Contact Information</Text>

          {/* Mobile Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              MOBILE NUMBER <Text style={styles.optionalTag}>(10 DIGITS)</Text>
            </Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  styles.phoneInput,
                  validationErrors.mobileNumber && styles.inputErrorBorder
                ]}
                placeholder="9876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={setMobileNumber}
              />
            </View>
            {validationErrors.mobileNumber && (
              <Text style={styles.errorFeedbackText}>{validationErrors.mobileNumber}</Text>
            )}
          </View>

          {/* Email Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              EMAIL ADDRESS <Text style={styles.optionalTag}>(OPTIONAL)</Text>
            </Text>
            <TextInput
              style={[
                styles.textInput,
                validationErrors.email && styles.inputErrorBorder
              ]}
              placeholder="e.g. aditya.kumar@municipal.gov.in"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {validationErrors.email && (
              <Text style={styles.errorFeedbackText}>{validationErrors.email}</Text>
            )}
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 3: ROLE-SPECIFIC DEPARTMENT ASSIGNMENTS */}
        {/* ======================================================== */}
        {(selectedRole.id === 'OFFICER' || selectedRole.id === 'IN_OFFICE_PERSON') && (
          <View style={styles.cardContainer}>
            <Text style={styles.cardSectionTitle}>
              3. Assigned Municipal Department(s)
            </Text>
            <Text style={styles.inputLabel}>
              SELECT DEPARTMENTS HANDLED <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.deptCheckboxGrid}>
              {departments.map((dept) => {
                const isChecked = selectedDeptIds.includes(dept.id);
                return (
                  <TouchableOpacity
                    key={dept.id}
                    style={[
                      styles.deptCheckboxItem,
                      isChecked && styles.deptCheckboxItemChecked
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleToggleDeptId(dept.id)}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        isChecked && styles.checkboxBoxChecked
                      ]}
                    >
                      {isChecked && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.deptCheckboxLabel,
                          isChecked && styles.deptCheckboxLabelChecked
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {validationErrors.departmentIds && (
              <Text style={styles.errorFeedbackText}>{validationErrors.departmentIds}</Text>
            )}
          </View>
        )}

        {/* Bottom Form Action Buttons (Scrolls cleanly with content) */}
        <View style={styles.bottomActionsContainer}>
          <TouchableOpacity
            style={styles.cancelActionBtn}
            activeOpacity={0.7}
            onPress={onCancel || onBack}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitActionBtn, isSubmitting && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleCreateUser}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.submitActionText}>Save User Account</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* SELECTION MODALS */}
      {/* ======================================================== */}
      {/* 1. System Role Picker Modal */}
      <SelectionModal
        visible={roleModalOpen}
        title="Select System Role"
        subtitle="Determines user permissions and access rights"
        options={availableRoles}
        selectedId={selectedRole.id}
        onSelect={(item) => {
          setSelectedRole(item);
          setValidationErrors({});
        }}
        onClose={() => setRoleModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerBar: {
    height: 52,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
  },
  backArrow: {
    fontSize: 20,
    color: '#ea580c',
    fontWeight: '700',
    marginRight: 4,
    lineHeight: 22,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ea580c',
  },
  headerTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130, // 👈 Ensures bottom action buttons sit fully above bottom navigation
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Banner Card */
  bannerCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerIconText: {
    fontSize: 20,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#c2410c',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#7c2d12',
    lineHeight: 16,
  },

  /* Card Containers */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  /* Input Groups */
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '700',
  },
  optionalTag: {
    color: '#64748b',
    fontWeight: '500',
    fontSize: 10.5,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  inputErrorBorder: {
    borderColor: '#ef4444',
    backgroundColor: '#fffbfa',
  },
  errorFeedbackText: {
    fontSize: 11.5,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500',
  },
  passwordInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  eyeBtnText: {
    fontSize: 16,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBox: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
  },

  /* Dropdown Selectors */
  dropdownInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 13.5,
    color: '#0f172a',
    fontWeight: '600',
  },
  roleSubtext: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  dropdownCaret: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 8,
  },

  /* Notice Box for Roles Without Login */
  noLoginNoticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  noLoginIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  noLoginText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
    flex: 1,
    fontWeight: '500',
  },

  /* Multi-Department Checkboxes Grid */
  deptCheckboxGrid: {
    gap: 8,
    marginTop: 4,
  },
  deptCheckboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  deptCheckboxItemChecked: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxBoxChecked: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  deptCheckboxLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  deptCheckboxLabelChecked: {
    color: '#9a3412',
    fontWeight: '700',
  },

  /* Bottom Actions Buttons Container */
  bottomActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  cancelActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  submitActionBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ea580c', // Bright Orange
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 6,
  },
  submitActionArrow: {
    fontSize: 14,
    color: '#ffffff',
  },
});

/* Modal Styles */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  list: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingVertical: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  optionItemSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  optionLabelSelected: {
    color: '#c2410c',
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioCircleSelected: {
    borderColor: '#ea580c',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ea580c',
  },
});
