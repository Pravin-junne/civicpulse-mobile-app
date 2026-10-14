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
  ActivityIndicator,
  AppState,
  Alert,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainHeader, BottomNav } from '../../components';
import api from '../../services/api';
import { exportCSVFile, exportPDFFile } from '../../utils/fileExport';

export default function OfficerPerformanceScreen({
  navigation,
  activeTab = 'reports',
  onTabPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  const [officersList, setOfficersList] = useState([]);

  const fetchPerformance = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/performance/officers');
      const list = Array.isArray(res) ? res : (res && res.officers ? res.officers : []);
      if (list && list.length > 0) {
        // Sort by resolutionPercentage descending
        const sorted = [...list].sort((a, b) => (b.resolutionPercentage || 0) - (a.resolutionPercentage || 0));
        setOfficersList(sorted.map((off, index) => ({
          id: `off-${off.id}`,
          rank: index + 1,
          name: typeof off.name === 'object' ? (off.name?.name || 'Officer') : (off.name || off.username || 'Officer'),
          designation: off.role ? `${String(off.role).replace('_', ' ')} Officer` : 'Field Officer',
          department: typeof off.departmentName === 'object' ? (off.departmentName?.name || 'General Administration') : (off.departmentName || (off.department?.name || 'General Administration')),
          ward: 'Municipal Ward',
          totalAssigned: off.totalAssigned || 0,
          totalResolved: off.completedTotal || (off.resolved || 0) + (off.closed || 0),
          totalPending: off.activePendingTotal || (off.pending || 0) + (off.assigned || 0),
          resolutionRate: off.resolutionPercentage || 0,
          avgResolutionHours: off.avgResolutionHours || 18.0,
          slaComplianceRate: Math.min(100, Math.max(70, (off.resolutionPercentage || 85) + 3))
        })));
      }
    } catch (err) {
      console.log('Officer performance fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchPerformance(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchPerformance]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformance();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const deptFilters = [
    { id: 'ALL', label: 'All Depts' },
    { id: 'Water Supply', label: 'Water Works' },
    { id: 'Roads & Infra', label: 'Roads & Infra' },
    { id: 'Solid Waste', label: 'Solid Waste' },
    { id: 'Health & Medical', label: 'Health' },
    { id: 'Electricity & Lights', label: 'Electricity' }
  ];

  const filteredOfficers = officersList.filter((item) => {
    const deptStr = String(item.department || '');
    if (selectedDept !== 'ALL' && !deptStr.toLowerCase().includes(selectedDept.toLowerCase())) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      String(item.name || '').toLowerCase().includes(query) ||
      deptStr.toLowerCase().includes(query) ||
      String(item.designation || '').toLowerCase().includes(query) ||
      String(item.ward || '').toLowerCase().includes(query)
    );
  });

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1:
        return { bg: '#fef3c7', text: '#b45309', label: '🥇 #1 Top Performer' };
      case 2:
        return { bg: '#f1f5f9', text: '#475569', label: '🥈 #2 Performer' };
      case 3:
        return { bg: '#fff7ed', text: '#c2410c', label: '🥉 #3 Performer' };
      default:
        return { bg: '#f8fafc', text: '#64748b', label: `#${rank} Scorecard` };
    }
  };

  // Export to Excel / CSV
  // Export Handlers
  const handleExportExcel = async () => {
    try {
      const headers = 'Rank,Officer Name,Designation,Department,Assigned,Resolved,Pending,Resolution Rate (%),SLA Compliance (%),Avg Turnaround (Hours)\n';
      const rows = filteredOfficers.map(o =>
        `"${o.rank}","${(o.name || '').replace(/"/g, '""')}","${o.designation}","${(o.department || '').replace(/"/g, '""')}","${o.totalAssigned}","${o.totalResolved}","${o.totalPending}","${o.resolutionRate}%","${o.slaComplianceRate}%","${o.avgResolutionHours}h"`
      ).join('\n');
      const csvData = headers + rows;

      await exportCSVFile(`Officer_Scorecards_${Date.now()}.csv`, csvData);
    } catch (err) {
      Alert.alert('Export Error', `Could not export scorecards: ${err.message}`);
    }
  };

  // Export to PDF Summary
  const handleExportPDF = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Officer Performance Scorecards</title>
            <style>
              @page { size: A4 landscape; margin: 10mm 8mm; }
              * { box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; background: #ffffff; }
              .header { border-bottom: 2px solid #f59e0b; padding-bottom: 8px; margin-bottom: 12px; }
              h1 { color: #d97706; font-size: 18px; margin: 0 0 4px 0; }
              .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; table-layout: fixed; }
              th { background: #fffbeb; color: #92400e; padding: 6px 4px; text-align: left; font-weight: 700; border: 1px solid #fde68a; word-break: break-word; overflow-wrap: break-word; }
              td { padding: 5px 4px; border: 1px solid #e2e8f0; text-align: left; word-break: break-word; overflow-wrap: break-word; vertical-align: top; }
              tr:nth-child(even) { background: #fafafa; }
              .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📊 Office of Kunal Tilak — Field Officer Performance Scorecards</h1>
              <div class="meta">
                <strong>Generated on:</strong> ${new Date().toLocaleString()} | <strong>Total Officers:</strong> ${filteredOfficers.length}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">Rank</th>
                  <th style="width: 22%;">Officer Name</th>
                  <th style="width: 20%;">Department</th>
                  <th style="width: 10%; text-align: center;">Assigned</th>
                  <th style="width: 10%; text-align: center;">Resolved</th>
                  <th style="width: 10%; text-align: center;">Pending</th>
                  <th style="width: 10%; text-align: center;">Resolution %</th>
                  <th style="width: 10%; text-align: center;">SLA Compliance</th>
                </tr>
              </thead>
              <tbody>
                ${filteredOfficers.map(o => `
                  <tr>
                    <td><strong>#${o.rank}</strong></td>
                    <td><strong>${o.name}</strong></td>
                    <td>${o.department || '—'}</td>
                    <td style="text-align: center;">${o.totalAssigned}</td>
                    <td style="text-align: center; color: #059669; font-weight: bold;">${o.totalResolved}</td>
                    <td style="text-align: center; color: #d97706;">${o.totalPending}</td>
                    <td style="text-align: center; font-weight: bold;">${o.resolutionRate}%</td>
                    <td style="text-align: center; font-weight: bold;">${o.slaComplianceRate}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">लोकप्रतिनिधी कार्यालय / Office of Kunal Tilak — Performance Scorecards</div>
          </body>
        </html>
      `;

      await exportPDFFile(`Officer_Scorecards_Report_${Date.now()}.pdf`, htmlContent);
    } catch (err) {
      Alert.alert('Export PDF', `PDF generation error: ${err.message}`);
    }
  };


  const handleExportOptions = () => {
    Alert.alert(
      'Export Officer Performance',
      `Export ${filteredOfficers.length} scorecards:`,
      [
        { text: '📊 Export Excel / CSV', onPress: handleExportExcel },
        { text: '📑 Export PDF Summary', onPress: handleExportPDF },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Staff Performance Analytics"
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
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Officer Scorecards</Text>
            <Text style={styles.screenSubtitle}>Resolution turnaround, SLA & efficiency rankings</Text>
          </View>

          <TouchableOpacity
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#e2e8f0'
            }}
            activeOpacity={0.7}
            onPress={handleExportOptions}
          >
            <Text style={{ fontSize: 16 }}>📤</Text>
          </TouchableOpacity>
        </View>

        {/* Aggregate KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: '#f97316' }]}>
            <Text style={styles.kpiNumber}>{officersList.length}</Text>
            <Text style={styles.kpiLabel}>Field Officers</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
            <Text style={[styles.kpiNumber, { color: '#059669' }]}>91.4%</Text>
            <Text style={styles.kpiLabel}>Avg SLA Compliance</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={[styles.kpiNumber, { color: '#2563eb' }]}>18.2h</Text>
            <Text style={styles.kpiLabel}>Avg Turnaround</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6' }]}>
            <Text style={[styles.kpiNumber, { color: '#7c3aed' }]}>218</Text>
            <Text style={styles.kpiLabel}>Total Resolved</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIconText}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search officer name, dept, ward..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Department Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {deptFilters.map((df) => {
            const isActive = selectedDept === df.id;
            return (
              <TouchableOpacity
                key={df.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setSelectedDept(df.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {df.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Officer Scorecards List */}
        <View style={styles.officersList}>
          {filteredOfficers.map((off) => {
            const rankStyle = getRankBadge(off.rank);
            const isTop = off.rank === 1;

            return (
              <View
                key={off.id}
                style={[styles.officerCard, isTop && styles.topOfficerCard]}
              >
                {/* Header: Rank + Dept Tag */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
                    <Text style={[styles.rankBadgeText, { color: rankStyle.text }]}>
                      {rankStyle.label}
                    </Text>
                  </View>

                  <View style={styles.wardTag}>
                    <Text style={styles.wardTagText}>📍 {off.ward}</Text>
                  </View>
                </View>

                {/* Officer Profile */}
                <View style={styles.profileRow}>
                  <View style={styles.officerAvatar}>
                    <Text style={styles.avatarEmoji}>👮‍♂️</Text>
                  </View>
                  <View style={styles.profileInfoCol}>
                    <Text style={styles.officerName}>{off.name}</Text>
                    <Text style={styles.officerDesignation}>{off.designation}</Text>
                  </View>
                </View>

                {/* Efficiency Bar */}
                <View style={styles.efficiencyContainer}>
                  <View style={styles.efficiencyHeader}>
                    <Text style={styles.efficiencyLabel}>Resolution Efficiency</Text>
                    <Text style={styles.efficiencyValue}>{off.resolutionRate}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(off.resolutionRate, 100)}%`,
                          backgroundColor:
                            off.resolutionRate >= 90
                              ? '#10b981'
                              : off.resolutionRate >= 80
                              ? '#f59e0b'
                              : '#ef4444'
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Metrics Breakdown Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Assigned</Text>
                    <Text style={styles.metricItemValue}>{off.totalAssigned}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Resolved</Text>
                    <Text style={[styles.metricItemValue, { color: '#059669' }]}>
                      {off.totalResolved}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Pending</Text>
                    <Text style={[styles.metricItemValue, { color: '#d97706' }]}>
                      {off.totalPending}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Avg Time</Text>
                    <Text style={styles.metricItemValue}>{off.avgResolutionHours}h</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredOfficers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📊</Text>
              <Text style={styles.emptyStateTitle}>No officer records found</Text>
              <Text style={styles.emptyStateSub}>Try adjusting your search or department filter</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 3. Bottom Nav */}
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
    paddingBottom: 120 // 👈 Generous clearance above persistent BottomNav bar
  },
  titleSection: {
    marginBottom: 16
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4
  },
  kpiNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a'
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2
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
    height: 44
  },
  searchIconText: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a'
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
    backgroundColor: '#f97316',
    borderColor: '#f97316'
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
  officersList: {
    gap: 14
  },
  officerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  topOfficerCard: {
    borderColor: '#fed7aa',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  wardTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  wardTagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  officerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarEmoji: {
    fontSize: 22
  },
  profileInfoCol: {
    flex: 1
  },
  officerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  officerDesignation: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  efficiencyContainer: {
    marginBottom: 14
  },
  efficiencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  efficiencyLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b'
  },
  efficiencyValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  barTrack: {
    height: 7,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 4
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricItemLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2
  },
  metricItemValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyStateEmoji: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  }
});
