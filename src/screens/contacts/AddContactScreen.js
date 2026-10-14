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
  FlatList,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AddressPlacesAutocomplete } from '../../components';
import api from '../../services/api';

export default function AddContactScreen({
  navigation,
  contact = null,
  isEdit = false,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Form State
  const [fullName, setFullName] = useState(contact?.name || '');
  const [mobileNumber, setMobileNumber] = useState(contact?.mobileNumber || '');
  const [address, setAddress] = useState(contact?.address || '');
  const [category, setCategory] = useState(contact?.category || '');
  const [subcategory, setSubcategory] = useState(contact?.subcategory || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Categories from Backend
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySubcategoryMap, setCategorySubcategoryMap] = useState({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState(false);

  useEffect(() => {
    if (contact) {
      setFullName(contact.name || '');
      setMobileNumber(contact.mobileNumber || '');
      setAddress(contact.address || '');
      setCategory(contact.category || '');
      setSubcategory(contact.subcategory || '');
    }
  }, [contact]);

  // Fetch dynamic categories from live backend
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get('/contacts');
        if (res && res.categories && res.categories.length > 0) {
          setCategoryOptions(res.categories);
        } else {
          setCategoryOptions([
            'VIP / Politician',
            'Municipal Staff',
            'Citizen Rep',
            'Party Worker',
            'Media & Press',
            'Contractor / Supplier'
          ]);
        }
        if (res && res.categorySubcategoryMap) {
          setCategorySubcategoryMap(res.categorySubcategoryMap);
        }
      } catch (e) {
        setCategoryOptions([
          'VIP / Politician',
          'Municipal Staff',
          'Citizen Rep',
          'Party Worker',
          'Media & Press',
          'Contractor / Supplier'
        ]);
      }
    };
    loadCategories();
  }, []);

  const availableSubcategories = category && categorySubcategoryMap[category] && categorySubcategoryMap[category].length > 0
    ? categorySubcategoryMap[category]
    : [
        'Zonal Officer',
        'Ward In-charge',
        'Chief Sanitary Inspector',
        'Youth Wing President',
        'Area Coordinator',
        'General Representative'
      ];

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    setShowCategoryPicker(false);
  };

  const handleSelectSubcategory = (subcat) => {
    setSubcategory(subcat);
    setShowSubcategoryPicker(false);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter contact full name (min 3 characters).');
      return;
    }
    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit mobile phone number.');
      return;
    }
    if (!address.trim() || address.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter address or constituency location.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Required Field', 'Please enter or select a contact category.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: fullName.trim(),
        mobileNumber: cleanMobile,
        address: address.trim(),
        category: category.trim(),
        subcategory: subcategory.trim() || null
      };

      if (isEdit && contact?.id) {
        await api.put(`/contacts/${contact.id}`, payload);
        Alert.alert(
          'Contact Updated',
          `"${fullName.trim()}" updated successfully.`,
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
      } else {
        await api.post('/contacts', payload);
        Alert.alert(
          'Contact Saved',
          `"${fullName.trim()}" added to directory successfully.`,
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
      }
    } catch (err) {
      console.log('Error saving contact:', err.message);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Unable to save contact.');
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
        {/* Scrollable Form Body */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Back Header Button */}
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={20} color="#ea580c" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {/* 2. Screen Title & Close Row */}
          <View style={styles.headerTitleRow}>
            <Text style={styles.screenTitle}>{isEdit ? 'Edit Contact' : 'Add New Contact'}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              activeOpacity={0.7}
              onPress={handleCancel}
            >
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitleText}>
            Fields marked <Text style={styles.requiredAsterisk}>*</Text> are required
          </Text>

          {/* 3. Field 1: Full Name * */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>
              Full Name <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Pratik Sharma"
              placeholderTextColor="#94a3b8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* 4. Field 2: Mobile Number * */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>
              Mobile Number <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={12}
              value={mobileNumber}
              onChangeText={setMobileNumber}
            />
          </View>

          {/* 5. Field 3: Address with Google Places Autocomplete */}
          <View style={styles.formGroup}>
            <AddressPlacesAutocomplete
              label="Address *"
              placeholder="e.g. Shivajinagar, Pune (search places)..."
              value={address}
              onChangeText={setAddress}
              onSelectPlace={(place) => {
                setAddress(place.display_name);
              }}
            />
          </View>

          {/* 6. Field 4: Category * */}
          <View style={styles.formGroup}>
            <View style={styles.labelWithActionRow}>
              <Text style={styles.fieldLabel}>
                Category <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.quickPickLink}>Choose from list ▾</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Party Worker / VIP / Citizen"
              placeholderTextColor="#94a3b8"
              value={category}
              onChangeText={setCategory}
            />
          </View>

          {/* 7. Field 5: Subcategory (Optional) */}
          <View style={styles.formGroup}>
            <View style={styles.labelWithActionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.fieldLabel}>Subcategory</Text>
                <Text style={styles.optionalTag}> (Optional)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSubcategoryPicker(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.quickPickLink}>Choose from list ▾</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Zonal Officer / Ward In-charge"
              placeholderTextColor="#94a3b8"
              value={subcategory}
              onChangeText={setSubcategory}
            />
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 8. Bottom Fixed Action Footer */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.7}
            onPress={handleCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveContactBtn, isSubmitting && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveContactBtnText}>
                {isEdit ? 'Save Changes' : 'Save Contact'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 9. Category Selection Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categoryOptions}
              keyExtractor={(item, index) => `${item}-${index}`}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = category === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryOptionItem,
                      isSelected && styles.categoryOptionItemSelected
                    ]}
                    onPress={() => handleSelectCategory(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        isSelected && styles.categoryOptionTextSelected
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#ea580c" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 10. Subcategory Selection Modal */}
      <Modal
        visible={showSubcategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubcategoryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSubcategoryPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Subcategory</Text>
              <TouchableOpacity onPress={() => setShowSubcategoryPicker(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableSubcategories}
              keyExtractor={(item, index) => `${item}-${index}`}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = subcategory === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryOptionItem,
                      isSelected && styles.categoryOptionItemSelected
                    ]}
                    onPress={() => handleSelectSubcategory(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        isSelected && styles.categoryOptionTextSelected
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#ea580c" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Back Button */
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ea580c',
    marginLeft: 6,
  },

  /* Title & Close Row */
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Subtitle */
  subtitleText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 20,
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '700',
  },

  /* Form Groups */
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  labelWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionalTag: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#94a3b8',
  },
  quickPickLink: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ea580c',
  },
  textInput: {
    height: 48,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: '#0f172a',
  },

  /* Bottom Footer */
  footerContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  saveContactBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveContactBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  categoryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  categoryOptionItemSelected: {
    backgroundColor: '#fff7ed',
  },
  categoryOptionText: {
    fontSize: 14.5,
    color: '#334155',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: '#ea580c',
    fontWeight: '700',
  }
});
