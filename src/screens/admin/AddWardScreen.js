import React, { useState, useEffect } from 'react';
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
  Platform,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddressPlacesAutocomplete } from '../../components';
import api from '../../services/api';

/**
 * Reusable Selection Modal for Wards
 */
const WardSelectModal = ({
  visible,
  options = [],
  selectedId,
  onSelect,
  onClose
}) => {
  const [search, setSearch] = useState('');

  const filtered = options.filter(opt =>
    (opt.name || opt.label || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <TouchableOpacity style={modalStyles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={modalStyles.sheetContainer}>
          <View style={modalStyles.headerRow}>
            <Text style={modalStyles.title}>Select Parent Ward</Text>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.searchBox}>
            <Text style={modalStyles.searchIcon}>🔍</Text>
            <TextInput
              style={modalStyles.searchInput}
              placeholder="Search ward..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            style={modalStyles.list}
            renderItem={({ item }) => {
              const isSelected = selectedId === item.id;
              return (
                <TouchableOpacity
                  style={[modalStyles.optionItem, isSelected && modalStyles.optionItemSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.optionLabel, isSelected && modalStyles.optionLabelSelected]}>
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text style={modalStyles.optionSub}>{item.description}</Text>
                    ) : null}
                  </View>
                  <View style={[modalStyles.radioCircle, isSelected && modalStyles.radioCircleSelected]}>
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

export default function AddWardScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Mode: 'WARD' (Create Ward) or 'AREA' (Create Area inside Ward)
  const [activeTab, setActiveTab] = useState('WARD');

  // Ward Form State (Matching Web ManageAreas.jsx)
  const [wardName, setWardName] = useState('');
  const [wardDesc, setWardDesc] = useState('');

  // Area Form State (Matching Web ManageAreas.jsx)
  const [areaName, setAreaName] = useState('');
  const [areaDesc, setAreaDesc] = useState('');
  const [selectedWardId, setSelectedWardId] = useState(null);

  const [wardsList, setWardsList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchWards();
  }, []);

  const fetchWards = async () => {
    try {
      const res = await api.get('/wards');
      const list = Array.isArray(res) ? res : (res?.wards || []);
      setWardsList(list);
      if (list.length > 0 && !selectedWardId) {
        setSelectedWardId(list[0].id);
      }
    } catch (err) {
      console.log('Error loading wards in AddWardScreen:', err.message);
    }
  };

  const selectedWardObj = wardsList.find(w => w.id === selectedWardId);

  const handleSubmit = async () => {
    setValidationErrors({});
    const errors = {};

    if (activeTab === 'WARD') {
      if (!wardName || wardName.trim().length < 2) {
        errors.wardName = 'Ward name is required (min 2 characters).';
      }
    } else {
      if (!selectedWardId) {
        errors.selectedWardId = 'Please select a parent ward.';
      }
      if (!areaName || areaName.trim().length < 2) {
        errors.areaName = 'Area / Sector name is required (min 2 characters).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert('Validation Error', 'Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'WARD') {
        const payload = {
          name: wardName.trim(),
          description: wardDesc.trim() || undefined
        };
        await api.post('/wards', payload);
        Alert.alert(
          '✅ Ward Created',
          `Municipal Ward "${wardName.trim()}" has been successfully created.`,
          [{ text: 'OK', onPress: () => onSubmitSuccess() }]
        );
      } else {
        const payload = {
          name: areaName.trim(),
          description: areaDesc.trim() || undefined,
          wardId: Number(selectedWardId)
        };
        await api.post('/areas', payload);
        Alert.alert(
          '✅ Area Created',
          `Area "${areaName.trim()}" has been added to ${selectedWardObj?.name || 'Ward'}.`,
          [{ text: 'OK', onPress: () => onSubmitSuccess() }]
        );
      }
    } catch (err) {
      console.warn('Create Ward/Area notice:', err.message);
      Alert.alert(
        'Error',
        err.message || `Could not create ${activeTab === 'WARD' ? 'ward' : 'area'}. Please ensure the name is unique.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={onBack || onCancel}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>
          {activeTab === 'WARD' ? 'Create Municipal Ward' : 'Create Ward Sub-Area'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Form Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab Switcher (Ward vs Area) */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'WARD' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('WARD');
              setValidationErrors({});
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'WARD' && styles.tabButtonTextActive]}>
              🏛️ 1. Create Ward
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'AREA' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab('AREA');
              setValidationErrors({});
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'AREA' && styles.tabButtonTextActive]}>
              📍 2. Create Area in Ward
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerIconBox}>
            <Text style={styles.bannerIconText}>{activeTab === 'WARD' ? '🏛️' : '📍'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {activeTab === 'WARD' ? 'Municipal Ward Structure' : 'Constituency Sub-Area'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {activeTab === 'WARD'
                ? 'Register a primary municipal jurisdiction ward for citizen grievance routing.'
                : 'Add a localized sector, colony, or residential cluster inside a ward.'}
            </Text>
          </View>
        </View>

        {/* FORM CONTENT: WARD */}
        {activeTab === 'WARD' ? (
          <View style={styles.cardContainer}>
            <Text style={styles.cardSectionTitle}>Ward Details</Text>

            {/* Ward Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                WARD NAME <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, validationErrors.wardName && styles.inputErrorBorder]}
                placeholder="e.g. Ward A (Shivajinagar Central)"
                placeholderTextColor="#94a3b8"
                value={wardName}
                onChangeText={setWardName}
              />
              {validationErrors.wardName && (
                <Text style={styles.errorFeedbackText}>{validationErrors.wardName}</Text>
              )}
              <Text style={styles.helperText}>
                Official identifier or name for the administrative ward jurisdiction.
              </Text>
            </View>

            {/* Ward Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                DESCRIPTION <Text style={styles.optionalTag}>(OPTIONAL)</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Describe key landmarks, boundaries, and coverage area..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={wardDesc}
                onChangeText={setWardDesc}
              />
              <Text style={styles.helperText}>
                Brief geographic summary or constituency reference notes.
              </Text>
            </View>
          </View>
        ) : (
          /* FORM CONTENT: AREA */
          <View style={styles.cardContainer}>
            <Text style={styles.cardSectionTitle}>Area Details</Text>

            {/* Parent Ward Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                PARENT WARD <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, validationErrors.selectedWardId && styles.inputErrorBorder]}
                activeOpacity={0.7}
                onPress={() => setWardModalOpen(true)}
              >
                <Text style={styles.dropdownText}>
                  {selectedWardObj ? selectedWardObj.name : '-- Choose Parent Ward --'}
                </Text>
                <Text style={styles.dropdownCaret}>▼</Text>
              </TouchableOpacity>
              {validationErrors.selectedWardId && (
                <Text style={styles.errorFeedbackText}>{validationErrors.selectedWardId}</Text>
              )}
            </View>

            {/* Area Name with Places API Autocomplete */}
            <View style={styles.inputGroup}>
              <AddressPlacesAutocomplete
                label="AREA / COLONY NAME"
                required={true}
                placeholder="Search area, colony or locality (e.g. FC Road, Kothrud, Pune)..."
                value={areaName}
                onChangeText={(text) => {
                  setAreaName(text);
                  if (validationErrors.areaName) {
                    setValidationErrors(prev => ({ ...prev, areaName: null }));
                  }
                }}
                onSelectPlace={(place) => {
                  const title = place.main_text || place.display_name.split(',')[0];
                  setAreaName(title);
                  if (!areaDesc && place.display_name) {
                    setAreaDesc(place.display_name);
                  }
                  if (validationErrors.areaName) {
                    setValidationErrors(prev => ({ ...prev, areaName: null }));
                  }
                }}
              />
              {validationErrors.areaName && (
                <Text style={styles.errorFeedbackText}>{validationErrors.areaName}</Text>
              )}
            </View>

            {/* Area Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                AREA DESCRIPTION / BOUNDARIES <Text style={styles.optionalTag}>(OPTIONAL)</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="e.g. Covers FC Road from Deccan Gymkhana to Agriculture College..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={areaDesc}
                onChangeText={setAreaDesc}
              />
            </View>
          </View>
        )}

        {/* Bottom Form Actions (Fully Visible) */}
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
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.submitActionText}>
                  {activeTab === 'WARD' ? 'Save Ward' : 'Save Area'}
                </Text>
                <Text style={styles.submitActionArrow}>➔</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Ward Picker Modal */}
      <WardSelectModal
        visible={wardModalOpen}
        options={wardsList}
        selectedId={selectedWardId}
        onSelect={(w) => {
          setSelectedWardId(w.id);
          setValidationErrors(prev => ({ ...prev, selectedWardId: null }));
        }}
        onClose={() => setWardModalOpen(false)}
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
    paddingBottom: 130, // 👈 Ensures buttons are never hidden
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  bannerCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerIconText: {
    fontSize: 20,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 11.5,
    color: '#3b82f6',
    lineHeight: 15,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
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
  textAreaInput: {
    minHeight: 85,
    paddingTop: 10,
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
  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
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
    flex: 1,
  },
  dropdownCaret: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 8,
  },
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
    backgroundColor: '#ea580c',
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

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  dismissArea: { flex: 1 },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
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
  searchIcon: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  list: { paddingHorizontal: 16 },
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
  optionItemSelected: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  optionLabelSelected: { color: '#c2410c', fontWeight: '700' },
  optionSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
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
  radioCircleSelected: { borderColor: '#ea580c' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#ea580c' },
});
