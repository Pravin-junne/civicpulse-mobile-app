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
  ActivityIndicator,
  Platform,
  AppState,
  Linking,
  Share,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api, { authService, API_BASE_URL } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadAndShareRemoteFile } from '../../utils/fileExport';

export default function ComplaintsScreen({
  navigation,
  initialFilters = null,
  routeParams = null,
  activeTab = 'complaints',
  onTabPress,
  onAddComplaintPress,
  onViewComplaintDetail,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const incomingParams = initialFilters || routeParams;

  // Validate that incomingParams is a filter configuration payload (e.g. from Dashboard widgets) and not a full complaint item
  const isFilterPayload = incomingParams && typeof incomingParams === 'object' && !incomingParams.rawId && !incomingParams.complaintNumber && !incomingParams.citizenName && !incomingParams.landmark;

  const validFilters = isFilterPayload ? incomingParams : null;

  const [searchQuery, setSearchQuery] = useState(validFilters?.search || '');
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Active Filter States (Web Parity)
  const [statusFilter, setStatusFilter] = useState(validFilters?.status || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState(validFilters?.priority || 'ALL');
  const [departmentFilter, setDepartmentFilter] = useState(validFilters?.department || 'ALL');
  const [wardFilter, setWardFilter] = useState(validFilters?.ward || 'ALL');
  const [areaFilter, setAreaFilter] = useState(validFilters?.area || 'ALL');
  const [officerFilter, setOfficerFilter] = useState(validFilters?.officer || 'ALL');
  const [dateFilter, setDateFilter] = useState(validFilters?.date || 'ALL'); // 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'
  const [sortBy, setSortBy] = useState(validFilters?.sortBy || 'NEWEST'); // 'NEWEST' | 'OLDEST' | 'PRIORITY'

  // Synchronize incoming filter parameters when props change
  useEffect(() => {
    if (validFilters) {
      if (validFilters.status !== undefined && validFilters.status !== null) {
        setStatusFilter(validFilters.status);
      }
      if (validFilters.priority !== undefined && validFilters.priority !== null) {
        setPriorityFilter(validFilters.priority);
      }
      if (validFilters.department !== undefined && validFilters.department !== null) {
        setDepartmentFilter(validFilters.department);
      }
      if (validFilters.ward !== undefined && validFilters.ward !== null) {
        setWardFilter(validFilters.ward);
      }
      if (validFilters.area !== undefined && validFilters.area !== null) {
        setAreaFilter(validFilters.area);
      }
      if (validFilters.officer !== undefined && validFilters.officer !== null) {
        setOfficerFilter(validFilters.officer);
      }
      if (validFilters.date !== undefined && validFilters.date !== null) {
        setDateFilter(validFilters.date);
      }
      if (validFilters.search !== undefined && validFilters.search !== null) {
        setSearchQuery(validFilters.search);
      }
      if (validFilters.sortBy !== undefined && validFilters.sortBy !== null) {
        setSortBy(validFilters.sortBy);
      }
    }
  }, [validFilters]);

  // Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempStatus, setTempStatus] = useState('ALL');
  const [tempPriority, setTempPriority] = useState('ALL');
  const [tempDepartment, setTempDepartment] = useState('ALL');
  const [tempWard, setTempWard] = useState('ALL');
  const [tempArea, setTempArea] = useState('ALL');
  const [tempOfficer, setTempOfficer] = useState('ALL');
  const [tempDate, setTempDate] = useState('ALL');
  const [tempSort, setTempSort] = useState('NEWEST');

  // Lookups
  const [departmentsList, setDepartmentsList] = useState([]);
  const [wardsData, setWardsData] = useState([]);
  const [officersList, setOfficersList] = useState([]);

  // Live complaints list from API
  const [complaintsData, setComplaintsData] = useState([]);

  // Fetch Complaints from backend
  const fetchComplaints = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorMessage('');
      const res = await api.get('/complaints');
      const rawList = res?.complaints || (Array.isArray(res) ? res : []);
      if (rawList && rawList.length > 0) {
        const formatted = rawList.map((item, idx) => {
          const createdAtDate = item.createdAt ? new Date(item.createdAt) : new Date();
          const formattedDate = createdAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const citizenNameStr = typeof item.citizenName === 'object' ? (item.citizenName?.name || 'Citizen') : (item.citizenName || 'Citizen');
          const mobileStr = item.mobileNumber || item.mobile || '';
          const wardNameStr = typeof item.ward === 'object' ? (item.ward?.name || 'Ward A') : (item.ward || 'Ward A');
          const areaNameStr = typeof item.area === 'object' ? (item.area?.name || '') : (item.area || '');
          const deptNameStr = typeof item.department === 'object' ? (item.department?.name || 'GENERAL') : (item.department || 'GENERAL');
          const locationStr = areaNameStr || item.landmark || item.address || 'Pune Area';

          return {
            id: item.complaintNumber || (item.id ? `GR-2026-${String(item.id).padStart(3, '0')}` : `GR-2026-${String(idx + 1).padStart(3, '0')}`),
            complaintNumber: item.complaintNumber || item.id,
            rawId: item.id,
            rawCreatedAt: createdAtDate,
            date: formattedDate,
            name: citizenNameStr,
            citizenName: citizenNameStr,
            mobile: mobileStr,
            mobileNumber: mobileStr,
            location: locationStr,
            ward: wardNameStr,
            wardName: wardNameStr,
            area: areaNameStr,
            areaName: areaNameStr,
            department: deptNameStr,
            departmentName: deptNameStr,
            subject: item.subject || 'Citizen Grievance',
            address: item.address || '',
            landmark: item.landmark || '',
            priority: item.priority ? item.priority.charAt(0) + item.priority.slice(1).toLowerCase() : 'Medium',
            priorityType: (item.priority || 'medium').toLowerCase(),
            status: item.status ? item.status.replace(/_/g, ' ') : 'Pending',
            statusType: (item.status || 'pending').toLowerCase(),
            rawStatus: item.status || 'PENDING',
            description: item.description || '',
            assignedOfficer: item.officers && item.officers.length > 0
              ? item.officers.map(o => (typeof o === 'object' ? (o.name || o.username) : o)).join(', ')
              : (typeof item.inOfficePerson === 'object' ? (item.inOfficePerson?.name || 'Unassigned') : (item.inOfficePerson || 'Unassigned')),
            attachments: item.attachments || []
          };
        });
        setComplaintsData(formatted);
      } else {
        setComplaintsData([]);
      }
    } catch (err) {
      console.log('Live complaints fetch notice:', err.message);
      setComplaintsData([]);
      if (!isSilent) setErrorMessage(err.message || 'Unable to load live complaints.');
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [complaintsData.length]);

  // Initial Load & Lookups Fetch
  useEffect(() => {
    fetchComplaints(false);

    const fetchLookups = async () => {
      try {
        const [deptRes, wardRes, userRes] = await Promise.all([
          api.get('/departments').catch(() => null),
          api.get('/wards').catch(() => null),
          api.get('/users?role=OFFICER').catch(() => null)
        ]);

        if (deptRes) {
          const list = Array.isArray(deptRes) ? deptRes : (deptRes?.departments || []);
          if (list.length > 0) setDepartmentsList(list);
        }

        if (wardRes) {
          const list = Array.isArray(wardRes) ? wardRes : (wardRes?.wards || []);
          if (list.length > 0) setWardsData(list);
        }

        if (userRes) {
          const list = Array.isArray(userRes) ? userRes : (userRes?.users || []);
          if (list.length > 0) setOfficersList(list);
        }
      } catch (e) {
        console.log('Lookups fetch error:', e.message);
      }
    };
    fetchLookups();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchComplaints(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchComplaints]);

  // Derived available areas based on selected temp ward in modal
  const availableAreas = useMemo(() => {
    if (tempWard === 'ALL') {
      const all = [];
      wardsData.forEach(w => {
        if (w.areas && Array.isArray(w.areas)) {
          w.areas.forEach(a => all.push(a));
        }
      });
      return all;
    }
    const found = wardsData.find(w => w.name === tempWard || String(w.id) === String(tempWard));
    return found?.areas || [];
  }, [tempWard, wardsData]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
  };

  // Open Modal with current applied filter values
  const handleOpenFilterModal = () => {
    setTempStatus(statusFilter);
    setTempPriority(priorityFilter);
    setTempDepartment(departmentFilter);
    setTempWard(wardFilter);
    setTempArea(areaFilter);
    setTempOfficer(officerFilter);
    setTempDate(dateFilter);
    setTempSort(sortBy);
    setIsFilterModalOpen(true);
  };

  // Apply Modal Filters
  const handleApplyFilters = () => {
    setStatusFilter(tempStatus);
    setPriorityFilter(tempPriority);
    setDepartmentFilter(tempDepartment);
    setWardFilter(tempWard);
    setAreaFilter(tempArea);
    setOfficerFilter(tempOfficer);
    setDateFilter(tempDate);
    setSortBy(tempSort);
    setIsFilterModalOpen(false);
  };

  // Reset Modal Filters
  const handleResetFilters = () => {
    setTempStatus('ALL');
    setTempPriority('ALL');
    setTempDepartment('ALL');
    setTempWard('ALL');
    setTempArea('ALL');
    setTempOfficer('ALL');
    setTempDate('ALL');
    setTempSort('NEWEST');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setDepartmentFilter('ALL');
    setWardFilter('ALL');
    setAreaFilter('ALL');
    setOfficerFilter('ALL');
    setDateFilter('ALL');
    setSortBy('NEWEST');
    setIsFilterModalOpen(false);
  };

  // Export Filtered Grievances (Excel, CSV, PDF)
  const handleExportComplaints = async () => {
    if (!filteredComplaints || filteredComplaints.length === 0) {
      Alert.alert('No Records Found', 'There are no grievances matching the current filters to export.');
      return;
    }

    const exportCSVFormat = async () => {
      try {
        const headers = [
          'Grievance ID',
          'Date',
          'Citizen Name',
          'Mobile Number',
          'Ward',
          'Area / Locality',
          'Department',
          'Priority',
          'Status',
          'Subject',
          'Description',
          'Address',
          'Landmark',
          'Assigned Officer'
        ];

        const escapeCSV = (val) => {
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        const rows = filteredComplaints.map(c => {
          const dateStr = c.rawCreatedAt ? new Date(c.rawCreatedAt).toLocaleString('en-IN') : (c.date || '');
          return [
            escapeCSV(c.complaintNumber || c.id),
            escapeCSV(dateStr),
            escapeCSV(c.citizenName || c.name),
            escapeCSV(c.mobileNumber || c.mobile),
            escapeCSV(c.wardName || c.ward),
            escapeCSV(c.areaName || c.location || c.area),
            escapeCSV(c.departmentName || c.department),
            escapeCSV(c.priority),
            escapeCSV(c.status),
            escapeCSV(c.subject),
            escapeCSV(c.description),
            escapeCSV(c.address),
            escapeCSV(c.landmark),
            escapeCSV(c.assignedOfficer)
          ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `Grievances_Export_${timestamp}.csv`;

        await exportCSVFile(filename, csvContent);
      } catch (err) {
        console.error('CSV Export Error:', err);
        Alert.alert('Export Error', err.message || 'Could not export CSV file.');
      }
    };

    const exportExcelFormat = async () => {
      try {
        const token = await authService.getToken();
        const params = new URLSearchParams();
        if (token) params.append('token', token);
        if (departmentFilter && departmentFilter !== 'ALL') {
          const d = departmentsList.find(item => item.name === departmentFilter || String(item.id) === String(departmentFilter));
          if (d) params.append('departmentId', d.id);
          else params.append('search', departmentFilter);
        }
        if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
        if (priorityFilter && priorityFilter !== 'ALL') params.append('priority', priorityFilter);
        if (wardFilter && wardFilter !== 'ALL') {
          const w = wardsData.find(item => item.name === wardFilter || String(item.id) === String(wardFilter));
          if (w) params.append('wardId', w.id);
        }
        if (areaFilter && areaFilter !== 'ALL') {
          const a = availableAreas.find(item => item.name === areaFilter || String(item.id) === String(areaFilter));
          if (a) params.append('areaId', a.id);
        }
        if (officerFilter && officerFilter !== 'ALL') {
          const o = officersList.find(item => item.name === officerFilter || String(item.id) === String(officerFilter));
          if (o) params.append('officerId', o.id);
        }
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        const url = `${API_BASE_URL}/reports/export/excel?${params.toString()}`;
        const timestamp = new Date().toISOString().slice(0, 10);
        await downloadAndShareRemoteFile(url, `Grievances_Report_${timestamp}.xlsx`, token);
      } catch (err) {
        console.error('Excel Export Error:', err);
        // Fallback to on-device CSV export if server endpoint is unreachable
        await exportCSVFormat();
      }
    };

    const exportPDFFormat = async () => {
      try {
        const token = await authService.getToken();
        const params = new URLSearchParams();
        if (token) params.append('token', token);
        if (departmentFilter && departmentFilter !== 'ALL') {
          const d = departmentsList.find(item => item.name === departmentFilter || String(item.id) === String(departmentFilter));
          if (d) params.append('departmentId', d.id);
        }
        if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
        if (priorityFilter && priorityFilter !== 'ALL') params.append('priority', priorityFilter);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        const url = `${API_BASE_URL}/reports/export/pdf?${params.toString()}`;
        const timestamp = new Date().toISOString().slice(0, 10);
        await downloadAndShareRemoteFile(url, `Grievances_Report_${timestamp}.pdf`, token);
      } catch (err) {
        console.error('PDF Export Error:', err);
        Alert.alert('PDF Export Error', 'Unable to download PDF report. You can use the CSV or Excel export options.');
      }
    };

    Alert.alert(
      'Export Grievances',
      `Export ${filteredComplaints.length} filtered grievance record(s)? Choose format:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '📊 Excel Workbook (.xlsx)',
          onPress: exportExcelFormat
        },
        {
          text: '📄 CSV Spreadsheet (.csv)',
          onPress: exportCSVFormat
        },
        {
          text: '📑 PDF Report (.pdf)',
          onPress: exportPDFFormat
        }
      ]
    );
  };


  // Active Filter Count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (priorityFilter !== 'ALL') count++;
    if (departmentFilter !== 'ALL') count++;
    if (wardFilter !== 'ALL') count++;
    if (areaFilter !== 'ALL') count++;
    if (officerFilter !== 'ALL') count++;
    if (dateFilter !== 'ALL') count++;
    if (sortBy !== 'NEWEST') count++;
    return count;
  }, [statusFilter, priorityFilter, departmentFilter, wardFilter, areaFilter, officerFilter, dateFilter, sortBy]);

  // Dynamic Filtering & Sorting
  const filteredComplaints = useMemo(() => {
    let result = [...complaintsData];

    // 1. Text Search Query Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter((item) =>
        item.id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.mobile.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        item.ward.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.assignedOfficer.toLowerCase().includes(query)
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => {
        const itemStatus = (item.rawStatus || '').toUpperCase();
        if (statusFilter === 'OPEN' || statusFilter === 'PENDING') {
          return itemStatus === 'PENDING' || itemStatus === 'OPEN';
        }
        if (statusFilter === 'ASSIGNED') {
          return itemStatus === 'ASSIGNED';
        }
        return itemStatus === statusFilter.toUpperCase() ||
          item.statusType.replace(/\s+/g, '_') === statusFilter.toLowerCase();
      });
    }

    // 3. Priority Filter
    if (priorityFilter !== 'ALL') {
      result = result.filter((item) => item.priorityType === priorityFilter.toLowerCase());
    }

    // 4. Department Filter
    if (departmentFilter !== 'ALL') {
      result = result.filter((item) => item.department.toLowerCase() === departmentFilter.toLowerCase());
    }

    // 5. Ward Filter
    if (wardFilter !== 'ALL') {
      result = result.filter((item) => item.ward.toLowerCase() === wardFilter.toLowerCase());
    }

    // 6. Area Filter
    if (areaFilter !== 'ALL') {
      result = result.filter((item) => item.location.toLowerCase().includes(areaFilter.toLowerCase()));
    }

    // 7. Officer Filter
    if (officerFilter !== 'ALL') {
      result = result.filter((item) => item.assignedOfficer.toLowerCase().includes(officerFilter.toLowerCase()));
    }

    // 8. Date Range Filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      result = result.filter((item) => {
        const itemDate = new Date(item.rawCreatedAt);
        if (dateFilter === 'TODAY') {
          return itemDate.toDateString() === now.toDateString();
        }
        if (dateFilter === 'THIS_WEEK') {
          const diffDays = (now - itemDate) / (1000 * 3600 * 24);
          return diffDays <= 7;
        }
        if (dateFilter === 'THIS_MONTH') {
          return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // 9. Sort
    result.sort((a, b) => {
      if (sortBy === 'OLDEST') {
        return a.rawCreatedAt - b.rawCreatedAt;
      }
      if (sortBy === 'PRIORITY') {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const wA = priorityWeight[a.priorityType] || 0;
        const wB = priorityWeight[b.priorityType] || 0;
        return wB - wA;
      }
      // Default: NEWEST
      return b.rawCreatedAt - a.rawCreatedAt;
    });

    return result;
  }, [complaintsData, searchQuery, statusFilter, priorityFilter, departmentFilter, wardFilter, areaFilter, officerFilter, dateFilter, sortBy]);

  // Priority Styling matching Reference Image
  const getPriorityStyle = (type) => {
    switch (type) {
      case 'critical':
        return { bg: '#fee2e2', text: '#ef4444' };
      case 'high':
        return { bg: '#fef3c7', text: '#d97706' };
      case 'medium':
        return { bg: '#fef9c3', text: '#854d0e' };
      case 'low':
        return { bg: '#ecfdf5', text: '#059669' };
      default:
        return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  // Status Styling matching Reference Image
  const getStatusStyle = (type) => {
    switch (type) {
      case 'resolved':
      case 'closed':
        return { bg: '#ecfdf5', text: '#059669', dot: '#10b981', label: 'Resolved' };
      case 'in_progress':
      case 'in progress':
        return { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b', label: 'In Progress' };
      case 'assigned':
        return { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6', label: 'Assigned' };
      case 'open':
      case 'pending':
        return { bg: '#eff6ff', text: '#2563eb', dot: '#2563eb', label: 'Open' };
      case 'on_hold':
      case 'on hold':
        return { bg: '#f5f3ff', text: '#7c3aed', dot: '#8b5cf6', label: 'On Hold' };
      case 'rejected':
        return { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Rejected' };
      default:
        return { bg: '#eff6ff', text: '#2563eb', dot: '#2563eb', label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Open' };
    }
  };

  // Status Filter Options (Web Parity)
  const statusOptions = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'OPEN', label: 'Open' },
    { id: 'ASSIGNED', label: 'Assigned' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'ON_HOLD', label: 'On Hold' },
    { id: 'CLOSED', label: 'Closed' },
    { id: 'REJECTED', label: 'Rejected' }
  ];

  // Priority Filter Options
  const priorityOptions = [
    { id: 'ALL', label: 'All Priorities' },
    { id: 'CRITICAL', label: 'Critical' },
    { id: 'HIGH', label: 'High' },
    { id: 'MEDIUM', label: 'Medium' },
    { id: 'LOW', label: 'Low' }
  ];

  // Date Range Options
  const dateOptions = [
    { id: 'ALL', label: 'All Time' },
    { id: 'TODAY', label: 'Today' },
    { id: 'THIS_WEEK', label: 'This Week' },
    { id: 'THIS_MONTH', label: 'This Month' }
  ];

  // Sort Options
  const sortOptions = [
    { id: 'NEWEST', label: 'Newest First' },
    { id: 'OLDEST', label: 'Oldest First' },
    { id: 'PRIORITY', label: 'Highest Priority' }
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header with Notification Bell and Profile Avatar */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Scrollable Body Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* Screen Title */}
        <Text style={styles.screenTitle}>Grievance Directory</Text>

        {/* Error Notice Banner */}
        {errorMessage ? (
          <View style={styles.errorNoticeBox}>
            <Text style={styles.errorNoticeText}>{errorMessage}</Text>
            <TouchableOpacity onPress={fetchComplaints} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Search Bar + Tuner Filter Icon Button */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <View style={styles.searchIconCircle} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search ID, citizen..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="never"
            />
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity
                style={styles.searchClearBtn}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Tuner Button with Active Badge */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive
            ]}
            activeOpacity={0.7}
            onPress={handleOpenFilterModal}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={activeFilterCount > 0 ? '#ffffff' : '#ea580c'}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Export Button */}
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.7}
            onPress={handleExportComplaints}
          >
            <Ionicons name="download-outline" size={22} color="#ea580c" />
          </TouchableOpacity>
        </View>

        {/* + New Grievance Primary Action Button (Matching Reference Image) */}
        <View style={styles.newGrievanceBtnRow}>
          <TouchableOpacity
            style={styles.newGrievanceBtn}
            activeOpacity={0.8}
            onPress={onAddComplaintPress}
          >
            <Ionicons name="add" size={19} color="#ffffff" style={{ marginRight: 5 }} />
            <Text style={styles.newGrievanceBtnText}>New Grievance</Text>
          </TouchableOpacity>
        </View>

        {/* Active Filters Pill Bar (if any filter active) */}
        {activeFilterCount > 0 && (
          <View style={styles.activeFiltersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipsScroll}>
              {statusFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Status: {statusFilter}</Text>
                  <TouchableOpacity onPress={() => setStatusFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {priorityFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Priority: {priorityFilter}</Text>
                  <TouchableOpacity onPress={() => setPriorityFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {departmentFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Dept: {departmentFilter}</Text>
                  <TouchableOpacity onPress={() => setDepartmentFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {wardFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Ward: {wardFilter}</Text>
                  <TouchableOpacity onPress={() => setWardFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {areaFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Area: {areaFilter}</Text>
                  <TouchableOpacity onPress={() => setAreaFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {officerFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Officer: {officerFilter}</Text>
                  <TouchableOpacity onPress={() => setOfficerFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {dateFilter !== 'ALL' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Date: {dateFilter}</Text>
                  <TouchableOpacity onPress={() => setDateFilter('ALL')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              {sortBy !== 'NEWEST' && (
                <View style={styles.activeFilterPill}>
                  <Text style={styles.activeFilterPillText}>Sort: {sortBy}</Text>
                  <TouchableOpacity onPress={() => setSortBy('NEWEST')}>
                    <Ionicons name="close-circle" size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={handleResetFilters} style={styles.resetAllBtn}>
                <Text style={styles.resetAllBtnText}>Clear All</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && complaintsData.length === 0 && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Loading grievances...</Text>
          </View>
        )}

        {/* Grievance Cards List (Pixel-Perfect to Figma Reference) */}
        <View style={styles.cardsList}>
          {filteredComplaints.map((item) => {
            const priorityStyle = getPriorityStyle(item.priorityType);
            const statusStyle = getStatusStyle(item.statusType);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.complaintCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (onViewComplaintDetail) {
                    onViewComplaintDetail(item);
                  }
                }}
              >
                {/* 1. Top Row: Grievance ID (Orange) + Date & Chevron */}
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardIdText}>{item.id}</Text>
                  <View style={styles.dateChevronRow}>
                    <Text style={styles.cardDateText}>{item.date}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginLeft: 2 }} />
                  </View>
                </View>

                {/* 2. Citizen Name */}
                <Text style={styles.citizenNameText}>{typeof item.name === 'object' ? item.name?.name : item.name}</Text>

                {/* 3. Address & Ward */}
                <Text style={styles.locationText}>
                  {typeof item.location === 'object' ? item.location?.name : item.location}{item.ward && item.ward !== 'N/A' ? `, ${typeof item.ward === 'object' ? item.ward?.name : item.ward}` : ''}
                </Text>

                {/* 4. Department Tag in Uppercase */}
                <Text style={styles.departmentText}>
                  {typeof item.department === 'object' ? (item.department?.name || 'GENERAL').toUpperCase() : (item.department ? item.department.toUpperCase() : 'GENERAL')}
                </Text>

                {/* 5. Bottom Row: Priority & Status Badges on Left, Take Action on Right */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.badgesRow}>
                    {/* Priority Badge */}
                    <View style={[styles.priorityPill, { backgroundColor: priorityStyle.bg }]}>
                      <Text style={[styles.priorityPillText, { color: priorityStyle.text }]}>
                        {item.priority}
                      </Text>
                    </View>

                    {/* Status Badge with Dot */}
                    <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                      <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                        {statusStyle.label}
                      </Text>
                    </View>

                    {/* Attachment Count Pill if present */}
                    {item.attachments && item.attachments.length > 0 && (
                      <View style={styles.attachmentBadgePill}>
                        <Ionicons name="attach" size={11} color="#0284c7" />
                        <Text style={styles.attachmentBadgeText}>
                          {item.attachments.length}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Take Action Button */}
                  <TouchableOpacity
                    style={styles.takeActionBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (onViewComplaintDetail) {
                        onViewComplaintDetail(item);
                      }
                    }}
                  >
                    <Ionicons name="arrow-forward" size={13.5} color="#ea580c" style={{ marginRight: 5 }} />
                    <Text style={styles.takeActionBtnText}>Take Action</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {!loading && filteredComplaints.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📋</Text>
              <Text style={styles.emptyStateTitle}>No grievances found</Text>
              <Text style={styles.emptyStateSub}>
                {searchQuery || activeFilterCount > 0
                  ? 'Try adjusting or clearing your search filters'
                  : 'No complaints registered yet'}
              </Text>
              {(searchQuery || activeFilterCount > 0) && (
                <TouchableOpacity
                  style={styles.clearSearchFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    handleResetFilters();
                  }}
                >
                  <Text style={styles.clearSearchFilterBtnText}>Reset Search & Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 3. Comprehensive Web Parity Filter Modal */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter Grievances</Text>
                <Text style={styles.modalSubtitle}>Filter and sort complaints directory</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsFilterModalOpen(false)}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              {/* Section 1: Status Filter */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>STATUS</Text>
                <View style={styles.chipsGrid}>
                  {statusOptions.map((opt) => {
                    const isSelected = tempStatus === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setTempStatus(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 2: Priority Filter */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>PRIORITY LEVEL</Text>
                <View style={styles.chipsGrid}>
                  {priorityOptions.map((opt) => {
                    const isSelected = tempPriority === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setTempPriority(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 3: Department Filter */}
              {departmentsList.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>MUNICIPAL DEPARTMENT</Text>
                  <View style={styles.chipsGrid}>
                    <TouchableOpacity
                      style={[styles.modalChip, tempDepartment === 'ALL' && styles.modalChipActive]}
                      onPress={() => setTempDepartment('ALL')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, tempDepartment === 'ALL' && styles.modalChipTextActive]}>
                        All Departments
                      </Text>
                    </TouchableOpacity>
                    {departmentsList.map((dept) => {
                      const deptName = dept.name || dept;
                      const isSelected = tempDepartment === deptName;
                      return (
                        <TouchableOpacity
                          key={dept.id || deptName}
                          style={[styles.modalChip, isSelected && styles.modalChipActive]}
                          onPress={() => setTempDepartment(deptName)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                            {deptName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 4: Ward Filter */}
              {wardsData.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>CONSTITUENCY WARD</Text>
                  <View style={styles.chipsGrid}>
                    <TouchableOpacity
                      style={[styles.modalChip, tempWard === 'ALL' && styles.modalChipActive]}
                      onPress={() => {
                        setTempWard('ALL');
                        setTempArea('ALL');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, tempWard === 'ALL' && styles.modalChipTextActive]}>
                        All Wards
                      </Text>
                    </TouchableOpacity>
                    {wardsData.map((w) => {
                      const wardName = w.name || w;
                      const isSelected = tempWard === wardName;
                      return (
                        <TouchableOpacity
                          key={w.id || wardName}
                          style={[styles.modalChip, isSelected && styles.modalChipActive]}
                          onPress={() => {
                            setTempWard(wardName);
                            setTempArea('ALL');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                            {wardName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 5: Dependent Area Filter (Web Parity) */}
              {availableAreas.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>LOCAL AREA / PETH</Text>
                  <View style={styles.chipsGrid}>
                    <TouchableOpacity
                      style={[styles.modalChip, tempArea === 'ALL' && styles.modalChipActive]}
                      onPress={() => setTempArea('ALL')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, tempArea === 'ALL' && styles.modalChipTextActive]}>
                        All Areas
                      </Text>
                    </TouchableOpacity>
                    {availableAreas.map((area) => {
                      const areaName = area.name || area;
                      const isSelected = tempArea === areaName;
                      return (
                        <TouchableOpacity
                          key={area.id || areaName}
                          style={[styles.modalChip, isSelected && styles.modalChipActive]}
                          onPress={() => setTempArea(areaName)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                            {areaName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 6: Assigned Officer Filter (Web Parity) */}
              {officersList.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>ASSIGNED OFFICER / STAFF</Text>
                  <View style={styles.chipsGrid}>
                    <TouchableOpacity
                      style={[styles.modalChip, tempOfficer === 'ALL' && styles.modalChipActive]}
                      onPress={() => setTempOfficer('ALL')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, tempOfficer === 'ALL' && styles.modalChipTextActive]}>
                        All Officers
                      </Text>
                    </TouchableOpacity>
                    {officersList.map((off) => {
                      const offName = off.name || off.username;
                      const isSelected = tempOfficer === offName;
                      return (
                        <TouchableOpacity
                          key={off.id || offName}
                          style={[styles.modalChip, isSelected && styles.modalChipActive]}
                          onPress={() => setTempOfficer(offName)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                            {offName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 7: Date Range Filter (Web Parity) */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>DATE RANGE</Text>
                <View style={styles.chipsGrid}>
                  {dateOptions.map((opt) => {
                    const isSelected = tempDate === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setTempDate(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 8: Sort Order */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>SORT ORDER</Text>
                <View style={styles.chipsGrid}>
                  {sortOptions.map((opt) => {
                    const isSelected = tempSort === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setTempSort(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={handleResetFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.modalResetBtnText}>Reset All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyFilters}
                activeOpacity={0.8}
              >
                <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab || internalTab}
        onTabPress={handleTabPress}
      />
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
    backgroundColor: '#F8FAFC'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center'
  },

  /* Title Heading */
  screenTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 14
  },

  /* Search & Filter Row */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  searchInputContainer: {
    flex: 1,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  searchIconCircle: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#334155',
    marginRight: 9
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    color: '#0f172a'
  },
  searchClearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  filterButtonActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c'
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff'
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },

  /* + New Grievance Primary Action Button Row (Matching Reference) */
  newGrievanceBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14
  },
  newGrievanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 16,
    paddingVertical: 9.5,
    borderRadius: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  newGrievanceBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700'
  },

  /* Active Filters Bar */
  activeFiltersBar: {
    marginBottom: 12
  },
  activeChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    gap: 6
  },
  activeFilterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  resetAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9'
  },
  resetAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b'
  },

  /* Grievance Card Styles (Pixel-Perfect to Figma Reference) */
  cardsList: {
    gap: 12
  },
  complaintCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  cardIdText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: -0.2
  },
  dateChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  cardDateText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '500'
  },
  citizenNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2
  },
  locationText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '400'
  },
  departmentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginTop: 5,
    marginBottom: 12
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14
  },
  priorityPillText: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 14
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  attachmentBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 12,
    gap: 2
  },
  attachmentBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0369a1'
  },
  takeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6.5
  },
  takeActionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c'
  },

  /* Empty & Error States */
  errorNoticeBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  errorNoticeText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600'
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyStateEmoji: {
    fontSize: 36,
    marginBottom: 8
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569'
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center'
  },
  clearSearchFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffedd5'
  },
  clearSearchFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c'
  },

  /* Filter Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalScrollBody: {
    marginTop: 14
  },
  modalSection: {
    marginBottom: 18
  },
  modalSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  modalChip: {
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c'
  },
  modalChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalChipTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  modalResetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalResetBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748b'
  },
  modalApplyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  modalApplyBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff'
  }
});
