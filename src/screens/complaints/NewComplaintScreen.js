import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav, AddressPlacesAutocomplete } from '../../components';
import api, { prepareFormDataFile } from '../../services/api';

/**
 * Reusable Selection Modal / Bottom Sheet
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
          {/* Sheet Header */}
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
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar if many items */}
          {options.length > 5 && (
            <View style={modalStyles.searchBox}>
              <Text style={modalStyles.searchIcon}>🔍</Text>
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

          {/* Options List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item, idx) => String(item.id !== undefined && item.id !== null ? item.id : (item.value || idx))}
            showsVerticalScrollIndicator={false}
            style={modalStyles.list}
            contentContainerStyle={modalStyles.listContent}
            ListEmptyComponent={
              <View style={modalStyles.emptyBox}>
                <Text style={modalStyles.emptyText}>No matching options found.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const itemId = item.id !== undefined ? item.id : (item.value || item);
              const itemLabel = item.label || item.name || String(item);
              const itemSub = item.description || item.subtitle || (item.areas ? `${item.areas.length} areas` : '');
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

export default function NewComplaintScreen({
  navigation,
  onCancel = () => {},
  onSubmitSuccess = () => {},
  activeTab = 'complaints',
  onTabPress
}) {
  // 1. Form Inputs State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedWard, setSelectedWard] = useState(null); // { id, name, label, areas: [] }
  const [selectedArea, setSelectedArea] = useState(null); // { id, name, label }
  const [landmark, setLandmark] = useState('');
  const [address, setAddress] = useState('');
  const [isSameAddress, setIsSameAddress] = useState(true);
  const [grievanceAddress, setGrievanceAddress] = useState('');
  const [grievanceLandmark, setGrievanceLandmark] = useState('');

  // Address Autocomplete API State
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [grievanceSuggestions, setGrievanceSuggestions] = useState([]);
  const [isSearchingGrievance, setIsSearchingGrievance] = useState(false);
  const [addressTimeout, setAddressTimeout] = useState(null);
  const [grievanceTimeout, setGrievanceTimeout] = useState(null);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLockedTitle, setLocationLockedTitle] = useState('');

  const [selectedDept, setSelectedDept] = useState(null); // { id, name, label }
  const [selectedPriority, setSelectedPriority] = useState({ id: 'MEDIUM', label: 'Medium (Moderate)', name: 'Medium (Moderate)', color: '#ea580c' });
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const [inOfficePerson, setInOfficePerson] = useState(null); // { id, name, label }
  const [officer, setOfficer] = useState(null); // { id, name, label }

  const [complaintPhotos, setComplaintPhotos] = useState([]);
  const [supportDocs, setSupportDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // 2. Modals Visibility State
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [inOfficeModalOpen, setInOfficeModalOpen] = useState(false);
  const [officerModalOpen, setOfficerModalOpen] = useState(false);

  const prioritiesList = [
    { id: 'LOW', label: 'Low (Regular)', name: 'Low (Regular)', subtitle: 'Non-urgent routine issue', color: '#10b981' },
    { id: 'MEDIUM', label: 'Medium (Moderate)', name: 'Medium (Moderate)', subtitle: 'Standard resolution SLA (24-48 hrs)', color: '#ea580c' },
    { id: 'HIGH', label: 'High (Urgent)', name: 'High (Urgent)', subtitle: 'Critical service outage / high priority', color: '#ea580c' },
    { id: 'CRITICAL', label: 'Critical (Immediate Action)', name: 'Critical (Immediate Action)', subtitle: 'Emergency hazard / safety threat', color: '#ef4444' }
  ];

  const [wardsList, setWardsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [officersList, setOfficersList] = useState([]);

  // Live Address Autocomplete Search (API)
  const handleAddressChange = (text) => {
    setAddress(text);
    if (addressTimeout) clearTimeout(addressTimeout);

    if (!text || text.trim().length < 2) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }

    setIsSearchingAddress(true);
    const timeout = setTimeout(async () => {
      try {
        const query = text.trim();
        const results = await api.get(`/location/search?q=${encodeURIComponent(query)}`);
        if (Array.isArray(results) && results.length > 0) {
          setAddressSuggestions(results);
        } else {
          setAddressSuggestions([]);
        }
      } catch (err) {
        console.warn('Address search notice:', err.message);
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);

    setAddressTimeout(timeout);
  };

  // Live Grievance Spot Autocomplete Search (API)
  const handleGrievanceAddressChange = (text) => {
    setGrievanceAddress(text);
    if (grievanceTimeout) clearTimeout(grievanceTimeout);

    if (!text || text.trim().length < 2) {
      setGrievanceSuggestions([]);
      setIsSearchingGrievance(false);
      return;
    }

    setIsSearchingGrievance(true);
    const timeout = setTimeout(async () => {
      try {
        const query = text.trim();
        const results = await api.get(`/location/search?q=${encodeURIComponent(query)}`);
        if (Array.isArray(results) && results.length > 0) {
          setGrievanceSuggestions(results);
        } else {
          setGrievanceSuggestions([]);
        }
      } catch (err) {
        console.warn('Grievance address search notice:', err.message);
        setGrievanceSuggestions([]);
      } finally {
        setIsSearchingGrievance(false);
      }
    }, 350);

    setGrievanceTimeout(timeout);
  };

  // Select Address Suggestion
  const handleSelectSuggestion = (item, isGrievance = false) => {
    const fullText = item.display_name || item.name || '';
    if (!isGrievance) {
      setAddress(fullText);
      setAddressSuggestions([]);
      if (!landmark && item.name) {
        setLandmark(item.name);
      }
    } else {
      setGrievanceAddress(fullText);
      setGrievanceSuggestions([]);
      if (!grievanceLandmark && item.name) {
        setGrievanceLandmark(item.name);
      }
    }

    if (item.lat && (item.lon || item.lng)) {
      const latVal = parseFloat(item.lat);
      const lngVal = parseFloat(item.lon || item.lng);
      setLatitude(latVal);
      setLongitude(lngVal);
      setLocationLockedTitle(fullText.split(',')[0]);
    }

    // Auto-detect Ward / Area from address string
    if (wardsList.length > 0 && (!selectedWard || !selectedArea)) {
      const lowerAddress = fullText.toLowerCase();
      for (const w of wardsList) {
        const wardLower = (w.name || '').toLowerCase();
        if (lowerAddress.includes(wardLower.split(' - ')[1]?.toLowerCase() || wardLower)) {
          setSelectedWard(w);
          if (Array.isArray(w.areas)) {
            const matchedArea = w.areas.find(a => lowerAddress.includes((a.name || '').toLowerCase()));
            if (matchedArea) {
              setSelectedArea(matchedArea);
            }
          }
          break;
        }
      }
    }
  };

  // 4. Fetch Dynamic Lookups from Backend Database
  useEffect(() => {
    let isMounted = true;
    const fetchLookups = async () => {
      try {
        const [deptsRes, wardsRes, officersRes, inOfficeRes] = await Promise.all([
          api.get('/departments').catch(() => null),
          api.get('/wards').catch(() => null),
          api.get('/users?role=OFFICER').catch(() => null),
          api.get('/users?role=IN_OFFICE_PERSON').catch(() => null)
        ]);

        if (isMounted) {
          // Departments
          const rawDepts = Array.isArray(deptsRes)
            ? deptsRes
            : (deptsRes?.departments && Array.isArray(deptsRes.departments) ? deptsRes.departments : []);
          
          const formattedDepts = rawDepts.map(d => ({
            id: d.id,
            name: d.name,
            label: d.name,
            description: d.description
          }));
          setDepartmentsList(formattedDepts);

          // Wards & Areas
          const rawWards = Array.isArray(wardsRes)
            ? wardsRes
            : (wardsRes?.wards && Array.isArray(wardsRes.wards) ? wardsRes.wards : []);

          if (rawWards && rawWards.length > 0) {
            const formattedWards = rawWards.map((w) => ({
              id: w.id,
              name: w.name || `Ward ${w.wardNumber || w.id}`,
              label: w.name || `Ward ${w.wardNumber || w.id}`,
              description: w.description || 'Constituency Ward',
              areas: Array.isArray(w.areas)
                ? w.areas.map(a => ({ id: a.id, name: a.name, label: a.name, description: a.description }))
                : []
            }));
            setWardsList(formattedWards);
          }

          // Field Officers
          const rawOfficers = Array.isArray(officersRes)
            ? officersRes
            : (officersRes?.users && Array.isArray(officersRes.users) ? officersRes.users : []);
          const officersFound = rawOfficers.filter(u => u.role === 'OFFICER');
          setOfficersList(officersFound.map(u => ({
            id: u.id,
            name: u.name || u.username,
            label: u.name || u.username,
            departmentId: u.departmentId,
            departments: u.departments,
            role: 'Field Officer'
          })));

          // In-Office Coordinators (IN_OFFICE_PERSON)
          const rawInOffice = Array.isArray(inOfficeRes)
            ? inOfficeRes
            : (inOfficeRes?.users && Array.isArray(inOfficeRes.users) ? inOfficeRes.users : []);
          const inOfficeFound = rawInOffice.filter(u => u.role === 'IN_OFFICE_PERSON');
          setStaffList(inOfficeFound.map(u => ({
            id: u.id,
            name: u.name || u.username,
            label: u.name || u.username,
            departmentId: u.departmentId,
            departments: u.departments,
            role: 'In-Office Personnel'
          })));
        }
      } catch (e) {
        console.log('Lookup fetch notice:', e.message);
      }
    };

    fetchLookups();
    return () => { isMounted = false; };
  }, []);

  // Compute areas available for currently selected ward
  const availableAreas = useMemo(() => {
    if (!selectedWard || !Array.isArray(selectedWard.areas)) return [];
    return selectedWard.areas;
  }, [selectedWard]);

  // Filter In-Office Coordinators by selected department (with fallback to all staff if none explicitly bound)
  const filteredStaffList = useMemo(() => {
    if (!selectedDept?.id) return staffList;
    const deptId = Number(selectedDept.id);
    const matched = staffList.filter(s =>
      s.departmentId === deptId ||
      (Array.isArray(s.departments) && s.departments.some(d => d.id === deptId))
    );
    return matched.length > 0 ? matched : staffList;
  }, [selectedDept, staffList]);

  // Filter Field Officers by selected department (with fallback to all officers if none explicitly bound)
  const filteredOfficersList = useMemo(() => {
    if (!selectedDept?.id) return officersList;
    const deptId = Number(selectedDept.id);
    const matched = officersList.filter(o =>
      o.departmentId === deptId ||
      (Array.isArray(o.departments) && o.departments.some(d => d.id === deptId))
    );
    return matched.length > 0 ? matched : officersList;
  }, [selectedDept, officersList]);

  // When Ward changes, reset selected area
  const handleWardSelect = (ward) => {
    setSelectedWard(ward);
    setSelectedArea(null);
  };

  // 5. Image & Attachment Pickers
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to capture issue photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const a = result.assets[0];
        let name = a.fileName || a.uri.split('/').pop() || `camera_${Date.now()}.jpg`;
        if (!name.includes('.')) name += '.jpg';
        const picked = {
          uri: a.uri,
          file: a.file,
          name,
          type: a.mimeType || 'image/jpeg'
        };
        setComplaintPhotos((prev) => [...prev, picked]);
      }
    } catch (err) {
      console.log('Camera photo error:', err);
    }
  };

  const handleChoosePhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access is needed to attach issue photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8
      });
      if (!result.canceled && result.assets) {
        const picked = result.assets.map((a, idx) => {
          let name = a.fileName || a.uri.split('/').pop() || `photo_${Date.now()}_${idx}.jpg`;
          if (!name.includes('.')) name += '.jpg';
          return {
            uri: a.uri,
            file: a.file,
            name,
            type: a.mimeType || 'image/jpeg'
          };
        });
        setComplaintPhotos((prev) => [...prev, ...picked]);
      }
    } catch (err) {
      console.log('Photo selection error:', err);
    }
  };

  const handleChooseDocs = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true
      });
      if (!result.canceled && result.assets) {
        const picked = result.assets.map((a, idx) => {
          let name = a.name || a.fileName || a.uri.split('/').pop() || `doc_${Date.now()}_${idx}.pdf`;
          if (!name.includes('.')) {
            const ext = (a.mimeType && a.mimeType.includes('image')) ? '.jpg' : '.pdf';
            name += ext;
          }
          return {
            uri: a.uri,
            file: a.file,
            name,
            type: a.mimeType || 'application/octet-stream'
          };
        });
        setSupportDocs((prev) => [...prev, ...picked]);
      }
    } catch (err) {
      console.log('Document selection error:', err);
    }
  };

  const removePhoto = (index) => {
    setComplaintPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDoc = (index) => {
    setSupportDocs((prev) => prev.filter((_, i) => i !== index));
  };

  // 6. Submit Registration Form
  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Field', 'Please enter citizen full name.');
      return;
    }
    if (fullName.trim().length < 3) {
      Alert.alert('Invalid Name', 'Citizen name must be at least 3 characters long.');
      return;
    }
    if (!mobileNumber.trim()) {
      Alert.alert('Missing Field', 'Please enter a 10-digit mobile number.');
      return;
    }
    const cleanMobile = mobileNumber.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!selectedWard) {
      Alert.alert('Missing Field', 'Please select a ward.');
      return;
    }
    if (!selectedDept) {
      Alert.alert('Missing Field', 'Please select a concerned department.');
      return;
    }

    setSubmitting(true);
    try {
      const areaName = selectedArea?.name || selectedArea?.label || '';
      const wardName = selectedWard?.name || selectedWard?.label || 'Constituency';
      const locLabel = areaName ? `${areaName}, ${wardName}` : wardName;
      const deptName = selectedDept?.name || selectedDept?.label || 'Department';

      const finalGrievanceAddress = isSameAddress
        ? (address.trim() || locLabel)
        : (grievanceAddress.trim() || address.trim() || locLabel);

      const finalGrievanceLandmark = isSameAddress
        ? (landmark.trim() || (areaName ? `${areaName} Main Chowk` : `${wardName} Central`))
        : (grievanceLandmark.trim() || landmark.trim() || (areaName ? `${areaName} Main Chowk` : `${wardName} Central`));

      const formData = new FormData();
      formData.append('citizenName', fullName.trim());
      formData.append('mobileNumber', cleanMobile);
      formData.append('wardId', String(Number(selectedWard.id) || 1));
      
      const areaIdToUse = selectedArea?.id 
        ? String(Number(selectedArea.id)) 
        : (selectedWard?.areas && selectedWard.areas.length > 0 ? String(Number(selectedWard.areas[0].id)) : '1');
      formData.append('areaId', areaIdToUse);

      formData.append('departmentId', String(Number(selectedDept.id) || 1));
      formData.append('landmark', finalGrievanceLandmark || 'Central Landmark');
      formData.append('address', finalGrievanceAddress || 'Constituency Address');
      if (latitude) formData.append('latitude', String(latitude));
      if (longitude) formData.append('longitude', String(longitude));
      formData.append('subject', subject.trim() || `${deptName} Issue - ${areaName || wardName}`);
      formData.append('description', description.trim() || subject.trim() || 'Citizen grievance logged via mobile desk.');
      formData.append('priority', selectedPriority?.id || 'MEDIUM');

      if (inOfficePerson && inOfficePerson.id) {
        formData.append('inOfficePersonId', String(inOfficePerson.id));
      }
      if (officer && officer.id) {
        formData.append('officerIds', JSON.stringify([Number(officer.id)]));
      }

      // Append complaint photos using prepareFormDataFile
      for (let idx = 0; idx < complaintPhotos.length; idx++) {
        const photo = complaintPhotos[idx];
        const fileObj = await prepareFormDataFile(photo, 'image/jpeg');
        if (fileObj) {
          formData.append('photos', fileObj);
        }
      }

      // Append support documents using prepareFormDataFile
      for (let idx = 0; idx < supportDocs.length; idx++) {
        const doc = supportDocs[idx];
        const fileObj = await prepareFormDataFile(doc, 'application/pdf');
        if (fileObj) {
          formData.append('documents', fileObj);
        }
      }

      const res = await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const ticketNum = res?.complaint?.complaintNumber || res?.complaintNumber || (res?.id ? `OKT-${res.id}` : 'Registered');

      Alert.alert(
        '✅ Grievance Registered',
        `Ticket #${ticketNum} registered successfully and routed to ${deptName} Department.`,
        [{ text: 'OK', onPress: () => onSubmitSuccess(res) }]
      );
    } catch (err) {
      console.error('Complaint registration error:', err.message);
      Alert.alert(
        'Registration Failed',
        err.message || 'An error occurred while saving the grievance. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.cancelBtnRow}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelArrow}>‹</Text>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>Register New Grievance</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Scrollable Form Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================== */}
        {/* CARD 1: CITIZEN & LOCATION INFORMATION */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>1. Citizen & Location Information</Text>

          {/* Citizen Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Citizen Full Name <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter citizen's full name"
              placeholderTextColor="#94a3b8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Mobile Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Mobile Number <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobileNumber}
              onChangeText={text => setMobileNumber(text.replace(/\D/g, '').slice(0, 10))}
            />
          </View>

          {/* Ward & Area Selectors (2 Columns) */}
          <View style={styles.twoColumnRow}>
            {/* Ward Selector */}
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Select Ward <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                activeOpacity={0.7}
                onPress={() => setWardModalOpen(true)}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedWard && styles.placeholderText
                  ]}
                  numberOfLines={1}
                >
                  {selectedWard ? (selectedWard.name || selectedWard.label).split(' (')[0] : '-- Select Ward --'}
                </Text>
                <Text style={styles.dropdownCaret}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Area Selector */}
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Select Area <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.dropdownInput,
                  !selectedWard && styles.dropdownDisabled
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (!selectedWard) {
                    Alert.alert('Select Ward First', 'Please select a ward first before picking an area.');
                    return;
                  }
                  setAreaModalOpen(true);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedArea && styles.placeholderText
                  ]}
                  numberOfLines={1}
                >
                  {selectedArea
                    ? (selectedArea.name || selectedArea.label).split(' (')[0]
                    : (selectedWard ? (availableAreas.length === 0 ? 'No Area Mapped' : '-- Select Area --') : 'Choose Ward First')}
                </Text>
                <Text style={styles.dropdownCaret}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Landmark / Reference */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Landmark / Reference</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Near Shaniwar Wada gate"
              placeholderTextColor="#94a3b8"
              value={landmark}
              onChangeText={setLandmark}
            />
          </View>

          {/* Full Address with Live API Autocomplete */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Full Address</Text>
              {isSearchingAddress && (
                <View style={styles.searchingBadge}>
                  <ActivityIndicator size="small" color="#ea580c" />
                  <Text style={styles.searchingText}>Searching places...</Text>
                </View>
              )}
            </View>
            <View style={styles.inputWithIconContainer}>
              <TextInput
                style={[styles.textInput, styles.textAreaSmall, { paddingRight: 36 }]}
                placeholder="Enter complete residential address..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={address}
                onChangeText={handleAddressChange}
              />
              {address.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputIconBtn}
                  onPress={() => {
                    setAddress('');
                    setAddressSuggestions([]);
                    setLatitude(null);
                    setLongitude(null);
                    setLocationLockedTitle('');
                  }}
                >
                  <Text style={styles.clearInputIconText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Address Suggestions Dropdown */}
            {addressSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <View style={styles.suggestionsHeaderRow}>
                  <Text style={styles.suggestionsHeaderTitle}>
                    📍 Matched Locations ({addressSuggestions.length})
                  </Text>
                  <TouchableOpacity onPress={() => setAddressSuggestions([])}>
                    <Text style={styles.suggestionsCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                {addressSuggestions.slice(0, 5).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.suggestionItem,
                      idx === addressSuggestions.length - 1 && styles.suggestionItemLast
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectSuggestion(item, false)}
                  >
                    <Text style={styles.suggestionPin}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionMainText} numberOfLines={2}>
                        {item.display_name || item.name}
                      </Text>
                      {item.lat && (item.lon || item.lng) ? (
                        <Text style={styles.suggestionCoordsText}>
                          GPS: {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon || item.lng).toFixed(4)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* GPS Telemetry Pill */}
            {latitude && longitude ? (
              <View style={styles.gpsPillContainer}>
                <View style={styles.gpsPillLeft}>
                  <Text style={styles.gpsPillPin}>🛰️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsPillTitle}>
                      GPS Coordinates Attached {locationLockedTitle ? `(${locationLockedTitle})` : ''}
                    </Text>
                    <Text style={styles.gpsPillCoords}>
                      {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.gpsPillClear}
                  onPress={() => {
                    setLatitude(null);
                    setLongitude(null);
                    setLocationLockedTitle('');
                  }}
                >
                  <Text style={styles.gpsPillClearText}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Residence Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            onPress={() => setIsSameAddress(!isSameAddress)}
          >
            <View style={[styles.checkboxBox, isSameAddress && styles.checkboxBoxChecked]}>
              {isSameAddress && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              Is Grievance location the same as Citizen Residence Address?
            </Text>
          </TouchableOpacity>

          {/* Conditional Grievance Location (When different from residence) */}
          {!isSameAddress && (
            <View style={styles.diffAddressContainer}>
              <Text style={styles.diffAddressTitle}>📍 Grievance Spot Location</Text>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>
                    Grievance Site Address <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  {isSearchingGrievance && (
                    <View style={styles.searchingBadge}>
                      <ActivityIndicator size="small" color="#ea580c" />
                      <Text style={[styles.searchingText, { color: '#ea580c' }]}>Searching...</Text>
                    </View>
                  )}
                </View>
                <View style={styles.inputWithIconContainer}>
                  <TextInput
                    style={[styles.textInput, styles.textAreaSmall, { paddingRight: 36 }]}
                    placeholder="Search incident site address..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    value={grievanceAddress}
                    onChangeText={handleGrievanceAddressChange}
                  />
                  {grievanceAddress.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearInputIconBtn}
                      onPress={() => {
                        setGrievanceAddress('');
                        setGrievanceSuggestions([]);
                      }}
                    >
                      <Text style={styles.clearInputIconText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Grievance Suggestions Dropdown */}
                {grievanceSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeaderRow}>
                      <Text style={styles.suggestionsHeaderTitle}>
                        📍 Matched Incident Spot ({grievanceSuggestions.length})
                      </Text>
                      <TouchableOpacity onPress={() => setGrievanceSuggestions([])}>
                        <Text style={styles.suggestionsCloseText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                    {grievanceSuggestions.slice(0, 5).map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.suggestionItem,
                          idx === grievanceSuggestions.length - 1 && styles.suggestionItemLast
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleSelectSuggestion(item, true)}
                      >
                        <Text style={styles.suggestionPin}>📍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionMainText} numberOfLines={2}>
                            {item.display_name || item.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Grievance Spot Landmark / Details</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Opposite Main Gate, Beside Electric Pole #4"
                  placeholderTextColor="#94a3b8"
                  value={grievanceLandmark}
                  onChangeText={setGrievanceLandmark}
                />
              </View>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* CARD 2: GRIEVANCE DESCRIPTION & CLASSIFICATION */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>2. Grievance Description & Classification</Text>

          {/* Department & Priority Selectors (2 Columns) */}
          <View style={styles.twoColumnRow}>
            {/* Department */}
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Concerned Department <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                activeOpacity={0.7}
                onPress={() => setDeptModalOpen(true)}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedDept && styles.placeholderText
                  ]}
                  numberOfLines={1}
                >
                  {selectedDept ? (selectedDept.name || selectedDept.label) : '-- Select Department --'}
                </Text>
                <Text style={styles.dropdownCaret}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Priority */}
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Priority <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                activeOpacity={0.7}
                onPress={() => setPriorityModalOpen(true)}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {selectedPriority ? (selectedPriority.label || selectedPriority.name) : 'Medium (Moderate)'}
                </Text>
                <Text style={styles.dropdownCaret}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Grievance Subject */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Subject / Summary <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Brief summary of the issue"
              placeholderTextColor="#94a3b8"
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          {/* Detailed Grievance Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Detailed Description <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textAreaLarge]}
              placeholder="Describe the complaint in detail..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        {/* ======================================================== */}
        {/* CARD 3: PERSONNEL ASSIGNMENT */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>3. Personnel Assignment</Text>

          {/* In-Office Person */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>In-Office Person</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              activeOpacity={0.7}
              onPress={() => setInOfficeModalOpen(true)}
            >
              <Text style={[styles.dropdownText, !inOfficePerson && styles.placeholderText]} numberOfLines={1}>
                {inOfficePerson ? (inOfficePerson.name || inOfficePerson.label) : '-- Assign In-Office Person --'}
              </Text>
              <Text style={styles.dropdownCaret}>▼</Text>
            </TouchableOpacity>
            {!selectedDept && (
              <Text style={styles.helperSubText}>Select a department first.</Text>
            )}
          </View>

          {/* Concerned PMC Officer(s) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Concerned PMC Officer(s)</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              activeOpacity={0.7}
              onPress={() => {
                if (!selectedDept) {
                  Alert.alert('Department Required', 'Please select a department first.');
                  return;
                }
                setOfficerModalOpen(true);
              }}
            >
              <Text style={[styles.dropdownText, !officer && styles.placeholderText]} numberOfLines={1}>
                {officer
                  ? (officer.name || officer.label)
                  : (selectedDept ? '-- Assign Field Officer --' : 'Select a department first.')}
              </Text>
              <Text style={styles.dropdownCaret}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* CARD 4: PHOTOS & SUPPORT DOCUMENTS */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>4. Photos & Support Documents</Text>

          {/* Complaint Photos (Multiple) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Complaint Photos (Multiple)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <TouchableOpacity
                style={[styles.chooseFileBtn, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}
                activeOpacity={0.7}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={14} color="#ea580c" style={{ marginRight: 5 }} />
                <Text style={styles.chooseFileBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chooseFileBtn, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}
                activeOpacity={0.7}
                onPress={handleChoosePhotos}
              >
                <Ionicons name="images" size={14} color="#2563eb" style={{ marginRight: 5 }} />
                <Text style={styles.chooseFileBtnText}>Choose Gallery</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
                <Text style={styles.fileChosenText} numberOfLines={1}>
                  {complaintPhotos.length > 0
                    ? `${complaintPhotos.length} photo(s) selected`
                    : 'No photos selected'}
                </Text>
              </View>
            </View>
            <Text style={styles.helperSubText}>Upload photos showing the issue site (JPG, PNG, WEBP).</Text>

            {complaintPhotos.length > 0 && (
              <View style={styles.photosPreviewGrid}>
                {complaintPhotos.map((item, idx) => {
                  const photoUri = typeof item === 'string' ? item : item.uri;
                  return (
                    <View key={idx} style={styles.photoThumbWrap}>
                      <Image source={{ uri: photoUri }} style={styles.photoThumbImage} />
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => removePhoto(idx)}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Support Documents */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Support Documents / Applications (Optional)</Text>
            <View style={styles.filePickerBox}>
              <TouchableOpacity
                style={[styles.chooseFileBtn, { flexDirection: 'row', alignItems: 'center' }]}
                activeOpacity={0.7}
                onPress={handleChooseDocs}
              >
                <Ionicons name="document-attach" size={14} color="#059669" style={{ marginRight: 5 }} />
                <Text style={styles.chooseFileBtnText}>Choose Documents</Text>
              </TouchableOpacity>
              <Text style={styles.fileChosenText} numberOfLines={1}>
                {supportDocs.length > 0
                  ? `${supportDocs.length} file(s) selected`
                  : 'No file chosen'}
              </Text>
            </View>
            <Text style={styles.helperSubText}>Upload supporting applications/documents/images (PDF, DOC, Images).</Text>

            {supportDocs.length > 0 && (
              <View style={styles.docsList}>
                {supportDocs.map((doc, idx) => {
                  const docName = typeof doc === 'string' ? doc : (doc.name || `Document-${idx + 1}`);
                  return (
                    <View key={idx} style={styles.docChip}>
                      <Text style={styles.docChipText} numberOfLines={1}>📑 {docName}</Text>
                      <TouchableOpacity onPress={() => removeDoc(idx)}>
                        <Text style={styles.removeDocText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ======================================================== */}
        {/* BOTTOM ACTION BUTTONS */}
        {/* ======================================================== */}
        <View style={styles.bottomActionsContainer}>
          <TouchableOpacity
            style={styles.cancelActionBtn}
            activeOpacity={0.7}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitActionBtn, submitting && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitActionText}>Register Grievance</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* SELECTION MODALS */}
      {/* ======================================================== */}
      {/* 1. Ward Picker Modal */}
      <SelectionModal
        visible={wardModalOpen}
        title="Select Ward"
        subtitle="Choose constituency ward"
        options={wardsList.map(w => ({
          id: w.id,
          name: w.name,
          label: w.name,
          subtitle: `${(w.areas || []).length} Areas mapped`,
          areas: w.areas
        }))}
        selectedId={selectedWard?.id}
        onSelect={(item) => {
          const found = wardsList.find(w => w.id === item.id) || item;
          handleWardSelect(found);
        }}
        onClose={() => setWardModalOpen(false)}
        searchPlaceholder="Search ward by name..."
      />

      {/* 2. Area Picker Modal */}
      <SelectionModal
        visible={areaModalOpen}
        title={`Select Area in ${selectedWard?.name ? selectedWard.name.split(' (')[0] : 'Ward'}`}
        subtitle="Choose specific locality or sector"
        options={[
          { id: null, label: '-- None / No Specific Area --', name: '-- None / No Specific Area --', description: 'General constituency jurisdiction' },
          ...availableAreas.map(a => ({
            id: a.id,
            name: a.name,
            label: a.name,
            description: a.description
          }))
        ]}
        selectedId={selectedArea?.id}
        onSelect={(item) => {
          setSelectedArea(item.id ? item : null);
        }}
        onClose={() => setAreaModalOpen(false)}
        searchPlaceholder="Search area or colony..."
      />

      {/* 3. Department Picker Modal */}
      <SelectionModal
        visible={deptModalOpen}
        title="Select Department"
        subtitle="Route grievance to concerned municipal department"
        options={departmentsList.map(d => ({
          id: d.id,
          name: d.name,
          label: d.name,
          subtitle: d.description || ''
        }))}
        selectedId={selectedDept?.id}
        onSelect={(item) => {
          setSelectedDept(item);
          // When department changes, reset coordinator and officer selections to avoid mismatch
          setInOfficePerson(null);
          setOfficer(null);
        }}
        onClose={() => setDeptModalOpen(false)}
        searchPlaceholder="Search department..."
      />

      {/* 4. Priority Level Picker Modal */}
      <SelectionModal
        visible={priorityModalOpen}
        title="Select Priority"
        subtitle="Determine urgency of resolution"
        options={prioritiesList.map(p => ({
          id: p.id,
          name: p.label,
          label: p.label,
          subtitle: p.subtitle,
          color: p.color
        }))}
        selectedId={selectedPriority?.id}
        onSelect={(item) => setSelectedPriority(item)}
        onClose={() => setPriorityModalOpen(false)}
      />

      {/* 5. In-Office Person Modal */}
      <SelectionModal
        visible={inOfficeModalOpen}
        title="Assign In-Office Person"
        subtitle="Select coordinator for tracking"
        options={[
          { id: null, label: '-- None / Unassigned --', name: '-- None / Unassigned --', subtitle: 'Do not assign coordinator' },
          ...filteredStaffList.map(s => ({
            id: s.id,
            name: s.name,
            label: s.name,
            subtitle: 'In-Office Personnel'
          }))
        ]}
        selectedId={inOfficePerson?.id}
        onSelect={(item) => setInOfficePerson(item.id ? item : null)}
        onClose={() => setInOfficeModalOpen(false)}
        searchPlaceholder="Search in-office person..."
      />

      {/* 6. Officer Modal */}
      <SelectionModal
        visible={officerModalOpen}
        title="Assign PMC Officer"
        subtitle="Direct grievance to field officer"
        options={[
          { id: null, label: '-- None / Unassigned --', name: '-- None / Unassigned --', subtitle: 'Auto-assign or unassigned' },
          ...filteredOfficersList.map(o => ({
            id: o.id,
            name: o.name,
            label: o.name,
            subtitle: 'Field Officer'
          }))
        ]}
        selectedId={officer?.id}
        onSelect={(item) => setOfficer(item.id ? item : null)}
        onClose={() => setOfficerModalOpen(false)}
        searchPlaceholder="Search field officer..."
      />

      {/* Persistent Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabPress={(tabId) => onTabPress && onTabPress(tabId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 130, // Clearance above BottomNav bar
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  /* Header Bar */
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
  cancelBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
    minWidth: 60,
  },
  cancelArrow: {
    fontSize: 22,
    color: '#0f172a',
    marginRight: 2,
    lineHeight: 24,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerRightPlaceholder: {
    minWidth: 60,
  },

  /* Card Containers */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ea580c',
    marginBottom: 16,
    letterSpacing: -0.2,
  },

  /* Input Groups */
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#64748b',
    fontWeight: '700',
  },
  helperSubText: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 15,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textAreaSmall: {
    minHeight: 64,
    paddingTop: 10,
  },
  textAreaLarge: {
    minHeight: 88,
    paddingTop: 10,
  },

  /* Autocomplete & Live Search Elements */
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
  },
  inputWithIconContainer: {
    position: 'relative',
  },
  clearInputIconBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  clearInputIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },

  /* Suggestions Dropdown Container */
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestionsHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  suggestionsCloseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionPin: {
    fontSize: 13,
    marginRight: 8,
    marginTop: 2,
  },
  suggestionMainText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#0f172a',
    lineHeight: 17,
  },
  suggestionCoordsText: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '500',
    marginTop: 2,
  },

  /* GPS Locked Telemetry Pill */
  gpsPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  gpsPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  gpsPillPin: {
    fontSize: 15,
  },
  gpsPillTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  gpsPillCoords: {
    fontSize: 10.5,
    color: '#047857',
    fontWeight: '600',
  },
  gpsPillClear: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#d1fae5',
  },
  gpsPillClearText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065f46',
  },

  /* Dropdown Selectors */
  dropdownInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.8,
  },
  dropdownText: {
    fontSize: 13.5,
    color: '#0f172a',
    fontWeight: '500',
    flex: 1,
  },
  placeholderText: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  dropdownCaret: {
    fontSize: 10,
    color: '#94a3b8',
    marginLeft: 6,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  halfColumn: {
    flex: 1,
  },

  /* Checkbox Row */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#ea580c',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  checkboxLabel: {
    fontSize: 12.5,
    color: '#475569',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500',
  },
  diffAddressContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  diffAddressTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c',
    marginBottom: 8,
  },

  /* File Attachments Box */
  filePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 6,
  },
  chooseFileBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  chooseFileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  fileChosenText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    marginLeft: 10,
  },
  photosPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  photoThumbWrap: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  docsList: {
    marginTop: 8,
    gap: 6,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  docChipText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  removeDocText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 4,
  },

  /* Bottom Actions Buttons */
  bottomActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 30,
  },
  cancelActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  submitActionBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  submitActionText: {
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: 8,
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
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  optionItemSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  optionLabelSelected: {
    color: '#ea580c',
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
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
