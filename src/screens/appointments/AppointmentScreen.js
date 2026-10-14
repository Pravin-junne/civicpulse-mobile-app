import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
  AppState,
  Share,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav, CalendarPickerModal } from '../../components';
import api, { API_BASE_URL, authService } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadFileDirectlyToDevice } from '../../utils/fileExport';

const TIME_SLOTS = [
  '09:30 AM - 10:00 AM',
  '10:00 AM - 10:30 AM',
  '10:30 AM - 11:00 AM',
  '11:00 AM - 11:30 AM',
  '11:30 AM - 12:00 PM',
  '02:00 PM - 02:30 PM',
  '02:30 PM - 03:00 PM',
  '03:30 PM - 04:00 PM',
  '04:00 PM - 04:30 PM'
];

const RESCHEDULE_REASONS = [
  'Visitor Requested Date/Time Change',
  'Concerned Official Unavailable',
  'Administrative / Meeting Conflict',
  'Public Holiday / Office Closed',
  'Constituency Field Visit',
  'Other / Custom Reason'
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function AppointmentScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddAppointmentPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [filterFacet, setFilterFacet] = useState('STATUS'); // 'STATUS' | 'PRIORITY'
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Pagination & Limit States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  // Reset to page 1 whenever search, status, priority, or limit changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedPriority, itemsPerPage]);

  // Status Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Reschedule Modal State
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleCalendarVisible, setRescheduleCalendarVisible] = useState(false);
  const [rescheduleSlot, setRescheduleSlot] = useState(TIME_SLOTS[0]);
  const [rescheduleSlotPickerVisible, setRescheduleSlotPickerVisible] = useState(false);
  const [rescheduleContractor, setRescheduleContractor] = useState('');
  const [rescheduleBillNo, setRescheduleBillNo] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState(RESCHEDULE_REASONS[0]);
  const [rescheduleReasonPickerVisible, setRescheduleReasonPickerVisible] = useState(false);
  const [rescheduleCustomNotes, setRescheduleCustomNotes] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  const [appointmentsList, setAppointmentsList] = useState([]);

  const fetchAppointments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/appointments');
      const list = Array.isArray(res) ? res : (res && res.appointments ? res.appointments : []);
      setAppointmentsList(list.map(item => {
        const rawDate = item.appointmentDate ? new Date(item.appointmentDate) : null;
        let formattedDate = 'Recent';
        if (rawDate && !isNaN(rawDate.getTime())) {
          formattedDate = rawDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
        return {
          id: item.id,
          appointmentNumber: item.appointmentNumber || `APT-2026-${String(item.id).padStart(4, '0')}`,
          visitorName: item.visitorName || 'Citizen Visitor',
          mobileNumber: item.mobileNumber || '',
          email: item.email || '',
          address: item.address || '',
          delegation: item.delegation || '',
          purpose: item.purpose || 'Constituency Visit',
          appointmentDate: formattedDate,
          rawDate: rawDate,
          timeSlot: item.timeSlot || '10:00 AM - 10:30 AM',
          priority: item.priority || 'MEDIUM',
          status: item.status || 'PENDING',
          assignedOfficer: item.assignedTo ? item.assignedTo.name : 'Constituency Desk',
          officeName: item.office ? item.office.name : '',
          notes: item.notes || ''
        };
      }));
    } catch (err) {
      console.log('Appointments fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchAppointments(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const statusOptions = [
    { id: 'ALL', label: 'All Status' },
    { id: 'TODAY', label: 'Today' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'RESCHEDULED', label: 'Rescheduled' },
    { id: 'CANCELLED', label: 'Cancelled' }
  ];

  const priorityOptions = [
    { id: 'ALL', label: 'All' },
    { id: 'LOW', label: 'LOW' },
    { id: 'MEDIUM', label: 'MEDIUM' },
    { id: 'HIGH', label: 'HIGH' },
    { id: 'CRITICAL', label: 'CRITICAL' }
  ];

  const isTodayDate = (rawDate) => {
    if (!rawDate || isNaN(rawDate.getTime())) return false;
    const now = new Date();
    return (
      rawDate.getFullYear() === now.getFullYear() &&
      rawDate.getMonth() === now.getMonth() &&
      rawDate.getDate() === now.getDate()
    );
  };

  const filteredAppointments = useMemo(() => {
    return appointmentsList.filter((item) => {
      // Status Filter
      if (selectedStatus === 'TODAY') {
        if (!isTodayDate(item.rawDate)) return false;
      } else if (selectedStatus !== 'ALL') {
        if ((item.status || '').toUpperCase() !== selectedStatus.toUpperCase()) return false;
      }

      // Priority Filter
      if (selectedPriority !== 'ALL') {
        if ((item.priority || '').toUpperCase() !== selectedPriority.toUpperCase()) return false;
      }

      // Search Query Match
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (item.appointmentNumber && item.appointmentNumber.toLowerCase().includes(query)) ||
        (item.visitorName && item.visitorName.toLowerCase().includes(query)) ||
        (item.delegation && item.delegation.toLowerCase().includes(query)) ||
        (item.mobileNumber && item.mobileNumber.toLowerCase().includes(query)) ||
        (item.purpose && item.purpose.toLowerCase().includes(query)) ||
        (item.assignedOfficer && item.assignedOfficer.toLowerCase().includes(query)) ||
        (item.officeName && item.officeName.toLowerCase().includes(query))
      );
    });
  }, [appointmentsList, selectedStatus, selectedPriority, searchQuery]);

  // Total Pages based on filtered results
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAppointments.length / itemsPerPage));
  }, [filteredAppointments.length, itemsPerPage]);

  // Paginated Appointment items for the current page view
  const paginatedAppointments = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredAppointments.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredAppointments, currentPage, itemsPerPage]);

  // Smart page numbers array with ellipsis for compact rendering
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  const showingStart = filteredAppointments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = Math.min(currentPage * itemsPerPage, filteredAppointments.length);

  const hasActiveFilters = selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSearchQuery('');
  };

  const handleCallVisitor = (apt) => {
    const phone = apt.mobileNumber || '';
    if (!phone) {
      Alert.alert('No Phone', 'No contact phone number provided for this visitor.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Calling', `Dialing ${phone}...`);
    });
  };

  const handleShareAppointment = (apt) => {
    Share.share({
      message: `Appointment Confirmation - Office of Kunal Tilak\n\nVisitor: ${apt.visitorName}\nDate: ${apt.appointmentDate}\nTime: ${apt.timeSlot}\nPurpose: ${apt.purpose}\nLocation: ${apt.officeName || 'Central Constituency Office'}\nRef: ${apt.appointmentNumber}`,
      title: `Appointment ${apt.appointmentNumber}`
    });
  };

  const handleExportCSV = async () => {
    if (!filteredAppointments || filteredAppointments.length === 0) {
      Alert.alert('No Records Found', 'There are no appointments matching the current filters to export.');
      return;
    }
    setIsExportingCsv(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedPriority && selectedPriority !== 'ALL') params.append('priority', selectedPriority);

      const downloadRes = await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/appointments/export/csv?${params.toString()}`,
        `Appointments_Export_${Date.now()}.csv`,
        token
      );

      if (!downloadRes || !downloadRes.success) {
        // Direct local CSV fallback
        const headers = 'Appointment Number,Appointment Date,Time Slot,Visitor Name,Mobile Number,Email,Address,Purpose,Section,Priority,Status,Office Unit,Assigned Officer';
        const rows = filteredAppointments.map(a => {
          const esc = str => `"${String(str || '').replace(/"/g, '""')}"`;
          return [
            esc(a.appointmentNumber || `#${a.id}`),
            esc(a.appointmentDate || ''),
            esc(a.timeSlot || ''),
            esc(a.visitorName || ''),
            esc(a.mobileNumber || ''),
            esc(a.email || ''),
            esc(a.address || ''),
            esc(a.purpose || ''),
            esc(a.section || 'General'),
            esc(a.priority || 'MEDIUM'),
            esc(a.status || 'PENDING'),
            esc(a.officeName || 'Central Office'),
            esc(a.assignedOfficer || 'Unassigned')
          ].join(',');
        });
        await exportCSVFile(`Appointments_Export_${Date.now()}.csv`, [headers, ...rows].join('\r\n'));
      }
    } catch (err) {
      console.error('Appointment CSV Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filteredAppointments || filteredAppointments.length === 0) {
      Alert.alert('No Records Found', 'There are no appointments matching the current filters to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedPriority && selectedPriority !== 'ALL') params.append('priority', selectedPriority);

      await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/appointments/export/pdf?${params.toString()}`,
        `Appointments_Register_${Date.now()}.pdf`,
        token
      );
    } catch (err) {
      console.error('Appointment PDF Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export PDF register.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return { label: 'Confirmed', bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6', border: '#bfdbfe' };
      case 'COMPLETED':
        return { label: 'Completed', bg: '#ecfdf5', fg: '#059669', dot: '#10b981', border: '#a7f3d0' };
      case 'PENDING':
        return { label: 'Pending Review', bg: '#fffbeb', fg: '#d97706', dot: '#f59e0b', border: '#fde68a' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: '#fef2f2', fg: '#dc2626', dot: '#ef4444', border: '#fecaca' };
      case 'RESCHEDULED':
        return { label: 'Rescheduled', bg: '#f5f3ff', fg: '#7c3aed', dot: '#8b5cf6', border: '#ddd6fe' };
      default:
        return { label: status, bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', border: '#e2e8f0' };
    }
  };

  const getPriorityBadge = (priority) => {
    const pri = (priority || 'MEDIUM').toUpperCase();
    if (pri === 'CRITICAL') {
      return { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', icon: 'alert-circle' };
    }
    if (pri === 'HIGH') {
      return { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', icon: 'warning-outline' };
    }
    if (pri === 'LOW') {
      return { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0', icon: 'arrow-down-circle-outline' };
    }
    return { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe', icon: 'flag-outline' };
  };

  const openRescheduleModal = (apt) => {
    setSelectedAppointment(apt);
    setStatusModalVisible(false);
    const initialDate = apt.rawDate 
      ? apt.rawDate.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];
    setRescheduleDate(initialDate);
    setRescheduleSlot(apt.timeSlot || TIME_SLOTS[0]);
    setRescheduleContractor('');
    setRescheduleBillNo('');
    setRescheduleReason(RESCHEDULE_REASONS[0]);
    setRescheduleCustomNotes('');
    setRescheduleModalVisible(true);
  };

  const handleConfirmReschedule = async () => {
    if (!selectedAppointment) return;
    const targetId = selectedAppointment.id;

    if (!rescheduleDate || !rescheduleSlot) {
      Alert.alert('Required Fields', 'Please select both a new appointment date and time slot.');
      return;
    }

    setIsSubmittingReschedule(true);
    try {
      let notesParts = [];
      if (rescheduleContractor && rescheduleContractor.trim()) {
        notesParts.push(`Contractor/Payee: ${rescheduleContractor.trim()}`);
      }
      if (rescheduleBillNo && rescheduleBillNo.trim()) {
        notesParts.push(`Bill/WO No: ${rescheduleBillNo.trim()}`);
      }
      if (rescheduleCustomNotes && rescheduleCustomNotes.trim()) {
        notesParts.push(rescheduleCustomNotes.trim());
      }

      const payload = {
        status: 'RESCHEDULED',
        appointmentDate: new Date(rescheduleDate).toISOString(),
        timeSlot: rescheduleSlot,
        reason: rescheduleReason,
        notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined
      };

      await api.patch(`/appointments/${targetId}/status`, payload);

      // Optimistic update
      const rawD = new Date(rescheduleDate);
      const formattedDate = !isNaN(rawD.getTime())
        ? rawD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : rescheduleDate;

      setAppointmentsList((prev) =>
        prev.map((apt) =>
          apt.id === targetId
            ? {
                ...apt,
                status: 'RESCHEDULED',
                appointmentDate: formattedDate,
                rawDate: rawD,
                timeSlot: rescheduleSlot,
                notes: payload.notes || apt.notes
              }
            : apt
        )
      );

      setRescheduleModalVisible(false);
      Alert.alert(
        'Appointment Rescheduled',
        `Meeting with ${selectedAppointment.visitorName} rescheduled to ${formattedDate} at ${rescheduleSlot}.`
      );
      fetchAppointments(true);
    } catch (err) {
      console.log('Reschedule error:', err.message);
      Alert.alert('Notice', err.response?.data?.message || 'Appointment rescheduled locally.');
      setRescheduleModalVisible(false);
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedAppointment) return;
    const targetId = selectedAppointment.id;
    
    // Optimistic local state update
    setAppointmentsList((prev) =>
      prev.map((apt) => (apt.id === targetId ? { ...apt, status: newStatus } : apt))
    );
    setStatusModalVisible(false);

    try {
      await api.patch(`/appointments/${targetId}/status`, { status: newStatus });
      Alert.alert('Status Updated', `Appointment status updated to ${newStatus}.`);
      fetchAppointments();
    } catch (err) {
      console.log('Update appointment status error:', err.message);
      Alert.alert('Status Updated (Local)', `Appointment marked as ${newStatus}.`);
    }
  };

  const handleDeleteAppointment = (apt) => {
    if (!apt) return;
    Alert.alert(
      'Delete Appointment',
      `Are you sure you want to delete appointment ${apt.appointmentNumber || ''} for "${apt.visitorName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const targetId = apt.id;
            // Optimistic local state update
            setAppointmentsList((prev) => prev.filter((item) => item.id !== targetId));

            try {
              await api.delete(`/appointments/${targetId}`);
              Alert.alert('Deleted', `Appointment for ${apt.visitorName} was deleted.`);
              fetchAppointments(true);
            } catch (err) {
              console.log('Delete appointment error:', err.message);
              Alert.alert('Notice', err.response?.data?.message || 'Appointment deleted locally.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Citizen & Delegation Portal"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Scrollable Body */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* Title and Top Actions */}
        <View style={styles.titleRow}>
          <View style={styles.titleTextWrap}>
            <Text style={styles.screenTitle}>Appointments & Visits</Text>
            <Text style={styles.screenSubtitle}>Citizen delegations & officer hearings</Text>
          </View>

          <View style={styles.topActionsRow}>
            {/* Add Appointment Button */}
            {onAddAppointmentPress && (
              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.8}
                onPress={onAddAppointmentPress}
              >
                <Ionicons name="add" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Metric Summary Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#ea580c' }]}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statLabel}>Total Bookings</Text>
              <Ionicons name="calendar" size={15} color="#ea580c" />
            </View>
            <Text style={styles.statNumber}>{appointmentsList.length}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#2563eb' }]}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statLabel}>Confirmed</Text>
              <Ionicons name="checkmark-circle" size={15} color="#2563eb" />
            </View>
            <Text style={[styles.statNumber, { color: '#2563eb' }]}>
              {appointmentsList.filter((a) => a.status === 'CONFIRMED').length}
            </Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#d97706' }]}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statLabel}>Pending</Text>
              <Ionicons name="time" size={15} color="#d97706" />
            </View>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>
              {appointmentsList.filter((a) => a.status === 'PENDING').length}
            </Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statLabel}>Completed</Text>
              <Ionicons name="checkmark-done-circle" size={15} color="#059669" />
            </View>
            <Text style={[styles.statNumber, { color: '#059669' }]}>
              {appointmentsList.filter((a) => a.status === 'COMPLETED').length}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search visitor, phone, purpose..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Export Actions Bar */}
        <View style={styles.exportActionsRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportCsvBtn]}
            onPress={handleExportCSV}
            disabled={isExportingCsv}
            activeOpacity={0.7}
          >
            {isExportingCsv ? (
              <ActivityIndicator size="small" color="#059669" style={{ marginRight: 5 }} />
            ) : (
              <Ionicons name="document-text-outline" size={14} color="#059669" style={{ marginRight: 5 }} />
            )}
            <Text style={styles.exportCsvText}>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.exportPdfBtn]}
            onPress={handleExportPDF}
            disabled={isExportingPdf}
            activeOpacity={0.7}
          >
            {isExportingPdf ? (
              <ActivityIndicator size="small" color="#dc2626" style={{ marginRight: 5 }} />
            ) : (
              <Ionicons name="download-outline" size={14} color="#dc2626" style={{ marginRight: 5 }} />
            )}
            <Text style={styles.exportPdfText}>{isExportingPdf ? 'Generating...' : 'Export PDF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Facet Switcher & Limit Tabs Row */}
        <View style={styles.facetTabsRow}>
          <TouchableOpacity
            style={[styles.facetTab, filterFacet === 'STATUS' && styles.facetTabActive]}
            onPress={() => setFilterFacet('STATUS')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="funnel-outline"
              size={13}
              color={filterFacet === 'STATUS' ? '#ffffff' : '#64748b'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.facetTabText, filterFacet === 'STATUS' && styles.facetTabTextActive]}>
              Status {selectedStatus !== 'ALL' ? `(${selectedStatus})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.facetTab, filterFacet === 'PRIORITY' && styles.facetTabActive]}
            onPress={() => setFilterFacet('PRIORITY')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flag-outline"
              size={13}
              color={filterFacet === 'PRIORITY' ? '#ffffff' : '#64748b'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.facetTabText, filterFacet === 'PRIORITY' && styles.facetTabTextActive]}>
              Priority {selectedPriority !== 'ALL' ? `(${selectedPriority})` : ''}
            </Text>
          </TouchableOpacity>

          {/* Limit Pill Selector */}
          <TouchableOpacity
            style={[styles.facetTab, styles.limitFacetTab, itemsPerPage !== 10 && styles.limitFacetTabActive]}
            onPress={() => setIsLimitModalOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="options-outline"
              size={13}
              color={itemsPerPage !== 10 ? '#ea580c' : '#64748b'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.facetTabText, itemsPerPage !== 10 && styles.limitFacetTabTextActive]}>
              {itemsPerPage} / pg
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={itemsPerPage !== 10 ? '#ea580c' : '#64748b'}
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={13} color="#ef4444" style={{ marginRight: 3 }} />
              <Text style={styles.clearFiltersBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sub-Pills for Active Facet */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {filterFacet === 'STATUS' &&
            statusOptions.map((st) => {
              const isActive = selectedStatus === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setSelectedStatus(st.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

          {filterFacet === 'PRIORITY' &&
            priorityOptions.map((pr) => {
              const isActive = selectedPriority === pr.id;
              return (
                <TouchableOpacity
                  key={pr.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setSelectedPriority(pr.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {pr.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        {/* Appointment Cards List */}
        <View style={styles.cardsList}>
          {paginatedAppointments.map((apt) => {
            const statusStyle = getStatusBadge(apt.status);
            const priBadge = getPriorityBadge(apt.priority);

            return (
              <View key={apt.id} style={styles.appointmentCard}>
                {/* Header Row: Apt Number + Date Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.idWrap}>
                    <View style={styles.idBadge}>
                      <Ionicons name="bookmark-outline" size={12} color="#ea580c" style={{ marginRight: 4 }} />
                      <Text style={styles.cardIdText}>{apt.appointmentNumber}</Text>
                    </View>
                    {apt.officeName ? (
                      <View style={styles.delegationTag}>
                        <Ionicons name="business-outline" size={11} color="#ea580c" style={{ marginRight: 3 }} />
                        <Text style={styles.delegationTagText} numberOfLines={1} ellipsizeMode="tail">
                          {apt.officeName}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.dateBadge}>
                    <Ionicons name="calendar-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.cardDateText} numberOfLines={1}>
                      {apt.appointmentDate}
                    </Text>
                  </View>
                </View>

                {/* Visitor Info */}
                <View style={styles.visitorRow}>
                  <View style={styles.visitorInfoLeft}>
                    <Text style={styles.visitorNameText} numberOfLines={1}>{apt.visitorName}</Text>
                    {apt.delegation ? (
                      <View style={styles.delegationNameBadge}>
                        <Ionicons name="people" size={10} color="#c2410c" style={{ marginRight: 3 }} />
                        <Text style={styles.delegationNameText} numberOfLines={1}>
                          {apt.delegation}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {apt.mobileNumber ? (
                    <TouchableOpacity
                      style={styles.phoneClickable}
                      activeOpacity={0.7}
                      onPress={() => handleCallVisitor(apt)}
                    >
                      <Ionicons name="call" size={11} color="#1d4ed8" style={{ marginRight: 4 }} />
                      <Text style={styles.visitorPhoneText} numberOfLines={1}>{apt.mobileNumber}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Purpose */}
                <Text style={styles.purposeText} numberOfLines={2}>
                  {apt.purpose}
                </Text>

                {/* Slot & Priority Info */}
                <View style={styles.metaRow}>
                  <View style={styles.slotBadge}>
                    <Ionicons name="time-outline" size={12} color="#0f766e" style={{ marginRight: 4 }} />
                    <Text style={styles.slotBadgeText}>{apt.timeSlot}</Text>
                  </View>
                  <View style={[styles.sectionBadge, { backgroundColor: priBadge.bg, borderColor: priBadge.border }]}>
                    <Ionicons name={priBadge.icon} size={12} color={priBadge.fg} style={{ marginRight: 4 }} />
                    <Text style={[styles.sectionBadgeText, { color: priBadge.fg }]}>
                      {apt.priority || 'MEDIUM'}
                    </Text>
                  </View>
                </View>

                {/* Footer Row: Assigned Officer & Actions */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.officerWrap}>
                    <Text style={styles.officerLabel}>Meeting With:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                      <Ionicons name="person-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.officerNameText} numberOfLines={1}>{apt.assignedOfficer}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActionsGroup}>
                    <TouchableOpacity
                      style={styles.miniActionButton}
                      activeOpacity={0.7}
                      onPress={() => handleShareAppointment(apt)}
                    >
                      <Ionicons name="share-social-outline" size={15} color="#475569" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.miniActionButton, styles.deleteMiniBtn]}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteAppointment(apt)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#ef4444" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.statusBadgeButton, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedAppointment(apt);
                        setStatusModalVisible(true);
                      }}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                      <Text style={[styles.statusBadgeText, { color: statusStyle.fg }]}>
                        {statusStyle.label}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color={statusStyle.fg} style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredAppointments.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-clear-outline" size={44} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>No appointments found</Text>
              <Text style={styles.emptyStateSub}>No scheduled visits match your filters</Text>
            </View>
          )}
        </View>

        {/* Professional Pagination Controls */}
        {filteredAppointments.length > 0 && (
          <View style={styles.paginationContainer}>
            {/* Header: Range Summary & Limit Selector Chip */}
            <View style={styles.paginationHeader}>
              <Text style={styles.paginationCountText}>
                Showing <Text style={styles.paginationCountBold}>{showingStart}</Text> - <Text style={styles.paginationCountBold}>{showingEnd}</Text> of <Text style={styles.paginationCountBold}>{filteredAppointments.length}</Text> visits
              </Text>
              <TouchableOpacity
                style={styles.limitSelectorChip}
                activeOpacity={0.7}
                onPress={() => setIsLimitModalOpen(true)}
              >
                <Ionicons name="layers-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                <Text style={styles.limitSelectorChipText}>{itemsPerPage} per page</Text>
                <Ionicons name="chevron-down" size={12} color="#ea580c" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>

            {/* Pagination Navigation Buttons */}
            {totalPages > 1 && (
              <View style={styles.paginationNavRow}>
                {/* Prev Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage <= 1 && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={15} color={currentPage <= 1 ? '#94a3b8' : '#0f172a'} />
                  <Text style={[styles.pageNavButtonText, currentPage <= 1 && styles.pageNavButtonTextDisabled]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                {/* Page Number Buttons */}
                <View style={styles.pageNumbersList}>
                  {pageNumbers.map((pageItem, index) => {
                    if (pageItem === '...') {
                      return (
                        <View key={`ellipsis-${index}`} style={styles.pageEllipsisWrap}>
                          <Text style={styles.pageEllipsisText}>•••</Text>
                        </View>
                      );
                    }
                    const isActive = currentPage === pageItem;
                    return (
                      <TouchableOpacity
                        key={pageItem}
                        style={[styles.pageNumberPill, isActive && styles.pageNumberPillActive]}
                        onPress={() => setCurrentPage(pageItem)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pageNumberPillText, isActive && styles.pageNumberPillTextActive]}>
                          {pageItem}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage >= totalPages && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNavButtonText, currentPage >= totalPages && styles.pageNavButtonTextDisabled]}>
                    Next
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={currentPage >= totalPages ? '#94a3b8' : '#0f172a'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 3. Status Action Modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Update Status</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  {selectedAppointment?.appointmentNumber} • {selectedAppointment?.visitorName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusOptionsList}>
              <TouchableOpacity
                style={[styles.statusOptionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                onPress={() => handleUpdateStatus('CONFIRMED')}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle-outline" size={19} color="#1d4ed8" style={{ marginRight: 10 }} />
                <Text style={[styles.statusOptionText, { color: '#1d4ed8' }]}>Confirm Appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
                onPress={() => handleUpdateStatus('COMPLETED')}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done-circle-outline" size={19} color="#059669" style={{ marginRight: 10 }} />
                <Text style={[styles.statusOptionText, { color: '#059669' }]}>Mark as Completed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionBtn, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}
                onPress={() => {
                  if (selectedAppointment) {
                    openRescheduleModal(selectedAppointment);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={19} color="#7c3aed" style={{ marginRight: 10 }} />
                <Text style={[styles.statusOptionText, { color: '#7c3aed' }]}>Reschedule Date & Time</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionBtn, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
                onPress={() => handleUpdateStatus('CANCELLED')}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={19} color="#b45309" style={{ marginRight: 10 }} />
                <Text style={[styles.statusOptionText, { color: '#b45309' }]}>Cancel Appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca', marginTop: 4 }]}
                onPress={() => {
                  const aptToDelete = selectedAppointment;
                  setStatusModalVisible(false);
                  if (aptToDelete) {
                    handleDeleteAppointment(aptToDelete);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={19} color="#dc2626" style={{ marginRight: 10 }} />
                <Text style={[styles.statusOptionText, { color: '#dc2626' }]}>Delete Appointment</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setStatusModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Dedicated Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRescheduleModalVisible(false)}
        >
          <View style={[styles.modalContent, styles.rescheduleModalContent]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.rescheduleHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.rescheduleHeaderTitle}>Reschedule Appointment</Text>
                <Text style={styles.rescheduleHeaderSub}>
                  Select new Appointment date, Time slot and reason
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRescheduleModalVisible(false)}
                style={styles.rescheduleCloseCircleBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.rescheduleScrollBody} contentContainerStyle={{ paddingBottom: 6 }}>
              {/* Peach Visitor Summary Box */}
              <View style={styles.reschedulePeachCard}>
                <View style={styles.peachCardRow}>
                  <Text style={styles.peachCardIcon}>👤</Text>
                  <Text style={styles.peachVisitorNameText} numberOfLines={1}>
                    {selectedAppointment?.visitorName} {selectedAppointment?.officeName ? `(${selectedAppointment.officeName})` : ''}
                  </Text>
                </View>
                {selectedAppointment?.mobileNumber ? (
                  <View style={styles.peachCardRow}>
                    <Text style={styles.peachCardIcon}>📞</Text>
                    <Text style={styles.peachMobileText}>
                      {selectedAppointment?.mobileNumber}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.peachCardRow, { marginTop: 2 }]}>
                  <Text style={styles.peachDotText}>●</Text>
                  <Text style={styles.peachPurposeText} numberOfLines={2}>
                    {selectedAppointment?.purpose || 'Constituency Visit'}
                  </Text>
                </View>
              </View>

              {/* Appointment Status */}
              <View style={styles.rescheduleFormFieldGroup}>
                <Text style={styles.rescheduleFieldLabel}>
                  Appointment Status <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.rescheduleStatusPill}>
                  <Text style={styles.rescheduleStatusPillText}>Rescheduled date & Time</Text>
                  <Ionicons name="chevron-down" size={16} color="#ea580c" />
                </View>
              </View>

              {/* Two-Column Row: New Date & New Time Slot */}
              <View style={styles.rescheduleTwoColRow}>
                {/* New Date */}
                <View style={styles.rescheduleCol}>
                  <Text style={styles.rescheduleFieldLabel}>
                    New Date <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.rescheduleInputTouchable}
                    activeOpacity={0.7}
                    onPress={() => setRescheduleCalendarVisible(true)}
                  >
                    <Ionicons name="calendar-outline" size={15} color="#ea580c" style={{ marginRight: 6 }} />
                    <Text style={styles.rescheduleInputTouchableText} numberOfLines={1}>
                      {rescheduleDate || 'YYYY-MM-DD'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* New Time Slot */}
                <View style={styles.rescheduleCol}>
                  <Text style={styles.rescheduleFieldLabel}>
                    New Time Slot <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.rescheduleInputTouchable}
                    activeOpacity={0.7}
                    onPress={() => setRescheduleSlotPickerVisible(true)}
                  >
                    <Ionicons name="time-outline" size={15} color="#ea580c" style={{ marginRight: 6 }} />
                    <Text style={styles.rescheduleInputTouchableText} numberOfLines={1}>
                      {rescheduleSlot || 'Select Slot'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Reason for Rescheduling */}
              <View style={styles.rescheduleFormFieldGroup}>
                <Text style={styles.rescheduleFieldLabel}>
                  Reason for Rescheduling <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.rescheduleReasonSelector}
                  activeOpacity={0.7}
                  onPress={() => setRescheduleReasonPickerVisible(true)}
                >
                  <Text style={styles.rescheduleReasonSelectorText} numberOfLines={1}>
                    {rescheduleReason}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#ea580c" />
                </TouchableOpacity>
              </View>

              {/* Remarks / Additional Notes */}
              <View style={styles.rescheduleFormFieldGroup}>
                <Text style={styles.rescheduleFieldLabel}>
                  Remarks / Additional Notes <Text style={styles.optionalTag}>(Optional)</Text>
                </Text>
                <TextInput
                  style={styles.rescheduleTextarea}
                  placeholder="Optional notes or remarks..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  value={rescheduleCustomNotes}
                  onChangeText={setRescheduleCustomNotes}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.rescheduleFooterContainer}>
              <Text style={styles.requiredNoticeText}>
                <Text style={styles.requiredAsterisk}>*</Text> Denotes required entry
              </Text>

              <View style={styles.rescheduleFooterBtnsRow}>
                <TouchableOpacity
                  style={styles.rescheduleCancelBtn}
                  onPress={() => setRescheduleModalVisible(false)}
                  disabled={isSubmittingReschedule}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rescheduleCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rescheduleConfirmBtn, isSubmittingReschedule && styles.btnDisabled]}
                  onPress={handleConfirmReschedule}
                  disabled={isSubmittingReschedule}
                  activeOpacity={0.8}
                >
                  {isSubmittingReschedule ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.rescheduleConfirmBtnText}>Confirm Reschedule</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Slot Picker Modal */}
      <Modal
        visible={rescheduleSlotPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleSlotPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRescheduleSlotPickerVisible(false)}
        >
          <View style={[styles.modalContent, { maxWidth: 360 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={18} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Time Slot</Text>
              </View>
              <TouchableOpacity onPress={() => setRescheduleSlotPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = rescheduleSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.limitSelectItem, isSelected && styles.limitSelectItemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setRescheduleSlot(slot);
                      setRescheduleSlotPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.limitSelectText, isSelected && styles.limitSelectTextActive]}>{slot}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#ea580c" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reason Picker Modal */}
      <Modal
        visible={rescheduleReasonPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleReasonPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRescheduleReasonPickerVisible(false)}
        >
          <View style={[styles.modalContent, { maxWidth: 360 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="help-circle-outline" size={18} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Reason for Rescheduling</Text>
              </View>
              <TouchableOpacity onPress={() => setRescheduleReasonPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {RESCHEDULE_REASONS.map((reason) => {
                const isSelected = rescheduleReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.limitSelectItem, isSelected && styles.limitSelectItemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setRescheduleReason(reason);
                      setRescheduleReasonPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.limitSelectText, isSelected && styles.limitSelectTextActive]}>{reason}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#ea580c" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. Calendar Picker Modal for Reschedule Date */}
      <CalendarPickerModal
        visible={rescheduleCalendarVisible}
        title="Select Reschedule Date"
        initialDate={rescheduleDate}
        onSelectDate={(selectedDate) => {
          setRescheduleDate(selectedDate);
          setRescheduleCalendarVisible(false);
        }}
        onClose={() => setRescheduleCalendarVisible(false)}
      />

      {/* 6. Items Per Page Limit Selection Modal */}
      <Modal
        visible={isLimitModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLimitModalOpen(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="options-outline" size={19} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Items Per Page</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLimitModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 4 }}>
              {LIMIT_OPTIONS.map((lim) => {
                const isSelected = itemsPerPage === lim;
                return (
                  <TouchableOpacity
                    key={lim}
                    style={[
                      styles.limitSelectItem,
                      isSelected && styles.limitSelectItemActive
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setItemsPerPage(lim);
                      setCurrentPage(1);
                      setIsLimitModalOpen(false);
                    }}
                  >
                    <View style={styles.limitOptionLabelWrap}>
                      <Text style={[styles.limitSelectText, isSelected && styles.limitSelectTextActive]}>
                        {lim} appointments
                      </Text>
                      {lim === 10 && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 7. Bottom Nav */}
      <BottomNav activeTab={internalTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  titleTextWrap: {
    flex: 1
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a'
  },
  statLabel: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '600'
  },
  searchRow: {
    marginBottom: 12
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  facetTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  facetTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  facetTabActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  facetTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b'
  },
  facetTabTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  limitFacetTab: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0'
  },
  limitFacetTabActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  limitFacetTabTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  clearFiltersBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ef4444'
  },
  filterPillsContainer: {
    gap: 8,
    paddingBottom: 12
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c'
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  cardsList: {
    gap: 12
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8
  },
  idWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap'
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  cardIdText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#c2410c'
  },
  delegationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 140
  },
  delegationTagText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#ea580c'
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0
  },
  cardDateText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  visitorInfoLeft: {
    flex: 1,
    minWidth: 0
  },
  visitorNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  delegationNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignSelf: 'flex-start',
    marginTop: 2
  },
  delegationNameText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#c2410c'
  },
  phoneClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0
  },
  visitorPhoneText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1d4ed8'
  },
  purposeText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6
  },
  slotBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f766e'
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    maxWidth: '55%'
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8
  },
  officerWrap: {
    flex: 1,
    minWidth: 0
  },
  officerLabel: {
    fontSize: 9.5,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.3
  },
  officerNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  miniActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  deleteMiniBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  statusBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyStateTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  paginationContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 12
  },
  paginationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  paginationCountText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500'
  },
  paginationCountBold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  limitSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  limitSelectorChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  paginationNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8
  },
  pageNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 4
  },
  pageNavButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#f8fafc'
  },
  pageNavButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  pageNavButtonTextDisabled: {
    color: '#94a3b8'
  },
  pageNumbersList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 1
  },
  pageNumberPill: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  pageNumberPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  pageNumberPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  pageNumberPillTextActive: {
    color: '#ffffff'
  },
  pageEllipsisWrap: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageEllipsisText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  statusOptionsList: {
    gap: 8,
    marginBottom: 16
  },
  statusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '700'
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  rescheduleModalContent: {
    maxWidth: 400,
    maxHeight: '90%',
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff'
  },
  rescheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  rescheduleHeaderTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  rescheduleHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16
  },
  rescheduleCloseCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rescheduleScrollBody: {
    maxHeight: 460
  },
  reschedulePeachCard: {
    backgroundColor: '#fff4ea',
    borderWidth: 1,
    borderColor: '#ffd7be',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 4
  },
  peachCardRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  peachCardIcon: {
    fontSize: 13,
    marginRight: 6
  },
  peachVisitorNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1
  },
  peachMobileText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569'
  },
  peachDotText: {
    fontSize: 9,
    color: '#059669',
    marginRight: 6
  },
  peachPurposeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    flex: 1,
    lineHeight: 16
  },
  rescheduleFormFieldGroup: {
    marginBottom: 12
  },
  rescheduleFieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '700'
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8'
  },
  rescheduleStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rescheduleStatusPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c'
  },
  rescheduleTwoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  rescheduleCol: {
    flex: 1
  },
  rescheduleInputTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9.5,
    minHeight: 40
  },
  rescheduleInputTouchableText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1
  },
  rescheduleInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 9,
    minHeight: 40
  },
  rescheduleInputIcon: {
    marginRight: 6
  },
  rescheduleTextInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 6
  },
  rescheduleReasonSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rescheduleReasonSelectorText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c',
    flex: 1,
    marginRight: 6
  },
  rescheduleTextarea: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    fontSize: 12.5,
    color: '#0f172a',
    minHeight: 60,
    textAlignVertical: 'top'
  },
  rescheduleFooterContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  requiredNoticeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8
  },
  rescheduleFooterBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  rescheduleCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  rescheduleCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  rescheduleConfirmBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  rescheduleConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  btnDisabled: {
    opacity: 0.6
  },
  limitSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  limitSelectItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c'
  },
  limitOptionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  limitSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155'
  },
  limitSelectTextActive: {
    color: '#ea580c',
    fontWeight: '800'
  },
  defaultBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b'
  },
  exportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff'
  },
  exportCsvBtn: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5'
  },
  exportPdfBtn: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  exportCsvText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669'
  },
  exportPdfText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626'
  }
});
