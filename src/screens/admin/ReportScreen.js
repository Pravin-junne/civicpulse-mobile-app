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
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav, CalendarPickerModal } from '../../components';
import api, { API_BASE_URL } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadAndShareRemoteFile } from '../../utils/fileExport';

/**
 * Reusable Selection Modal
 */
const SelectorModal = ({
  visible,
  title,
  options = [],
  selectedId,
  onSelect,
  onClose,
  searchPlaceholder = 'Search options...'
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {options.length > 6 && (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={filteredOptions}
            keyExtractor={(item, index) => String(item.id !== undefined ? item.id : index)}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => {
              const itemId = item.id !== undefined ? item.id : item.value !== undefined ? item.value : item;
              const itemLabel = item.label || item.name || String(item);
              const isSelected = selectedId === itemId;

              return (
                <TouchableOpacity
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {itemLabel}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#2563eb" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function ReportScreen({
  navigation,
  activeTab = 'reports',
  onTabPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Filter States
  const [reportType, setReportType] = useState('all'); // 'all' | 'pending' | 'resolution'
  const [departmentId, setDepartmentId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [wardId, setWardId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Lookup States
  const [depts, setDepts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [wards, setWards] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);

  // Report Records
  const [complaints, setComplaints] = useState([]);

  // Modal Picker States
  const [activePicker, setActivePicker] = useState(null); // 'reportType' | 'department' | 'officer' | 'ward' | 'area'
  const [calendarPickerTarget, setCalendarPickerTarget] = useState(null); // 'start' | 'end' | null

  const reportTypeOptions = [
    { id: 'all', label: 'All Complaints Report' },
    { id: 'pending', label: 'Pending Complaints Report' },
    { id: 'resolution', label: 'Resolution Summary Report' }
  ];

  const fetchLookups = useCallback(async () => {
    try {
      const [wardsList, deptsList, officersList] = await Promise.all([
        api.get('/wards'),
        api.get('/departments'),
        api.get('/users?role=OFFICER')
      ]);
      setWards(Array.isArray(wardsList) ? wardsList : (wardsList?.wards || []));
      setDepts(Array.isArray(deptsList) ? deptsList : (deptsList?.departments || []));
      setOfficers(Array.isArray(officersList) ? officersList : (officersList?.users || []));
    } catch (err) {
      console.log('Error fetching lookups in reports:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  // Update areas when ward changes
  useEffect(() => {
    if (!wardId) {
      setAvailableAreas([]);
      setAreaId('');
      return;
    }
    const selectedWardObj = wards.find(w => w.id === parseInt(wardId, 10));
    if (selectedWardObj && Array.isArray(selectedWardObj.areas)) {
      setAvailableAreas(selectedWardObj.areas);
    } else {
      setAvailableAreas([]);
    }
    setAreaId('');
  }, [wardId, wards]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (reportType) params.append('reportType', reportType);
    if (departmentId) params.append('departmentId', String(departmentId));
    if (officerId) params.append('officerId', String(officerId));
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (wardId) params.append('wardId', String(wardId));
    if (areaId) params.append('areaId', String(areaId));
    return params;
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setHasGenerated(true);
    try {
      const params = buildQueryParams();
      const res = await api.get(`/reports/data?${params.toString()}`);
      const list = Array.isArray(res) ? res : (res && res.complaints ? res.complaints : []);
      setComplaints(list);
    } catch (err) {
      Alert.alert('Report Error', 'Failed to generate report preview: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLookups();
    if (hasGenerated) {
      handleGenerateReport();
    } else {
      setRefreshing(false);
    }
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // Export handlers
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const params = buildQueryParams();
      const downloadUrl = `${API_BASE_URL}/reports/export/excel?${params.toString()}`;
      
      const res = await downloadAndShareRemoteFile(downloadUrl, `Grievance_Report_${Date.now()}.xlsx`);
      if (!res.success) {
        // Fallback to local CSV generation
        const headers = 'Grievance ID,Citizen Name,Mobile,Date,Ward,Area,Priority,Department,Officer,Status,Subject\n';
        const rows = complaints.map(c => {
          const off = c.officers && c.officers.length > 0 ? c.officers.map(o => o.name).join(', ') : (c.inOfficePerson?.name || 'Unassigned');
          return `"${c.complaintNumber || ''}","${(c.citizenName || '').replace(/"/g, '""')}","${c.mobileNumber || ''}","${new Date(c.complaintDate || c.createdAt).toLocaleDateString()}","${c.ward?.name || ''}","${c.area?.name || ''}","${c.priority || 'MEDIUM'}","${c.department?.name || 'Unassigned'}","${off}","${c.status}","${(c.subject || '').replace(/"/g, '""')}"`;
        }).join('\n');
        await exportCSVFile(`Grievance_Report_${Date.now()}.csv`, headers + rows);
      }
    } catch (err) {
      Alert.alert('Export Notice', `Export initiated: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const params = buildQueryParams();
      const downloadUrl = `${API_BASE_URL}/reports/export/pdf?${params.toString()}`;

      const res = await downloadAndShareRemoteFile(downloadUrl, `Grievance_Report_${Date.now()}.pdf`);
      if (!res.success) {
        // Fallback to local HTML generation
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Administrative Reports Center</title>
              <style>
                @page { size: A4 landscape; margin: 10mm 8mm; }
                * { box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px; color: #0f172a; background: #ffffff; }
                h1 { color: #1e3a8a; font-size: 17px; margin: 0 0 4px 0; }
                .meta { font-size: 10.5px; color: #64748b; margin-bottom: 12px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; }
                table { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
                th { background: #f1f5f9; color: #1e293b; padding: 6px 4px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; word-break: break-word; overflow-wrap: break-word; }
                td { padding: 5px 4px; border: 1px solid #e2e8f0; word-break: break-word; overflow-wrap: break-word; vertical-align: top; }
                tr:nth-child(even) { background: #f8fafc; }
              </style>
            </head>
            <body>
              <h1>📊 Office of Kunal Tilak — Administrative Grievance Report</h1>
              <div class="meta">
                <strong>Generated:</strong> ${new Date().toLocaleString()} | <strong>Total Records:</strong> ${complaints.length}
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 12%;">Grievance ID</th>
                    <th style="width: 14%;">Citizen Name</th>
                    <th style="width: 9%;">Date</th>
                    <th style="width: 15%;">Ward / Area</th>
                    <th style="width: 9%;">Priority</th>
                    <th style="width: 15%;">Department</th>
                    <th style="width: 14%;">Officer</th>
                    <th style="width: 12%;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${complaints.map(c => {
                    const off = c.officers && c.officers.length > 0 ? c.officers.map(o => o.name).join(', ') : (c.inOfficePerson?.name || '—');
                    return `
                      <tr>
                        <td><strong>${c.complaintNumber || ('GR-' + c.id)}</strong></td>
                        <td>${c.citizenName || '—'}</td>
                        <td>${new Date(c.complaintDate || c.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>${c.ward?.name || 'N/A'}${c.area ? ' / ' + c.area.name : ''}</td>
                        <td>${c.priority || 'MEDIUM'}</td>
                        <td>${c.department?.name || 'Unassigned'}</td>
                        <td>${off}</td>
                        <td><strong>${c.status || 'PENDING'}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;
        await exportPDFFile(`Grievance_Report_${Date.now()}.pdf`, html);
      }
    } catch (err) {
      Alert.alert('Export Notice', `Export initiated: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Helper Labels for Selectors
  const selectedReportTypeLabel = reportTypeOptions.find(o => o.id === reportType)?.label || 'All Complaints Report';
  const selectedDeptLabel = depts.find(d => d.id === parseInt(departmentId, 10))?.name || '-- All Departments --';
  const selectedOfficerLabel = officers.find(o => o.id === parseInt(officerId, 10))?.name || '-- All Officers --';
  const selectedWardLabel = wards.find(w => w.id === parseInt(wardId, 10))?.name || '-- All Wards --';
  const selectedAreaLabel = !wardId
    ? '-- Choose Ward First --'
    : (availableAreas.find(a => a.id === parseInt(areaId, 10))?.name || '-- All Areas --');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Politician Portal"
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
        {/* Breadcrumb Screen Title */}
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backChevronBtn}>
            <Ionicons name="chevron-back" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Administrative Reports Center</Text>
        </View>

        {/* 1. Filter Report Grievances Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Report Grievances</Text>

          {/* Form Fields */}
          <View style={styles.fieldsContainer}>
            {/* Field: Report Type */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Report Type</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setActivePicker('reportType')}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>{selectedReportTypeLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field: Department */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Department</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setActivePicker('department')}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>{selectedDeptLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field: Concerned Officer */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Concerned Officer</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setActivePicker('officer')}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>{selectedOfficerLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field: Ward */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Ward</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setActivePicker('ward')}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>{selectedWardLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field: Area */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Area</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, !wardId && styles.dropdownDisabled]}
                onPress={() => {
                  if (wardId) setActivePicker('area');
                  else Alert.alert('Notice', 'Please choose a Ward first.');
                }}
                activeOpacity={wardId ? 0.7 : 1}
              >
                <Text style={[styles.dropdownText, !wardId && { color: '#94a3b8' }]} numberOfLines={1}>
                  {selectedAreaLabel}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field: Start Date */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateInputWrap}
                onPress={() => setCalendarPickerTarget('start')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateTextInput, !startDate && { color: '#94a3b8' }]}>
                  {startDate || 'YYYY-MM-DD'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#64748b" style={styles.dateIcon} />
              </TouchableOpacity>
            </View>

            {/* Field: End Date */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateInputWrap}
                onPress={() => setCalendarPickerTarget('end')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateTextInput, !endDate && { color: '#94a3b8' }]}>
                  {endDate || 'YYYY-MM-DD'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#64748b" style={styles.dateIcon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonActionRow}>
            {/* Generate Button */}
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateReport}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Report Preview</Text>
              )}
            </TouchableOpacity>

            {/* Export Buttons */}
            <View style={styles.exportButtonGroup}>
              <TouchableOpacity
                style={styles.exportExcelBtn}
                onPress={handleExportExcel}
                disabled={exportingExcel}
                activeOpacity={0.8}
              >
                {exportingExcel ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.exportExcelText}>Export Excel</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportPdfBtn}
                onPress={handleExportPdf}
                disabled={exportingPdf}
                activeOpacity={0.8}
              >
                {exportingPdf ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.exportPdfText}>Export PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2. Preview Records Card */}
        {loading ? (
          <View style={[styles.card, styles.placeholderCard]}>
            <ActivityIndicator size="small" color="#2563eb" style={{ marginBottom: 8 }} />
            <Text style={styles.placeholderText}>Loading report records...</Text>
          </View>
        ) : hasGenerated && complaints.length > 0 ? (
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.recordsCardHeader}>
              <Text style={styles.recordsTitle}>
                Preview: Generated Records ({complaints.length})
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{complaints.length} Records</Text>
              </View>
            </View>

            <View style={styles.recordsList}>
              {complaints.map((item, idx) => {
                const off = item.officers && item.officers.length > 0
                  ? item.officers.map(o => o.name).join(', ')
                  : (item.inOfficePerson?.name || 'Unassigned');
                const dateStr = new Date(item.complaintDate || item.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <View key={item.id || idx} style={[styles.recordRow, idx === complaints.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.recordMain}>
                      <View style={styles.recordTopRow}>
                        <Text style={styles.recordIdText}>{item.complaintNumber || `GRV-${item.id}`}</Text>
                        <View style={[
                          styles.statusPill,
                          item.status === 'RESOLVED' || item.status === 'CLOSED'
                            ? styles.statusResolved
                            : styles.statusPending
                        ]}>
                          <Text style={[
                            styles.statusPillText,
                            item.status === 'RESOLVED' || item.status === 'CLOSED'
                              ? styles.statusResolvedText
                              : styles.statusPendingText
                          ]}>
                            {item.status || 'PENDING'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.recordCitizenName}>{item.citizenName || 'Citizen'}</Text>

                      <View style={styles.recordMetaRow}>
                        <Text style={styles.recordMetaText}>📅 {dateStr}</Text>
                        <Text style={styles.recordMetaText}>📍 {item.ward?.name || 'Ward'} {item.area ? `/ ${item.area.name}` : ''}</Text>
                      </View>

                      <View style={styles.recordMetaRow}>
                        <Text style={styles.recordMetaText}>🏢 {item.department?.name || 'General'}</Text>
                        <Text style={styles.recordMetaText}>👤 {off}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.placeholderCard]}>
            <Text style={styles.placeholderText}>
              Click "Generate Report Preview" to load filtered records.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Selectors Modals */}
      <SelectorModal
        visible={activePicker === 'reportType'}
        title="Select Report Type"
        options={reportTypeOptions}
        selectedId={reportType}
        onSelect={(opt) => setReportType(opt.id)}
        onClose={() => setActivePicker(null)}
      />

      <SelectorModal
        visible={activePicker === 'department'}
        title="Select Department"
        options={[{ id: '', label: '-- All Departments --' }, ...depts.map(d => ({ id: d.id, label: d.name }))]}
        selectedId={departmentId}
        onSelect={(opt) => setDepartmentId(opt.id)}
        onClose={() => setActivePicker(null)}
      />

      <SelectorModal
        visible={activePicker === 'officer'}
        title="Select Concerned Officer"
        options={[{ id: '', label: '-- All Officers --' }, ...officers.map(o => ({ id: o.id, label: o.name }))]}
        selectedId={officerId}
        onSelect={(opt) => setOfficerId(opt.id)}
        onClose={() => setActivePicker(null)}
      />

      <SelectorModal
        visible={activePicker === 'ward'}
        title="Select Ward"
        options={[{ id: '', label: '-- All Wards --' }, ...wards.map(w => ({ id: w.id, label: w.name }))]}
        selectedId={wardId}
        onSelect={(opt) => setWardId(opt.id)}
        onClose={() => setActivePicker(null)}
      />

      <SelectorModal
        visible={activePicker === 'area'}
        title="Select Area"
        options={[{ id: '', label: '-- All Areas --' }, ...availableAreas.map(a => ({ id: a.id, label: a.name }))]}
        selectedId={areaId}
        onSelect={(opt) => setAreaId(opt.id)}
        onClose={() => setActivePicker(null)}
      />

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={calendarPickerTarget !== null}
        title={calendarPickerTarget === 'start' ? 'Select Start Date' : 'Select End Date'}
        initialDate={calendarPickerTarget === 'start' ? startDate : endDate}
        onSelectDate={(val) => {
          if (calendarPickerTarget === 'start') {
            setStartDate(val);
          } else if (calendarPickerTarget === 'end') {
            setEndDate(val);
          }
        }}
        onClose={() => setCalendarPickerTarget(null)}
      />

      {/* Bottom Nav */}
      <BottomNav
        activeTab={internalTab}
        onTabPress={handleTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 90
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8
  },
  backChevronBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#e2e8f0'
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14
  },
  fieldsContainer: {
    gap: 12
  },
  formGroup: {
    gap: 4
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569'
  },
  dropdownButton: {
    height: 42,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff'
  },
  dropdownDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0'
  },
  dropdownText: {
    fontSize: 13.5,
    color: '#1e293b',
    flex: 1,
    marginRight: 6
  },
  dateInputWrap: {
    height: 42,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  dateTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1e293b',
    padding: 0
  },
  dateIcon: {
    marginLeft: 6
  },
  buttonActionRow: {
    marginTop: 18,
    gap: 10
  },
  generateBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  exportButtonGroup: {
    flexDirection: 'row',
    gap: 10
  },
  exportExcelBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportExcelText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600'
  },
  exportPdfBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportPdfText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600'
  },
  placeholderCard: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderText: {
    fontSize: 13.5,
    color: '#94a3b8',
    textAlign: 'center'
  },
  recordsCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  recordsTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  countBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  recordsList: {
    paddingVertical: 4
  },
  recordRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  recordMain: {
    gap: 4
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  recordIdText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb'
  },
  recordCitizenName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b'
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  recordMetaText: {
    fontSize: 12,
    color: '#64748b'
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6
  },
  statusResolved: {
    backgroundColor: '#ecfdf5'
  },
  statusPending: {
    backgroundColor: '#fff7ed'
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700'
  },
  statusResolvedText: {
    color: '#059669'
  },
  statusPendingText: {
    color: '#c2410c'
  },

  /* Modal Styling */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  modalCloseBtn: {
    padding: 4
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginVertical: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2
  },
  optionItemSelected: {
    backgroundColor: '#eff6ff'
  },
  optionText: {
    fontSize: 13.5,
    color: '#334155'
  },
  optionTextSelected: {
    color: '#2563eb',
    fontWeight: '600'
  }
});
