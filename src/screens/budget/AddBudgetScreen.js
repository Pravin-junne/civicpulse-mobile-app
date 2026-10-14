import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CalendarPickerModal } from '../../components';
import api from '../../services/api';

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

export default function AddBudgetScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Form State (Matching Clean Reference UI)
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Funding Sources Lookups
  const [fundingSources, setFundingSources] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Pickers and Modals
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Add Funding Source Form
  const [newSourceName, setNewSourceName] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  const fetchLookups = async () => {
    try {
      setLoadingLookups(true);
      const sourcesRes = await api.get('/budgets/sources');
      const list = Array.isArray(sourcesRes) ? sourcesRes : [];
      setFundingSources(list);
      if (list.length > 0 && !selectedSource) {
        setSelectedSource(list[0]);
      }
    } catch (err) {
      console.warn('Error fetching budget lookups:', err.message);
    } finally {
      setLoadingLookups(false);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  // Create New Funding Source
  const handleCreateSource = async () => {
    if (!newSourceName.trim() || newSourceName.trim().length < 3) {
      Alert.alert('Validation Error', 'Please enter a funding source name (min 3 characters).');
      return;
    }

    setIsAddingSource(true);
    try {
      const payload = {
        name: newSourceName.trim()
      };

      const created = await api.post('/budgets/sources', payload);
      const newSourceObj = created && created.id ? created : { id: Date.now(), ...payload };

      setFundingSources((prev) => [newSourceObj, ...prev]);
      setSelectedSource(newSourceObj);

      // Reset Modal Form
      setNewSourceName('');
      setShowAddSourceModal(false);

      Alert.alert('Success', `Funding source "${newSourceObj.name}" added and selected.`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to add funding source.');
    } finally {
      setIsAddingSource(false);
    }
  };

  // Delete Funding Source
  const handleDeleteSource = (sourceId, sourceName) => {
    Alert.alert(
      'Remove Funding Source',
      `Are you sure you want to delete "${sourceName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/budgets/sources/${sourceId}`);
              setFundingSources((prev) => {
                const updated = prev.filter((s) => s.id !== sourceId);
                if (selectedSource && selectedSource.id === sourceId) {
                  setSelectedSource(updated.length > 0 ? updated[0] : null);
                }
                return updated;
              });
              Alert.alert('Success', `Funding source "${sourceName}" removed.`);
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to remove funding source.');
            }
          }
        }
      ]
    );
  };

  const handleSubmit = async () => {
    if (!amount.trim()) {
      Alert.alert('Required Field', 'Please enter the allocation amount in ₹.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for amount.');
      return;
    }
    if (!selectedSource) {
      Alert.alert('Required Field', 'Please select a funding source.');
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter the allocated purpose / title (min 3 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        amount: parsedAmount,
        sourceId: parseInt(selectedSource.id),
        allocatedTo: purpose.trim(),
        allocationDate: allocationDate ? new Date(allocationDate).toISOString() : new Date().toISOString(),
        description: description.trim() || null
      };

      await api.post('/budgets', payload);

      Alert.alert(
        'Budget Allocated',
        `Allocation of ₹${parsedAmount.toLocaleString('en-IN')} for "${purpose.trim()}" successfully registered.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSubmitSuccess) onSubmitSuccess();
              else handleBack();
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to register budget allocation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Back Action Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBackBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#ea580c" />
            <Text style={styles.topBackBtnText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Form Body */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Title with Close Icon */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Add Budget Allocation</Text>
              <TouchableOpacity
                style={styles.closeCircleBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.screenSubtitle}>
              Fields marked <Text style={styles.requiredStar}>*</Text> are required
            </Text>
          </View>

          {/* Form Fields Card */}
          <View style={styles.formCard}>
            {/* 1. Amount (₹) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Amount (₹) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 500000"
                  placeholderTextColor="#94a3b8"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
              </View>
              <Text style={styles.helperText}>Total allocated amount in ₹</Text>
            </View>

            {/* 2. Funding Source with + Add/Manage button */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Funding Source <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  style={styles.sourceSelectBox}
                  activeOpacity={0.7}
                  onPress={() => setShowSourcePicker(true)}
                  disabled={isSubmitting || loadingLookups}
                >
                  {loadingLookups ? (
                    <ActivityIndicator size="small" color="#ea580c" />
                  ) : (
                    <Text
                      style={[
                        styles.sourceSelectText,
                        !selectedSource && { color: '#94a3b8' }
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSource ? selectedSource.name : '-- Select Source --'}
                    </Text>
                  )}
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addManageBtn}
                  activeOpacity={0.8}
                  onPress={() => setShowAddSourceModal(true)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.addManageBtnText}>+ Add/Manage</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Allocated To (Purpose / Budget Source) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Allocated Purpose / Budget Source <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Ward Road Repair & Maintenance"
                  placeholderTextColor="#94a3b8"
                  value={purpose}
                  onChangeText={setPurpose}
                  editable={!isSubmitting}
                />
              </View>
              <Text style={styles.helperText}>e.g. Water Supply, Road Development, Office Upkeep</Text>
            </View>

            {/* 4. Allocation Date (Interactive Calendar Picker) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Allocation Date <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.datePickerBox}
                activeOpacity={0.7}
                onPress={() => setIsCalendarOpen(true)}
                disabled={isSubmitting}
              >
                <Text style={allocationDate ? styles.datePickerText : styles.datePlaceholderText}>
                  {allocationDate ? `${formatDateDisplay(allocationDate)} (${allocationDate})` : 'Choose Allocation Date (Calendar)'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#ea580c" />
              </TouchableOpacity>
            </View>

            {/* 5. Description (Optional) */}
            <View style={styles.fieldGroup}>
              <View style={styles.descriptionLabelRow}>
                <Text style={styles.fieldLabel}>Description</Text>
                <Text style={styles.optionalBadge}>OPTIONAL</Text>
              </View>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Details about this budget allocation..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Footer Buttons */}
        <View style={styles.footerBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Budget</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 1. Funding Source Picker Modal */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Funding Source</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Tap source to select or trash to remove</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {fundingSources.map((item) => {
                const isSelected = selectedSource && selectedSource.id === item.id;
                return (
                  <View
                    key={item.id}
                    style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                  >
                    <TouchableOpacity
                      style={styles.modalOptionTextWrap}
                      onPress={() => {
                        setSelectedSource(item);
                        setShowSourcePicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#ea580c" style={{ marginLeft: 6 }} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteSourceBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteSource(item.id, item.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={17} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {fundingSources.length === 0 && (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#94a3b8' }}>No funding sources available.</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addNewSourceQuickBtn}
              activeOpacity={0.8}
              onPress={() => {
                setShowSourcePicker(false);
                setShowAddSourceModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#ea580c" />
              <Text style={styles.addNewSourceQuickText}>Add / Manage Funding Sources</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Add / Manage Funding Sources Modal */}
      <Modal
        visible={showAddSourceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddSourceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalContent, { maxHeight: 520, paddingBottom: 24 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Funding Sources</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Create new or remove funding source</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddSourceModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                New Funding Source Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. MLA Constituency Dev Fund"
                  placeholderTextColor="#94a3b8"
                  value={newSourceName}
                  onChangeText={setNewSourceName}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddSourceModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalAddBtn, isAddingSource && { opacity: 0.7 }]}
                onPress={handleCreateSource}
                disabled={isAddingSource}
              >
                {isAddingSource ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalAddBtnText}>+ Add Source</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Existing Sources List for deletion */}
            {fundingSources.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.fieldLabel, { fontSize: 12, color: '#64748b', marginBottom: 8 }]}>
                  EXISTING SOURCES ({fundingSources.length})
                </Text>
                <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                  {fundingSources.map((item) => (
                    <View key={item.id} style={styles.modalOptionItem}>
                      <Text style={[styles.modalOptionText, { flex: 1 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteSourceBtn}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteSource(item.id, item.name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 3. Interactive Calendar Picker Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        initialDate={allocationDate}
        title="Select Allocation Date"
        onSelectDate={(val) => {
          if (val) setAllocationDate(val);
          setIsCalendarOpen(false);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff7ed'
  },
  topBackBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40
  },
  titleSection: {
    marginBottom: 16
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: '#64748b'
  },
  requiredStar: {
    color: '#ef4444',
    fontWeight: '700'
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 16
  },
  fieldGroup: {
    width: '100%'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden'
  },
  textAreaContainer: {
    minHeight: 80
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: 'top'
  },
  helperText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4
  },
  descriptionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  optionalBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8'
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  sourceSelectBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46
  },
  sourceSelectText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a'
  },
  addManageBtn: {
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addManageBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  datePickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46
  },
  datePickerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a'
  },
  datePlaceholderText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#94a3b8'
  },
  footerBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnDisabled: {
    opacity: 0.7
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  pickerModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalOptionItemActive: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    paddingHorizontal: 8
  },
  modalOptionTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155'
  },
  modalOptionTextActive: {
    fontWeight: '700',
    color: '#ea580c'
  },
  deleteSourceBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addNewSourceQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  addNewSourceQuickText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalAddBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalAddBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff'
  }
});
