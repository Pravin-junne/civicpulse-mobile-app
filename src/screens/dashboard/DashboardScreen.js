import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Dimensions,
  Modal,
  Pressable,
  AppState,
  Linking,
  Animated,
  ActivityIndicator,
  Image,
  ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import GeographicAnalyticsMap from '../../components/dashboard/GeographicAnalyticsMap';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Mini Bar Chart indicator component for metric cards
 */
const MiniBarChart = ({ color = '#f97316' }) => {
  const barHeights = [8, 14, 10, 18, 22];
  return (
    <View style={styles.miniChartWrapper}>
      {barHeights.map((h, idx) => (
        <View
          key={idx}
          style={[
            styles.miniBar,
            { height: h, backgroundColor: color, opacity: 0.35 + idx * 0.15 }
          ]}
        />
      ))}
    </View>
  );
};

export default function DashboardScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onNavigateGrievances,
  onNavigateLiveTrack,
  onNavigateDepartments,
  onNavigateAppointments,
  onNavigateAssets,
  onNavigateBudget,
  onNavigateExpenses,
  onNavigateEvents,
  onNavigatePerformance,
  onNavigateReports,
  onNavigateContacts,
  onNavigateFileManager,
  onViewComplaintDetail,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  // Geographic Analytics Map States
  const [allComplaintsForMap, setAllComplaintsForMap] = useState([]);
  const [areaStatsData, setAreaStatsData] = useState([]);

  // Live Aggregate Statistics
  const [statsData, setStatsData] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    satisfaction: '0%'
  });

  const [budgetData, setBudgetData] = useState({
    totalAllocated: 0,
    totalConsumed: 0,
    utilizationPercentage: 0
  });

  const [appointmentData, setAppointmentData] = useState({
    total: 0,
    todayCount: 0,
    pendingCount: 0,
    completedCount: 0
  });

  const [assetData, setAssetData] = useState({
    total: 0,
    valuation: 0,
    activeCount: 0,
    underRepairCount: 0
  });

  const [liveDeptData, setLiveDeptData] = useState([]);
  const [livePersonnel, setLivePersonnel] = useState([]);
  const [liveRecentGrievances, setLiveRecentGrievances] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, complaintsRes] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/complaints?limit=100')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const data = statsRes.value;
        const overall = data.overall || data.overallStats;
        if (overall) {
          const totalTickets = overall.total || 0;
          const resolvedTickets = (overall.resolved || 0) + (overall.closed || 0);
          const rate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

          setStatsData({
            total: totalTickets,
            open: (overall.pending || 0) + (overall.assigned || 0),
            inProgress: overall.inProgress || 0,
            resolved: resolvedTickets,
            satisfaction: `${rate}%`
          });
        }
        if (data.budgetSummary) {
          setBudgetData(data.budgetSummary);
        }
        if (data.appointmentSummary) {
          setAppointmentData(data.appointmentSummary);
        }
        if (data.assetSummary) {
          setAssetData(data.assetSummary);
        }
        const deptList = data.departmentWise || data.departmentStats;
        if (deptList && deptList.length > 0) {
          const colors = ['#ea580c', '#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6'];
          setLiveDeptData(deptList.map((d, i) => ({
            name: typeof d.name === 'object' ? (d.name?.name || 'Department') : (d.name || 'Department'),
            count: d.total || 0,
            total: Math.max(d.total, 1),
            color: colors[i % colors.length]
          })));
        }
        const personnelList = data.officerWise || data.personnelStats;
        if (personnelList && personnelList.length > 0) {
          setLivePersonnel(personnelList.map(p => ({
            ...p,
            departmentName: typeof p.departmentName === 'object' ? (p.departmentName?.name || 'Unassigned') : (p.departmentName || 'Unassigned')
          })));
        }
        const areaList = data.areaWise || data.areaStats;
        if (areaList && areaList.length > 0) {
          setAreaStatsData(areaList);
        }
      }

      if (complaintsRes.status === 'fulfilled' && complaintsRes.value) {
        const cData = complaintsRes.value;
        const complaintsList = Array.isArray(cData) ? cData : (cData.complaints || []);
        setAllComplaintsForMap(complaintsList);

        if (complaintsList.length > 0) {
          setLiveRecentGrievances(complaintsList.slice(0, 5).map(c => ({
            ...c,
            rawComplaint: c,
            rawId: c.id,
            id: c.complaintNumber || (c.id ? `OKT-${c.id}` : 'Complaint'),
            date: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
            name: typeof c.citizenName === 'object' ? (c.citizenName?.name || 'Citizen') : (c.citizenName || 'Citizen'),
            phone: c.mobileNumber || c.mobile || 'N/A',
            department: typeof c.department === 'object' ? (c.department?.name || 'General Administration') : (c.department || 'General Administration'),
            priority: c.priority ? c.priority.charAt(0) + c.priority.slice(1).toLowerCase() : 'Medium',
            priorityType: (c.priority || 'medium').toLowerCase(),
            status: c.status ? c.status.replace(/_/g, ' ') : 'Pending',
            statusType: (c.status || 'open').toLowerCase().replace(/_/g, '_')
          })));
        } else {
          setLiveRecentGrievances([]);
        }
      }
    } catch (err) {
      console.log('Dashboard stats fetch notice:', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Refresh immediately when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchDashboardData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Officer Performance Metrics State
  const [officerRoleFilter, setOfficerRoleFilter] = useState('ALL');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const activePersonnelList = livePersonnel;

  const filteredPersonnel = activePersonnelList.filter((off) => {
    if (officerRoleFilter === 'ALL') return true;
    return off.role === officerRoleFilter;
  });

  const getRoleBadgeText = () => {
    if (officerRoleFilter === 'ALL') {
      return `${filteredPersonnel.length} TOTAL PERSONNEL`;
    }
    if (officerRoleFilter === 'OFFICER') {
      return `${filteredPersonnel.length} PMC OFFICERS`;
    }
    return `${filteredPersonnel.length} IN-OFFICE STAFF`;
  };

  const getRoleFilterLabel = (key) => {
    switch (key) {
      case 'ALL':
        return 'All Roles (PMC Officer & In-Office)';
      case 'OFFICER':
        return 'PMC Department Officers';
      case 'IN_OFFICE_PERSON':
        return 'In-Office Person (Desk Staff)';
      default:
        return 'All Roles';
    }
  };

  const getEmptyStateText = () => {
    if (officerRoleFilter === 'OFFICER') return 'No PMC department officers found.';
    if (officerRoleFilter === 'IN_OFFICE_PERSON') return 'No in-office personnel found.';
    return 'No officers or personnel found in system.';
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // Grievance Breakdown Filter: 'DEPARTMENT' or 'AREA'
  const [breakdownFilter, setBreakdownFilter] = useState('DEPARTMENT');
  const [breakdownStatusFilter, setBreakdownStatusFilter] = useState('ALL');

  // Filtered complaints for breakdown calculation
  const filteredComplaintsForBreakdown = useMemo(() => {
    if (breakdownStatusFilter === 'ALL') return allComplaintsForMap;
    return (allComplaintsForMap || []).filter((c) => {
      const statusUpper = (c.status || '').toUpperCase().trim();
      const priorityUpper = (c.priority || '').toUpperCase().trim();
      if (breakdownStatusFilter === 'PENDING') {
        return ['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'OPEN'].includes(statusUpper);
      }
      if (breakdownStatusFilter === 'ASSIGNED') {
        return statusUpper === 'ASSIGNED';
      }
      if (breakdownStatusFilter === 'RESOLVED') {
        return ['RESOLVED', 'CLOSED'].includes(statusUpper);
      }
      if (breakdownStatusFilter === 'CRITICAL') {
        return priorityUpper === 'CRITICAL';
      }
      return true;
    });
  }, [allComplaintsForMap, breakdownStatusFilter]);

  // Dynamic civic department icon helper
  const getDeptIcon = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('water')) return '🚰';
    if (n.includes('road') || n.includes('infra') || n.includes('pothole')) return '🛣️';
    if (n.includes('garbage') || n.includes('waste') || n.includes('solid')) return '🗑️';
    if (n.includes('drainage') || n.includes('sewer') || n.includes('gutter')) return '🌊';
    if (n.includes('light') || n.includes('elect') || n.includes('power')) return '⚡';
    if (n.includes('health') || n.includes('sanitat') || n.includes('clean')) return '🧹';
    if (n.includes('garden') || n.includes('tree') || n.includes('park')) return '🌳';
    if (n.includes('building') || n.includes('construct') || n.includes('encroach')) return '🏗️';
    if (n.includes('tax') || n.includes('revenue') || n.includes('finance')) return '💰';
    if (n.includes('police') || n.includes('traffic') || n.includes('security')) return '👮';
    return '🏢';
  };

  // Department Breakdown List
  const departmentBreakdownData = useMemo(() => {
    const deptColors = ['#ea580c', '#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4'];
    const deptMap = new Map();

    if (filteredComplaintsForBreakdown && filteredComplaintsForBreakdown.length > 0) {
      filteredComplaintsForBreakdown.forEach((c) => {
        const deptName = typeof c.department === 'object'
          ? (c.department?.name || 'General Administration')
          : (c.department || c.departmentName || 'General Administration');
        const name = (deptName || 'General Administration').trim();
        if (!deptMap.has(name)) {
          deptMap.set(name, { name, count: 0, pending: 0, resolved: 0 });
        }
        const record = deptMap.get(name);
        record.count += 1;
        const s = (c.status || '').toUpperCase();
        if (['RESOLVED', 'CLOSED'].includes(s)) {
          record.resolved += 1;
        } else {
          record.pending += 1;
        }
      });
    } else if (breakdownStatusFilter === 'ALL' && liveDeptData && liveDeptData.length > 0) {
      liveDeptData.forEach((d) => {
        deptMap.set(d.name, { name: d.name, count: d.count || 0, pending: 0, resolved: 0 });
      });
    }

    const list = Array.from(deptMap.values()).sort((a, b) => b.count - a.count);
    return list.map((d, idx) => ({
      ...d,
      icon: getDeptIcon(d.name),
      color: deptColors[idx % deptColors.length],
      efficiency: d.count > 0 ? Math.round((d.resolved / d.count) * 100) : 0
    }));
  }, [filteredComplaintsForBreakdown, breakdownStatusFilter, liveDeptData]);

  // Area Breakdown List
  const areaBreakdownData = useMemo(() => {
    const areaColors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#a855f7', '#06b6d4'];
    const areaMap = new Map();

    if (filteredComplaintsForBreakdown && filteredComplaintsForBreakdown.length > 0) {
      filteredComplaintsForBreakdown.forEach((c) => {
        const areaName = c.area ? (typeof c.area === 'object' ? c.area.name : c.area) : (c.landmark || 'Pune Central');
        const name = (areaName || 'Pune Central').trim();
        if (!areaMap.has(name)) {
          areaMap.set(name, { name, count: 0, pending: 0, resolved: 0 });
        }
        const record = areaMap.get(name);
        record.count += 1;
        const s = (c.status || '').toUpperCase();
        if (['RESOLVED', 'CLOSED'].includes(s)) {
          record.resolved += 1;
        } else {
          record.pending += 1;
        }
      });
    } else if (breakdownStatusFilter === 'ALL' && areaStatsData && areaStatsData.length > 0) {
      areaStatsData.forEach((a) => {
        const name = (a.area || a.name || 'Pune Locality').trim();
        areaMap.set(name, {
          name,
          count: a.total || 0,
          pending: a.pending || 0,
          resolved: a.completed || 0
        });
      });
    }

    const list = Array.from(areaMap.values()).sort((a, b) => b.count - a.count);
    return list.map((a, idx) => ({
      ...a,
      icon: '📍',
      color: areaColors[idx % areaColors.length],
      efficiency: a.count > 0 ? Math.round((a.resolved / a.count) * 100) : 0
    }));
  }, [filteredComplaintsForBreakdown, breakdownStatusFilter, areaStatsData]);

  const currentBreakdownData = breakdownFilter === 'DEPARTMENT' ? departmentBreakdownData : areaBreakdownData;
  const maxBreakdownCount = Math.max(...currentBreakdownData.map((d) => d.count), 1);
  const totalBreakdownTickets = currentBreakdownData.reduce((sum, d) => sum + d.count, 0);

  const activeRecentGrievances = liveRecentGrievances;

  const getPriorityBadgeStyle = (type) => {
    switch (type) {
      case 'critical':
        return { bg: '#fee2e2', text: '#ef4444' };
      case 'high':
        return { bg: '#fef3c7', text: '#d97706' };
      case 'medium':
        return { bg: '#fef9c3', text: '#ca8a04' };
      case 'low':
        return { bg: '#dcfce7', text: '#16a34a' };
      default:
        return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const getStatusBadgeStyle = (type) => {
    switch (type) {
      case 'resolved':
        return { bg: '#ecfdf5', text: '#059669', dot: '#10b981' };
      case 'in_progress':
        return { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' };
      case 'open':
        return { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' };
      default:
        return { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Brand Header */}
      <MainHeader
        title="Grievance Portal"
        subtitle="Constituency Dashboard"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* ======================================================== */}
        {/* SECTION 1: OVERVIEW METRICS */}
        {/* ======================================================== */}
        <Text style={styles.sectionHeaderTitle}>Overview Metrics</Text>

        {/* 2x2 Grid of Metrics */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Grievances */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.7}
            onPress={() => onNavigateGrievances ? onNavigateGrievances({ status: 'ALL' }) : onTabPress && onTabPress('complaints')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricTitle}>Total Grievances</Text>
              <View style={[styles.dot, { backgroundColor: '#ea580c' }]} />
            </View>
            <Text style={styles.metricValue}>{statsData.total.toLocaleString()}</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricSubtitle, { color: '#ea580c' }]}>View All Tickets →</Text>
              <MiniBarChart color="#ea580c" />
            </View>
          </TouchableOpacity>

          {/* Card 2: Open Tickets */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.7}
            onPress={() => onNavigateGrievances ? onNavigateGrievances({ status: 'OPEN' }) : onTabPress && onTabPress('complaints')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricTitle}>Open Tickets</Text>
              <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />
            </View>
            <Text style={styles.metricValue}>{statsData.open.toLocaleString()}</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricSubtitle, { color: '#3b82f6' }]}>Pending Action →</Text>
              <MiniBarChart color="#3b82f6" />
            </View>
          </TouchableOpacity>

          {/* Card 3: In Progress */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.7}
            onPress={() => onNavigateGrievances ? onNavigateGrievances({ status: 'IN_PROGRESS' }) : onTabPress && onTabPress('complaints')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricTitle}>In Progress</Text>
              <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
            </View>
            <Text style={styles.metricValue}>{statsData.inProgress.toLocaleString()}</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricSubtitle, { color: '#f59e0b' }]}>In Resolution →</Text>
              <MiniBarChart color="#f59e0b" />
            </View>
          </TouchableOpacity>

          {/* Card 4: Resolved */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.7}
            onPress={() => onNavigateGrievances ? onNavigateGrievances({ status: 'RESOLVED' }) : onTabPress && onTabPress('complaints')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricTitle}>Resolved</Text>
              <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            </View>
            <Text style={styles.metricValue}>{statsData.resolved.toLocaleString()}</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricSubtitle, { color: '#10b981' }]}>{statsData.satisfaction} satisfaction →</Text>
              <MiniBarChart color="#10b981" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* SECTION 2: GRIEVANCES BREAKDOWN (Dept Wise / Area Wise) */}
        {/* ======================================================== */}
        <View style={styles.whiteCardContainer}>
          <View style={styles.breakdownHeaderRow}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.7}
              onPress={() => {
                if (onNavigateGrievances) {
                  onNavigateGrievances({
                    status: breakdownStatusFilter === 'CRITICAL' ? 'ALL' : breakdownStatusFilter,
                    priority: breakdownStatusFilter === 'CRITICAL' ? 'CRITICAL' : 'ALL'
                  });
                } else if (onTabPress) {
                  onTabPress('complaints');
                }
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.breakdownTitleIconCircle, { backgroundColor: breakdownFilter === 'DEPARTMENT' ? '#fff7ed' : '#eff6ff' }]}>
                    <Text style={{ fontSize: 16 }}>{breakdownFilter === 'DEPARTMENT' ? '🏢' : '📍'}</Text>
                  </View>
                  <Text style={styles.cardHeaderTitle}>
                    Grievances by {breakdownFilter === 'DEPARTMENT' ? 'Department' : 'Area'}
                  </Text>
                </View>
                <View style={styles.breakdownCountBadge}>
                  <Text style={styles.breakdownCountBadgeText}>
                    {totalBreakdownTickets} {totalBreakdownTickets === 1 ? 'Ticket' : 'Tickets'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardHeaderSubtitle}>
                {breakdownFilter === 'DEPARTMENT'
                  ? 'Civic department grievance distribution & resolution workload'
                  : 'Municipal ward & locality distribution with active hotzones'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Filter Switcher */}
          <View style={styles.segmentedToggleContainer}>
            <TouchableOpacity
              style={[
                styles.segmentedPill,
                breakdownFilter === 'DEPARTMENT' && styles.segmentedPillActive
              ]}
              activeOpacity={0.7}
              onPress={() => setBreakdownFilter('DEPARTMENT')}
            >
              <Text
                style={[
                  styles.segmentedPillText,
                  breakdownFilter === 'DEPARTMENT' && styles.segmentedPillTextActive
                ]}
              >
                🏢 Department Wise
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentedPill,
                breakdownFilter === 'AREA' && styles.segmentedPillActive
              ]}
              activeOpacity={0.7}
              onPress={() => setBreakdownFilter('AREA')}
            >
              <Text
                style={[
                  styles.segmentedPillText,
                  breakdownFilter === 'AREA' && styles.segmentedPillTextActive
                ]}
              >
                📍 Area Wise
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Quick Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breakdownStatusFiltersRow}
          >
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'PENDING', label: '🟡 Active / Pending' },
              { id: 'ASSIGNED', label: '🔵 Assigned' },
              { id: 'RESOLVED', label: '🟢 Resolved' },
              { id: 'CRITICAL', label: '🔴 Critical' }
            ].map((sf) => {
              const isSelected = breakdownStatusFilter === sf.id;
              return (
                <TouchableOpacity
                  key={sf.id}
                  style={[
                    styles.breakdownFilterChip,
                    isSelected && styles.breakdownFilterChipActive
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setBreakdownStatusFilter(sf.id)}
                >
                  <Text
                    style={[
                      styles.breakdownFilterChipText,
                      isSelected && styles.breakdownFilterChipTextActive
                    ]}
                  >
                    {sf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* List of Bars */}
          <View style={styles.deptListContainer}>
            {currentBreakdownData.length === 0 ? (
              <View style={styles.breakdownEmptyContainer}>
                <Text style={styles.breakdownEmptyText}>
                  No grievances recorded for the selected {breakdownFilter === 'DEPARTMENT' ? 'department' : 'area'} filter.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.breakdownScrollContainer}
                contentContainerStyle={styles.breakdownScrollContent}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                indicatorStyle="black"
              >
                {currentBreakdownData.map((item, index) => {
                  const widthPct = `${Math.min(100, Math.max(8, (item.count / maxBreakdownCount) * 100))}%`;
                  const sharePct = totalBreakdownTickets > 0 ? Math.round((item.count / totalBreakdownTickets) * 100) : 0;

                  return (
                    <TouchableOpacity
                      key={`${breakdownFilter}-${item.name}-${index}`}
                      style={[
                        styles.breakdownItemCard,
                        index === currentBreakdownData.length - 1 && styles.breakdownItemCardLast
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        const filters = {};
                        if (breakdownFilter === 'DEPARTMENT') {
                          filters.department = item.name;
                        } else {
                          filters.area = item.name;
                        }
                        if (breakdownStatusFilter === 'CRITICAL') {
                          filters.priority = 'CRITICAL';
                        } else if (breakdownStatusFilter !== 'ALL') {
                          filters.status = breakdownStatusFilter;
                        }
                        if (onNavigateGrievances) {
                          onNavigateGrievances(filters);
                        } else if (onTabPress) {
                          onTabPress('complaints');
                        }
                      }}
                    >
                      <View style={styles.breakdownCardHeader}>
                        <View style={styles.breakdownLeftHeader}>
                          <View style={[styles.breakdownIconBox, { backgroundColor: item.color + '18' }]}>
                            <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.breakdownItemName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <View style={styles.breakdownSubRow}>
                              <View style={styles.breakdownSubPillPending}>
                                <Text style={styles.breakdownSubTextPending}>{item.pending || 0} Open</Text>
                              </View>
                              <View style={styles.breakdownSubPillResolved}>
                                <Text style={styles.breakdownSubTextResolved}>{item.resolved || 0} Resolved</Text>
                              </View>
                              {sharePct > 0 && (
                                <Text style={styles.breakdownShareText}>
                                  • {sharePct}% share
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>

                        <View style={styles.breakdownRightHeader}>
                          <Text style={styles.breakdownItemTotalCount}>{item.count}</Text>
                          <Text style={styles.breakdownItemTotalLabel}>Tickets</Text>
                        </View>
                      </View>

                      {/* Progress track */}
                      <View style={styles.breakdownTrackBox}>
                        <View style={styles.breakdownBarTrack}>
                          <View
                            style={[
                              styles.breakdownBarFill,
                              {
                                width: widthPct,
                                backgroundColor: item.color
                              }
                            ]}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Summary Footer Banner */}
          {currentBreakdownData.length > 0 && (
            <View style={styles.breakdownSummaryFooter}>
              <View style={styles.breakdownFooterCol}>
                <Text style={styles.breakdownFooterLabel}>Top {breakdownFilter === 'DEPARTMENT' ? 'Dept' : 'Locality'}</Text>
                <Text style={styles.breakdownFooterVal} numberOfLines={1}>
                  {currentBreakdownData[0]?.name || 'N/A'}
                </Text>
              </View>
              <View style={styles.breakdownFooterDivider} />
              <View style={styles.breakdownFooterCol}>
                <Text style={styles.breakdownFooterLabel}>Categories</Text>
                <Text style={styles.breakdownFooterVal}>
                  {currentBreakdownData.length} {breakdownFilter === 'DEPARTMENT' ? 'Depts' : 'Areas'}
                </Text>
              </View>
              <View style={styles.breakdownFooterDivider} />
              <View style={styles.breakdownFooterCol}>
                <Text style={styles.breakdownFooterLabel}>Total Volume</Text>
                <Text style={[styles.breakdownFooterVal, { color: '#ea580c' }]}>
                  {totalBreakdownTickets} Grievances
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* SECTION 3: CONSTITUENCY OFFICE OVERVIEW */}
        {/* ======================================================== */}
        <View style={styles.constituencySectionHeader}>
          <Text style={styles.sectionHeaderTitle}>Constituency Office Overview</Text>
          <Text style={styles.sectionHeaderSubtitle}>Real-time Operational Metrics</Text>
        </View>

        {/* 2x2 Grid of Office Overview */}
        <View style={styles.metricsGrid}>
          {/* 1. BUDGET */}
          <TouchableOpacity
            style={styles.officeCard}
            activeOpacity={0.7}
            onPress={() => onNavigateBudget ? onNavigateBudget() : (navigation && navigation.navigate('budget'))}
          >
            <View style={styles.officeCardTop}>
              <Text style={[styles.badgeLabel, { color: '#8b5cf6' }]}>BUDGET</Text>
              <View style={[styles.iconCircle, { backgroundColor: '#f5f3ff' }]}>
                <Text style={{ color: '#8b5cf6', fontSize: 13, fontWeight: '700' }}>₹</Text>
              </View>
            </View>
            <Text style={[styles.officeValue, { color: '#7c3aed' }]}>
              {budgetData.totalAllocated >= 100000 ? `₹${(budgetData.totalAllocated / 100000).toFixed(1)}L` : `₹${budgetData.totalAllocated.toLocaleString()}`}
            </Text>
            <Text style={styles.officeSublabel}>Allocated</Text>
            <View style={styles.officeFooterRow}>
              <Text style={styles.officeFooterLeft}>Consumed: <Text style={{ color: '#ea580c', fontWeight: '700' }}>₹{(budgetData.totalConsumed || 0).toLocaleString()}</Text></Text>
              <Text style={styles.officeFooterRight}>{budgetData.utilizationPercentage || 0}%</Text>
            </View>
            <Text style={[styles.utilizationText, { color: '#8b5cf6' }]}>Manage Allocations →</Text>
          </TouchableOpacity>

          {/* 2. APPOINTMENTS */}
          <TouchableOpacity
            style={styles.officeCard}
            activeOpacity={0.7}
            onPress={() => onNavigateAppointments ? onNavigateAppointments() : (navigation && navigation.navigate('appointments'))}
          >
            <View style={styles.officeCardTop}>
              <Text style={[styles.badgeLabel, { color: '#10b981' }]}>APPOINTMENTS</Text>
              <View style={[styles.iconCircle, { backgroundColor: '#ecfdf5' }]}>
                <Text style={{ fontSize: 13 }}>📅</Text>
              </View>
            </View>
            <Text style={[styles.officeValue, { color: '#059669' }]}>{appointmentData.todayCount || 0}</Text>
            <Text style={styles.officeSublabel}>Today's Scheduled</Text>
            <View style={styles.officeFooterRow}>
              <Text style={styles.officeFooterLeft}>Active Queue:</Text>
              <Text style={styles.officeFooterRight}>{appointmentData.pendingCount || 0} Pending</Text>
            </View>
            <Text style={[styles.manageLink, { color: '#059669' }]}>Total Booked: {appointmentData.total || 0} →</Text>
          </TouchableOpacity>

          {/* 3. ASSET INVENTORY */}
          <TouchableOpacity
            style={styles.officeCard}
            activeOpacity={0.7}
            onPress={() => onNavigateAssets ? onNavigateAssets() : (navigation && navigation.navigate('assets'))}
          >
            <View style={styles.officeCardTop}>
              <Text style={[styles.badgeLabel, { color: '#ea580c' }]}>ASSET INVENTORY</Text>
              <View style={[styles.iconCircle, { backgroundColor: '#fff7ed' }]}>
                <Text style={{ fontSize: 13 }}>📦</Text>
              </View>
            </View>
            <Text style={[styles.officeValue, { color: '#ea580c' }]}>{assetData.total || 0} Items</Text>
            <Text style={styles.officeSublabel}>Total Assets</Text>
            <View style={styles.officeFooterRow}>
              <Text style={styles.officeFooterLeft}>Valuation:</Text>
              <Text style={[styles.officeFooterRight, { fontWeight: '700' }]}>₹{(assetData.valuation || 0).toLocaleString()}</Text>
            </View>
            <Text style={styles.activeAssetMeta}>Active: <Text style={{ fontWeight: '700' }}>{assetData.activeCount || 0}</Text>  In Repair: <Text style={{ fontWeight: '700' }}>{assetData.underRepairCount || 0}</Text> →</Text>
          </TouchableOpacity>

          {/* 4. EVENTS */}
          <TouchableOpacity
            style={styles.officeCard}
            activeOpacity={0.7}
            onPress={() => onNavigateEvents ? onNavigateEvents() : (navigation && navigation.navigate('events'))}
          >
            <View style={styles.officeCardTop}>
              <Text style={[styles.badgeLabel, { color: '#3b82f6' }]}>EVENTS</Text>
              <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                <Text style={{ fontSize: 13 }}>🗓️</Text>
              </View>
            </View>
            <Text style={[styles.officeValue, { color: '#2563eb' }]}>{appointmentData.total || 0}</Text>
            <Text style={styles.officeSublabel}>Total Scheduled</Text>
            <View style={styles.officeFooterRow}>
              <Text style={styles.officeFooterLeft}>Upcoming:</Text>
              <Text style={[styles.officeFooterRight, { fontWeight: '700', color: '#2563eb' }]}>{appointmentData.todayCount || 0}</Text>
            </View>
            <Text style={[styles.manageLink, { color: '#2563eb' }]}>Manage Events →</Text>
          </TouchableOpacity>
        </View>

        {/* 5. OFFICE EXPENSES (Full Width) */}
        <TouchableOpacity
          style={styles.officeExpensesCard}
          activeOpacity={0.7}
          onPress={() => onNavigateExpenses ? onNavigateExpenses() : (navigation && navigation.navigate('expenses'))}
        >
          <View style={styles.officeCardTop}>
            <Text style={[styles.badgeLabel, { color: '#ea580c' }]}>OFFICE EXPENSES</Text>
            <View style={[styles.iconCircle, { backgroundColor: '#fff7ed' }]}>
              <Text style={{ fontSize: 13 }}>🧾</Text>
            </View>
          </View>
          <Text style={[styles.officeValue, { color: '#ea580c' }]}>₹{(budgetData.totalConsumed || 0).toLocaleString()}</Text>
          <Text style={styles.officeSublabel}>This Month</Text>
          <View style={styles.officeExpensesFooter}>
            <Text style={styles.officeFooterLeft}>Yearly:</Text>
            <Text style={[styles.officeFooterRight, { color: '#ea580c', fontWeight: '700' }]}>₹{(budgetData.totalConsumed || 0).toLocaleString()}</Text>
          </View>
          <Text style={[styles.manageLink, { color: '#ea580c', marginTop: 4 }]}>Utilization: {budgetData.utilizationPercentage || 0}% →</Text>
        </TouchableOpacity>

        {/* ======================================================== */}
        {/* SECTION 4: RECENT GRIEVANCES */}
        {/* ======================================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Recent Grievances</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => onNavigateGrievances ? onNavigateGrievances() : onTabPress && onTabPress('complaints')}>
            <Text style={styles.viewAllOrangeText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grievanceList}>
          {activeRecentGrievances.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 24, alignItems: 'center', borderColor: '#e2e8f0', borderWidth: 1 }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>No recent grievances recorded in system.</Text>
            </View>
          ) : (
            activeRecentGrievances.map((item) => {
              const priorityStyle = getPriorityBadgeStyle(item.priorityType);
              const statusStyle = getStatusBadgeStyle(item.statusType);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.grievanceCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (onViewComplaintDetail) {
                      onViewComplaintDetail(item.rawComplaint || item);
                    } else if (onNavigateGrievances) {
                      onNavigateGrievances();
                    } else if (onTabPress) {
                      onTabPress('complaints');
                    }
                  }}
                >
                  {/* Header Row: ID + Date */}
                  <View style={styles.grievanceHeaderRow}>
                    <Text style={styles.grievanceIdText}>{item.id}</Text>
                    <Text style={styles.grievanceDateText}>{item.date}</Text>
                  </View>

                  {/* Citizen Name & Phone */}
                  <Text style={styles.citizenNameText}>{item.name}</Text>
                  <Text style={styles.citizenPhoneText}>{item.phone}</Text>

                  {/* Department */}
                  <View style={styles.grievanceDeptRow}>
                    <Text style={styles.deptIcon}>🛡️</Text>
                    <Text style={styles.grievanceDeptText}>{typeof item.department === 'object' ? (item.department?.name || 'General') : (item.department || 'General')}</Text>
                  </View>

                  {/* Badges Row */}
                  <View style={styles.grievanceBadgesRow}>
                    {/* Priority Badge */}
                    <View style={[styles.pillBadge, { backgroundColor: priorityStyle.bg }]}>
                      <Text style={[styles.pillBadgeText, { color: priorityStyle.text }]}>
                        {item.priority}
                      </Text>
                    </View>

                    {/* Status Badge with Dot */}
                    <View style={[styles.pillBadge, { backgroundColor: statusStyle.bg }]}>
                      <View style={[styles.badgeDot, { backgroundColor: statusStyle.dot }]} />
                      <Text style={[styles.pillBadgeText, { color: statusStyle.text }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ======================================================== */}
        {/* SECTION 5: GEOGRAPHIC ANALYTICS MAP (Pune City) */}
        {/* ======================================================== */}
        <GeographicAnalyticsMap
          complaints={allComplaintsForMap}
          areaStats={areaStatsData}
          onViewComplaintDetail={onViewComplaintDetail}
          onNavigateGrievances={onNavigateGrievances || (() => onTabPress && onTabPress('complaints'))}
        />

        {/* ======================================================== */}
        {/* SECTION 6: OFFICER PERFORMANCE METRICS (Web Reference) */}
        {/* ======================================================== */}
        <View style={styles.metricsCardWrapper}>
          {/* Card Top Header & Filter Controls */}
          <View style={styles.metricsHeaderBox}>
            <TouchableOpacity
              style={styles.metricsTitleGroup}
              activeOpacity={0.7}
              onPress={() => onNavigatePerformance ? onNavigatePerformance() : (onTabPress && onTabPress('reports'))}
            >
              <Text style={styles.metricsTitleText}>Officer Performance Metrics</Text>
              <View style={styles.roleCountBadge}>
                <Text style={styles.roleCountBadgeText}>{getRoleBadgeText()} →</Text>
              </View>
            </TouchableOpacity>

            {/* Filter By Role Dropdown Trigger */}
            <View style={styles.filterByRoleRow}>
              <Text style={styles.filterByRoleLabel}>Filter By Role:</Text>
              <TouchableOpacity
                style={styles.roleSelectBox}
                activeOpacity={0.7}
                onPress={() => setIsRoleDropdownOpen(true)}
              >
                <Text style={styles.roleSelectBoxText} numberOfLines={1}>
                  {getRoleFilterLabel(officerRoleFilter)}
                </Text>
                <Text style={styles.roleSelectBoxChevron}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Table Container Card */}
          <View style={styles.innerTableContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScrollContent}
            >
              <View style={styles.tableBlock}>
                {/* Table Header Row (All 7 columns matching web) */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: 140 }]}>OFFICER / STAFF NAME</Text>
                  <Text style={[styles.tableHeaderCell, { width: 105 }]}>SYSTEM ROLE</Text>
                  <Text style={[styles.tableHeaderCell, { width: 140 }]}>ASSOCIATED DEPARTMENT</Text>
                  <Text style={[styles.tableHeaderCell, { width: 95, textAlign: 'center' }]}>ASSIGNED COMPLAINTS</Text>
                  <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center' }]}>ACTIVE PENDING</Text>
                  <Text style={[styles.tableHeaderCell, { width: 100, textAlign: 'center' }]}>COMPLETED COMPLAINTS</Text>
                  <Text style={[styles.tableHeaderCell, { width: 115, textAlign: 'center' }]}>RESOLUTION EFFICIENCY</Text>
                </View>

                {/* Table Body / Rows or Empty State */}
                {filteredPersonnel.length === 0 ? (
                  <View style={styles.tableEmptyRow}>
                    <Text style={styles.tableEmptyText}>{getEmptyStateText()}</Text>
                  </View>
                ) : (
                  filteredPersonnel.map((off, index) => {
                    const rate = off.resolutionPercentage;
                    const dotColor = rate >= 70 ? '#10b981' : (rate >= 40 ? '#f59e0b' : '#ef4444');
                    const isLast = index === filteredPersonnel.length - 1;

                    return (
                      <TouchableOpacity
                        key={`${off.role}-${off.id}`}
                        style={[styles.tableDataRow, isLast && styles.tableDataRowLast]}
                        activeOpacity={0.7}
                        onPress={() => onNavigateGrievances ? onNavigateGrievances({ officer: off.name }) : (onTabPress && onTabPress('complaints'))}
                      >
                        {/* 1. Name */}
                        <View style={{ width: 140 }}>
                          <Text style={styles.cellNameText}>{off.name}</Text>
                        </View>

                        {/* 2. System Role Badge */}
                        <View style={{ width: 105 }}>
                          <View style={[
                            styles.systemRoleBadge,
                            off.role === 'IN_OFFICE_PERSON' ? styles.systemRoleBadgeInOffice : styles.systemRoleBadgeOfficer
                          ]}>
                            <Text style={[
                              styles.systemRoleBadgeText,
                              off.role === 'IN_OFFICE_PERSON' ? styles.systemRoleTextInOffice : styles.systemRoleTextOfficer
                            ]}>
                              {off.roleLabel}
                            </Text>
                          </View>
                        </View>

                        {/* 3. Associated Department */}
                        <View style={{ width: 140 }}>
                          <Text style={styles.cellDeptText}>{typeof off.departmentName === 'object' ? (off.departmentName?.name || 'General') : (off.departmentName || 'General')}</Text>
                        </View>

                        {/* 4. Assigned Complaints */}
                        <View style={{ width: 95, alignItems: 'center' }}>
                          <Text style={styles.cellCountText}>{off.assigned}</Text>
                        </View>

                        {/* 5. Active Pending Badge */}
                        <View style={{ width: 90, alignItems: 'center' }}>
                          <View style={styles.badgePending}>
                            <Text style={styles.badgePendingText}>{off.pending}</Text>
                          </View>
                        </View>

                        {/* 6. Completed Complaints Badge */}
                        <View style={{ width: 100, alignItems: 'center' }}>
                          <View style={styles.badgeCompleted}>
                            <Text style={styles.badgeCompletedText}>{off.completed}</Text>
                          </View>
                        </View>

                        {/* 7. Resolution Efficiency */}
                        <View style={{ width: 115, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={styles.efficiencyContainer}>
                            <View style={[styles.efficiencyDot, { backgroundColor: dotColor }]} />
                            <Text style={styles.efficiencyPercentText}>{rate}%</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Role Selector Modal */}
        <Modal
          visible={isRoleDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRoleDropdownOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsRoleDropdownOpen(false)}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Filter By Role</Text>

              {[
                { key: 'ALL', label: 'All Roles (PMC Officer & In-Office)' },
                { key: 'OFFICER', label: 'PMC Department Officers' },
                { key: 'IN_OFFICE_PERSON', label: 'In-Office Person (Desk Staff)' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.modalOption,
                    officerRoleFilter === item.key && styles.modalOptionActive
                  ]}
                  onPress={() => {
                    setOfficerRoleFilter(item.key);
                    setIsRoleDropdownOpen(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    officerRoleFilter === item.key && styles.modalOptionTextActive
                  ]}>
                    {item.label}
                  </Text>
                  {officerRoleFilter === item.key && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Spacer for bottom navigation / safe space */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Persistent Bottom Navigation Bar */}
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
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Section Title */
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  viewAllOrangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },

  /* 2x2 Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  metricSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },

  /* Mini Chart */
  miniChartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 22,
  },
  miniBar: {
    width: 3.5,
    borderRadius: 1.5,
  },

  /* White Card Container */
  whiteCardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },

  /* Breakdown Header & Filters */
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  breakdownSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  breakdownSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  breakdownSelectChevron: {
    fontSize: 9,
    color: '#64748b',
  },
  segmentedToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    gap: 4,
  },
  segmentedPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedPillActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentedPillTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  breakdownItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  breakdownDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  breakdownTitleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownCountBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  breakdownCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
  },
  breakdownStatusFiltersRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
    paddingVertical: 2,
  },
  breakdownFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  breakdownFilterChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  breakdownFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  breakdownFilterChipTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  deptListContainer: {
    marginTop: 4,
  },
  breakdownScrollContainer: {
    maxHeight: 345,
  },
  breakdownScrollContent: {
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  breakdownItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  breakdownItemCardLast: {
    marginBottom: 2,
  },
  breakdownCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  breakdownLeftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  breakdownIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  breakdownSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  breakdownSubPillPending: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  breakdownSubTextPending: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  breakdownSubPillResolved: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  breakdownSubTextResolved: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  breakdownShareText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  breakdownRightHeader: {
    alignItems: 'flex-end',
    minWidth: 46,
  },
  breakdownItemTotalCount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  breakdownItemTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  breakdownTrackBox: {
    width: '100%',
  },
  breakdownBarTrack: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownEmptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownEmptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  breakdownSummaryFooter: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownFooterCol: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownFooterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  breakdownFooterVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  breakdownFooterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#cbd5e1',
  },

  /* Constituency Office Overview */
  constituencySectionHeader: {
    marginTop: 8,
  },
  officeCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  officeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 1,
  },
  officeSublabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  officeFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  officeFooterLeft: {
    fontSize: 11,
    color: '#64748b',
  },
  officeFooterRight: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '600',
  },
  utilizationText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  manageLink: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  activeAssetMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
  },

  /* Office Expenses (Full Width) */
  officeExpensesCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  officeExpensesFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },

  /* Grievances Feed */
  grievanceList: {
    marginBottom: 14,
  },
  grievanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  grievanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  grievanceIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  grievanceDateText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  citizenNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  citizenPhoneText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  grievanceDeptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deptIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  grievanceDeptText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  grievanceBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ======================================================== */
  /* MUNICIPAL GEOGRAPHIC HEATMAP SECTION (Reference Design) */
  /* ======================================================== */
  mapActionControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  areaWiseStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  areaWiseStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  zoomButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomTextBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  zoomTextBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* Vector Map Canvas Wrapper */
  mapGraphicWrapper: {
    height: 250,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapGridBackground: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  mapVectorCanvas: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  /* Delicate Radiating Vector Road Network Lines */
  roadLine1: {
    position: 'absolute',
    top: '48%',
    left: '-10%',
    width: '120%',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    transform: [{ rotate: '-12deg' }],
  },
  roadLine2: {
    position: 'absolute',
    top: '52%',
    left: '-10%',
    width: '120%',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    transform: [{ rotate: '22deg' }],
  },
  roadLine3: {
    position: 'absolute',
    top: '-10%',
    left: '50%',
    width: 1.5,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    transform: [{ rotate: '8deg' }],
  },
  roadLine4: {
    position: 'absolute',
    top: '-10%',
    left: '32%',
    width: 1.5,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ rotate: '-35deg' }],
  },
  roadLine5: {
    position: 'absolute',
    top: '-10%',
    left: '68%',
    width: 1.5,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ rotate: '40deg' }],
  },
  roadLine6: {
    position: 'absolute',
    top: '25%',
    left: '-10%',
    width: '120%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    transform: [{ rotate: '5deg' }],
  },
  roadLine7: {
    position: 'absolute',
    top: '72%',
    left: '-10%',
    width: '120%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    transform: [{ rotate: '-6deg' }],
  },
  roadLine8: {
    position: 'absolute',
    top: '-10%',
    left: '42%',
    width: 1,
    height: '120%',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    transform: [{ rotate: '-18deg' }],
  },

  /* Concentric Sector Rings */
  roadRingInner: {
    position: 'absolute',
    top: '32%',
    left: '36%',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  roadRingMid: {
    position: 'absolute',
    top: '18%',
    left: '24%',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  roadRingOuter: {
    position: 'absolute',
    top: '4%',
    left: '10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },

  /* Grid mesh */
  gridLineH1: {
    position: 'absolute',
    top: '20%',
    width: '100%',
    height: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridLineH3: {
    position: 'absolute',
    top: '80%',
    width: '100%',
    height: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '25%',
    height: '100%',
    width: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '50%',
    height: '100%',
    width: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridLineV3: {
    position: 'absolute',
    left: '75%',
    height: '100%',
    width: 0.8,
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
  },

  /* River corridor */
  riverCorridor: {
    position: 'absolute',
    top: '40%',
    left: '-10%',
    width: '120%',
    height: 8,
    backgroundColor: 'rgba(224, 242, 254, 0.6)',
    transform: [{ rotate: '-16deg' }],
  },

  /* Center PMC reference anchor */
  pmcCenterAnchor: {
    position: 'absolute',
    top: '49%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmcCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },

  /* Scatter Particle Cloud Cluster Styles */
  clusterCloudBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
  },
  clusterAmbientHalo: {
    position: 'absolute',
    borderRadius: 60,
  },
  clusterMicroParticle: {
    position: 'absolute',
  },
  clusterDenseCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Place Name Label Pill (Crisp, High-Contrast & Responsive) */
  placeNamePill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: -28,
    marginTop: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    gap: 4,
  },
  placeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  placeNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
  },
  placeNameTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  placeCountBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  placeCountText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748b',
  },

  /* Light Theme Floating Inspector Callout */
  lightCalloutCard: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 60,
  },
  calloutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  calloutTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  calloutResBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  calloutResDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  calloutResText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  calloutWardText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  calloutCloseBtn: {
    padding: 3,
  },
  calloutMetricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 6,
  },
  calloutMetricChip: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutMetricNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  calloutMetricLbl: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  calloutTopDept: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  calloutActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calloutGmapsBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    borderRadius: 8,
  },
  calloutGmapsBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  calloutViewTicketsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    paddingVertical: 7,
    borderRadius: 8,
  },
  calloutViewTicketsBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Bottom Legend & Timestamp Row */
  mapFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 4,
  },
  mapLegendCols: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  mapUpdatedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* Area-Wise Status Modal Styles */
  areaModalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
    width: '100%',
  },
  areaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  areaModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  areaModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  areaModalCloseBtn: {
    padding: 4,
  },
  areaModalScroll: {
    marginBottom: 10,
  },
  areaSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  areaSummaryCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  areaSummaryVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  areaSummaryLbl: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  areaListHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  areaListItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  areaListItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  areaListName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  areaListWard: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  areaListResBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  areaListResDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  areaListResText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  areaListProgressTrack: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  areaListProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  areaListFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  areaListFooterText: {
    fontSize: 10.5,
    color: '#64748b',
  },
  areaFocusBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  areaFocusBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  areaGmapsMiniBtn: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Officer Performance Metrics Card Styles */
  metricsCardWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  metricsHeaderBox: {
    marginBottom: 14,
    gap: 10,
  },
  metricsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricsTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  roleCountBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  roleCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.3,
  },
  filterByRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterByRoleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roleSelectBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleSelectBoxText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 6,
  },
  roleSelectBoxChevron: {
    fontSize: 9,
    color: '#64748b',
  },
  innerTableContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableBlock: {
    minWidth: 775,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tableDataRowLast: {
    borderBottomWidth: 0,
  },
  cellNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  systemRoleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  systemRoleBadgeOfficer: {
    backgroundColor: '#eff6ff',
  },
  systemRoleBadgeInOffice: {
    backgroundColor: '#f0fdf4',
  },
  systemRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  systemRoleTextOfficer: {
    color: '#2563eb',
  },
  systemRoleTextInOffice: {
    color: '#16a34a',
  },
  cellDeptText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  cellCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgePending: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  badgePendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  badgeCompleted: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  badgeCompletedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  efficiencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  efficiencyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  efficiencyPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableEmptyRow: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 775,
  },
  tableEmptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },

  /* Modal Role Selector */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  modalOptionActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  modalOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  modalOptionTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  modalCheckmark: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
});
