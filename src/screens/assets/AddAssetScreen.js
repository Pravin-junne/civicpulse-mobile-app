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
  Platform,
  Modal,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

import { CalendarPickerModal, AddressPlacesAutocomplete } from '../../components';
import api from '../../services/api';

const DEFAULT_CATEGORIES = [
  'IT Equipment',
  'Electronics',
  'Furniture',
  'Vehicle',
  'Office Appliance',
  'Security & CCTV',
  'Other'
];

const CONDITIONS = [
  { id: 'NEW', label: 'Brand New', color: '#10b981', icon: 'sparkles-outline' },
  { id: 'GOOD', label: 'Good Condition', color: '#3b82f6', icon: 'checkmark-circle-outline' },
  { id: 'FAIR', label: 'Fair / Usable', color: '#f59e0b', icon: 'shield-outline' },
  { id: 'DAMAGED', label: 'Damaged / Needs Repair', color: '#ef4444', icon: 'alert-circle-outline' }
];

const STATUS_OPTIONS = [
  { id: 'ACTIVE', label: 'Active', color: '#10b981' },
  { id: 'IN_USE', label: 'In Use', color: '#3b82f6' },
  { id: 'AVAILABLE', label: 'Available in Store', color: '#8b5cf6' },
  { id: 'UNDER_REPAIR', label: 'Under Repair', color: '#f59e0b' },
  { id: 'DISPOSED', label: 'Disposed / Scrapped', color: '#64748b' }
];

export default function AddAssetScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {},
  asset = null,
  isEdit = false
}) {
  // Form State
  const [name, setName] = useState(asset?.name || '');
  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState(asset?.category || DEFAULT_CATEGORIES[0]);
  
  // Custom Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Office Location Unit State
  const [officesList, setOfficesList] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState(asset?.officeId ? String(asset.officeId) : '');
  const [isOfficeSelectModalOpen, setIsOfficeSelectModalOpen] = useState(false);
  const [officeSearchQuery, setOfficeSearchQuery] = useState('');
  const [isAddOfficeModalOpen, setIsAddOfficeModalOpen] = useState(false);
  const [newOfficeData, setNewOfficeData] = useState({
    name: '',
    code: '',
    type: 'BRANCH',
    address: '',
    contactNumber: ''
  });
  const [isSavingOffice, setIsSavingOffice] = useState(false);

  // Custodian / Staff State
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(asset?.assignedToId ? String(asset.assignedToId) : '');
  const [custodianRoleCategory, setCustodianRoleCategory] = useState(''); // '' | 'OFFICER' | 'STAFF'
  const [isCustodianTypeModalOpen, setIsCustodianTypeModalOpen] = useState(false);
  const [isCustodianUserModalOpen, setIsCustodianUserModalOpen] = useState(false);
  const [isAddCustodianModalOpen, setIsAddCustodianModalOpen] = useState(false);
  const [newCustodianData, setNewCustodianData] = useState({
    name: '',
    role: 'OFFICER',
    mobileNumber: '',
    email: ''
  });
  const [isSavingCustodian, setIsSavingCustodian] = useState(false);

  // Financials & Procurement
  const [purchasePrice, setPurchasePrice] = useState(asset?.purchasePrice ? String(asset.purchasePrice) : '');
  const [purchaseDate, setPurchaseDate] = useState(() => {
    if (asset?.rawPurchaseDate) {
      const d = new Date(asset.rawPurchaseDate);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    if (asset?.purchaseDate && asset.purchaseDate !== 'Recent') {
      const d = new Date(asset.purchaseDate);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [warrantyExpiry, setWarrantyExpiry] = useState(() => {
    if (asset?.rawWarrantyExpiry) {
      const d = new Date(asset.rawWarrantyExpiry);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    if (asset?.warrantyExpiry && asset.warrantyExpiry !== 'N/A') {
      const d = new Date(asset.warrantyExpiry);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return '';
  });
  const [calendarTarget, setCalendarTarget] = useState(null); // 'purchase' | 'warranty' | null
  const [vendor, setVendor] = useState(asset?.vendor || '');
  const [invoiceNumber, setInvoiceNumber] = useState(asset?.invoiceNumber || (asset?.serialNumber && asset.serialNumber !== 'N/A' ? asset.serialNumber : '') || '');

  // Condition & Status
  const [condition, setCondition] = useState(asset?.condition || 'GOOD');
  const [status, setStatus] = useState(asset?.status || 'ACTIVE');

  // Documentation & Attachments
  const [photoFile, setPhotoFile] = useState(null);
  const [docFile, setDocFile] = useState(null);

  // Technical Specs & Description
  const [description, setDescription] = useState(asset?.description || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch offices, users, and existing categories from server
  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [officesRes, statsRes, usersRes] = await Promise.all([
        api.get('/performance/units').catch(() => null),
        api.get('/assets/stats').catch(() => null),
        api.get('/users').catch(() => null)
      ]);

      if (officesRes && Array.isArray(officesRes)) {
        setOfficesList(officesRes);
        if (officesRes.length > 0 && !selectedOfficeId) {
          setSelectedOfficeId(String(officesRes[0].id));
        }
      }

      const rawUsers = usersRes?.users || (Array.isArray(usersRes) ? usersRes : []);
      if (rawUsers && rawUsers.length > 0) {
        setUsersList(rawUsers.map(u => {
          let cat = 'STAFF';
          let displayRole = u.role ? u.role.replace(/_/g, ' ') : 'Staff Member';
          const normalizedRole = (u.role || '').toUpperCase();
          if (normalizedRole.includes('OFFICER') || normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
            cat = 'OFFICER';
            displayRole = 'In-Office Officer';
          } else if (normalizedRole.includes('STAFF') || normalizedRole.includes('PERSON') || normalizedRole.includes('MEMBER')) {
            cat = 'STAFF';
            displayRole = 'Staff Member';
          } else {
            cat = 'STAFF';
            displayRole = u.role ? u.role.replace(/_/g, ' ') : 'Staff Member';
          }
          return {
            id: u.id,
            name: u.name || u.username,
            category: cat,
            role: displayRole
          };
        }));
      }

      if (statsRes?.categoryBreakdown && Array.isArray(statsRes.categoryBreakdown)) {
        const serverCats = statsRes.categoryBreakdown.map(c => c.category);
        setCategoriesList(prev => [...new Set([...DEFAULT_CATEGORIES, ...serverCats, ...prev])].filter(Boolean));
      }
    } catch (e) {
      console.log('Asset lookups notice:', e.message);
    }
  };

  // Add Custom Category Handler
  const handleAddNewCategory = () => {
    if (!newCategoryInput.trim()) {
      Alert.alert('Category Name', 'Please enter a name for the new category.');
      return;
    }
    const trimmed = newCategoryInput.trim();
    if (!categoriesList.includes(trimmed)) {
      setCategoriesList(prev => [...prev, trimmed]);
    }
    setCategory(trimmed);
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  // Remove Category Handler
  const handleRemoveCategory = (catToRemove) => {
    const target = catToRemove || category;
    if (!target) return;
    if (categoriesList.length <= 1) {
      Alert.alert('Notice', 'At least one category must remain.');
      return;
    }
    Alert.alert(
      'Remove Category',
      `Are you sure you want to remove "${target}" from the category list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = categoriesList.filter(c => c !== target);
            setCategoriesList(updated);
            if (category === target) {
              setCategory(updated[0] || DEFAULT_CATEGORIES[0]);
            }
          }
        }
      ]
    );
  };

  // Delete Office Unit Handler
  const handleRemoveOfficeUnit = (officeId, officeName) => {
    if (!officeId) return;
    Alert.alert(
      'Delete Office Unit',
      `Are you sure you want to permanently delete office "${officeName}" from the system?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/performance/units/${officeId}`);
              setOfficesList(prev => prev.filter(o => String(o.id) !== String(officeId)));
              if (selectedOfficeId === String(officeId)) {
                setSelectedOfficeId('');
              }
              Alert.alert('Deleted', `Office unit "${officeName}" removed.`);
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not delete office unit.');
            }
          }
        }
      ]
    );
  };

  // Handle Save Office Unit
  const handleSaveOffice = async () => {
    if (!newOfficeData.name.trim()) {
      Alert.alert('Required Field', 'Office unit name is required.');
      return;
    }
    setIsSavingOffice(true);
    try {
      const res = await api.post('/performance/units', {
        name: newOfficeData.name.trim(),
        code: newOfficeData.code.trim() || undefined,
        type: newOfficeData.type || 'BRANCH',
        address: newOfficeData.address.trim() || undefined,
        contactNumber: newOfficeData.contactNumber.trim() || undefined
      });
      Alert.alert('Success', `Office unit "${res.name}" registered successfully!`);
      setOfficesList(prev => [...prev, res]);
      setSelectedOfficeId(String(res.id));
      setIsAddOfficeModalOpen(false);
      setNewOfficeData({ name: '', code: '', type: 'BRANCH', address: '', contactNumber: '' });
    } catch (err) {
      Alert.alert('Error', err.message || 'Error creating office unit.');
    } finally {
      setIsSavingOffice(false);
    }
  };

  // Handle Save Custodian / Staff
  const handleSaveCustodian = async () => {
    if (!newCustodianData.name.trim()) {
      Alert.alert('Required Field', 'Custodian name is required.');
      return;
    }
    setIsSavingCustodian(true);
    try {
      const res = await api.post('/users', {
        name: newCustodianData.name.trim(),
        role: newCustodianData.role || 'OFFICER',
        mobileNumber: newCustodianData.mobileNumber.trim() || undefined,
        email: newCustodianData.email.trim() || undefined
      });
      Alert.alert('Success', `Custodian "${res.name}" added successfully!`);
      let cat = 'STAFF';
      let displayRole = res.role ? res.role.replace(/_/g, ' ') : 'Staff Member';
      if (res.role === 'OFFICER') {
        cat = 'OFFICER';
        displayRole = 'In-Office Officer';
      } else {
        cat = 'STAFF';
        displayRole = 'Staff Member';
      }
      const formatted = {
        id: res.id,
        name: res.name || res.username,
        category: cat,
        role: displayRole
      };
      setUsersList(prev => [...prev, formatted]);
      setSelectedUserId(String(res.id));
      setIsAddCustodianModalOpen(false);
      setNewCustodianData({ name: '', role: 'OFFICER', mobileNumber: '', email: '' });
    } catch (err) {
      Alert.alert('Error', err.message || 'Error adding custodian.');
    } finally {
      setIsSavingCustodian(false);
    }
  };

  // Delete / Remove Custodian Handler
  const handleRemoveCustodian = (userId, userName) => {
    if (!userId) return;
    Alert.alert(
      'Remove Custodian',
      `Are you sure you want to permanently remove custodian "${userName}" from the system list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${userId}`);
              setUsersList(prev => prev.filter(u => String(u.id) !== String(userId)));
              if (selectedUserId === String(userId)) {
                setSelectedUserId('');
              }
              Alert.alert('Removed', `Custodian "${userName}" removed from the list.`);
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not remove custodian.');
            }
          }
        }
      ]
    );
  };

  // 1. Pick Photo from Camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is required to take an asset photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoFile({
          uri: asset.uri,
          name: asset.fileName || `asset_photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize ? (asset.fileSize / 1024).toFixed(1) + ' KB' : ''
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  // 2. Pick Photo from Gallery
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access is required to attach asset photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let filename = asset.fileName;
        if (!filename) {
          const parts = asset.uri.split('/');
          filename = parts[parts.length - 1] || `photo_${Date.now()}.jpg`;
        }
        setPhotoFile({
          uri: asset.uri,
          name: filename,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize ? (asset.fileSize / 1024).toFixed(1) + ' KB' : ''
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not select photo: ' + err.message);
    }
  };

  // 3. Pick Document (PDF / DOC / DOCX)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '*/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        setDocFile({
          uri: doc.uri,
          name: doc.name || `invoice_${Date.now()}.pdf`,
          mimeType: doc.mimeType || 'application/pdf',
          size: doc.size ? (doc.size / 1024).toFixed(1) + ' KB' : ''
        });
      }
    } catch (err) {
      Alert.alert('Document Error', 'Could not select document: ' + err.message);
    }
  };

  // Submit Asset
  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 3) {
      Alert.alert('Required Field', 'Asset name is required (min 3 characters).');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Required Field', 'Please select or add an asset category.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('category', category.trim());
      
      if (description.trim()) formData.append('description', description.trim());
      if (purchaseDate) formData.append('purchaseDate', new Date(purchaseDate).toISOString());
      if (purchasePrice && !isNaN(parseFloat(purchasePrice))) {
        formData.append('purchasePrice', String(parseFloat(purchasePrice)));
      }
      if (vendor.trim()) formData.append('vendor', vendor.trim());
      if (invoiceNumber.trim()) formData.append('invoiceNumber', invoiceNumber.trim());
      if (selectedOfficeId) formData.append('officeId', String(selectedOfficeId));
      if (selectedUserId) formData.append('assignedToId', String(selectedUserId));
      
      formData.append('condition', condition);
      formData.append('status', status);
      if (warrantyExpiry) formData.append('warrantyExpiry', new Date(warrantyExpiry).toISOString());

      // Attach Photo
      if (photoFile) {
        const photoUri = Platform.OS === 'android' ? photoFile.uri : photoFile.uri.replace('file://', '');
        formData.append('photo', {
          uri: photoUri,
          name: photoFile.name || `photo_${Date.now()}.jpg`,
          type: photoFile.mimeType || 'image/jpeg'
        });
      }

      // Attach Document
      if (docFile) {
        const docUri = Platform.OS === 'android' ? docFile.uri : docFile.uri.replace('file://', '');
        formData.append('document', {
          uri: docUri,
          name: docFile.name || `doc_${Date.now()}.pdf`,
          type: docFile.mimeType || 'application/pdf'
        });
      }

      if (isEdit && asset?.id) {
        await api.put(`/assets/${asset.id}`, formData);
        Alert.alert(
          'Asset Updated',
          `Asset "${name}" has been successfully updated.`,
          [{ text: 'OK', onPress: () => onSubmitSuccess() }]
        );
      } else {
        await api.post('/assets', formData);
        Alert.alert(
          'Asset Registered',
          `Asset "${name}" (${category}) has been successfully added to inventory.`,
          [{ text: 'OK', onPress: () => onSubmitSuccess() }]
        );
      }
    } catch (err) {
      console.warn('Save asset error:', err.message);
      Alert.alert(
        'Submission Notice',
        err.response?.data?.message || err.message || 'Asset could not be saved.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOffice = useMemo(() => {
    return officesList.find(o => String(o.id) === String(selectedOfficeId));
  }, [officesList, selectedOfficeId]);

  const filteredOffices = useMemo(() => {
    if (!officeSearchQuery.trim()) return officesList;
    const q = officeSearchQuery.toLowerCase().trim();
    return officesList.filter(o => 
      (o.name && o.name.toLowerCase().includes(q)) ||
      (o.code && o.code.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q))
    );
  }, [officesList, officeSearchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={onBack || onCancel}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" style={{ marginRight: 4 }} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>{isEdit ? 'Edit Asset Record' : 'Register New Asset'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Form Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================== */}
        {/* SECTION 1: ASSET IDENTIFICATION & ALLOCATION */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="pricetag-outline" size={15} color="#ea580c" />
            </View>
            <Text style={styles.cardSectionTitle}>Asset Identification & Allocation</Text>
          </View>

          {/* Asset Name / Model */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Asset Name / Model <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="cube-outline" size={17} color="#94a3b8" style={styles.inputPrefixIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                placeholder="e.g. Dell Latitude 5430 Laptop, Projector 4K"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Category Selector with "+ Add Category" and "✕ Remove" */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Category <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {!isAddingCategory && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsAddingCategory(true)}
                    style={styles.actionHeaderBtn}
                  >
                    <Ionicons name="add-circle-outline" size={13} color="#ea580c" style={{ marginRight: 3 }} />
                    <Text style={styles.actionHeaderBtnText}>Add Category</Text>
                  </TouchableOpacity>
                )}
                {categoriesList.length > 1 && !isAddingCategory && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleRemoveCategory(category)}
                    style={styles.actionHeaderBtn}
                  >
                    <Ionicons name="trash-outline" size={13} color="#ef4444" style={{ marginRight: 3 }} />
                    <Text style={[styles.actionHeaderBtnText, { color: '#ef4444' }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Inline Custom Category Creator */}
            {isAddingCategory && (
              <View style={styles.newInlineBox}>
                <TextInput
                  style={styles.newInlineInput}
                  placeholder="Enter custom category name..."
                  placeholderTextColor="#94a3b8"
                  value={newCategoryInput}
                  onChangeText={setNewCategoryInput}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.newInlineAddBtn}
                  activeOpacity={0.8}
                  onPress={handleAddNewCategory}
                >
                  <Text style={styles.newInlineAddBtnText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.newInlineCancelBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsAddingCategory(false);
                    setNewCategoryInput('');
                  }}
                >
                  <Ionicons name="close" size={16} color="#64748b" />
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
                    {isSelected && (
                      <Ionicons name="checkmark" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Clean Office Location Unit Dropdown Selector */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Office Location Unit <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              {selectedOfficeId ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedOfficeId('')}
                  style={styles.actionHeaderBtn}
                >
                  <Ionicons name="close-circle-outline" size={13} color="#64748b" style={{ marginRight: 3 }} />
                  <Text style={[styles.actionHeaderBtnText, { color: '#64748b' }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.dropdownSelectBox, selectedOffice && styles.dropdownSelectBoxActive]}
              activeOpacity={0.7}
              onPress={() => {
                setOfficeSearchQuery('');
                setIsOfficeSelectModalOpen(true);
              }}
            >
              <View style={styles.dropdownLeftWrap}>
                <View style={[styles.dropdownIconBox, selectedOffice && styles.dropdownIconBoxActive]}>
                  <Ionicons
                    name="business-outline"
                    size={17}
                    color={selectedOffice ? '#ea580c' : '#64748b'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownMiniLabel}>Office Unit</Text>
                  <Text
                    style={[
                      styles.dropdownValueText,
                      !selectedOffice && styles.dropdownPlaceholderText
                    ]}
                    numberOfLines={1}
                  >
                    {selectedOffice ? selectedOffice.name : 'Select Office Location Unit...'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Assigned Custodian 2-Step Dropdowns */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Assigned Custodian <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              {selectedUserId ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedUserId('')}
                  style={styles.actionHeaderBtn}
                >
                  <Ionicons name="close-circle-outline" size={13} color="#64748b" style={{ marginRight: 3 }} />
                  <Text style={[styles.actionHeaderBtnText, { color: '#64748b' }]}>Unassign</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Dropdown 1: Custodian Role Type */}
              <TouchableOpacity
                style={[styles.dropdownSelectBox, { flex: 1 }, custodianRoleCategory && styles.dropdownSelectBoxActive]}
                activeOpacity={0.7}
                onPress={() => setIsCustodianTypeModalOpen(true)}
              >
                <View style={styles.dropdownLeftWrap}>
                  <View style={[styles.dropdownIconBox, custodianRoleCategory && styles.dropdownIconBoxActive]}>
                    <Ionicons
                      name={custodianRoleCategory === 'OFFICER' ? 'shield-checkmark-outline' : 'people-outline'}
                      size={16}
                      color={custodianRoleCategory ? '#ea580c' : '#64748b'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownMiniLabel}>Type</Text>
                    <Text
                      style={[
                        styles.dropdownValueText,
                        !custodianRoleCategory && styles.dropdownPlaceholderText
                      ]}
                      numberOfLines={1}
                    >
                      {custodianRoleCategory === 'OFFICER'
                        ? 'In-Office Officer'
                        : custodianRoleCategory === 'STAFF'
                        ? 'Staff Members'
                        : 'Select Type...'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={15} color="#64748b" />
              </TouchableOpacity>

              {/* Dropdown 2: Custodian Person */}
              <TouchableOpacity
                style={[
                  styles.dropdownSelectBox,
                  { flex: 1.25 },
                  !custodianRoleCategory && styles.dropdownDisabled,
                  selectedUserId && styles.dropdownSelectBoxActive
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (!custodianRoleCategory) {
                    setIsCustodianTypeModalOpen(true);
                  } else {
                    setIsCustodianUserModalOpen(true);
                  }
                }}
              >
                <View style={styles.dropdownLeftWrap}>
                  <View style={[styles.dropdownIconBox, selectedUserId && styles.dropdownIconBoxActive]}>
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={selectedUserId ? '#ea580c' : '#64748b'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownMiniLabel}>Person</Text>
                    <Text
                      style={[
                        styles.dropdownValueText,
                        !selectedUserId && styles.dropdownPlaceholderText
                      ]}
                      numberOfLines={1}
                    >
                      {usersList.find(u => String(u.id) === String(selectedUserId))
                        ? usersList.find(u => String(u.id) === String(selectedUserId)).name
                        : (custodianRoleCategory ? 'Select Person...' : 'Select Type first')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={15} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 2: PROCUREMENT & VALUATION */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="card-outline" size={15} color="#ea580c" />
            </View>
            <Text style={styles.cardSectionTitle}>Procurement & Valuation</Text>
          </View>

          {/* Purchase Price & Dates */}
          <View style={styles.rowTwoInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Purchase Price (₹)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="cash-outline" size={16} color="#94a3b8" style={styles.inputPrefixIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Purchase Date</Text>
              <TouchableOpacity
                style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setCalendarTarget('purchase')}
                activeOpacity={0.7}
              >
                <Text style={{ color: purchaseDate ? '#0f172a' : '#94a3b8', fontSize: 13.5, fontWeight: '500' }}>
                  {purchaseDate || 'Select Date'}
                </Text>
                <Ionicons name="calendar-outline" size={17} color="#ea580c" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Warranty Expiry */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Warranty Expiry Date</Text>
            <TouchableOpacity
              style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setCalendarTarget('warranty')}
              activeOpacity={0.7}
            >
              <Text style={{ color: warrantyExpiry ? '#0f172a' : '#94a3b8', fontSize: 13.5, fontWeight: '500' }}>
                {warrantyExpiry || 'Select Warranty Expiry Date'}
              </Text>
              <Ionicons name="shield-checkmark-outline" size={17} color="#0d9488" />
            </TouchableOpacity>
          </View>

          {/* Vendor & Invoice */}
          <View style={styles.rowTwoInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Vendor / Supplier</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="business-outline" size={16} color="#94a3b8" style={styles.inputPrefixIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  placeholder="e.g. Infotech Systems"
                  placeholderTextColor="#94a3b8"
                  value={vendor}
                  onChangeText={setVendor}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Invoice Number</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="receipt-outline" size={16} color="#94a3b8" style={styles.inputPrefixIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  placeholder="INV-2026-001"
                  placeholderTextColor="#94a3b8"
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 3: PHYSICAL CONDITION & OPERATIONAL STATUS */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="hardware-chip-outline" size={15} color="#ea580c" />
            </View>
            <Text style={styles.cardSectionTitle}>Physical Condition & Status</Text>
          </View>

          {/* Condition Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Physical Condition</Text>
            <View style={styles.chipsWrap}>
              {CONDITIONS.map((c) => {
                const isSelected = condition === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: `${c.color}15`, borderColor: c.color }
                    ]}
                    onPress={() => setCondition(c.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={c.icon}
                      size={13}
                      color={isSelected ? c.color : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && { color: c.color, fontWeight: '700' }
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Operational Status Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Operational Status</Text>
            <View style={styles.chipsWrap}>
              {STATUS_OPTIONS.map((st) => {
                const isSelected = status === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: `${st.color}15`, borderColor: st.color }
                    ]}
                    onPress={() => setStatus(st.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.statusChipDot,
                        { backgroundColor: isSelected ? st.color : '#94a3b8' }
                      ]}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && { color: st.color, fontWeight: '700' }
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 4: DOCUMENTATION & ATTACHMENTS */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="attach-outline" size={15} color="#ea580c" />
            </View>
            <Text style={styles.cardSectionTitle}>Documentation & Attachments</Text>
          </View>

          {/* Asset Photo Attachment */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Asset Photo (Optional)</Text>
            
            {photoFile ? (
              <View style={styles.filePreviewCard}>
                <Image source={{ uri: photoFile.uri }} style={styles.photoThumbnail} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.filePreviewTitle} numberOfLines={1}>
                    {photoFile.name}
                  </Text>
                  <Text style={styles.filePreviewSize}>
                    ✓ Photo Attached {photoFile.size ? `(${photoFile.size})` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFileBtn}
                  activeOpacity={0.7}
                  onPress={() => setPhotoFile(null)}
                >
                  <Ionicons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pickerActionsRow}>
                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  activeOpacity={0.7}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera-outline" size={20} color="#ea580c" style={{ marginBottom: 4 }} />
                  <Text style={styles.pickerActionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickPhoto}
                >
                  <Ionicons name="images-outline" size={20} color="#ea580c" style={{ marginBottom: 4 }} />
                  <Text style={styles.pickerActionText}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Invoice / Warranty Document Attachment */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Invoice / Warranty Document (PDF/DOC)</Text>
            
            {docFile ? (
              <View style={styles.filePreviewCard}>
                <View style={styles.docIconBox}>
                  <Ionicons name="document-text-outline" size={22} color="#15803d" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.filePreviewTitle} numberOfLines={1}>
                    {docFile.name}
                  </Text>
                  <Text style={styles.filePreviewSize}>
                    ✓ Document Attached {docFile.size ? `(${docFile.size})` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFileBtn}
                  activeOpacity={0.7}
                  onPress={() => setDocFile(null)}
                >
                  <Ionicons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.docUploadBtn}
                activeOpacity={0.7}
                onPress={handlePickDocument}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.docUploadText}>Upload Document (PDF / DOC / DOCX)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 5: DESCRIPTION & TECHNICAL SPECS */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="create-outline" size={15} color="#ea580c" />
            </View>
            <Text style={styles.cardSectionTitle}>Description & Technical Specs</Text>
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Serial numbers, hardware specifications, tag barcodes, or maintenance notes..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        {/* Bottom Form Actions */}
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
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.submitActionText}>{isEdit ? 'Save Changes' : 'Register Asset'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: SELECT OFFICE LOCATION UNIT */}
      {/* ======================================================== */}
      <Modal
        visible={isOfficeSelectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOfficeSelectModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOfficeSelectModalOpen(false)}
        >
          <View style={[styles.modalContainer, { maxHeight: '82%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="business-outline" size={18} color="#ea580c" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Select Office Location</Text>
                  <Text style={styles.modalSubtitle}>Assign equipment to an office unit</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsOfficeSelectModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Search filter for offices */}
            {officesList.length > 4 && (
              <View style={styles.modalSearchBox}>
                <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search office unit..."
                  placeholderTextColor="#94a3b8"
                  value={officeSearchQuery}
                  onChangeText={setOfficeSearchQuery}
                />
              </View>
            )}

            <ScrollView style={{ padding: 14 }} showsVerticalScrollIndicator={false}>
              {/* Unspecified / None Option */}
              <TouchableOpacity
                style={[
                  styles.selectOptionRow,
                  !selectedOfficeId && styles.selectOptionRowActive,
                  { marginBottom: 8 }
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedOfficeId('');
                  setIsOfficeSelectModalOpen(false);
                }}
              >
                <View style={styles.selectOptionIconBox}>
                  <Ionicons name="remove-circle-outline" size={20} color="#64748b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectOptionTitle}>None / Unspecified Location</Text>
                  <Text style={styles.selectOptionDesc}>General inventory without dedicated office desk</Text>
                </View>
                {!selectedOfficeId && (
                  <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                )}
              </TouchableOpacity>

              {/* Filtered Offices List */}
              {filteredOffices.map((off) => {
                const isSelected = selectedOfficeId === String(off.id);
                return (
                  <TouchableOpacity
                    key={off.id}
                    style={[
                      styles.selectOptionRow,
                      isSelected && styles.selectOptionRowActive,
                      { marginBottom: 8 }
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedOfficeId(String(off.id));
                      setIsOfficeSelectModalOpen(false);
                    }}
                  >
                    <View style={[styles.selectOptionIconBox, isSelected && { backgroundColor: '#fff7ed' }]}>
                      <Ionicons
                        name="business-outline"
                        size={19}
                        color={isSelected ? '#ea580c' : '#475569'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.selectOptionTitle, isSelected && { color: '#ea580c' }]}>
                          {off.name}
                        </Text>
                        {off.code ? (
                          <View style={styles.codeTag}>
                            <Text style={styles.codeTagText}>{off.code}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.selectOptionDesc} numberOfLines={1}>
                        {off.address || (off.type ? off.type.replace(/_/g, ' ') : 'Municipal Unit')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.deleteUnitBtn}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveOfficeUnit(off.id, off.name);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      </TouchableOpacity>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                      ) : (
                        <Ionicons name="radio-button-off" size={18} color="#cbd5e1" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add New Office Option Button */}
              <TouchableOpacity
                style={[
                  styles.selectOptionRow,
                  { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderStyle: 'dashed', marginTop: 4, marginBottom: 14 }
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setIsOfficeSelectModalOpen(false);
                  setIsAddOfficeModalOpen(true);
                }}
              >
                <View style={[styles.selectOptionIconBox, { backgroundColor: '#ffedd5' }]}>
                  <Ionicons name="add-circle" size={20} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectOptionTitle, { color: '#ea580c' }]}>
                    + Add New Office Location Unit
                  </Text>
                  <Text style={styles.selectOptionDesc}>Create a new municipal branch or ward office</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ea580c" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: ADD OFFICE LOCATION UNIT (CREATE FORM) */}
      {/* ======================================================== */}
      <Modal
        visible={isAddOfficeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddOfficeModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddOfficeModalOpen(false)}
        >
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="business-outline" size={18} color="#ea580c" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Add Office Location Unit</Text>
                  <Text style={styles.modalSubtitle}>Create new municipal branch or office</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddOfficeModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Office Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Pune Central Ward B"
                  placeholderTextColor="#94a3b8"
                  value={newOfficeData.name}
                  onChangeText={(val) => setNewOfficeData({ ...newOfficeData, name: val })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Office Code</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. OFF-PUN-01"
                  placeholderTextColor="#94a3b8"
                  value={newOfficeData.code}
                  onChangeText={(val) => setNewOfficeData({ ...newOfficeData, code: val })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Office Type</Text>
                <View style={styles.chipsWrap}>
                  {[
                    { id: 'HEAD_OFFICE', label: 'Head Office' },
                    { id: 'BRANCH', label: 'Branch Office' },
                    { id: 'WARD_OFFICE', label: 'Ward Office' },
                    { id: 'FIELD_OFFICE', label: 'Field Office' },
                    { id: 'OTHER', label: 'Other' }
                  ].map((t) => {
                    const isSelected = newOfficeData.type === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        onPress={() => setNewOfficeData({ ...newOfficeData, type: t.id })}
                      >
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <AddressPlacesAutocomplete
                  label="Address"
                  placeholder="Enter office address (search places)..."
                  value={newOfficeData.address}
                  onChangeText={(val) => setNewOfficeData({ ...newOfficeData, address: val })}
                  onSelectPlace={(place) => {
                    setNewOfficeData({ ...newOfficeData, address: place.display_name });
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter contact number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={newOfficeData.contactNumber}
                  onChangeText={(val) => setNewOfficeData({ ...newOfficeData, contactNumber: val })}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddOfficeModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSavingOffice && styles.btnDisabled]}
                onPress={handleSaveOffice}
                disabled={isSavingOffice}
              >
                {isSavingOffice ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Office</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: SELECT CUSTODIAN TYPE */}
      {/* ======================================================== */}
      <Modal
        visible={isCustodianTypeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustodianTypeModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCustodianTypeModalOpen(false)}
        >
          <View style={[styles.modalContainer, { maxWidth: 380 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="people-outline" size={18} color="#ea580c" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Select Custodian Type</Text>
                  <Text style={styles.modalSubtitle}>Choose personnel category</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsCustodianTypeModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16, gap: 10 }}>
              {[
                {
                  id: 'OFFICER',
                  label: 'In-Office Officer',
                  icon: 'shield-checkmark-outline',
                  desc: 'Department officers & in-office desk personnel'
                },
                {
                  id: 'STAFF',
                  label: 'Staff Members',
                  icon: 'people-outline',
                  desc: 'Constituency & administrative staff members'
                }
              ].map((item) => {
                const isSelected = custodianRoleCategory === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.selectOptionRow,
                      isSelected && styles.selectOptionRowActive
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCustodianRoleCategory(item.id);
                      setSelectedUserId('');
                      setIsCustodianTypeModalOpen(false);
                      setIsCustodianUserModalOpen(true);
                    }}
                  >
                    <View style={[styles.selectOptionIconBox, isSelected && { backgroundColor: '#fff7ed' }]}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isSelected ? '#ea580c' : '#475569'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectOptionTitle, isSelected && { color: '#ea580c' }]}>
                        {item.label}
                      </Text>
                      <Text style={styles.selectOptionDesc}>{item.desc}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "chevron-forward"}
                      size={20}
                      color={isSelected ? "#ea580c" : "#94a3b8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: SELECT CUSTODIAN PERSON */}
      {/* ======================================================== */}
      <Modal
        visible={isCustodianUserModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustodianUserModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCustodianUserModalOpen(false)}
        >
          <View style={[styles.modalContainer, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons
                    name={custodianRoleCategory === 'OFFICER' ? 'shield-checkmark-outline' : 'people-outline'}
                    size={18}
                    color="#ea580c"
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {custodianRoleCategory === 'OFFICER'
                      ? 'Select In-Office Officer'
                      : 'Select Staff Member'}
                  </Text>
                  <Text style={styles.modalSubtitle}>Choose person to assign custody</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsCustodianUserModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 14 }} showsVerticalScrollIndicator={false}>
              {/* Unassigned Option */}
              <TouchableOpacity
                style={[
                  styles.selectOptionRow,
                  !selectedUserId && styles.selectOptionRowActive,
                  { marginBottom: 8 }
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedUserId('');
                  setIsCustodianUserModalOpen(false);
                }}
              >
                <View style={styles.selectOptionIconBox}>
                  <Ionicons name="remove-circle-outline" size={19} color="#64748b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectOptionTitle}>Unassigned / None</Text>
                  <Text style={styles.selectOptionDesc}>Do not assign this asset to any specific person</Text>
                </View>
                {!selectedUserId && (
                  <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                )}
              </TouchableOpacity>

              {/* Filtered users list */}
              {usersList
                .filter(u => !custodianRoleCategory || u.category === custodianRoleCategory)
                .map((u) => {
                  const isSelected = selectedUserId === String(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[
                        styles.selectOptionRow,
                        isSelected && styles.selectOptionRowActive,
                        { marginBottom: 8 }
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedUserId(String(u.id));
                        setIsCustodianUserModalOpen(false);
                      }}
                    >
                      <View style={[styles.selectOptionIconBox, isSelected && { backgroundColor: '#fff7ed' }]}>
                        <Ionicons
                          name={u.category === 'OFFICER' ? 'shield-checkmark-outline' : 'person-outline'}
                          size={18}
                          color={isSelected ? '#ea580c' : '#475569'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selectOptionTitle, isSelected && { color: '#ea580c' }]}>
                          {u.name}
                        </Text>
                        <Text style={styles.selectOptionDesc}>{u.role}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.deleteUnitBtn}
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleRemoveCustodian(u.id, u.name);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#ef4444" />
                        </TouchableOpacity>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                        ) : (
                          <Ionicons name="radio-button-off" size={18} color="#cbd5e1" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

              {/* Add New Option */}
              <TouchableOpacity
                style={[
                  styles.selectOptionRow,
                  { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderStyle: 'dashed', marginTop: 4, marginBottom: 14 }
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setIsCustodianUserModalOpen(false);
                  setNewCustodianData(prev => ({
                    ...prev,
                    role: custodianRoleCategory === 'OFFICER' ? 'OFFICER' : 'STAFF'
                  }));
                  setIsAddCustodianModalOpen(true);
                }}
              >
                <View style={[styles.selectOptionIconBox, { backgroundColor: '#ffedd5' }]}>
                  <Ionicons name="add-circle" size={20} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectOptionTitle, { color: '#ea580c' }]}>
                    + Add New {custodianRoleCategory === 'OFFICER' ? 'In-Office Officer' : 'Staff Member'}
                  </Text>
                  <Text style={styles.selectOptionDesc}>Create a new member and assign immediately</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ea580c" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: ADD CUSTODIAN / STAFF */}
      {/* ======================================================== */}
      <Modal
        visible={isAddCustodianModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddCustodianModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddCustodianModalOpen(false)}
        >
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="person-add-outline" size={18} color="#ea580c" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Add Custodian Member</Text>
                  <Text style={styles.modalSubtitle}>Add personnel for asset custody</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddCustodianModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter full name"
                  placeholderTextColor="#94a3b8"
                  value={newCustodianData.name}
                  onChangeText={(val) => setNewCustodianData({ ...newCustodianData, name: val })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Role Category</Text>
                <View style={styles.chipsWrap}>
                  {[
                    { id: 'OFFICER', label: 'In-Office Officer', icon: 'shield-checkmark-outline' },
                    { id: 'STAFF', label: 'Staff Member', icon: 'people-outline' }
                  ].map((r) => {
                    const isSelected = newCustodianData.role === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        onPress={() => setNewCustodianData({ ...newCustodianData, role: r.id })}
                      >
                        <Ionicons
                          name={r.icon}
                          size={13}
                          color={isSelected ? '#ea580c' : '#64748b'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={newCustodianData.mobileNumber}
                  onChangeText={(val) => setNewCustodianData({ ...newCustodianData, mobileNumber: val })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email address"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newCustodianData.email}
                  onChangeText={(val) => setNewCustodianData({ ...newCustodianData, email: val })}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddCustodianModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSavingCustodian && styles.btnDisabled]}
                onPress={handleSaveCustodian}
                disabled={isSavingCustodian}
              >
                {isSavingCustodian ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Add Member</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Interactive Calendar Picker Modal */}
      <CalendarPickerModal
        visible={calendarTarget !== null}
        title={calendarTarget === 'purchase' ? 'Select Purchase Date' : 'Select Warranty Expiry Date'}
        initialDate={calendarTarget === 'purchase' ? purchaseDate : warrantyExpiry}
        onSelectDate={(selectedDate) => {
          if (calendarTarget === 'purchase') {
            setPurchaseDate(selectedDate);
          } else if (calendarTarget === 'warranty') {
            setWarrantyExpiry(selectedDate);
          }
          setCalendarTarget(null);
        }}
        onClose={() => setCalendarTarget(null)}
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
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 130,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  cardSectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  actionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionHeaderBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  requiredStar: {
    color: '#ef4444',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputPrefixIcon: {
    marginRight: 8,
  },
  textInputWithIcon: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    height: '100%',
  },
  textArea: {
    minHeight: 75,
    paddingTop: 10,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },

  /* Inline Creator */
  newInlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 6,
    marginBottom: 10,
    gap: 6,
  },
  newInlineInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a',
  },
  newInlineAddBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newInlineAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  newInlineCancelBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  /* Chips */
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  /* Attachments UI */
  pickerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerActionBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  docUploadBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docUploadText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  filePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
  },
  photoThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filePreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  filePreviewSize: {
    fontSize: 11.5,
    color: '#15803d',
  },
  removeFileBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* Bottom Action Buttons */
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
  },

  /* Dropdown Input Boxes */
  dropdownSelectBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dropdownSelectBoxActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ea580c',
  },
  dropdownLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  dropdownIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dropdownIconBoxActive: {
    backgroundColor: '#fff7ed',
  },
  dropdownMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  dropdownValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  dropdownDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.75,
  },

  /* Option Select Rows in Modals */
  selectOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  selectOptionRowActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  selectOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  selectOptionDesc: {
    fontSize: 11.5,
    color: '#64748b',
  },
  codeTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  deleteUnitBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
