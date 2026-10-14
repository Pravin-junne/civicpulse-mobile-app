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
  RefreshControl,
  AppState,
  ActivityIndicator,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api, { API_BASE_URL, authService, resolveFileUrl } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadFileDirectlyToDevice } from '../../utils/fileExport';

const formatINR = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' • ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

const statusColors = {
  UPCOMING: { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  COMPLETED: { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' }
};

export default function EventManagementScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddEventPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'

  // Quick Status Change Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedEventForStatus, setSelectedEventForStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalEventsCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalBudgetAllocated: 0
  });

  const fetchEvents = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [eventsRes, statsRes] = await Promise.allSettled([
        api.get('/events'),
        api.get('/events/stats')
      ]);

      if (eventsRes.status === 'fulfilled') {
        const list = Array.isArray(eventsRes.value) ? eventsRes.value : (eventsRes.value?.events || []);
        setEvents(list);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
    } catch (err) {
      console.log('Events fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchEvents(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchEvents]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };

  const handleDeleteEvent = (id, title) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/events/${id}`);
              fetchEvents(true);
              Alert.alert('Deleted', 'Event has been deleted successfully.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete event.');
            }
          }
        }
      ]
    );
  };

  const handleOpenStatusModal = (item) => {
    setSelectedEventForStatus(item);
    setStatusModalVisible(true);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedEventForStatus) return;
    if (selectedEventForStatus.status === newStatus) {
      setStatusModalVisible(false);
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await api.patch(`/events/${selectedEventForStatus.id}/status`, { status: newStatus });
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEventForStatus.id ? { ...e, status: newStatus } : e))
      );
      setStatusModalVisible(false);
      fetchEvents(true);
      Alert.alert('Status Updated', `Event status has been changed to ${newStatus}.`);
    } catch (err) {
      console.log('Update status error:', err);
      Alert.alert(
        'Status Update Failed',
        err.response?.data?.message || err.message || 'Could not update event status.'
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (ev.title && ev.title.toLowerCase().includes(q)) ||
        (ev.location && ev.location.toLowerCase().includes(q)) ||
        (ev.description && ev.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' || (ev.status && ev.status.toUpperCase() === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [events, searchQuery, statusFilter]);

  const handleExportCSV = async () => {
    if (!filteredEvents || filteredEvents.length === 0) {
      Alert.alert('No Records Found', 'There are no events matching the current filters to export.');
      return;
    }
    setIsExportingCsv(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

      const downloadRes = await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/events/export/csv?${params.toString()}`,
        `Events_Export_${Date.now()}.csv`,
        token
      );

      if (!downloadRes || !downloadRes.success) {
        // Direct local CSV fallback
        const headers = 'Event ID,Event Title,Event Date,Time,Location,Status,Allocated Budget (INR),Budget Head,Department,Created By,Description';
        const rows = filteredEvents.map(ev => {
          let dateStr = '';
          let timeStr = '';
          if (ev.eventDate) {
            const d = new Date(ev.eventDate);
            dateStr = d.toLocaleDateString('en-IN');
            timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
          const budgetHead = ev.allocatedFrom?.allocatedTo || ev.allocatedFrom?.source?.name || 'Direct / General';
          const dept = ev.department?.name || '';
          const creator = ev.createdBy?.name || '';
          const esc = str => `"${String(str ?? '').replace(/"/g, '""')}"`;
          return [
            esc(`#${ev.id}`),
            esc(ev.title || ''),
            esc(dateStr),
            esc(timeStr),
            esc(ev.location || ''),
            esc(ev.status || 'UPCOMING'),
            esc(ev.budget ?? 0),
            esc(budgetHead),
            esc(dept),
            esc(creator),
            esc(ev.description || '')
          ].join(',');
        });
        await exportCSVFile(`Events_Export_${Date.now()}.csv`, [headers, ...rows].join('\r\n'));
      }
    } catch (err) {
      console.error('Event CSV Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filteredEvents || filteredEvents.length === 0) {
      Alert.alert('No Records Found', 'There are no events matching the current filters to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

      await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/events/export/pdf?${params.toString()}`,
        `Events_Register_${Date.now()}.pdf`,
        token
      );
    } catch (err) {
      console.error('Event PDF Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export PDF register.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {/* Title Row with Navigation & Actions */}
        <View style={styles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation?.goBack?.()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Event Management</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.newButton}
              activeOpacity={0.8}
              onPress={() => {
                if (onAddEventPress) onAddEventPress();
                else navigation?.navigate?.('create_event');
              }}
            >
              <Text style={styles.newButtonText}>+ Create Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. 4 Metric Cards Grid */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Events */}
          <View style={styles.metricCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#6366f1' }]}>
              <Ionicons name="calendar" size={18} color="#ffffff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#6366f1' }]}>
                {stats?.totalEventsCount ?? events.length}
              </Text>
              <Text style={styles.statLabel}>Total Events</Text>
            </View>
          </View>

          {/* Card 2: Upcoming */}
          <View style={styles.metricCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#2563eb' }]}>
              <Ionicons name="time" size={18} color="#ffffff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>
                {stats?.upcomingCount ?? events.filter(e => e.status === 'UPCOMING').length}
              </Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>

          {/* Card 3: Completed */}
          <View style={styles.metricCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#16a34a' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>
                {stats?.completedCount ?? events.filter(e => e.status === 'COMPLETED').length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Card 4: Cancelled */}
          <View style={styles.metricCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#dc2626' }]}>
              <Ionicons name="close-circle" size={18} color="#ffffff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#dc2626' }]}>
                {stats?.cancelledCount ?? events.filter(e => e.status === 'CANCELLED').length}
              </Text>
              <Text style={styles.statLabel}>Cancelled</Text>
            </View>
          </View>
        </View>

        {/* 2. Total Events Budget Allocated Banner */}
        <View style={styles.budgetBanner}>
          <Text style={styles.budgetBannerLabel}>💰 Total Events Budget Allocated</Text>
          <Text style={styles.budgetBannerValue}>
            {formatINR(stats?.totalBudgetAllocated ?? events.reduce((sum, e) => sum + (e.budget || 0), 0))}
          </Text>
        </View>

        {/* 3. Search & Filter Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginLeft: 4 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, location..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
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

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
        >
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled' }
          ].map((st) => {
            const isActive = statusFilter === st.id;
            return (
              <TouchableOpacity
                key={st.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive
                ]}
                onPress={() => setStatusFilter(st.id)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive
                ]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Heading */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>Scheduled Events</Text>
          <Text style={styles.recordsCount}>{filteredEvents.length} Records</Text>
        </View>

        {/* 4. Events Cards List */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>Loading events...</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No scheduled events found</Text>
            <Text style={styles.emptySub}>Create your first event or adjust search filters.</Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {filteredEvents.map((item) => {
              const sc = statusColors[item.status?.toUpperCase()] || statusColors.UPCOMING;
              return (
                <View key={item.id} style={styles.eventCard}>
                  {/* Top Row: #ID + Status Badge + Budget */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.eventIdText}>#{item.id}</Text>
                      <TouchableOpacity
                        style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border, flexDirection: 'row', alignItems: 'center', gap: 3 }]}
                        onPress={() => handleOpenStatusModal(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusBadgeText, { color: sc.color }]}>
                          {item.status || 'UPCOMING'}
                        </Text>
                        <Ionicons name="chevron-down" size={11} color={sc.color} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.budgetText}>{formatINR(item.budget)}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.eventTitleText}>{item.title}</Text>

                  {/* Date & Time */}
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={15} color="#64748b" />
                    <Text style={styles.metaText}>{formatDate(item.eventDate)}</Text>
                  </View>

                  {/* Location */}
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={15} color="#64748b" />
                    <Text style={styles.metaText}>{item.location || 'Kasba Peth, Ward 5'}</Text>
                  </View>

                  {/* Allocated From Budget (if any) */}
                  {item.allocatedFrom && (
                    <View style={styles.metaRow}>
                      <Ionicons name="wallet-outline" size={15} color="#4f46e5" />
                      <Text style={[styles.metaText, { color: '#4f46e5', fontWeight: '600' }]}>
                        Allocated: {item.allocatedFrom.allocatedTo} ({item.allocatedFrom.source?.name || 'General'})
                      </Text>
                    </View>
                  )}

                  {/* Attachment View Link */}
                  {item.mediaUrl && (
                    <TouchableOpacity
                      style={styles.attachmentRow}
                      onPress={() => {
                        const fullUrl = resolveFileUrl(item.mediaUrl);
                        Linking.openURL(fullUrl).catch(err => console.log('Cannot open URL', err));
                      }}
                    >
                      <Ionicons name="document-attach" size={16} color="#2563eb" />
                      <Text style={styles.attachmentText}>View Attachment</Text>
                    </TouchableOpacity>
                  )}

                  {/* Actions Divider & Buttons */}
                  <View style={styles.cardDivider} />

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.changeStatusBtn}
                      onPress={() => handleOpenStatusModal(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#2563eb" />
                      <Text style={styles.changeStatusBtnText}>Change Status</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteEvent(item.id, item.title)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fabButton}
        activeOpacity={0.85}
        onPress={() => {
          if (onAddEventPress) onAddEventPress();
          else navigation?.navigate?.('create_event');
        }}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Bottom Nav */}
      <BottomNav
        activeTab={activeTab || internalTab}
        onTabPress={handleTabPress}
      />

      {/* Quick Status Change Modal */}
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
          <View style={styles.statusModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.statusModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusModalTitle}>Change Event Status</Text>
                <Text style={styles.statusModalSub} numberOfLines={1}>
                  #{selectedEventForStatus?.id} • {selectedEventForStatus?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setStatusModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {isUpdatingStatus ? (
              <View style={{ padding: 28, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Updating status...</Text>
              </View>
            ) : (
              <View style={styles.statusOptionsList}>
                {[
                  {
                    id: 'UPCOMING',
                    title: 'Upcoming',
                    desc: 'Event is scheduled and actively taking place.',
                    icon: 'time-outline',
                    color: '#2563eb',
                    bg: '#eff6ff',
                    border: '#bfdbfe'
                  },
                  {
                    id: 'COMPLETED',
                    title: 'Completed',
                    desc: 'Event has concluded successfully.',
                    icon: 'checkmark-circle-outline',
                    color: '#16a34a',
                    bg: '#f0fdf4',
                    border: '#bbf7d0'
                  },
                  {
                    id: 'CANCELLED',
                    title: 'Cancelled',
                    desc: 'Event is cancelled and allocated budget is released.',
                    icon: 'close-circle-outline',
                    color: '#dc2626',
                    bg: '#fef2f2',
                    border: '#fecaca'
                  }
                ].map((opt) => {
                  const isCurrent = selectedEventForStatus?.status === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.statusOptionCard,
                        isCurrent && { borderColor: opt.color, backgroundColor: opt.bg }
                      ]}
                      activeOpacity={0.75}
                      onPress={() => handleUpdateStatus(opt.id)}
                    >
                      <View style={[styles.statusOptIconBox, { backgroundColor: opt.bg, borderColor: opt.border }]}>
                        <Ionicons name={opt.icon} size={20} color={opt.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.statusOptTitle, { color: opt.color }]}>{opt.title}</Text>
                          {isCurrent && (
                            <View style={[styles.currentPill, { backgroundColor: opt.color }]}>
                              <Text style={styles.currentPillText}>Current</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.statusOptDesc}>{opt.desc}</Text>
                      </View>
                      {isCurrent && (
                        <Ionicons name="checkmark-circle" size={20} color={opt.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center'
  },

  /* Title Row */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  newButton: {
    backgroundColor: '#2563eb', // Blue primary
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  newButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },

  /* Metrics Grid (4 cards) */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statInfo: {
    flex: 1
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1
  },

  /* Budget Banner */
  budgetBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  budgetBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  budgetBannerValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366f1'
  },

  /* Search Bar */
  searchBarContainer: {
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    marginLeft: 8
  },

  /* Filter Chips */
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  filterChipTextActive: {
    color: '#ffffff'
  },

  /* Section Heading */
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  recordsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },

  /* Event Cards */
  eventsList: {
    gap: 12
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
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
    marginBottom: 8
  },
  eventIdText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  budgetText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6366f1'
  },
  eventTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  metaText: {
    fontSize: 12.5,
    color: '#475569'
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  attachmentText: {
    fontSize: 12.5,
    color: '#2563eb',
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8
  },
  changeStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  changeStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb'
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626'
  },

  /* Status Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  statusModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  statusModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12
  },
  statusModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusModalSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  statusOptionsList: {
    gap: 10
  },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 12
  },
  statusOptIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusOptTitle: {
    fontSize: 14,
    fontWeight: '800'
  },
  statusOptDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2
  },
  currentPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  currentPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase'
  },

  /* Empty & Loading States */
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10
  },
  emptySub: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center'
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center'
  },

  fabButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5
  },
  exportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 12
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
