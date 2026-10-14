import React, { useState, useEffect, useMemo } from 'react';
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
import { AddressPlacesAutocomplete } from '../../components';
import api from '../../services/api';

const BackArrowIcon = () => (
  <View style={styles.backArrowBox}>
    <View style={styles.backArrowStem} />
    <View style={styles.backArrowHeadTop} />
    <View style={styles.backArrowHeadBottom} />
  </View>
);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const POPULAR_TIME_PRESETS = [
  '09:00 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '02:00 PM', '03:30 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
];

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export default function CreateEventScreen({
  navigation,
  onBack = () => {},
  onCancel = () => {},
  onSubmitSuccess = () => {}
}) {
  // Form State
  const [eventTitle, setEventTitle] = useState('');
  const [location, setLocation] = useState('');
  const [allocatedBudgetAmount, setAllocatedBudgetAmount] = useState('');
  const [status, setStatus] = useState('UPCOMING');
  const [description, setDescription] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [attachedMedia, setAttachedMedia] = useState(null); // { uri, name, type, mimeType, isImage }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Location & Google Places Autocomplete State
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationTimeout, setLocationTimeout] = useState(null);

  // Date & Time State
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('30');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [clockActiveMode, setClockActiveMode] = useState('HOUR'); // 'HOUR' | 'MINUTE'

  // Modals
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  // Budgets List & Preset Locations List
  const [budgetsList, setBudgetsList] = useState([]);
  const [presetLocationsList, setPresetLocationsList] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [budgetsRes, locationsRes] = await Promise.allSettled([
          api.get('/budgets'),
          api.get('/events/locations')
        ]);

        if (budgetsRes.status === 'fulfilled') {
          const list = Array.isArray(budgetsRes.value) ? budgetsRes.value : (budgetsRes.value?.budgets || []);
          setBudgetsList(list);
        }

        if (locationsRes.status === 'fulfilled') {
          const locs = Array.isArray(locationsRes.value) ? locationsRes.value : [];
          setPresetLocationsList(locs);
        }
      } catch (err) {
        console.log('Events initial lookups notice:', err.message);
      }
    };
    fetchInitialData();
  }, []);

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else if (navigation && navigation.goBack) navigation.goBack();
  };

  // Selected Budget Object & Computed Remaining Balance
  const selectedBudget = useMemo(() => {
    if (!selectedBudgetId) return null;
    return budgetsList.find(b => String(b.id) === String(selectedBudgetId)) || null;
  }, [selectedBudgetId, budgetsList]);

  const selectedBudgetAvailableBalance = useMemo(() => {
    if (!selectedBudget) return null;
    if (selectedBudget.remainingAmount !== undefined) return selectedBudget.remainingAmount;
    const directCons = (selectedBudget.consumptions || []).reduce((sum, c) => sum + (c.amount || 0), 0);
    const eventCons = (selectedBudget.events || []).filter(e => e.status !== 'CANCELLED').reduce((sum, e) => sum + (e.budget || 0), 0);
    return Math.max(0, selectedBudget.amount - (directCons + eventCons));
  }, [selectedBudget]);

  // Handle Location Typing & Google Places Autocomplete
  const handleLocationChange = (text) => {
    setLocation(text);
    if (locationTimeout) clearTimeout(locationTimeout);

    if (!text || text.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    setShowLocationDropdown(true);

    const timeout = setTimeout(async () => {
      try {
        const q = text.trim().toLowerCase();

        // 1. Check local preset civic/ward locations
        const localMatches = presetLocationsList
          .filter(loc => {
            const name = typeof loc === 'string' ? loc : loc.name;
            const cat = typeof loc === 'object' ? loc.category : '';
            return name.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
          })
          .slice(0, 4)
          .map(loc => ({
            title: typeof loc === 'string' ? loc : loc.name,
            subtitle: typeof loc === 'object' ? loc.category : 'Civic Venue',
            source: 'venue'
          }));

        // 2. Query live Google Location search API
        let googleMatches = [];
        try {
          const res = await api.get(`/location/search?q=${encodeURIComponent(text.trim())}`);
          if (Array.isArray(res)) {
            googleMatches = res.slice(0, 5).map(item => ({
              title: item.display_name,
              subtitle: item.source === 'google' ? 'Google Places' : 'Pune Location',
              source: 'google'
            }));
          }
        } catch (gErr) {
          console.log('Google location search notice:', gErr.message);
        }

        // Combine & deduplicate
        const seen = new Set();
        const combined = [];
        [...localMatches, ...googleMatches].forEach(item => {
          const key = item.title.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            combined.push(item);
          }
        });

        setLocationSuggestions(combined);
      } catch (err) {
        console.log('Location autocomplete notice:', err.message);
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 350);

    setLocationTimeout(timeout);
  };

  const handleSelectLocation = (locTitle) => {
    setLocation(locTitle);
    setShowLocationDropdown(false);
    setLocationSuggestions([]);
  };

  // Quick Date Preset Handlers
  const handleSetQuickDate = (type) => {
    const d = new Date();
    if (type === 'TODAY') {
      // today
    } else if (type === 'TOMORROW') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'WEEKEND') {
      const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilSat);
    } else if (type === 'NEXT_WEEK') {
      d.setDate(d.getDate() + 7);
    }
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
    setSelectedDay(d.getDate());
  };

  // Quick Time Preset Handler
  const handleSelectPresetTime = (preset) => {
    const [timeStr, period] = preset.split(' ');
    const [hour, min] = timeStr.split(':');
    setSelectedHour(hour);
    setSelectedMinute(min);
    setSelectedPeriod(period);
  };

  // Computed Date-Time Strings
  const getFormattedDateString = () => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-IN', options);
  };

  const getFormattedTimeString = () => {
    return `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  };

  const constructISODateTime = () => {
    let hour24 = parseInt(selectedHour, 10);
    if (selectedPeriod === 'PM' && hour24 < 12) hour24 += 12;
    if (selectedPeriod === 'AM' && hour24 === 12) hour24 = 0;

    const d = new Date(
      selectedYear,
      selectedMonth,
      selectedDay,
      hour24,
      parseInt(selectedMinute, 10),
      0
    );
    return d.toISOString();
  };

  // Media Pickers
  const handlePickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture event photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachedMedia({
          uri: asset.uri,
          name: `event_banner_${Date.now()}.jpg`,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', err.message);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select event media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.85
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || (asset.fileName && asset.fileName.toLowerCase().endsWith('.mp4'));
        setAttachedMedia({
          uri: asset.uri,
          name: asset.fileName || `event_media_${Date.now()}.jpg`,
          type: isVideo ? 'VIDEO' : 'IMAGE',
          mimeType: isVideo ? 'video/mp4' : (asset.mimeType || 'image/jpeg'),
          isImage: !isVideo
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', err.message);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const isImg = !!(doc.name && doc.name.match(/\.(jpg|jpeg|png|webp)$/i));
        setAttachedMedia({
          uri: doc.uri,
          name: doc.name,
          type: isImg ? 'IMAGE' : 'DOCUMENT',
          mimeType: doc.mimeType || 'application/pdf',
          isImage: isImg
        });
      }
    } catch (err) {
      Alert.alert('Document Error', err.message);
    }
  };

  // Submit Event Form
  const handleSubmit = async () => {
    if (!eventTitle.trim() || eventTitle.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter event title (min 3 characters).');
      return;
    }
    if (!location.trim() || location.trim().length < 3) {
      Alert.alert('Required Field', 'Please specify the event location or venue (min 3 characters).');
      return;
    }

    const isoDate = constructISODateTime();
    const cleanBudgetAmount = allocatedBudgetAmount ? parseFloat(allocatedBudgetAmount.replace(/[^0-9.]/g, '')) : null;

    // Validate budget logic against selected budget head
    if (selectedBudgetId && cleanBudgetAmount !== null) {
      if (selectedBudgetAvailableBalance !== null && cleanBudgetAmount > selectedBudgetAvailableBalance) {
        Alert.alert(
          'Budget Limit Exceeded',
          `Allocated amount (₹${cleanBudgetAmount.toLocaleString('en-IN')}) exceeds the available balance (₹${selectedBudgetAvailableBalance.toLocaleString('en-IN')}) of "${selectedBudget?.allocatedTo}".`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', eventTitle.trim());
      formData.append('eventDate', isoDate);
      formData.append('location', location.trim());
      formData.append('status', status);

      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (cleanBudgetAmount !== null && !isNaN(cleanBudgetAmount) && cleanBudgetAmount >= 0) {
        formData.append('budget', String(cleanBudgetAmount));
      }
      if (selectedBudgetId) {
        formData.append('budgetId', String(selectedBudgetId));
      }

      if (attachedMedia) {
        const fileUri = Platform.OS === 'android' ? attachedMedia.uri : attachedMedia.uri.replace('file://', '');
        let mimeType = attachedMedia.mimeType;
        if (!mimeType) {
          const ext = (attachedMedia.name.split('.').pop() || '').toLowerCase();
          if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else if (ext === 'mp4') mimeType = 'video/mp4';
          else mimeType = 'application/octet-stream';
        }

        formData.append('media', {
          uri: fileUri,
          name: attachedMedia.name,
          type: mimeType
        });
      }

      await api.post('/events', formData);

      Alert.alert(
        'Event Scheduled',
        `"${eventTitle.trim()}" has been successfully scheduled for ${getFormattedDateString()} at ${getFormattedTimeString()}.`,
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
      console.log('Create event error:', err);
      const isAuth = err.message && (
        err.message.toLowerCase().includes('token') ||
        err.message.toLowerCase().includes('auth') ||
        err.message.toLowerCase().includes('unauthorized') ||
        err.message.toLowerCase().includes('session')
      );

      if (isAuth) {
        Alert.alert(
          'Authentication Required',
          'Your session is not active or token is invalid. Please log in with an Administrator account.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Log In',
              onPress: () => {
                if (navigation && navigation.navigate) {
                  navigation.navigate('login');
                } else if (onCancel) {
                  onCancel();
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', err.message || 'Unable to schedule event. Please check your network.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysInCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

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
            <Text style={styles.headerTitle}>Create New Event</Text>
            <Text style={styles.headerSubtitle}>Schedule Townhalls, Camps & Hearings</Text>
          </View>
        </View>

        {/* Scrollable Form Content */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.cardHeaderTitle}>Event Details</Text>

            {/* Event Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Event Title <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ward 4 Jan Samwad & Cleanliness Drive"
                placeholderTextColor="#94a3b8"
                value={eventTitle}
                onChangeText={setEventTitle}
              />
            </View>

            {/* 🗓️ Interactive Date & Digital Clock Time Chooser */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Event Date & Time <Text style={styles.requiredStar}>*</Text>
              </Text>

              {/* Combined Date & Time Card */}
              <View style={styles.dateTimeCard}>
                <TouchableOpacity
                  style={styles.dateTimeBlock}
                  activeOpacity={0.7}
                  onPress={() => setShowDatePickerModal(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.dateTimeBlockLabel}>Event Date</Text>
                  </View>
                  <Text style={styles.dateTimeBlockValue}>{getFormattedDateString()}</Text>
                  <Text style={styles.tapToChangeHint}>Tap to choose date ›</Text>
                </TouchableOpacity>

                <View style={styles.dateTimeDivider} />

                <TouchableOpacity
                  style={styles.dateTimeBlock}
                  activeOpacity={0.7}
                  onPress={() => setShowTimePickerModal(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Ionicons name="time-outline" size={14} color="#64748b" />
                    <Text style={styles.dateTimeBlockLabel}>Start Time</Text>
                  </View>
                  <Text style={styles.dateTimeBlockValue}>{getFormattedTimeString()}</Text>
                  <Text style={styles.tapToChangeHint}>Digital clock ›</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Date Chips */}
              <View style={styles.quickDateChipsRow}>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => handleSetQuickDate('TODAY')}
                >
                  <Text style={styles.quickDateChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => handleSetQuickDate('TOMORROW')}
                >
                  <Text style={styles.quickDateChipText}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => handleSetQuickDate('WEEKEND')}
                >
                  <Text style={styles.quickDateChipText}>This Weekend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => handleSetQuickDate('NEXT_WEEK')}
                >
                  <Text style={styles.quickDateChipText}>Next Week</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 📍 Location / Venue with Google Places Autocomplete */}
            <View style={styles.inputGroup}>
              <AddressPlacesAutocomplete
                label="Location / Venue"
                required={true}
                placeholder="e.g. Tilak Smarak Mandir, Kasba Peth, Pune (search places)..."
                value={location}
                onChangeText={setLocation}
                onSelectPlace={(place) => {
                  setLocation(place.display_name);
                }}
              />
            </View>

            {/* Status Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Event Status</Text>
              <View style={styles.statusChipsRow}>
                {['UPCOMING', 'COMPLETED', 'CANCELLED'].map((st) => {
                  const isSelected = status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusChip, isSelected && styles.statusChipActive]}
                      onPress={() => setStatus(st)}
                    >
                      <Text style={[styles.statusChipText, isSelected && styles.statusChipTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 💰 Allocate From Budget & Internal Logic */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Allocate From Budget</Text>
              <Text style={styles.fieldHint}>
                Select the sanction budget head to fund this event's arrangements.
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <TouchableOpacity
                  style={[styles.budgetHeadChip, !selectedBudgetId && styles.budgetHeadChipActive]}
                  onPress={() => {
                    setSelectedBudgetId('');
                    setAllocatedBudgetAmount('');
                  }}
                >
                  <Text style={[styles.budgetHeadChipTitle, !selectedBudgetId && styles.budgetHeadChipTitleActive]}>
                    No Budget Linked
                  </Text>
                  <Text style={[styles.budgetHeadChipSub, !selectedBudgetId && styles.budgetHeadChipSubActive]}>
                    General Funds
                  </Text>
                </TouchableOpacity>

                {budgetsList.map((b) => {
                  const isSelected = String(selectedBudgetId) === String(b.id);
                  const rem = b.remainingAmount !== undefined
                    ? b.remainingAmount
                    : Math.max(0, b.amount - ((b.consumptions || []).reduce((s, c) => s + (c.amount || 0), 0) + (b.events || []).filter(e => e.status !== 'CANCELLED').reduce((s, e) => s + (e.budget || 0), 0)));

                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.budgetHeadChip, isSelected && styles.budgetHeadChipActive]}
                      onPress={() => setSelectedBudgetId(String(b.id))}
                    >
                      <Text style={[styles.budgetHeadChipTitle, isSelected && styles.budgetHeadChipTitleActive]}>
                        #{b.id} {b.allocatedTo}
                      </Text>
                      <Text style={[styles.budgetHeadChipSub, isSelected && styles.budgetHeadChipSubActive]}>
                        Avail: ₹{Number(rem).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* If a budget is selected, show Allocated Amount field with balance validation */}
              {selectedBudgetId ? (
                <View style={styles.budgetAllocationCard}>
                  <View style={styles.budgetBalanceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="wallet-outline" size={16} color="#4f46e5" />
                      <Text style={styles.budgetBalanceLabel}>Available in {selectedBudget?.allocatedTo}:</Text>
                    </View>
                    <Text style={styles.budgetBalanceValue}>
                      ₹{Number(selectedBudgetAvailableBalance || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10, marginBottom: 4 }]}>
                    Allocated Amount for Event (₹) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter amount to allocate (e.g. 25000)"
                    placeholderTextColor="#94a3b8"
                    value={allocatedBudgetAmount}
                    onChangeText={setAllocatedBudgetAmount}
                    keyboardType="numeric"
                  />

                  {(() => {
                    const entered = parseFloat(allocatedBudgetAmount) || 0;
                    const avail = selectedBudgetAvailableBalance !== null ? selectedBudgetAvailableBalance : 0;
                    if (entered > avail) {
                      return (
                        <Text style={styles.budgetWarningText}>
                          ⚠️ Amount exceeds remaining balance of ₹{Number(avail).toLocaleString('en-IN')} by ₹{Number(entered - avail).toLocaleString('en-IN')}
                        </Text>
                      );
                    }
                    if (entered > 0) {
                      return (
                        <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '700', marginTop: 6 }}>
                          ✓ Remaining head balance after event: ₹{Number(avail - entered).toLocaleString('en-IN')}
                        </Text>
                      );
                    }
                    return null;
                  })()}
                </View>
              ) : null}
            </View>

            {/* Description / Agenda */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description & Program Agenda</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe key speakers, target audience, public notice details..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Attach Banner / Circular Media */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Attach Event Banner / Circular</Text>
              <View style={styles.attachButtonsRow}>
                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromCamera}
                >
                  <Ionicons name="camera-outline" size={18} color="#0284c7" />
                  <Text style={styles.attachActionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromGallery}
                >
                  <Ionicons name="images-outline" size={18} color="#7c3aed" />
                  <Text style={styles.attachActionText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickDocument}
                >
                  <Ionicons name="document-text-outline" size={18} color="#ea580c" />
                  <Text style={styles.attachActionText}>Document</Text>
                </TouchableOpacity>
              </View>

              {attachedMedia && (
                <View style={styles.attachedPreviewRow}>
                  {attachedMedia.isImage ? (
                    <Image source={{ uri: attachedMedia.uri }} style={styles.attachedThumb} />
                  ) : (
                    <View style={styles.attachedDocIconBox}>
                      <Ionicons name="document-text" size={20} color="#2563eb" />
                    </View>
                  )}

                  <View style={styles.attachedInfoCol}>
                    <Text style={styles.attachedFileName} numberOfLines={1}>
                      {attachedMedia.name}
                    </Text>
                    <Text style={styles.attachedFileSub}>Ready for upload</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.removeAttachBtn}
                    onPress={() => setAttachedMedia(null)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
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
            disabled={Boolean(isSubmitting)}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          {(() => {
            const entered = parseFloat(allocatedBudgetAmount) || 0;
            const avail = selectedBudgetAvailableBalance !== null ? selectedBudgetAvailableBalance : Infinity;
            const isOver = Boolean(selectedBudgetId && entered > avail);
            const isDisabled = Boolean(isSubmitting || isOver);

            return (
              <TouchableOpacity
                style={[styles.submitBtn, isDisabled && { opacity: 0.5, backgroundColor: isOver ? '#94a3b8' : '#ea580c' }]}
                onPress={handleSubmit}
                activeOpacity={0.8}
                disabled={Boolean(isDisabled)}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isOver ? 'Exceeds Available Budget' : 'Schedule Event'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })()}
        </View>
      </KeyboardAvoidingView>

      {/* 🗓️ 1. Date Picker Modal (With Close Button) */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePickerModal(false)}
        >
          <View style={styles.modalCalendarCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Select Event Date</Text>
                <Text style={styles.modalSub}>
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Selectors */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
              >
                <Text style={styles.monthNavBtnText}>‹ Prev</Text>
              </TouchableOpacity>

              <Text style={styles.currentMonthYearText}>
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Text>

              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
              >
                <Text style={styles.monthNavBtnText}>Next ›</Text>
              </TouchableOpacity>
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {daysArray.map((day) => {
                const isSelected = selectedDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => {
                      setSelectedDay(day);
                      setShowDatePickerModal(false);
                    }}
                  >
                    <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { flex: 1 }]}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={styles.submitBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ⏰ 2. Digital Clock Time Picker Modal (With Close Button & Digital Clock View) */}
      <Modal
        visible={showTimePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTimePickerModal(false)}
        >
          <View style={styles.modalCalendarCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Choose Event Time</Text>
                <Text style={styles.modalSub}>Interactive Digital Clock</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 🕒 Digital Clock Face */}
            <View style={styles.digitalClockFace}>
              <TouchableOpacity
                style={[
                  styles.digitalSegment,
                  clockActiveMode === 'HOUR' && styles.digitalSegmentActive
                ]}
                onPress={() => setClockActiveMode('HOUR')}
              >
                <Text style={[
                  styles.digitalDigit,
                  clockActiveMode === 'HOUR' && styles.digitalDigitActive
                ]}>
                  {selectedHour}
                </Text>
                <Text style={styles.digitalLabel}>Hour</Text>
              </TouchableOpacity>

              <Text style={styles.digitalColon}>:</Text>

              <TouchableOpacity
                style={[
                  styles.digitalSegment,
                  clockActiveMode === 'MINUTE' && styles.digitalSegmentActive
                ]}
                onPress={() => setClockActiveMode('MINUTE')}
              >
                <Text style={[
                  styles.digitalDigit,
                  clockActiveMode === 'MINUTE' && styles.digitalDigitActive
                ]}>
                  {selectedMinute}
                </Text>
                <Text style={styles.digitalLabel}>Minute</Text>
              </TouchableOpacity>

              {/* AM / PM Segmented Toggle */}
              <View style={styles.amPmColumn}>
                <TouchableOpacity
                  style={[
                    styles.amPmBtn,
                    selectedPeriod === 'AM' && styles.amPmBtnActive
                  ]}
                  onPress={() => setSelectedPeriod('AM')}
                >
                  <Text style={[
                    styles.amPmBtnText,
                    selectedPeriod === 'AM' && styles.amPmBtnTextActive
                  ]}>
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.amPmBtn,
                    selectedPeriod === 'PM' && styles.amPmBtnActive
                  ]}
                  onPress={() => setSelectedPeriod('PM')}
                >
                  <Text style={[
                    styles.amPmBtnText,
                    selectedPeriod === 'PM' && styles.amPmBtnTextActive
                  ]}>
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selector Grid depending on Active Mode */}
            {clockActiveMode === 'HOUR' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.timeSectionHeader}>Select Hour (1 - 12):</Text>
                <View style={styles.clockNumbersGrid}>
                  {HOURS.map((hr) => {
                    const isSelected = selectedHour === hr;
                    return (
                      <TouchableOpacity
                        key={hr}
                        style={[styles.clockNumberCell, isSelected && styles.clockNumberCellActive]}
                        onPress={() => {
                          setSelectedHour(hr);
                          setClockActiveMode('MINUTE');
                        }}
                      >
                        <Text style={[styles.clockNumberText, isSelected && styles.clockNumberTextActive]}>
                          {hr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.timeSectionHeader}>Select Minute (00 - 55):</Text>
                <View style={styles.clockNumbersGrid}>
                  {MINUTES.map((min) => {
                    const isSelected = selectedMinute === min;
                    return (
                      <TouchableOpacity
                        key={min}
                        style={[styles.clockNumberCell, isSelected && styles.clockNumberCellActive]}
                        onPress={() => setSelectedMinute(min)}
                      >
                        <Text style={[styles.clockNumberText, isSelected && styles.clockNumberTextActive]}>
                          {min}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Quick Popular Schedule Slots */}
            <Text style={[styles.timeSectionHeader, { marginTop: 14 }]}>Quick Presets:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
              {POPULAR_TIME_PRESETS.map((preset) => {
                const isSelected = `${selectedHour}:${selectedMinute} ${selectedPeriod}` === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.timeSlotChip, isSelected && styles.timeSlotChipActive]}
                    onPress={() => handleSelectPresetTime(preset)}
                  >
                    <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { flex: 1.5 }]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={styles.submitBtnText}>Confirm ({getFormattedTimeString()})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 60
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  fieldHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6
  },
  requiredStar: {
    color: '#ef4444'
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
  textArea: {
    height: 75,
    textAlignVertical: 'top'
  },

  /* 📍 Location Input with Google Location Autocomplete */
  locationInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10
  },
  locationTextInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 8,
    fontSize: 13.5,
    color: '#0f172a'
  },
  locationSuggestionsCard: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden'
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase'
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  suggestionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  suggestionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  suggestionSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1
  },

  dateTimeCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  dateTimeBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4
  },
  dateTimeBlockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  dateTimeBlockValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2
  },
  tapToChangeHint: {
    fontSize: 10.5,
    color: '#f97316',
    fontWeight: '700'
  },
  dateTimeDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  quickDateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  statusChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  statusChipTextActive: {
    color: '#ffffff'
  },
  budgetHeadChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    minWidth: 120
  },
  budgetHeadChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5'
  },
  budgetHeadChipTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  budgetHeadChipTitleActive: {
    color: '#ffffff'
  },
  budgetHeadChipSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  budgetHeadChipSubActive: {
    color: '#e0e7ff',
    fontWeight: '600'
  },
  budgetAllocationCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 12,
    marginTop: 8
  },
  budgetBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  budgetBalanceLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3730a3'
  },
  budgetBalanceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4338ca'
  },
  budgetWarningText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 6
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCalendarCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12
  },
  monthNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  monthNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  currentMonthYearText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start'
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayCellSelected: {
    backgroundColor: '#f97316'
  },
  dayCellText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },
  dayCellTextSelected: {
    color: '#ffffff'
  },

  /* ⏰ Digital Clock Styles */
  digitalClockFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8
  },
  digitalSegment: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70
  },
  digitalSegmentActive: {
    borderColor: '#f97316',
    backgroundColor: '#334155'
  },
  digitalDigit: {
    fontSize: 32,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 2
  },
  digitalDigitActive: {
    color: '#ffffff'
  },
  digitalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase'
  },
  digitalColon: {
    fontSize: 30,
    fontWeight: '900',
    color: '#f97316'
  },
  amPmColumn: {
    gap: 4,
    marginLeft: 4
  },
  amPmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  amPmBtnActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316'
  },
  amPmBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8'
  },
  amPmBtnTextActive: {
    color: '#ffffff'
  },
  clockNumbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6
  },
  clockNumberCell: {
    width: 44,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  clockNumberCellActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  clockNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  clockNumberTextActive: {
    color: '#ffffff'
  },
  timeSectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6
  },
  timeSlotChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6
  },
  timeSlotChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  timeSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  timeSlotTextActive: {
    color: '#ffffff'
  }
});
