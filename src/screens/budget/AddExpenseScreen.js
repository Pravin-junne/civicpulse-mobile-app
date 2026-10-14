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
  ActivityIndicator,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CalendarPickerModal } from '../../components';
import api from '../../services/api';

const BackArrowIcon = () => (
  <View style={styles.backArrowBox}>
    <View style={styles.backArrowStem} />
    <View style={styles.backArrowHeadTop} />
    <View style={styles.backArrowHeadBottom} />
  </View>
);

const DEFAULT_EXPENSE_CATEGORIES = [
  'Office Stationery',
  'Utilities',
  'Catering',
  'Travel',
  'Maintenance',
  'Staff Welfare',
  'Logistics & Fuel',
  'Civic Works',
  'Miscellaneous'
];

const formatExpenseDate = (dateStr) => {
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

export default function AddExpenseScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Form State
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [attachedInvoice, setAttachedInvoice] = useState(null); // { uri, name, type, mimeType, isImage }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Category State
  const [categoriesList, setCategoriesList] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Budgets List for linking
  const [budgetsList, setBudgetsList] = useState([]);

  // Fetch Existing Budgets & Categories
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [budgetsRes, catsRes] = await Promise.allSettled([
          api.get('/budgets'),
          api.get('/expenses/categories')
        ]);

        if (budgetsRes.status === 'fulfilled' && budgetsRes.value) {
          const raw = budgetsRes.value;
          const list = Array.isArray(raw) ? raw : (raw.budgets || []);
          setBudgetsList(list);
        }

        if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value) && catsRes.value.length > 0) {
          const names = catsRes.value.map(c => c.name);
          setCategoriesList(names);
          setCategory(names[0]);
        }
      } catch (err) {
        console.log('AddExpense lookups notice:', err.message);
      }
    };
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

  // Add Custom Category Handler
  const handleAddNewCategory = () => {
    if (!newCategoryInput.trim()) {
      Alert.alert('Required Field', 'Please enter a name for the new expense category.');
      return;
    }
    const trimmed = newCategoryInput.trim();
    if (!categoriesList.includes(trimmed)) {
      setCategoriesList((prev) => [...prev, trimmed]);
    }
    setCategory(trimmed);
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  // 1. Pick From Camera
  const handlePickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture receipt photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachedInvoice({
          uri: asset.uri,
          name: `receipt_photo_${Date.now()}.jpg`,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  // 2. Pick From Gallery
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery permission is required to attach receipt images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let name = asset.fileName;
        if (!name) {
          const parts = asset.uri.split('/');
          name = parts[parts.length - 1] || `invoice_${Date.now()}.jpg`;
        }
        setAttachedInvoice({
          uri: asset.uri,
          name,
          type: 'IMAGE',
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not open gallery: ' + err.message);
    }
  };

  // 3. Pick Document (PDF / Word / Excel)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const isImg = !!(doc.name && doc.name.match(/\.(jpg|jpeg|png|webp)$/i));
        setAttachedInvoice({
          uri: doc.uri,
          name: doc.name,
          type: isImg ? 'IMAGE' : 'DOCUMENT',
          mimeType: doc.mimeType || 'application/pdf',
          isImage: isImg
        });
      }
    } catch (err) {
      Alert.alert('Document Error', 'Could not select document: ' + err.message);
    }
  };

  // Submit Expense Form
  const handleSubmit = async () => {
    if (!amount.trim()) {
      Alert.alert('Required Field', 'Please enter the expense amount in ₹.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for expense amount.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Required Field', 'Please select or add an expense category.');
      return;
    }
    if (!description.trim() || description.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter a description or vendor reason (min 3 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(parsedAmount));
      formData.append('category', category.trim());
      formData.append('description', description.trim());
      formData.append('expenseDate', expenseDate || new Date().toISOString().split('T')[0]);

      if (selectedBudgetId) {
        formData.append('budgetId', String(selectedBudgetId));
      }

      if (attachedInvoice) {
        const fileUri = Platform.OS === 'android' ? attachedInvoice.uri : attachedInvoice.uri.replace('file://', '');
        let mimeType = attachedInvoice.mimeType;
        if (!mimeType) {
          const ext = (attachedInvoice.name.split('.').pop() || '').toLowerCase();
          if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else mimeType = 'application/octet-stream';
        }

        formData.append('invoice', {
          uri: fileUri,
          name: attachedInvoice.name,
          type: mimeType
        });
      }

      await api.post('/expenses', formData);

      Alert.alert(
        'Expense Recorded',
        `Expense of ₹${parsedAmount.toLocaleString('en-IN')} for "${category}" has been saved.`,
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
      console.log('Expense creation error:', err);
      const isAuth = err.message && (
        err.message.toLowerCase().includes('token') ||
        err.message.toLowerCase().includes('auth') ||
        err.message.toLowerCase().includes('unauthorized') ||
        err.message.toLowerCase().includes('session')
      );

      if (isAuth) {
        Alert.alert(
          'Authentication Required',
          'Your session is not active or token has expired. Please log in with an Administrator or Superadmin account.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Log In',
              onPress: () => {
                if (navigation && navigation.navigate) navigation.navigate('login');
                else handleBack();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', err.message || 'Unable to record expense. Check network connection.');
      }
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <BackArrowIcon />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Add New Expense</Text>
            <Text style={styles.headerSubtitle}>Office & Constituency Expenditure</Text>
          </View>
        </View>

        {/* Scrollable Form Content */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Card: Expense Parameters */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeaderTitle}>Expense Details</Text>

            {/* Expense Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Expense Amount (₹) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 15000"
                placeholderTextColor="#94a3b8"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>

            {/* Expense Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Expense Date <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.datePickerTouchable}
                activeOpacity={0.7}
                onPress={() => setIsCalendarOpen(true)}
              >
                <Text style={expenseDate ? styles.datePickerValueText : styles.datePlaceholderText}>
                  {expenseDate ? `${formatExpenseDate(expenseDate)} (${expenseDate})` : 'Choose Expense Date (Calendar)'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#0d9488" />
              </TouchableOpacity>
            </View>

            {/* Category Selector with Custom Category Creation */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>
                  Category <Text style={styles.requiredStar}>*</Text>
                </Text>
                {!isAddingCategory && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsAddingCategory(true)}
                    style={styles.addCategoryHeaderBtn}
                  >
                    <Text style={styles.addCategoryHeaderBtnText}>+ Add New Category</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline Custom Category Creator */}
              {isAddingCategory && (
                <View style={styles.newCategoryInlineBox}>
                  <TextInput
                    style={styles.newCategoryInput}
                    placeholder="Enter custom category name..."
                    placeholderTextColor="#94a3b8"
                    value={newCategoryInput}
                    onChangeText={setNewCategoryInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.newCategoryAddBtn}
                    activeOpacity={0.8}
                    onPress={handleAddNewCategory}
                  >
                    <Text style={styles.newCategoryAddBtnText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.newCategoryCancelBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsAddingCategory(false);
                      setNewCategoryInput('');
                    }}
                  >
                    <Text style={styles.newCategoryCancelBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Category Chips List */}
              <View style={styles.chipsWrap}>
                {categoriesList.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {!isAddingCategory && (
                  <TouchableOpacity
                    style={styles.addCategoryChip}
                    onPress={() => setIsAddingCategory(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addCategoryChipText}>+ Custom Category</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Optional Linked Budget Head */}
            {budgetsList.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Link to Budget Allocation (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  <TouchableOpacity
                    style={[styles.budgetChip, !selectedBudgetId && styles.budgetChipActive]}
                    onPress={() => setSelectedBudgetId('')}
                  >
                    <Text style={[styles.budgetChipText, !selectedBudgetId && styles.budgetChipTextActive]}>
                      None (General Expense)
                    </Text>
                  </TouchableOpacity>

                  {budgetsList.map((b) => {
                    const isSelected = String(selectedBudgetId) === String(b.id);
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.budgetChip, isSelected && styles.budgetChipActive]}
                        onPress={() => setSelectedBudgetId(String(b.id))}
                      >
                        <Text style={[styles.budgetChipText, isSelected && styles.budgetChipTextActive]}>
                          {b.allocatedTo || b.budgetName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Description & Purpose */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Description & Vendor Purpose <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Explain the purpose of the expense, items purchased, or contractor bills..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Real Invoice / Bill Voucher Attachment */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Attach Invoice / Bill Voucher</Text>
              <View style={styles.attachButtonsRow}>
                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromCamera}
                >
                  <Text style={styles.attachActionIcon}>📸</Text>
                  <Text style={styles.attachActionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromGallery}
                >
                  <Text style={styles.attachActionIcon}>🖼️</Text>
                  <Text style={styles.attachActionText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickDocument}
                >
                  <Text style={styles.attachActionIcon}>📄</Text>
                  <Text style={styles.attachActionText}>Document</Text>
                </TouchableOpacity>
              </View>

              {attachedInvoice && (
                <View style={styles.attachedPreviewRow}>
                  {attachedInvoice.isImage ? (
                    <Image source={{ uri: attachedInvoice.uri }} style={styles.attachedThumb} />
                  ) : (
                    <View style={styles.attachedDocIconBox}>
                      <Text style={{ fontSize: 18 }}>📄</Text>
                    </View>
                  )}

                  <View style={styles.attachedInfoCol}>
                    <Text style={styles.attachedFileName} numberOfLines={1}>
                      {attachedInvoice.name}
                    </Text>
                    <Text style={styles.attachedFileSub}>Ready for upload</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.removeAttachBtn}
                    onPress={() => setAttachedInvoice(null)}
                  >
                    <Text style={styles.removeAttachText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBarContainer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Record Expense</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        initialDate={expenseDate}
        title="Select Expense Date"
        onSelectDate={(val) => {
          if (val) setExpenseDate(val);
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  backArrowBox: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  backArrowStem: {
    width: 12,
    height: 2,
    backgroundColor: '#0f172a',
    borderRadius: 1
  },
  backArrowHeadTop: {
    position: 'absolute',
    left: 1,
    top: 3,
    width: 6,
    height: 2,
    backgroundColor: '#0f172a',
    transform: [{ rotate: '-45deg' }],
    borderRadius: 1
  },
  backArrowHeadBottom: {
    position: 'absolute',
    left: 1,
    bottom: 3,
    width: 6,
    height: 2,
    backgroundColor: '#0f172a',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1
  },
  headerTextWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 60 // 👈 Generous clearance for bottom buttons
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  requiredStar: {
    color: '#ef4444'
  },
  addCategoryHeaderBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  addCategoryHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316'
  },
  newCategoryInlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6
  },
  newCategoryInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 4
  },
  newCategoryAddBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  newCategoryAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },
  newCategoryCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  newCategoryCancelBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '800'
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a'
  },
  datePickerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    height: 48
  },
  datePickerValueText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a'
  },
  datePlaceholderText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#94a3b8'
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top'
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  categoryChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  addCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
    borderStyle: 'dashed'
  },
  addCategoryChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  budgetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6
  },
  budgetChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  budgetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  budgetChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  attachButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  attachActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6
  },
  attachActionIcon: {
    fontSize: 16
  },
  attachActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155'
  },
  attachedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 8,
    marginTop: 8
  },
  attachedThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginRight: 8
  },
  attachedDocIconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  attachedInfoCol: {
    flex: 1
  },
  attachedFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  attachedFileSub: {
    fontSize: 10.5,
    color: '#60a5fa'
  },
  removeAttachBtn: {
    padding: 6
  },
  removeAttachText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444'
  },
  bottomBarContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'android' ? 24 : 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 6
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b'
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  }
});
