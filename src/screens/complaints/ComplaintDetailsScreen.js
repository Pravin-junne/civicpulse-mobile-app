import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Linking,
  ActivityIndicator,
  AppState,
  Platform,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { resolveFileUrl } from '../../services/api';
import { downloadAndShareRemoteFile } from '../../utils/fileExport';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_OPTIONS = [
  { id: 'PENDING', label: 'Open / Pending', dotColor: '#2563eb', bg: '#eff6ff', fg: '#2563eb' },
  { id: 'ASSIGNED', label: 'Assigned', dotColor: '#3b82f6', bg: '#eff6ff', fg: '#1d4ed8' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: '#f59e0b', bg: '#fffbeb', fg: '#d97706' },
  { id: 'ON_HOLD', label: 'On Hold', dotColor: '#8b5cf6', bg: '#f5f3ff', fg: '#7c3aed' },
  { id: 'RESOLVED', label: 'Resolved', dotColor: '#10b981', bg: '#ecfdf5', fg: '#059669' },
  { id: 'CLOSED', label: 'Closed', dotColor: '#64748b', bg: '#f1f5f9', fg: '#334155' },
  { id: 'REJECTED', label: 'Rejected', dotColor: '#ef4444', bg: '#fef2f2', fg: '#dc2626' }
];

const getSafeString = (val, fallback = '') => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.title || val.label || fallback;
  }
  return String(val);
};

const getInitials = (val) => {
  const str = getSafeString(val, '??');
  if (!str || str === '??') return '??';
  const parts = str.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const isImageFile = (filename, url) => {
  const target = (filename || url || '').toLowerCase().split('?')[0];
  return (
    target.endsWith('.jpg') ||
    target.endsWith('.jpeg') ||
    target.endsWith('.png') ||
    target.endsWith('.webp') ||
    target.endsWith('.gif') ||
    target.endsWith('.bmp') ||
    target.endsWith('.heic')
  );
};

// Isolated, memoized Photo Preview Modal to prevent infinite re-renders
const PhotoPreviewModal = React.memo(function PhotoPreviewModal({
  visible,
  photoUrl,
  photoName,
  onClose
}) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (visible && photoUrl) {
      setImageLoading(true);
      setImageError(false);
      setDownloading(false);
    }
  }, [visible, photoUrl]);

  const imageSource = useMemo(() => (photoUrl ? { uri: photoUrl } : null), [photoUrl]);

  const handleDownload = async () => {
    if (!photoUrl || downloading) return;
    setDownloading(true);
    try {
      const cleanName = photoName || `complaint_photo_${Date.now()}.jpg`;
      await downloadAndShareRemoteFile(photoUrl, cleanName);
    } catch (err) {
      Alert.alert('Download Error', 'Could not save or share photo.');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenBrowser = async () => {
    if (!photoUrl) return;
    try {
      await Linking.openURL(photoUrl);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not open image in browser.');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.photoModalOverlay}>
        {/* Header Bar */}
        <View style={styles.photoModalHeader}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.photoModalTitle} numberOfLines={1}>
              {photoName || 'Photo Preview'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={styles.photoHeaderIconBtn}
              activeOpacity={0.7}
              onPress={handleOpenBrowser}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="globe-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoCloseBtn}
              activeOpacity={0.8}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Photo Display with Zoom Support */}
        <View style={styles.photoContainer}>
          {imageLoading && !imageError && (
            <View style={styles.photoLoadingOverlay}>
              <ActivityIndicator size="large" color="#ea580c" />
              <Text style={styles.photoLoadingText}>Loading image...</Text>
            </View>
          )}

          {imageError ? (
            <View style={styles.photoErrorBox}>
              <Ionicons name="alert-circle-outline" size={48} color="#f87171" />
              <Text style={styles.photoErrorTitle}>Unable to load image preview</Text>
              <Text style={styles.photoErrorSub}>Check network connection or try opening in browser</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.photoRetryBtn}
                  onPress={() => {
                    setImageError(false);
                    setImageLoading(true);
                  }}
                >
                  <Ionicons name="reload" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.photoRetryBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBrowserBtn}
                  onPress={handleOpenBrowser}
                >
                  <Ionicons name="open-outline" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.photoRetryBtnText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            imageSource && (
              <ScrollView
                style={{ width: '100%', height: '100%' }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                maximumZoomScale={4}
                minimumZoomScale={1}
                centerContent={true}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={imageSource}
                  style={styles.fullScreenPhoto}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={(e) => {
                    console.log('Image load failed in preview modal:', e.nativeEvent?.error);
                    setImageLoading(false);
                    setImageError(true);
                  }}
                />
              </ScrollView>
            )
          )}
        </View>

        {/* Footer Action Bar */}
        <View style={styles.photoModalFooter}>
          <TouchableOpacity
            style={styles.photoModalActionBtn}
            activeOpacity={0.8}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#ffffff" />
                <Text style={styles.photoModalActionText}>Download to Device 📥</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default function ComplaintDetailsScreen({
  complaintData,
  navigation,
  onBack = () => {},
  onStatusChangeSuccess = () => {}
}) {
  const formatComplaintObject = useCallback((res) => {
    if (!res) return null;
    return {
      id: getSafeString(res.complaintNumber) || (res.id ? `OKT-${res.id}` : 'Complaint'),
      rawId: res.id,
      filingDate: res.createdAt
        ? new Date(res.createdAt).toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
          })
        : '9/19/2026, 5:14:47 PM',
      name: getSafeString(res.citizenName, 'Citizen'),
      mobile: getSafeString(res.mobileNumber || res.mobile, ''),
      location: getSafeString(res.address || res.landmark, 'Pune'),
      landmark: getSafeString(res.landmark, 'Pune Central'),
      ward: getSafeString(res.ward, 'Ward A'),
      area: getSafeString(res.area, 'N/A'),
      subject: getSafeString(res.subject, 'Citizen Grievance Request'),
      description: getSafeString(res.description, 'No detailed description provided.'),
      department: getSafeString(res.department, 'General Administration'),
      departmentId: typeof res.departmentId === 'number' ? res.departmentId : (res.department?.id || null),
      inOfficePerson: getSafeString(res.inOfficePerson, 'Unassigned'),
      inOfficePersonId: typeof res.inOfficePersonId === 'number' ? res.inOfficePersonId : (res.inOfficePerson?.id || null),
      officers: Array.isArray(res.officers) ? res.officers : [],
      officersText: Array.isArray(res.officers) && res.officers.length > 0
        ? res.officers.map(o => getSafeString(o, o.username || 'Officer')).join(', ')
        : (typeof res.assignedOfficer === 'string' ? res.assignedOfficer : (res.assignedOfficer ? getSafeString(res.assignedOfficer) : 'No officers assigned')),
      priority: typeof res.priority === 'string' ? res.priority.toUpperCase() : 'MEDIUM',
      priorityType: (typeof res.priority === 'string' ? res.priority : 'medium').toLowerCase(),
      status: typeof res.status === 'string' ? res.status.toUpperCase() : 'IN_PROGRESS',
      latitude: res.latitude,
      longitude: res.longitude,
      attachments: Array.isArray(res.attachments) ? res.attachments : [],
      history: Array.isArray(res.history) ? res.history : []
    };
  }, []);

  const [complaint, setComplaint] = useState(() => (complaintData ? formatComplaintObject(complaintData) : null));
  const [loading, setLoading] = useState(!complaintData);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Status update state (Matching Web "Update Grievance Status" card)
  const [selectedStatusStep, setSelectedStatusStep] = useState(() => {
    const initStatus = complaintData?.status;
    return typeof initStatus === 'string' ? initStatus : 'IN_PROGRESS';
  });
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState([]);

  // Routing & Assignment Edit state (Matching Web "Routing & Assignments" card)
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [deptsList, setDeptsList] = useState([]);
  const [officersList, setOfficersList] = useState([]);
  const [inOfficeList, setInOfficeList] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedInOfficeId, setSelectedInOfficeId] = useState(null);
  const [selectedOfficerIds, setSelectedOfficerIds] = useState([]);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isInOfficeDropdownOpen, setIsInOfficeDropdownOpen] = useState(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState('');


  // Full Screen Image Preview Modal & Document Actions
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [previewPhotoName, setPreviewPhotoName] = useState('');
  const [openingDocId, setOpeningDocId] = useState(null);

  const handleOpenDocument = async (doc, idx) => {
    const rawUrl = doc.url || doc.uri;
    if (!rawUrl) {
      Alert.alert('File Unavailable', 'Attachment link is missing or broken.');
      return;
    }
    const resolvedUri = resolveFileUrl(rawUrl);

    // If it's an image file, view immediately in full screen preview modal
    if (isImageFile(doc.filename, rawUrl)) {
      setPreviewPhotoName(doc.filename || `Photo-${idx + 1}`);
      setPreviewPhotoUrl(resolvedUri);
      return;
    }

    // For PDFs, DOCs, and other files, download & open / share
    const filename = doc.filename || `Document-${idx + 1}.pdf`;
    setOpeningDocId(idx);
    try {
      await downloadAndShareRemoteFile(resolvedUri, filename);
    } catch (err) {
      console.log('Direct document download fallback:', err.message);
      try {
        await Linking.openURL(resolvedUri);
      } catch (linkErr) {
        Alert.alert('Error', `Could not open document: ${linkErr.message || 'Please check network connection.'}`);
      }
    } finally {
      setOpeningDocId(null);
    }
  };

  // Activity logs / timeline
  const [activityLogs, setActivityLogs] = useState([]);

  const fetchComplaintDetails = useCallback(async (isSilent = false) => {
    const targetId = complaintData?.rawId || complaintData?.id || complaint?.rawId || complaint?.id;
    if (!targetId) return;

    try {
      if (!isSilent) setLoading(true);
      const res = await api.get(`/complaints/${targetId}`);
      if (res) {
        const formatted = formatComplaintObject(res);
        setComplaint(formatted);
        setSelectedStatusStep(formatted.status);
        setSelectedDeptId(formatted.departmentId);
        setSelectedInOfficeId(formatted.inOfficePersonId);
        setSelectedOfficerIds(formatted.officers ? formatted.officers.map(o => o.id) : []);

        if (Array.isArray(res.history) && res.history.length > 0) {
          setActivityLogs(res.history.map(h => ({
            id: `log-${h.id}`,
            author: h.performedBy?.name || h.performedBy?.username || 'System Administrator',
            time: h.createdAt
              ? new Date(h.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Recent',
            text: h.remarks || `Status transitioned to ${h.status}`
          })));
        } else {
          setActivityLogs([]);
        }
      }
    } catch (err) {
      console.log('Complaint details fetch error:', err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [complaintData, complaint?.rawId, complaint?.id, formatComplaintObject]);

  useEffect(() => {
    fetchComplaintDetails(false);

    // Load lookups for Assignment Editor
    const loadLookups = async () => {
      try {
        const [deptsRes, officersRes, inOfficeRes] = await Promise.all([
          api.get('/departments').catch(() => null),
          api.get('/users?role=OFFICER').catch(() => null),
          api.get('/users?role=IN_OFFICE_PERSON').catch(() => null)
        ]);
        if (deptsRes) setDeptsList(Array.isArray(deptsRes) ? deptsRes : (deptsRes?.departments || []));
        if (officersRes) setOfficersList(Array.isArray(officersRes) ? officersRes : (officersRes?.users || []));
        if (inOfficeRes) setInOfficeList(Array.isArray(inOfficeRes) ? inOfficeRes : (inOfficeRes?.users || []));
      } catch (e) {
        console.log('Assignment lookups error:', e.message);
      }
    };
    loadLookups();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchComplaintDetails(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchComplaintDetails]);

  const activeComplaint = complaint || formatComplaintObject(complaintData) || {
    id: 'GR-2026-015',
    rawId: 15,
    filingDate: '9/19/2026, 5:14:47 PM',
    name: 'Pravin',
    mobile: '8767079685',
    location: 'Ward A',
    landmark: 'Ward A Central',
    ward: 'Ward A',
    area: 'N/A',
    subject: 'Demo Issue - Ward A',
    description: 'Citizen grievance logged via mobile desk.',
    department: 'Demo',
    inOfficePerson: 'Unassigned',
    officersText: 'No officers assigned',
    priority: 'MEDIUM',
    priorityType: 'medium',
    status: 'IN_PROGRESS',
    attachments: [],
    history: []
  };

  // Work completion photos handlers
  const handlePickCompletionPhotosFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library access is required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems = result.assets.map((a, idx) => ({
          uri: a.uri,
          name: a.fileName || a.uri.split('/').pop() || `work_proof_${Date.now()}_${idx}.jpg`,
          type: a.mimeType || 'image/jpeg'
        }));
        setCompletionPhotos(prev => [...prev, ...newItems]);
      }
    } catch (err) {
      console.log('Error picking gallery photos:', err);
      Alert.alert('Selection Error', 'Could not access photo library.');
    }
  };

  const handleTakeCompletionPhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const a = result.assets[0];
        const newPhoto = {
          uri: a.uri,
          name: a.fileName || a.uri.split('/').pop() || `work_proof_cam_${Date.now()}.jpg`,
          type: a.mimeType || 'image/jpeg'
        };
        setCompletionPhotos(prev => [...prev, newPhoto]);
      }
    } catch (err) {
      console.log('Error taking camera photo:', err);
      Alert.alert('Camera Error', 'Could not open device camera.');
    }
  };

  const handleRemoveCompletionPhoto = (indexToRemove) => {
    setCompletionPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Status Update (Matching Web Submit Status Update action)
  const handleSubmitStatusUpdate = async () => {
    if (!selectedStatusStep) return;

    setSubmittingStatus(true);
    try {
      const targetId = activeComplaint.rawId || activeComplaint.id;
      const statusNormalized = selectedStatusStep.toUpperCase().replace(/\s+/g, '_');
      const remarksText = statusRemarks.trim() || `Status updated to ${selectedStatusStep} via mobile portal.`;

      if (completionPhotos.length > 0) {
        const formData = new FormData();
        formData.append('status', statusNormalized);
        formData.append('remarks', remarksText);

        completionPhotos.forEach((photo, idx) => {
          let fileUri = photo.uri;
          if (Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
            fileUri = `file://${fileUri}`;
          }
          formData.append('completionPhotos', {
            uri: fileUri,
            name: photo.name || `completion_${Date.now()}_${idx}.jpg`,
            type: photo.type || 'image/jpeg'
          });
        });

        await api.patch(`/complaints/${targetId}/status`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.patch(`/complaints/${targetId}/status`, {
          status: statusNormalized,
          remarks: remarksText
        });
      }

      setStatusRemarks('');
      setCompletionPhotos([]);
      fetchComplaintDetails();
      Alert.alert('✅ Status Updated', `Grievance status has been updated to ${selectedStatusStep}.`);
      if (onStatusChangeSuccess) onStatusChangeSuccess(selectedStatusStep);
    } catch (err) {
      console.log('Status update error:', err.message);
      Alert.alert('Update Failed', err.message || 'Could not update status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Routing memoized lookups
  const selectedDeptObj = useMemo(() => {
    return deptsList.find(d => String(d.id) === String(selectedDeptId));
  }, [deptsList, selectedDeptId]);

  const selectedInOfficeObj = useMemo(() => {
    return inOfficeList.find(u => String(u.id) === String(selectedInOfficeId));
  }, [inOfficeList, selectedInOfficeId]);

  const filteredDeptsList = useMemo(() => {
    if (!deptSearchQuery.trim()) return deptsList;
    return deptsList.filter(d => (d.name || '').toLowerCase().includes(deptSearchQuery.toLowerCase()));
  }, [deptsList, deptSearchQuery]);

  const filteredOfficers = useMemo(() => {
    if (!selectedDeptId) return [];
    const dId = parseInt(selectedDeptId);
    return officersList.filter(o => 
      o.departmentId === dId || 
      (Array.isArray(o.departments) && o.departments.some(d => d.id === dId))
    );
  }, [selectedDeptId, officersList]);

  const filteredInOffice = useMemo(() => {
    if (!selectedDeptId) return inOfficeList;
    const dId = parseInt(selectedDeptId);
    const matched = inOfficeList.filter(u => 
      u.departmentId === dId || 
      (Array.isArray(u.departments) && u.departments.some(d => d.id === dId))
    );
    return matched.length > 0 ? matched : inOfficeList;
  }, [selectedDeptId, inOfficeList]);

  const handleSelectDepartment = (deptId) => {
    setSelectedDeptId(deptId);
    setIsDeptDropdownOpen(false);
    if (deptId) {
      const dId = parseInt(deptId);
      const newOfficers = officersList.filter(o => 
        o.departmentId === dId || 
        (Array.isArray(o.departments) && o.departments.some(d => d.id === dId))
      );
      const newOfficerIds = new Set(newOfficers.map(o => o.id));
      setSelectedOfficerIds(prev => prev.filter(id => newOfficerIds.has(id)));
    } else {
      setSelectedOfficerIds([]);
      setSelectedInOfficeId(null);
    }
  };

  // Save Assignment Updates (Matching Web Routing & Assignments Edit)
  const handleSaveAssignment = async () => {
    setSavingAssignment(true);
    try {
      const targetId = activeComplaint.rawId || activeComplaint.id;
      await api.put(`/complaints/${targetId}`, {
        departmentId: selectedDeptId ? parseInt(selectedDeptId) : null,
        inOfficePersonId: selectedInOfficeId ? parseInt(selectedInOfficeId) : null,
        officerIds: selectedOfficerIds
      });

      setIsEditingAssignment(false);
      await fetchComplaintDetails(true);
      Alert.alert('Assignments Saved', 'Grievance routing and officer assignments updated successfully.');
    } catch (err) {
      console.log('Assignment save error:', err.message);
      Alert.alert('Save Failed', err.message || 'Could not update assignment details.');
    } finally {
      setSavingAssignment(false);
    }
  };


  // Navigate on Google Maps
  const handleOpenGoogleMaps = () => {
    const lat = activeComplaint.latitude;
    const lng = activeComplaint.longitude;
    const query = encodeURIComponent(`${activeComplaint.landmark || activeComplaint.location || ''} ${activeComplaint.ward || ''} Pune`);
    let mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    Linking.openURL(mapUrl).catch(() => {
      Alert.alert('Maps Navigation', `Navigating to: ${activeComplaint.landmark || activeComplaint.location}`);
    });
  };

  // Priority Dot & Badge styling
  const getPriorityInfo = (pri) => {
    const p = (pri || 'MEDIUM').toUpperCase();
    switch (p) {
      case 'CRITICAL': return { dot: '#ef4444', text: 'CRITICAL', color: '#ef4444' };
      case 'HIGH': return { dot: '#f59e0b', text: 'HIGH', color: '#d97706' };
      case 'MEDIUM': return { dot: '#3b82f6', text: 'MEDIUM', color: '#2563eb' };
      case 'LOW': return { dot: '#10b981', text: 'LOW', color: '#059669' };
      default: return { dot: '#64748b', text: p, color: '#475569' };
    }
  };

  // Status Badge styling
  const getStatusBadge = (st) => {
    const s = (st || 'PENDING').toUpperCase().replace(/\s+/g, '_');
    switch (s) {
      case 'RESOLVED':
      case 'CLOSED':
        return { bg: '#ecfdf5', fg: '#059669', border: '#a7f3d0', label: 'RESOLVED' };
      case 'IN_PROGRESS':
        return { bg: '#f5f3ff', fg: '#7c3aed', border: '#ddd6fe', label: 'IN PROGRESS' };
      case 'ON_HOLD':
        return { bg: '#fffbeb', fg: '#d97706', border: '#fde68a', label: 'ON HOLD' };
      case 'REJECTED':
        return { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca', label: 'REJECTED' };
      default:
        return { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe', label: 'OPEN' };
    }
  };

  const priorityInfo = getPriorityInfo(activeComplaint.priority);
  const statusBadge = getStatusBadge(activeComplaint.status);
  const currentStepOption = STATUS_OPTIONS.find(o => o.id === selectedStatusStep.toUpperCase().replace(/\s+/g, '_')) || STATUS_OPTIONS[2];

  if (loading && !complaint) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#0f172a" style={{ marginRight: 6 }} />
            <Text style={styles.backText}>Grievance Directory</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Loading grievance details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" style={{ marginRight: 6 }} />
          <Text style={styles.backText}>Grievance Directory</Text>
        </TouchableOpacity>

        <View style={styles.complaintIdHeaderBadge}>
          <Text style={styles.complaintIdHeaderText}>{activeComplaint.id}</Text>
        </View>
      </View>

      {/* 2. Scrollable Body Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* CARD 1: GRIEVANCE INFORMATION (Matching Web Screenshot)  */}
        {/* ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Grievance Information</Text>
            <View style={[styles.topStatusPill, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border }]}>
              <Text style={[styles.topStatusPillText, { color: statusBadge.fg }]}>
                {statusBadge.label}
              </Text>
            </View>
          </View>

          {/* Grid of Key-Value Fields */}
          <View style={styles.infoGrid}>
            {/* Row 1: Citizen Name & Mobile Number */}
            <View style={styles.infoGridRow}>
              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>CITIZEN NAME</Text>
                <Text style={styles.fieldValueBold}>{getSafeString(activeComplaint.name, 'Citizen')}</Text>
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.fieldValueBold}>{getSafeString(activeComplaint.mobile, 'N/A')}</Text>
                  {activeComplaint.mobile ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${activeComplaint.mobile}`)}
                      style={styles.inlineCallBtn}
                    >
                      <Ionicons name="call" size={12} color="#059669" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Row 2: Ward/Area & Landmark */}
            <View style={styles.infoGridRow}>
              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>WARD / AREA</Text>
                <Text style={styles.fieldValue}>{getSafeString(activeComplaint.ward, 'Ward A')} / {getSafeString(activeComplaint.area, 'N/A')}</Text>
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>LANDMARK</Text>
                <Text style={styles.fieldValue}>{getSafeString(activeComplaint.landmark, 'N/A')}</Text>
              </View>
            </View>

            {/* Row 3: Priority & Filing Date */}
            <View style={styles.infoGridRow}>
              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>PRIORITY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <View style={[styles.statusDotSmall, { backgroundColor: priorityInfo.dot }]} />
                  <Text style={[styles.priorityValueText, { color: priorityInfo.color }]}>
                    {priorityInfo.text}
                  </Text>
                </View>
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>FILING DATE</Text>
                <Text style={styles.fieldValue}>{getSafeString(activeComplaint.filingDate)}</Text>
              </View>
            </View>
          </View>

          {/* Subject */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>SUBJECT</Text>
            <Text style={styles.subjectText}>{getSafeString(activeComplaint.subject, 'Citizen Grievance Request')}</Text>
          </View>

          {/* Description */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <Text style={styles.descriptionText}>{getSafeString(activeComplaint.description, 'No description provided.')}</Text>
          </View>

          {/* Grievance Spot Address Container */}
          <View style={styles.spotAddressContainer}>
            <Text style={styles.spotAddressLabel}>GRIEVANCE SPOT ADDRESS</Text>
            <View style={styles.spotAddressRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                <Ionicons name="location-sharp" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.spotAddressText} numberOfLines={2}>
                  {getSafeString(activeComplaint.location) || getSafeString(activeComplaint.landmark) || 'Pune'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.navMapsBtn}
                activeOpacity={0.8}
                onPress={handleOpenGoogleMaps}
              >
                <Ionicons name="compass-outline" size={15} color="#d97706" style={{ marginRight: 4 }} />
                <Text style={styles.navMapsBtnText}>Navigate on Google Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* CARD 2: UPLOADED PHOTOS & DOCUMENTS (Matching Web UI)    */}
        {/* ======================================================== */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Uploaded photos & documents</Text>

          {/* Complaint Photos */}
          <View style={styles.uploadSectionBlock}>
            <Text style={styles.uploadSubHeading}>COMPLAINT PHOTOS</Text>
            {activeComplaint.attachments && activeComplaint.attachments.filter(a => a.type === 'COMPLAINT_PHOTO' || a.type === 'PHOTO' || (!a.type && isImageFile(a.filename, a.url))).length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
                {activeComplaint.attachments
                  .filter(a => a.type === 'COMPLAINT_PHOTO' || a.type === 'PHOTO' || (!a.type && isImageFile(a.filename, a.url)))
                  .map((photo, idx) => {
                    const resolvedUri = resolveFileUrl(photo.url);
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        onPress={() => {
                          setPreviewPhotoName(photo.filename || `Complaint-Photo-${idx + 1}`);
                          setPreviewPhotoUrl(resolvedUri);
                        }}
                        style={styles.photoThumbWrap}
                      >
                        <Image 
                          source={{ uri: resolvedUri }} 
                          style={styles.photoThumb} 
                          resizeMode="cover"
                        />
                        <View style={styles.photoZoomBadge}>
                          <Ionicons name="expand" size={11} color="#ffffff" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            ) : (
              <Text style={styles.noUploadsText}>No photos uploaded for this grievance.</Text>
            )}
          </View>

          {/* Support Documents */}
          <View style={[styles.uploadSectionBlock, { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }]}>
            <Text style={styles.uploadSubHeading}>SUPPORT DOCUMENTS</Text>
            {activeComplaint.attachments && activeComplaint.attachments.filter(a => a.type === 'COMPLAINT_DOCUMENT' || a.type === 'DOC' || a.type === 'DOCUMENT' || (!a.type && !isImageFile(a.filename, a.url))).length > 0 ? (
              <View style={{ gap: 8 }}>
                {activeComplaint.attachments
                  .filter(a => a.type === 'COMPLAINT_DOCUMENT' || a.type === 'DOC' || a.type === 'DOCUMENT' || (!a.type && !isImageFile(a.filename, a.url)))
                  .map((doc, idx) => {
                    const isImg = isImageFile(doc.filename, doc.url);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.docItemRow}
                        activeOpacity={0.7}
                        onPress={() => handleOpenDocument(doc, idx)}
                        disabled={openingDocId === idx}
                      >
                        <Ionicons 
                          name={isImg ? "image-outline" : "document-text-outline"} 
                          size={18} 
                          color="#ea580c" 
                          style={{ marginRight: 8 }} 
                        />
                        <Text style={styles.docItemName} numberOfLines={1}>
                          {doc.filename || `Document-${idx + 1}`}
                        </Text>
                        <View style={styles.docActionBadge}>
                          {openingDocId === idx ? (
                            <ActivityIndicator size="small" color="#ea580c" />
                          ) : (
                            <>
                              <Ionicons 
                                name={isImg ? "eye-outline" : "download-outline"} 
                                size={14} 
                                color="#475569" 
                                style={{ marginRight: 4 }} 
                              />
                              <Text style={styles.docActionText}>{isImg ? 'View' : 'Download 📥'}</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ) : (
              <Text style={styles.noUploadsText}>No documents uploaded.</Text>
            )}
          </View>

          {/* Resolution Work Photos (Matching Web UI) */}
          {(activeComplaint.status === 'RESOLVED' || activeComplaint.status === 'CLOSED' || (activeComplaint.attachments && activeComplaint.attachments.some(a => a.type === 'COMPLETION_PHOTO'))) && (
            <View style={[styles.uploadSectionBlock, { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.uploadSubHeading, { color: '#059669', marginBottom: 0 }]}>WORK COMPLETION PHOTOS</Text>
                <View style={styles.resolutionBadgeWrap}>
                  <Text style={styles.resolutionBadgeText}>Resolution Proof</Text>
                </View>
              </View>
              {activeComplaint.attachments && activeComplaint.attachments.filter(a => a.type === 'COMPLETION_PHOTO').length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
                  {activeComplaint.attachments
                    .filter(a => a.type === 'COMPLETION_PHOTO')
                    .map((photo, idx) => {
                      const resolvedUri = resolveFileUrl(photo.url);
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.8}
                          onPress={() => {
                            setPreviewPhotoName(photo.filename || `Resolution-Proof-${idx + 1}`);
                            setPreviewPhotoUrl(resolvedUri);
                          }}
                          style={[styles.photoThumbWrap, { borderColor: '#10b981' }]}
                        >
                          <Image source={{ uri: resolvedUri }} style={styles.photoThumb} />
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              ) : (
                <Text style={styles.noUploadsText}>No work completion photos attached.</Text>
              )}
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* CARD 3: ROUTING & ASSIGNMENTS (Executive Web-Style UI)   */}
        {/* ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="business" size={16} color="#4f46e5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Routing & Assignments</Text>
                <Text style={styles.cardHeaderSubtitle}>Administrative jurisdiction & personnel allocation</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editAssignmentBtn}
              activeOpacity={0.7}
              onPress={() => {
                setIsEditingAssignment(true);
                setIsDeptDropdownOpen(false);
                setIsInOfficeDropdownOpen(false);
                setDeptSearchQuery('');
              }}
            >
              <Ionicons name="create-outline" size={14} color="#4f46e5" style={{ marginRight: 4 }} />
              <Text style={styles.editAssignmentBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.routingContainer}>
            {/* 1. Department */}
            <View style={styles.routingRow}>
              <View style={styles.routingIconCol}>
                <View style={[styles.miniIconCircle, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="business-outline" size={14} color="#4338ca" />
                </View>
              </View>
              <View style={styles.routingInfoCol}>
                <Text style={styles.routingFieldTitle}>CONCERNED DEPARTMENT</Text>
                <View style={styles.deptBadgePill}>
                  <Ionicons name="shield-outline" size={12} color="#4338ca" style={{ marginRight: 5 }} />
                  <Text style={styles.deptBadgePillText}>
                    {getSafeString(activeComplaint.department, 'General Administration')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.routingDivider} />

            {/* 2. In-Office Desk Person */}
            <View style={styles.routingRow}>
              <View style={styles.routingIconCol}>
                <View style={[styles.miniIconCircle, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="person-outline" size={14} color="#15803d" />
                </View>
              </View>
              <View style={styles.routingInfoCol}>
                <Text style={styles.routingFieldTitle}>IN-OFFICE COORDINATOR</Text>
                {activeComplaint.inOfficePerson && activeComplaint.inOfficePerson !== 'Unassigned' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={styles.avatarMiniCircle}>
                      <Text style={styles.avatarMiniText}>{getInitials(activeComplaint.inOfficePerson)}</Text>
                    </View>
                    <Text style={styles.routingValueName}>{activeComplaint.inOfficePerson}</Text>
                    <View style={styles.deskStaffBadge}>
                      <Text style={styles.deskStaffBadgeText}>Desk Staff</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.routingUnassignedText}>Unassigned</Text>
                )}
              </View>
            </View>

            <View style={styles.routingDivider} />

            {/* 3. Concerned Field Officers */}
            <View style={styles.routingRow}>
              <View style={styles.routingIconCol}>
                <View style={[styles.miniIconCircle, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#b45309" />
                </View>
              </View>
              <View style={styles.routingInfoCol}>
                <Text style={styles.routingFieldTitle}>CONCERNED FIELD OFFICER(S)</Text>
                {Array.isArray(activeComplaint.officers) && activeComplaint.officers.length > 0 ? (
                  <View style={styles.officerPillsWrap}>
                    {activeComplaint.officers.map((off, idx) => {
                      const offName = typeof off === 'string' ? off : (off.name || off.username || `Officer #${idx + 1}`);
                      return (
                        <View key={idx} style={styles.officerPill}>
                          <View style={styles.officerPillAvatar}>
                            <Text style={styles.officerPillAvatarText}>{getInitials(offName)}</Text>
                          </View>
                          <Text style={styles.officerPillName}>{offName}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : activeComplaint.officersText && activeComplaint.officersText !== 'No officers assigned' ? (
                  <Text style={styles.routingValueName}>{activeComplaint.officersText}</Text>
                ) : (
                  <Text style={styles.routingUnassignedText}>No field officers assigned</Text>
                )}
              </View>
            </View>
          </View>
        </View>


        {/* ======================================================== */}
        {/* CARD 4: UPDATE GRIEVANCE STATUS (Matching Web UI)        */}
        {/* ======================================================== */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Update Grievance Status</Text>

          {/* Next Status Step Picker */}
          <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>Next Status Step</Text>
          <TouchableOpacity
            style={styles.statusSelectBox}
            activeOpacity={0.7}
            onPress={() => setStatusDropdownOpen(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.statusDotSmall, { backgroundColor: currentStepOption.dotColor }]} />
              <Text style={[styles.statusSelectBoxText, { color: currentStepOption.fg }]}>
                {currentStepOption.label}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          {/* Remarks / Notes Textarea */}
          <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 6 }]}>Remarks / Notes</Text>
          <TextInput
            style={styles.remarksTextarea}
            placeholder="Enter details of action taken..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            value={statusRemarks}
            onChangeText={setStatusRemarks}
          />

          {/* Work Completion Photos (Optional) */}
          <View style={styles.completionPhotosBlock}>
            <View style={styles.completionPhotosHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="camera" size={15} color="#059669" />
                <Text style={styles.fieldLabelNoMargin}>WORK COMPLETION PHOTOS</Text>
              </View>
              <View style={styles.optionalBadgePill}>
                <Text style={styles.optionalBadgeText}>Optional</Text>
              </View>
            </View>

            <Text style={styles.completionPhotosHelpText}>
              Attach on-site repair or resolution proof photos (Max 5 images)
            </Text>

            {/* Selected Photos Preview Scroll */}
            {completionPhotos.length > 0 && (
              <View style={styles.completionPhotosPreviewWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.completionPhotosScroll}>
                  {completionPhotos.map((photo, idx) => (
                    <View key={idx} style={styles.completionPhotoItemWrap}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setPreviewPhotoName(`Work-Completion-Photo-${idx + 1}`);
                          setPreviewPhotoUrl(photo.uri);
                        }}
                      >
                        <Image source={{ uri: photo.uri }} style={styles.completionPhotoThumb} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removePhotoBadge}
                        activeOpacity={0.7}
                        onPress={() => handleRemoveCompletionPhoto(idx)}
                      >
                        <Ionicons name="close" size={12} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Action Buttons: Camera & Media Library */}
            <View style={styles.photoActionButtonsRow}>
              <TouchableOpacity
                style={styles.photoActionBtn}
                activeOpacity={0.7}
                onPress={handleTakeCompletionPhotoWithCamera}
              >
                <Ionicons name="camera-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.photoActionBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoActionBtn}
                activeOpacity={0.7}
                onPress={handlePickCompletionPhotosFromGallery}
              >
                <Ionicons name="images-outline" size={16} color="#4f46e5" style={{ marginRight: 6 }} />
                <Text style={styles.photoActionBtnText}>Choose Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Status Update Button */}
          <TouchableOpacity
            style={styles.submitStatusBtn}
            activeOpacity={0.8}
            onPress={handleSubmitStatusUpdate}
            disabled={submittingStatus}
          >
            {submittingStatus ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitStatusBtnText}>Submit Status Update</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* CARD 5: STATUS TIMELINE & REMARKS (Matching Web UI)      */}
        {/* ======================================================== */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Status Timeline & Remarks</Text>

          <View style={styles.timelineList}>
            {activityLogs.length > 0 ? (
              activityLogs.map((log, idx) => (
                <View key={log.id || idx} style={styles.timelineItem}>
                  <View style={styles.timelineDotCol}>
                    <View style={styles.timelineDot} />
                    {idx < activityLogs.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineAuthor}>{log.author}</Text>
                      <Text style={styles.timelineTime}>{log.time}</Text>
                    </View>
                    <Text style={styles.timelineText}>{log.text}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>No timeline remarks logged yet.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 3. Status Selection Modal */}
      <Modal
        visible={statusDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusDropdownOpen(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Next Status</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatusStep === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.statusOptRow,
                      { backgroundColor: opt.bg, borderColor: isSelected ? opt.fg : '#e2e8f0' }
                    ]}
                    onPress={() => {
                      setSelectedStatusStep(opt.id);
                      setStatusDropdownOpen(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.statusDotSmall, { backgroundColor: opt.dotColor }]} />
                      <Text style={[styles.statusOptText, { color: opt.fg }]}>{opt.label}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={opt.fg} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* 4. Professional Routing & Assignments Edit Modal         */}
      {/* ======================================================== */}
      <Modal
        visible={isEditingAssignment}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingAssignment(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsEditingAssignment(false)}
          />

          <View style={styles.assignmentSheetContainer}>
            {/* Grab Handle */}
            <View style={styles.sheetGrabHandle} />

            {/* Header */}
            <View style={styles.assignmentModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="git-network-outline" size={20} color="#4f46e5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignmentModalTitle}>Routing & Assignments</Text>
                  <Text style={styles.assignmentModalSubtitle}>Assign department, desk staff & field officers</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.closeRoundBtn}
                onPress={() => setIsEditingAssignment(false)}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.assignmentModalScroll} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* 1. Department Selection */}
              <View style={styles.formSectionBox}>
                <View style={styles.formSectionHeader}>
                  <Text style={styles.formSectionLabel}>CONCERNED DEPARTMENT</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>

                <TouchableOpacity
                  style={[styles.customSelectBox, isDeptDropdownOpen && styles.customSelectBoxActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsDeptDropdownOpen(!isDeptDropdownOpen);
                    setIsInOfficeDropdownOpen(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={[styles.selectorIconWrap, { backgroundColor: '#eef2ff' }]}>
                      <Ionicons name="business" size={16} color="#4f46e5" />
                    </View>
                    <Text style={[styles.selectorValueText, !selectedDeptId && styles.selectorPlaceholderText]}>
                      {selectedDeptObj ? selectedDeptObj.name : '-- Select Department --'}
                    </Text>
                  </View>
                  <Ionicons 
                    name={isDeptDropdownOpen ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color="#64748b" 
                  />
                </TouchableOpacity>

                {isDeptDropdownOpen && (
                  <View style={styles.dropdownExpandCard}>
                    {deptsList.length > 4 && (
                      <View style={styles.dropdownSearchWrap}>
                        <Ionicons name="search" size={14} color="#94a3b8" />
                        <TextInput
                          style={styles.dropdownSearchInput}
                          placeholder="Search departments..."
                          placeholderTextColor="#94a3b8"
                          value={deptSearchQuery}
                          onChangeText={setDeptSearchQuery}
                        />
                        {deptSearchQuery ? (
                          <TouchableOpacity onPress={() => setDeptSearchQuery('')}>
                            <Ionicons name="close-circle" size={14} color="#94a3b8" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      <TouchableOpacity
                        style={[styles.dropdownOptionItem, !selectedDeptId && styles.dropdownOptionItemActive]}
                        onPress={() => handleSelectDepartment(null)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="remove-circle-outline" size={16} color="#64748b" />
                          <Text style={[styles.dropdownOptionText, !selectedDeptId && styles.dropdownOptionTextActive]}>
                            -- Unassigned --
                          </Text>
                        </View>
                        {!selectedDeptId && <Ionicons name="checkmark-circle" size={16} color="#4f46e5" />}
                      </TouchableOpacity>

                      {filteredDeptsList.map((d) => {
                        const isSelected = String(selectedDeptId) === String(d.id);
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.dropdownOptionItem, isSelected && styles.dropdownOptionItemActive]}
                            onPress={() => handleSelectDepartment(d.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <Ionicons name="business-outline" size={16} color={isSelected ? "#4f46e5" : "#64748b"} />
                              <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextActive]}>
                                {d.name}
                              </Text>
                            </View>
                            {isSelected && <Ionicons name="checkmark-circle" size={16} color="#4f46e5" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 2. In-Office Desk Person */}
              <View style={[styles.formSectionBox, { marginTop: 14 }]}>
                <View style={styles.formSectionHeader}>
                  <Text style={styles.formSectionLabel}>IN-OFFICE DESK COORDINATOR</Text>
                  <Text style={styles.optionalTag}>(Optional)</Text>
                </View>

                {!selectedDeptId ? (
                  <View style={styles.disabledPromptBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
                    <Text style={styles.disabledPromptText}>Select a department first to assign desk staff.</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.customSelectBox, isInOfficeDropdownOpen && styles.customSelectBoxActive]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setIsInOfficeDropdownOpen(!isInOfficeDropdownOpen);
                        setIsDeptDropdownOpen(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.selectorIconWrap, { backgroundColor: '#f0fdf4' }]}>
                          <Ionicons name="person" size={16} color="#16a34a" />
                        </View>
                        <Text style={[styles.selectorValueText, !selectedInOfficeId && styles.selectorPlaceholderText]}>
                          {selectedInOfficeObj ? (selectedInOfficeObj.name || selectedInOfficeObj.username) : '-- Unassigned --'}
                        </Text>
                      </View>
                      <Ionicons 
                        name={isInOfficeDropdownOpen ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color="#64748b" 
                      />
                    </TouchableOpacity>

                    {isInOfficeDropdownOpen && (
                      <View style={styles.dropdownExpandCard}>
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          <TouchableOpacity
                            style={[styles.dropdownOptionItem, !selectedInOfficeId && styles.dropdownOptionItemActive]}
                            onPress={() => {
                              setSelectedInOfficeId(null);
                              setIsInOfficeDropdownOpen(false);
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="remove-circle-outline" size={16} color="#64748b" />
                              <Text style={[styles.dropdownOptionText, !selectedInOfficeId && styles.dropdownOptionTextActive]}>
                                -- Unassigned --
                              </Text>
                            </View>
                            {!selectedInOfficeId && <Ionicons name="checkmark-circle" size={16} color="#16a34a" />}
                          </TouchableOpacity>

                          {filteredInOffice.map((u) => {
                            const isSelected = String(selectedInOfficeId) === String(u.id);
                            return (
                              <TouchableOpacity
                                key={u.id}
                                style={[styles.dropdownOptionItem, isSelected && styles.dropdownOptionItemActive]}
                                onPress={() => {
                                  setSelectedInOfficeId(u.id);
                                  setIsInOfficeDropdownOpen(false);
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <View style={styles.avatarMiniCircle}>
                                    <Text style={styles.avatarMiniText}>{getInitials(u.name || u.username)}</Text>
                                  </View>
                                  <View>
                                    <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextActive]}>
                                      {u.name || u.username}
                                    </Text>
                                    <Text style={styles.dropdownOptionSubText}>Desk Staff</Text>
                                  </View>
                                </View>
                                {isSelected && <Ionicons name="checkmark-circle" size={16} color="#16a34a" />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* 3. Concerned Field Officers Multi-Select */}
              <View style={[styles.formSectionBox, { marginTop: 14 }]}>
                <View style={styles.formSectionHeader}>
                  <Text style={styles.formSectionLabel}>CONCERNED FIELD OFFICER(S)</Text>
                  {filteredOfficers.length > 0 && (
                    <View style={styles.counterBadge}>
                      <Text style={styles.counterBadgeText}>{selectedOfficerIds.length} Selected</Text>
                    </View>
                  )}
                </View>

                {!selectedDeptId ? (
                  <View style={styles.disabledPromptBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
                    <Text style={styles.disabledPromptText}>Select a department first to load field officers.</Text>
                  </View>
                ) : filteredOfficers.length === 0 ? (
                  <View style={styles.warningPromptBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
                    <Text style={styles.warningPromptText}>No field officers registered under this department.</Text>
                  </View>
                ) : (
                  <View style={styles.officerChecklistCard}>
                    {/* Select All / Clear Row */}
                    <View style={styles.quickActionsRow}>
                      <Text style={styles.quickActionsHelpText}>Tap officers to assign:</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.quickActionPill}
                          onPress={() => setSelectedOfficerIds(filteredOfficers.map(o => o.id))}
                        >
                          <Text style={styles.quickActionPillText}>Select All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickActionPill}
                          onPress={() => setSelectedOfficerIds([])}
                        >
                          <Text style={styles.quickActionPillText}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Officers Checklist Items */}
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {filteredOfficers.map((off) => {
                        const isChecked = selectedOfficerIds.includes(off.id);
                        return (
                          <TouchableOpacity
                            key={off.id}
                            style={[styles.officerCheckItem, isChecked && styles.officerCheckItemChecked]}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (isChecked) {
                                setSelectedOfficerIds(prev => prev.filter(id => id !== off.id));
                              } else {
                                setSelectedOfficerIds(prev => [...prev, off.id]);
                              }
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <View style={[styles.avatarMiniCircle, isChecked && { backgroundColor: '#4f46e5' }]}>
                                <Text style={[styles.avatarMiniText, isChecked && { color: '#ffffff' }]}>
                                  {getInitials(off.name || off.username)}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.officerCheckName, isChecked && styles.officerCheckNameChecked]}>
                                  {off.name || off.username}
                                </Text>
                                <Text style={styles.officerCheckRole}>
                                  {off.designation || 'Field Officer'}
                                </Text>
                              </View>
                            </View>

                            <View style={[styles.customCheckbox, isChecked && styles.customCheckboxChecked]}>
                              {isChecked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooterActionBar}>
              <TouchableOpacity
                style={styles.actionCancelBtn}
                activeOpacity={0.7}
                onPress={() => setIsEditingAssignment(false)}
                disabled={savingAssignment}
              >
                <Text style={styles.actionCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSaveBtn}
                activeOpacity={0.7}
                onPress={handleSaveAssignment}
                disabled={savingAssignment}
              >
                {savingAssignment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionSaveBtnText}>Save Assignments</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Photo Preview Modal */}
      <PhotoPreviewModal
        visible={!!previewPhotoUrl}
        photoUrl={previewPhotoUrl}
        photoName={previewPhotoName}
        onClose={() => {
          setPreviewPhotoUrl(null);
          setPreviewPhotoName('');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  complaintIdHeaderBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  complaintIdHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center'
  },

  /* Section Card Styling */
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  topStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1
  },
  topStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3
  },

  /* Info Grid */
  infoGrid: {
    gap: 12,
    marginBottom: 12
  },
  infoGridRow: {
    flexDirection: 'row',
    gap: 12
  },
  infoCol: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    marginBottom: 2
  },
  fieldValueBold: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  fieldValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  priorityValueText: {
    fontSize: 12.5,
    fontWeight: '800'
  },
  statusDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  inlineCallBtn: {
    backgroundColor: '#ecfdf5',
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },

  /* Subject & Description */
  fieldBlock: {
    marginBottom: 12
  },
  subjectText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2
  },
  descriptionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2
  },

  /* Spot Address & Maps Container */
  spotAddressContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4
  },
  spotAddressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  spotAddressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  spotAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b'
  },
  navMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8
  },
  navMapsBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d97706'
  },

  /* Uploads Card */
  uploadSectionBlock: {
    marginBottom: 10
  },
  uploadSubHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    marginBottom: 6
  },
  noUploadsText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 4
  },
  photosScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  photoThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  photoThumb: {
    width: '100%',
    height: '100%'
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  docItemName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    flex: 1
  },

  /* Executive Routing & Assignments Card */
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardHeaderSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1
  },
  editAssignmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe'
  },
  editAssignmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5'
  },
  routingContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginTop: 4
  },
  routingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  routingIconCol: {
    paddingTop: 2
  },
  miniIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  routingInfoCol: {
    flex: 1
  },
  routingFieldTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  deptBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  deptBadgePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338ca'
  },
  routingValueName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  deskStaffBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6
  },
  deskStaffBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803d'
  },
  routingUnassignedText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 2
  },
  routingDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12
  },
  officerPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  officerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6
  },
  officerPillAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  officerPillAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff'
  },
  officerPillName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b'
  },

  /* Update Status Card */
  statusSelectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 12
  },
  statusSelectBoxText: {
    fontSize: 13,
    fontWeight: '700'
  },
  remarksTextarea: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top'
  },
  submitStatusBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  submitStatusBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700'
  },

  /* Timeline List */
  timelineList: {
    marginTop: 8
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14
  },
  timelineDotCol: {
    alignItems: 'center',
    width: 20,
    marginRight: 10
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ea580c'
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#fed7aa',
    marginTop: 4
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  timelineAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  timelineTime: {
    fontSize: 11,
    color: '#94a3b8'
  },
  timelineText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 17
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusOptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  statusOptText: {
    fontSize: 13,
    fontWeight: '700'
  },

  /* Professional Assignment Bottom Sheet */
  assignmentSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  sheetGrabHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12
  },
  assignmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe'
  },
  assignmentModalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  assignmentModalSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1
  },
  closeRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  assignmentModalScroll: {
    marginTop: 14,
    maxHeight: 460
  },

  /* Form Sections inside Modal */
  formSectionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4
  },
  requiredStar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    marginLeft: 2
  },
  optionalTag: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  customSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46
  },
  customSelectBoxActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#ffffff',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  selectorIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectorValueText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  selectorPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '500'
  },
  dropdownExpandCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    marginTop: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3
  },
  dropdownSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 6
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0f172a',
    padding: 0
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2
  },
  dropdownOptionItemActive: {
    backgroundColor: '#eef2ff'
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  dropdownOptionTextActive: {
    color: '#4338ca',
    fontWeight: '800'
  },
  dropdownOptionSubText: {
    fontSize: 10.5,
    color: '#64748b'
  },

  /* Prompts */
  disabledPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  disabledPromptText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1
  },
  warningPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  warningPromptText: {
    fontSize: 12,
    color: '#b45309',
    flex: 1
  },

  /* Avatar Circles */
  avatarMiniCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569'
  },

  /* Officer Checklist */
  counterBadge: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  counterBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4338ca'
  },
  officerChecklistCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  quickActionsHelpText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  quickActionPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quickActionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  officerCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  officerCheckItemChecked: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe'
  },
  officerCheckName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b'
  },
  officerCheckNameChecked: {
    color: '#4338ca'
  },
  officerCheckRole: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  customCheckboxChecked: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5'
  },

  /* Modal Footer Actions */
  modalFooterActionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8
  },
  actionCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  actionCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569'
  },
  actionSaveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  actionSaveBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff'
  },

  /* Work Completion Photos Field in Status Card */
  completionPhotosBlock: {
    marginTop: 14,
    marginBottom: 4,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed'
  },
  completionPhotosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  fieldLabelNoMargin: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.4
  },
  optionalBadgePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669'
  },
  completionPhotosHelpText: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16
  },
  completionPhotosPreviewWrap: {
    marginBottom: 10
  },
  completionPhotosScroll: {
    gap: 8,
    paddingVertical: 2
  },
  completionPhotoItemWrap: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  completionPhotoThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  removePhotoBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2
  },
  photoActionButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  photoActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b'
  },
  resolutionBadgeWrap: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignSelf: 'flex-start',
    marginBottom: 6
  },
  resolutionBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669'
  },

  /* Photo Preview Modal Styles */
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 28) + 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 16
  },
  photoModalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    paddingBottom: 8
  },
  photoModalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  photoHeaderIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoContainer: {
    width: SCREEN_WIDTH * 0.94,
    height: SCREEN_HEIGHT * 0.72,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  fullScreenPhoto: {
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_HEIGHT * 0.68
  },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    zIndex: 10
  },
  photoLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8
  },
  photoErrorBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  photoErrorTitle: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10
  },
  photoErrorSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4
  },
  photoRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  photoBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  photoRetryBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600'
  },
  photoModalFooter: {
    width: '100%',
    alignItems: 'center',
    zIndex: 100,
    paddingTop: 8
  },
  photoModalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  photoModalActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  photoZoomBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 4,
    padding: 2
  },
  docActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  docActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  }
});

