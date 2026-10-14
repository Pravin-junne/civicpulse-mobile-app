import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Modal,
  Alert,
  Linking,
  RefreshControl,
  AppState,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { MainHeader, BottomNav } from '../../components';
import api, { authService, API_BASE_URL } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadAndShareRemoteFile } from '../../utils/fileExport';

// Approved DLT Registered SMS Templates (Way2Smart / NEOPCE)
const SMS_TEMPLATES = [
  {
    id: '1707178377588111415',
    dltTemplateId: '1707178377588111415',
    category: 'Authentication / OTP',
    title: '🔐 Customer Login OTP (DLT: 1707178377588111415)',
    text: 'Dear Customer your Otp for login is {154205} . This code will expire in 10 minutes . - Neopace Team g98us9GoAaG'
  },
  {
    id: '1707178402458607724',
    dltTemplateId: '1707178402458607724',
    category: 'Grievance Status',
    title: '📝 Grievance Registered (DLT: 1707178402458607724)',
    text: 'Dear user, your grievance ID {complaintNumber} has been created on {date}. You can check status on office.kunaltilak.com/track - Team Neopace'
  },
  {
    id: '1707178402436668365',
    dltTemplateId: '1707178402436668365',
    category: 'Grievance Status',
    title: '⚙️ Grievance In-Process (DLT: 1707178402436668365)',
    text: 'Dear user, your grievance ID {complaintNumber} is under process, you can check status on office.kunaltilak.com/track - Team Neopace'
  },
  {
    id: '1707178402445029460',
    dltTemplateId: '1707178402445029460',
    category: 'Grievance Status',
    title: '✅ Grievance Resolved (DLT: 1707178402445029460)',
    text: 'Dear user, your Grievance ID {complaintNumber} has been resolved on {date}. You can check status on office.kunaltilak.com/track, - Team Neopace'
  }
];

// Dynamic Badge and theme color mapping
const getCategoryBadgeStyle = (categoryName) => {
  const cat = (categoryName || '').toUpperCase();
  if (cat.includes('VIP') || cat.includes('POLITICIAN')) {
    return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', avatarBg: '#dbeafe', avatarText: '#1d4ed8', icon: 'ribbon-outline', label: 'VIP / Politician' };
  }
  if (cat.includes('STAFF') || cat.includes('MUNICIPAL')) {
    return { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa', avatarBg: '#ffedd5', avatarText: '#c2410c', icon: 'business-outline', label: 'Municipal Staff' };
  }
  if (cat.includes('CITIZEN') || cat.includes('REP')) {
    return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', avatarBg: '#fef3c7', avatarText: '#92400e', icon: 'people-outline', label: 'Citizen Rep' };
  }
  if (cat.includes('PARTY') || cat.includes('WORKER') || cat.includes('VOLUNTEER')) {
    return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', avatarBg: '#dcfce7', avatarText: '#15803d', icon: 'shield-checkmark-outline', label: 'Party Worker' };
  }
  if (cat.includes('MEDIA') || cat.includes('PRESS')) {
    return { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff', avatarBg: '#f3e8ff', avatarText: '#7e22ce', icon: 'newspaper-outline', label: 'Media & Press' };
  }
  return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', avatarBg: '#f1f5f9', avatarText: '#334155', icon: 'person-outline', label: categoryName || 'Contact' };
};

export default function ContactDirectoryScreen({
  navigation,
  activeTab = 'contacts',
  onTabPress,
  onAddContactPress,
  onEditContactPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const insets = useSafeAreaInsets();
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Contacts and Filter Data
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categorySubcategoryMap, setCategorySubcategoryMap] = useState({});
  const [totalCount, setTotalCount] = useState(0);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [limitFilter, setLimitFilter] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Active Filter Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory) count++;
    if (selectedSubcategory) count++;
    if (limitFilter) count++;
    return count;
  }, [selectedCategory, selectedSubcategory, limitFilter]);

  // Selection States
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // SMS Composer State
  const [smsTargetContact, setSmsTargetContact] = useState(null); // When set, targets single contact
  const [selectedTemplate, setSelectedTemplate] = useState(SMS_TEMPLATES[0]);
  const [customMessage, setCustomMessage] = useState(SMS_TEMPLATES[0].text);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [smsProgress, setSmsProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    percentage: 0,
    sentCount: 0,
    failedCount: 0,
    statusText: ''
  });

  // Import State
  const [selectedImportFile, setSelectedImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch Contacts from backend
  const fetchContacts = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/contacts', {
        params: {
          search: searchQuery.trim() || undefined,
          category: selectedCategory || undefined,
          subcategory: selectedSubcategory || undefined,
          limit: limitFilter ? parseInt(limitFilter) : undefined
        }
      });

      let rawContacts = [];
      if (Array.isArray(res)) {
        rawContacts = res;
        setTotalCount(res.length);
      } else if (res && res.contacts) {
        rawContacts = res.contacts;
        if (res.categories) setCategories(res.categories);
        if (res.categorySubcategoryMap) setCategorySubcategoryMap(res.categorySubcategoryMap);
        setTotalCount(res.pagination?.total || rawContacts.length);
      } else {
        setTotalCount(0);
      }

      if (rawContacts && rawContacts.length > 0) {
        const mapped = rawContacts.map((c, idx) => ({
          id: c.id || idx + 1,
          code: `C-${c.id || 100 + idx}`,
          name: c.name || 'Contact Name',
          category: c.category || 'General',
          subcategory: c.subcategory || '',
          address: c.address || 'Pune',
          mobileNumber: c.mobileNumber || '',
          email: c.email || '',
          avatar: c.avatar || null
        }));
        setContacts(mapped);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.log('Contacts fetch notice:', err.message);
      setContacts([]);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedSubcategory, limitFilter]);

  useEffect(() => {
    fetchContacts(false);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchContacts(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchContacts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // Selection Logic
  const isAllSelected = useMemo(() => {
    if (contacts.length === 0) return false;
    return contacts.every((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id));
    }
  };

  const handleToggleContact = (id) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open SMS modal for single contact
  const handleOpenSingleSMS = (contact) => {
    setSmsTargetContact(contact);
    setSmsProgress({ active: false, current: 0, total: 0, percentage: 0, sentCount: 0, failedCount: 0, statusText: '' });
    setSelectedTemplate(SMS_TEMPLATES[0]);
    setCustomMessage(SMS_TEMPLATES[0].text);
    setIsTemplateModalOpen(true);
  };

  // Open SMS modal for bulk selected contacts
  const handleOpenBulkSMS = () => {
    if (selectedContactIds.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact using the checkboxes to compose an SMS broadcast.');
      return;
    }
    setSmsTargetContact(null);
    setSmsProgress({ active: false, current: 0, total: 0, percentage: 0, sentCount: 0, failedCount: 0, statusText: '' });
    setSelectedTemplate(SMS_TEMPLATES[0]);
    setCustomMessage(SMS_TEMPLATES[0].text);
    setIsTemplateModalOpen(true);
  };

  // Send SMS Dispatch with Real-time Progress Tracking
  const handleSendSMSBroadcast = async () => {
    const targetIds = smsTargetContact ? [smsTargetContact.id] : selectedContactIds;

    if (targetIds.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one contact before sending.');
      return;
    }

    if (!customMessage.trim()) {
      Alert.alert('Message Required', 'Please enter or select an SMS template content.');
      return;
    }

    setIsSendingSMS(true);
    const total = targetIds.length;
    const batchSize = total > 20 ? 10 : (total > 6 ? 5 : 2);
    let cumulativeSent = 0;
    let cumulativeFailed = 0;

    setSmsProgress({
      active: true,
      current: 0,
      total,
      percentage: 0,
      sentCount: 0,
      failedCount: 0,
      statusText: `Connecting to SMS Gateway for ${total} recipient${total > 1 ? 's' : ''}...`
    });

    try {
      for (let i = 0; i < total; i += batchSize) {
        const chunk = targetIds.slice(i, i + batchSize);
        const currentBatchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(total / batchSize);

        setSmsProgress((prev) => ({
          ...prev,
          statusText: `Dispatching batch ${currentBatchNum} of ${totalBatches}...`
        }));

        try {
          const res = await api.post('/contacts/send-sms', {
            contactIds: chunk,
            message: customMessage,
            dltTemplateId: selectedTemplate?.dltTemplateId || selectedTemplate?.id
          });
          cumulativeSent += (typeof res.sentCount === 'number' ? res.sentCount : chunk.length);
          cumulativeFailed += (typeof res.failedCount === 'number' ? res.failedCount : 0);
        } catch (chunkErr) {
          cumulativeFailed += chunk.length;
        }

        const processed = Math.min(i + chunk.length, total);
        const pct = Math.round((processed / total) * 100);

        setSmsProgress({
          active: true,
          current: processed,
          total,
          percentage: pct,
          sentCount: cumulativeSent,
          failedCount: cumulativeFailed,
          statusText: processed === total
            ? `Completed: ${cumulativeSent} sent${cumulativeFailed > 0 ? `, ${cumulativeFailed} failed` : ''}.`
            : `Dispatched ${processed} of ${total} contacts (${pct}%)...`
        });
      }

      Alert.alert(
        'SMS Broadcast Complete',
        `Dispatched: ${cumulativeSent} successfully${cumulativeFailed > 0 ? `\nFailed / skipped: ${cumulativeFailed}` : ''}`
      );

      setTimeout(() => {
        setIsTemplateModalOpen(false);
        setSmsTargetContact(null);
        setSmsProgress({
          active: false,
          current: 0,
          total: 0,
          percentage: 0,
          sentCount: 0,
          failedCount: 0,
          statusText: ''
        });
        if (!smsTargetContact) {
          setSelectedContactIds([]);
        }
      }, 1400);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error dispatching SMS gateway request.';
      Alert.alert('SMS Dispatch Notice', errMsg);
      setSmsProgress({
        active: false,
        current: 0,
        total: 0,
        percentage: 0,
        sentCount: 0,
        failedCount: 0,
        statusText: ''
      });
    } finally {
      setIsSendingSMS(false);
    }
  };

  // Delete Contact Action
  const handleDeleteContact = (contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${contact.name}" from directory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/contacts/${contact.id}`);
              setSelectedContactIds((prev) => prev.filter((id) => id !== contact.id));
              Alert.alert('Deleted', `"${contact.name}" removed successfully.`);
              fetchContacts();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete contact.');
            }
          }
        }
      ]
    );
  };

  // Delete All Contacts Action
  const handleDeleteAllContacts = () => {
    if (contacts.length === 0) {
      Alert.alert('Empty Directory', 'There are no contacts to delete.');
      return;
    }
    Alert.alert(
      '⚠️ Delete All Contacts',
      `Are you sure you want to permanently delete ALL ${totalCount || contacts.length} contacts in the directory? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/contacts/all');
              setSelectedContactIds([]);
              Alert.alert('Deleted', 'All contacts have been removed successfully.');
              fetchContacts();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete all contacts.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Delete Selected Contacts Action
  const handleDeleteSelectedContacts = () => {
    if (selectedContactIds.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select contacts using checkboxes first.');
      return;
    }
    Alert.alert(
      'Delete Selected Contacts',
      `Are you sure you want to permanently delete the ${selectedContactIds.length} selected contact(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Selected',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.post('/contacts/bulk-delete', { contactIds: selectedContactIds });
              setSelectedContactIds([]);
              Alert.alert('Deleted', 'Selected contacts removed successfully.');
              fetchContacts();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete selected contacts.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Edit Contact Action
  const handleEditContact = (contact) => {
    if (onEditContactPress) {
      onEditContactPress(contact);
    }
  };

  // Call Action
  const handleCallNow = (contact) => {
    const phone = contact.mobileNumber || '';
    const cleanPhone = phone.replace(/\s+/g, '');
    Alert.alert('Call Contact', `Dial ${phone} for ${contact.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call Now 📞',
        onPress: () => {
          Linking.openURL(`tel:${cleanPhone}`).catch(() => {
            Alert.alert('Calling', `Dialing ${phone}...`);
          });
        }
      }
    ]);
  };

  // Pick Document for Import
  const handlePickImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImportFile(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Document Error', 'Failed to pick file: ' + err.message);
    }
  };

  const handleUploadImport = async () => {
    if (!selectedImportFile) {
      Alert.alert('File Required', 'Please select a CSV or Excel file to import.');
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', {
        uri: selectedImportFile.uri,
        name: selectedImportFile.name || 'contacts.csv',
        type: selectedImportFile.mimeType || 'text/csv'
      });

      const res = await api.post('/contacts/import', formData);
      Alert.alert('Import Complete', res.message || 'Contacts imported successfully.');
      setIsImportModalOpen(false);
      setSelectedImportFile(null);
      fetchContacts();
    } catch (err) {
      Alert.alert('Import Notice', err.response?.data?.message || err.message || 'Contacts imported into directory.');
      setIsImportModalOpen(false);
      setSelectedImportFile(null);
      fetchContacts();
    } finally {
      setIsImporting(false);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = async () => {
    try {
      const token = await authService.getToken();
      const exportUrl = `${API_BASE_URL}/contacts/export?token=${token || ''}`;

      const headers = 'ID,Code,Name,Category,Subcategory,Address,Mobile Number,Email\n';
      const rows = contacts.map((c) =>
        `"${c.id}","${c.code}","${c.name}","${c.category}","${c.subcategory || ''}","${c.address || ''}","${c.mobileNumber}","${c.email || ''}"`
      ).join('\n');
      const csvContent = headers + rows;

      Alert.alert(
        'Export Contacts Directory',
        `Export ${contacts.length} contacts? Choose format:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save / Share CSV 📄',
            onPress: async () => {
              await exportCSVFile(`Contacts_Directory_${Date.now()}.csv`, csvContent);
            }
          },
          {
            text: 'Download Excel (.xlsx) 📊',
            onPress: async () => {
              await downloadAndShareRemoteFile(exportUrl, `Contacts_Directory_${Date.now()}.xlsx`, token);
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Export Error', err.message || 'Unable to initiate contacts export.');
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Contact Directory Report</title>
          <style>
            @page { size: A4 landscape; margin: 10mm 8mm; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; background: #ffffff; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 12px; }
            h1 { color: #1d4ed8; font-size: 18px; margin: 0 0 4px 0; }
            .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; table-layout: fixed; }
            th { background: #f1f5f9; color: #334155; padding: 6px 4px; text-align: left; font-weight: 700; border: 1px solid #cbd5e1; word-break: break-word; overflow-wrap: break-word; }
            td { padding: 5px 4px; border: 1px solid #e2e8f0; text-align: left; word-break: break-word; overflow-wrap: break-word; vertical-align: top; }
            tr:nth-child(even) { background: #fafafa; }
            .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👥 Office of Kunal Tilak — Contact Directory Report</h1>
            <div class="meta">
              <strong>Generated on:</strong> ${new Date().toLocaleString()} | <strong>Total Contacts:</strong> ${contacts.length}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 10%;">Code</th>
                <th style="width: 22%;">Name</th>
                <th style="width: 16%;">Category</th>
                <th style="width: 16%;">Subcategory</th>
                <th style="width: 14%;">Mobile Number</th>
                <th style="width: 22%;">Address / Location</th>
              </tr>
            </thead>
            <tbody>
              ${contacts.map(c => `
                <tr>
                  <td><strong>${c.code || '—'}</strong></td>
                  <td><strong>${c.name || '—'}</strong></td>
                  <td>${c.category || '—'}</td>
                  <td>${c.subcategory || '—'}</td>
                  <td>${c.mobileNumber || '—'}</td>
                  <td>${c.address || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">लोकप्रतिनिधी कार्यालय / Office of Kunal Tilak — Contact Directory</div>
        </body>
      </html>
    `;

    await exportPDFFile(`Contacts_Directory_Report_${Date.now()}.pdf`, htmlContent);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setLimitFilter('');
  };

  // Distinct categories list
  const categoryList = useMemo(() => {
    const defaultList = ['VIP / Politician', 'Municipal Staff', 'Citizen Rep', 'Party Worker', 'Media & Press', 'Contractor / Supplier'];
    const merged = new Set([...categories, ...defaultList]);
    return Array.from(merged);
  }, [categories]);

  // Dependent subcategories list
  const subcategoryList = useMemo(() => {
    if (selectedCategory && categorySubcategoryMap[selectedCategory]) {
      return categorySubcategoryMap[selectedCategory];
    }
    return [
      'Ward 4 Corporator',
      'Chief Sanitary Inspector',
      'Kothrud Youth Representative',
      'Zonal Officer',
      'Ward In-charge',
      'Area Coordinator',
      'General Representative'
    ];
  }, [selectedCategory, categorySubcategoryMap]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Top Portal Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
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
        {/* Title & Quick Actions Row */}
        <View style={styles.titleRow}>
          <View style={styles.titleTextGroup}>
            <Text style={styles.screenHeading}>Contact Directory</Text>
            <Text style={styles.screenSubheading}>Citizen & Official Directory</Text>
          </View>

          <View style={styles.titleActionsRow}>
            {/* Add Contact Button */}
            <TouchableOpacity
              style={styles.primaryAddBtn}
              activeOpacity={0.85}
              onPress={onAddContactPress || (() => {})}
            >
              <Ionicons name="person-add" size={15} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.primaryAddBtnText}>Add</Text>
            </TouchableOpacity>

            {/* Import Button */}
            <TouchableOpacity
              style={styles.secondaryImportBtn}
              activeOpacity={0.85}
              onPress={() => setIsImportModalOpen(true)}
            >
              <Ionicons name="cloud-upload-outline" size={15} color="#475569" style={{ marginRight: 5 }} />
              <Text style={styles.secondaryImportBtnText}>Import</Text>
            </TouchableOpacity>

            {/* Delete All Button */}
            <TouchableOpacity
              style={styles.dangerDeleteAllBtn}
              activeOpacity={0.85}
              onPress={handleDeleteAllContacts}
            >
              <Ionicons name="trash-outline" size={15} color="#dc2626" style={{ marginRight: 4 }} />
              <Text style={styles.dangerDeleteAllBtnText}>Delete All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Executive Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="people" size={19} color="#2563eb" />
            </View>
            <View style={styles.metricTextWrap}>
              <Text style={styles.metricValue}>
                {totalCount > 0 ? totalCount.toLocaleString('en-IN') : contacts.length}
              </Text>
              <Text style={styles.metricLabel}>TOTAL CONTACTS</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: selectedContactIds.length > 0 ? '#fff7ed' : '#f1f5f9' }]}>
              <Ionicons
                name="chatbubbles"
                size={19}
                color={selectedContactIds.length > 0 ? '#ea580c' : '#94a3b8'}
              />
            </View>
            <View style={styles.metricTextWrap}>
              <Text style={[styles.metricValue, selectedContactIds.length > 0 && { color: '#ea580c' }]}>
                {selectedContactIds.length}
              </Text>
              <Text style={styles.metricLabel}>SELECTED (SMS)</Text>
            </View>
          </View>
        </View>

        {/* 4. Search & Filter Card */}
        <View style={styles.filterCard}>
          <View style={styles.searchRowContainer}>
            <View style={styles.searchInputBox}>
              <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name, phone, designation..."
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

            <TouchableOpacity
              style={[
                styles.filterSliderBtn,
                (isFilterExpanded || activeFilterCount > 0) && styles.filterSliderBtnActive
              ]}
              activeOpacity={0.7}
              onPress={() => setIsFilterExpanded((prev) => !prev)}
            >
              <Ionicons
                name={isFilterExpanded ? 'chevron-up' : 'funnel-outline'}
                size={18}
                color={isFilterExpanded || activeFilterCount > 0 ? '#ea580c' : '#475569'}
              />
              {activeFilterCount > 0 && !isFilterExpanded && (
                <View style={styles.filterActiveDot} />
              )}
            </TouchableOpacity>
          </View>

          {/* Horizontal Quick Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsScroll}
            style={styles.categoryPillsContainer}
          >
            {['All', 'VIP / Politician', 'Municipal Staff', 'Citizen Rep', 'Party Worker', 'Media & Press'].map((cat) => {
              const isCurrent = (cat === 'All' && !selectedCategory) || selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, isCurrent && styles.categoryPillActive]}
                  activeOpacity={0.75}
                  onPress={() => {
                    setSelectedCategory(cat === 'All' ? '' : cat);
                    setSelectedSubcategory('');
                  }}
                >
                  <Text style={[styles.categoryPillText, isCurrent && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Expandable Advanced Filter Fields */}
          {isFilterExpanded && (
            <View style={styles.filterExpandedBody}>
              <View style={styles.dropdownsRow}>
                {/* Category Dropdown */}
                <View style={styles.dropdownColumn}>
                  <Text style={styles.dropdownLabel}>CATEGORY</Text>
                  <TouchableOpacity
                    style={styles.pickerBox}
                    activeOpacity={0.7}
                    onPress={() => setIsCategoryModalOpen(true)}
                  >
                    <Text style={styles.pickerBoxText} numberOfLines={1}>
                      {selectedCategory || '-- All --'}
                    </Text>
                    <Ionicons name="chevron-down" size={15} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Sub-Category Dropdown */}
                <View style={styles.dropdownColumn}>
                  <Text style={styles.dropdownLabel}>SUB-CATEGORY</Text>
                  <TouchableOpacity
                    style={styles.pickerBox}
                    activeOpacity={0.7}
                    onPress={() => setIsSubcategoryModalOpen(true)}
                  >
                    <Text style={styles.pickerBoxText} numberOfLines={1}>
                      {selectedSubcategory || '-- All --'}
                    </Text>
                    <Ionicons name="chevron-down" size={15} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Limit Input */}
              <View style={styles.limitContainer}>
                <Text style={styles.dropdownLabel}>LIMIT CONTACTS</Text>
                <TextInput
                  style={styles.limitInput}
                  placeholder="e.g. 50 (Leave blank for all)"
                  placeholderTextColor="#94a3b8"
                  value={limitFilter}
                  onChangeText={setLimitFilter}
                  keyboardType="numeric"
                />
              </View>

              {/* Filter Actions */}
              <View style={styles.filterActionsRow}>
                <TouchableOpacity
                  style={styles.clearBtn}
                  activeOpacity={0.7}
                  onPress={handleClearFilters}
                >
                  <Ionicons name="refresh-outline" size={15} color="#475569" style={{ marginRight: 4 }} />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportExcelBtn}
                  activeOpacity={0.8}
                  onPress={handleExportExcel}
                >
                  <Ionicons name="document-text-outline" size={15} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.exportExcelText}>Export Excel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportPdfBtn}
                  activeOpacity={0.8}
                  onPress={handleExportPDF}
                >
                  <Ionicons name="download-outline" size={15} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.exportPdfText}>Export PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 5. Executive Broadcast & Selection Bar */}
        <View style={styles.smsActionBar}>
          <TouchableOpacity
            style={[styles.actionPillBtn, isAllSelected && styles.actionPillBtnActive]}
            activeOpacity={0.75}
            onPress={handleToggleSelectAll}
          >
            <Ionicons
              name={isAllSelected ? 'checkbox' : 'square-outline'}
              size={17}
              color={isAllSelected ? '#ea580c' : '#64748b'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.actionPillBtnText, isAllSelected && styles.actionPillBtnTextActive]}>
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>

          {selectedContactIds.length > 0 && (
            <TouchableOpacity
              style={styles.bulkDeleteBtn}
              activeOpacity={0.8}
              onPress={handleDeleteSelectedContacts}
            >
              <Ionicons name="trash-outline" size={14} color="#dc2626" style={{ marginRight: 3 }} />
              <Text style={styles.bulkDeleteBtnText}>
                Delete ({selectedContactIds.length})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.templatePillBtn}
            activeOpacity={0.75}
            onPress={handleOpenBulkSMS}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={15} color="#475569" style={{ marginRight: 5 }} />
            <Text style={styles.templatePillBtnText} numberOfLines={1}>
              Compose SMS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendSmsSolidBtn,
              selectedContactIds.length === 0 && { opacity: 0.7 }
            ]}
            activeOpacity={0.85}
            onPress={handleOpenBulkSMS}
          >
            <View style={styles.sendSmsInner}>
              <Ionicons name="paper-plane" size={14} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.sendSmsSolidBtnText}>
                Send ({selectedContactIds.length})
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 6. Directory Cards List */}
        <View style={styles.contactsList}>
          {contacts.map((contact) => {
            const badge = getCategoryBadgeStyle(contact.category);
            const isSelected = selectedContactIds.includes(contact.id);

            return (
              <View
                key={contact.id}
                style={[styles.contactCard, isSelected && styles.contactCardSelected]}
              >
                {/* Top Row: Category Badge & Code + Actions */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Ionicons name={badge.icon} size={13} color={badge.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.categoryBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>

                  <View style={styles.cardHeaderActions}>
                    <Text style={styles.cardCodeText}>{contact.code || `C-${contact.id}`}</Text>
                    
                    {/* Quick Edit Icon */}
                    <TouchableOpacity
                      style={styles.cardHeaderIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleEditContact(contact)}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#475569" />
                    </TouchableOpacity>

                    {/* Quick Delete Icon */}
                    <TouchableOpacity
                      style={styles.cardHeaderIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDeleteContact(contact)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Middle Row: Checkbox, Avatar, Name & Designation */}
                <View style={styles.cardMiddleRow}>
                  {/* Select Checkbox */}
                  <TouchableOpacity
                    style={styles.cardCheckboxWrap}
                    activeOpacity={0.7}
                    onPress={() => handleToggleContact(contact.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? '#ea580c' : '#94a3b8'}
                    />
                  </TouchableOpacity>

                  {/* Avatar */}
                  {contact.avatar ? (
                    <Image
                      source={{ uri: contact.avatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: badge.avatarBg }]}>
                      <Text style={[styles.avatarPlaceholderText, { color: badge.avatarText }]}>
                        {(contact.name || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Name & Subcategory */}
                  <View style={styles.nameContainer}>
                    <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
                    <Text style={styles.contactDesignation} numberOfLines={1}>
                      {contact.subcategory || 'Constituency Contact'}
                    </Text>
                  </View>
                </View>

                {/* Subtle Divider */}
                <View style={styles.cardDivider} />

                {/* Location & Mobile Details */}
                <View style={styles.detailsGroup}>
                  <View style={styles.detailItemRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                    <Text style={styles.detailText} numberOfLines={1}>{contact.address || 'Pune'}</Text>
                  </View>

                  <View style={styles.detailItemRow}>
                    <Ionicons name="call-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                    <Text style={styles.detailText}>{contact.mobileNumber || 'N/A'}</Text>
                  </View>
                </View>

                {/* Action Buttons: Call Direct & Send SMS */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.callNowBtn}
                    activeOpacity={0.75}
                    onPress={() => handleCallNow(contact)}
                  >
                    <Ionicons name="call" size={14} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.callNowText}>Call Direct</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.smsActionBtn}
                    activeOpacity={0.75}
                    onPress={() => handleOpenSingleSMS(contact)}
                  >
                    <Ionicons name="chatbubble" size={14} color="#2563eb" style={{ marginRight: 6 }} />
                    <Text style={styles.smsActionText}>Send SMS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {contacts.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyStateTitle}>No contacts found</Text>
              <Text style={styles.emptyStateSub}>
                {searchQuery || selectedCategory
                  ? 'No contacts match your active search filters. Tap "Reset Filters" to view all.'
                  : 'Start building your constituency directory by adding or importing contacts.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                activeOpacity={0.8}
                onPress={searchQuery || selectedCategory ? handleClearFilters : (onAddContactPress || (() => {}))}
              >
                <Text style={styles.emptyActionBtnText}>
                  {searchQuery || selectedCategory ? 'Reset Filters' : '+ Add First Contact'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 8. Category Selector Modal */}
      <Modal
        visible={isCategoryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={[styles.modalOptionItem, selectedCategory === '' && styles.modalOptionItemActive]}
                onPress={() => {
                  setSelectedCategory('');
                  setSelectedSubcategory('');
                  setIsCategoryModalOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, selectedCategory === '' && styles.modalOptionTextActive]}>
                  -- All Categories --
                </Text>
                {selectedCategory === '' && <Ionicons name="checkmark" size={18} color="#ea580c" />}
              </TouchableOpacity>

              {categoryList.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.modalOptionItem, selectedCategory === cat && styles.modalOptionItemActive]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory('');
                    setIsCategoryModalOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedCategory === cat && styles.modalOptionTextActive]}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && <Ionicons name="checkmark" size={18} color="#ea580c" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 9. Subcategory Selector Modal */}
      <Modal
        visible={isSubcategoryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSubcategoryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sub-Category</Text>
              <TouchableOpacity onPress={() => setIsSubcategoryModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={[styles.modalOptionItem, selectedSubcategory === '' && styles.modalOptionItemActive]}
                onPress={() => {
                  setSelectedSubcategory('');
                  setIsSubcategoryModalOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, selectedSubcategory === '' && styles.modalOptionTextActive]}>
                  -- All Sub-Categories --
                </Text>
                {selectedSubcategory === '' && <Ionicons name="checkmark" size={18} color="#ea580c" />}
              </TouchableOpacity>

              {subcategoryList.map((subcat) => (
                <TouchableOpacity
                  key={subcat}
                  style={[styles.modalOptionItem, selectedSubcategory === subcat && styles.modalOptionItemActive]}
                  onPress={() => {
                    setSelectedSubcategory(subcat);
                    setIsSubcategoryModalOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedSubcategory === subcat && styles.modalOptionTextActive]}>
                    {subcat}
                  </Text>
                  {selectedSubcategory === subcat && <Ionicons name="checkmark" size={18} color="#ea580c" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 10. Interactive SMS Composer Modal (Matching Web Portal) */}
      <Modal
        visible={isTemplateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSendingSMS) {
            setIsTemplateModalOpen(false);
            setSmsTargetContact(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {smsTargetContact ? 'Send SMS to Contact' : 'SMS Broadcast'}
                </Text>
                <Text style={styles.recipientSubtext}>
                  {smsTargetContact
                    ? `Recipient: ${smsTargetContact.name} (${smsTargetContact.mobileNumber})`
                    : `Recipients: ${selectedContactIds.length} Selected Contacts`}
                </Text>
              </View>
              <TouchableOpacity
                disabled={isSendingSMS}
                onPress={() => {
                  setIsTemplateModalOpen(false);
                  setSmsTargetContact(null);
                }}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputSectionLabel}>CHOOSE APPROVED DLT TEMPLATE</Text>
              {SMS_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate?.id === tmpl.id;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    style={[styles.templateCard, isSelected && styles.templateCardSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedTemplate(tmpl);
                      setCustomMessage(tmpl.text);
                    }}
                  >
                    <View style={styles.templateCardHeader}>
                      <Text style={[styles.templateTitle, isSelected && styles.templateTitleSelected]}>
                        {tmpl.title}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color="#ea580c" />}
                    </View>
                    <Text style={styles.templateTextPreview}>{tmpl.text}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Message Editor */}
              <View style={{ marginTop: 14 }}>
                <View style={styles.editorLabelRow}>
                  <Text style={styles.inputSectionLabel}>MESSAGE CONTENT</Text>
                  <Text style={styles.charCountBadge}>
                    {customMessage.length} chars ({Math.ceil(customMessage.length / 160) || 1} SMS)
                  </Text>
                </View>
                <TextInput
                  style={[styles.formInput, { height: 95, textAlignVertical: 'top' }]}
                  multiline
                  numberOfLines={4}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  placeholder="Template message content..."
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.dltDisclaimerText}>
                  💡 Way2Smart Gateway requires exact approved DLT template structure.
                </Text>
              </View>

              {/* Real-time SMS Dispatch Progress Bar */}
              {smsProgress.active && (
                <View style={styles.progressCard}>
                  <View style={styles.progressHeaderRow}>
                    <Text style={styles.progressTitle} numberOfLines={1}>
                      {smsProgress.statusText || 'Dispatching SMS Broadcast...'}
                    </Text>
                    <Text style={styles.progressPercentageText}>
                      {smsProgress.percentage}%
                    </Text>
                  </View>

                  {/* Progress Bar Track */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(Math.max(smsProgress.percentage, 0), 100)}%` },
                        smsProgress.failedCount > 0 && smsProgress.sentCount === 0 && { backgroundColor: '#ef4444' }
                      ]}
                    />
                  </View>

                  {/* Progress Details & Counts */}
                  <View style={styles.progressFooterRow}>
                    <Text style={styles.progressCounterText}>
                      Progress: {smsProgress.current} / {smsProgress.total} contacts
                    </Text>
                    <View style={styles.progressBadgeGroup}>
                      <Text style={styles.progressSuccessBadge}>✓ {smsProgress.sentCount} sent</Text>
                      {smsProgress.failedCount > 0 && (
                        <Text style={styles.progressFailedBadge}>✗ {smsProgress.failedCount} failed</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  disabled={isSendingSMS}
                  onPress={() => {
                    setIsTemplateModalOpen(false);
                    setSmsTargetContact(null);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSendButton,
                    (isSendingSMS || !customMessage.trim() || (!smsTargetContact && selectedContactIds.length === 0)) && { opacity: 0.7 }
                  ]}
                  disabled={isSendingSMS || !customMessage.trim() || (!smsTargetContact && selectedContactIds.length === 0)}
                  onPress={handleSendSMSBroadcast}
                >
                  {isSendingSMS ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="paper-plane" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.modalSendButtonText}>
                        Send {smsTargetContact ? 'SMS' : `(${selectedContactIds.length})`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 11. Import Contacts Modal */}
      <Modal
        visible={isImportModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsImportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Contacts</Text>
              <TouchableOpacity onPress={() => setIsImportModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.importDesc}>
              Upload a .CSV or Excel (.xlsx) file with columns: Name, Mobile Number, Address, Category, Subcategory.
            </Text>

            <TouchableOpacity
              style={styles.filePickerBox}
              activeOpacity={0.7}
              onPress={handlePickImportFile}
            >
              <Ionicons name="cloud-upload-outline" size={32} color="#ea580c" style={{ marginBottom: 6 }} />
              <Text style={styles.filePickerText}>
                {selectedImportFile ? selectedImportFile.name : 'Tap to select CSV or Excel file'}
              </Text>
              <Text style={styles.filePickerSub}>Supported formats: .csv, .xlsx (Max 10MB)</Text>
            </TouchableOpacity>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setSelectedImportFile(null);
                  setIsImportModalOpen(false);
                }}
              >
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, isImporting && { opacity: 0.7 }]}
                disabled={isImporting || !selectedImportFile}
                onPress={handleUploadImport}
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Upload & Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 12. Persistent Bottom Navigation */}
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
  /* TITLE & ACTIONS ROW */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  titleTextGroup: {
    flex: 1,
    paddingRight: 10
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4
  },
  screenSubheading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500'
  },
  titleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  primaryAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  secondaryImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  secondaryImportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  dangerDeleteAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  dangerDeleteAllBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#dc2626'
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  bulkDeleteBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#dc2626'
  },

  /* EXECUTIVE METRICS GRID */
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  metricTextWrap: {
    flex: 1
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
    letterSpacing: 0.3
  },

  /* SEARCH & FILTER CARD */
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  searchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  filterSliderBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterSliderBtnActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74'
  },
  filterActiveDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c'
  },

  /* QUICK CATEGORY PILLS */
  categoryPillsContainer: {
    marginTop: 10
  },
  categoryPillsScroll: {
    gap: 6,
    paddingVertical: 2
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  categoryPillActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c'
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  categoryPillTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },

  /* EXPANDABLE FILTER FIELDS */
  filterExpandedBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  dropdownColumn: {
    flex: 1
  },
  dropdownLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 5,
    letterSpacing: 0.2
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40
  },
  pickerBoxText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
    flex: 1
  },
  limitContainer: {
    marginBottom: 14
  },
  limitInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 12.5,
    color: '#0f172a'
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center'
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569'
  },
  exportExcelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 9
  },
  exportExcelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff'
  },
  exportPdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 9
  },
  exportPdfText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff'
  },

  /* SMS BROADCAST ACTION STRIP */
  smsActionBar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  actionPillBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  actionPillBtnActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed'
  },
  actionPillBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b'
  },
  actionPillBtnTextActive: {
    color: '#ea580c'
  },
  templatePillBtn: {
    flex: 1.15,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  templatePillBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
    flexShrink: 1
  },
  sendSmsSolidBtn: {
    flex: 1.15,
    height: 40,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  sendSmsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendSmsSolidBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },

  /* DIRECTORY CARDS LIST */
  contactsList: {
    gap: 12
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  contactCardSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fffcfb'
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cardCodeText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#334155',
    marginRight: 4
  },
  cardHeaderIconBtn: {
    padding: 4
  },
  cardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  cardCheckboxWrap: {
    marginRight: 10
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    marginRight: 12
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarPlaceholderText: {
    fontSize: 16,
    fontWeight: '800'
  },
  nameContainer: {
    flex: 1
  },
  contactName: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  contactDesignation: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500'
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 10
  },
  detailsGroup: {
    gap: 6,
    marginBottom: 14
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
    flex: 1
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  callNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingVertical: 8
  },
  callNowText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#15803d'
  },
  smsActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 8
  },
  smsActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2563eb'
  },

  /* EMPTY STATE */
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6
  },
  emptyStateSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
    marginBottom: 16
  },
  emptyActionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ea580c',
    borderRadius: 8
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c'
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  recipientSubtext: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '600',
    marginTop: 2
  },
  modalOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalOptionItemActive: {
    backgroundColor: '#fff7ed'
  },
  modalOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500'
  },
  modalOptionTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },
  inputSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
    marginBottom: 8
  },
  templateCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  templateCardSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed'
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1
  },
  templateTitleSelected: {
    color: '#ea580c'
  },
  templateTextPreview: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16
  },
  editorLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  charCountBadge: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  dltDisclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 5,
    lineHeight: 15
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 10
  },
  modalCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  modalCancelButtonText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalSendButton: {
    flex: 1.4,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  modalSendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff'
  },
  /* PROGRESS BAR STYLES */
  progressCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 4
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    paddingRight: 8
  },
  progressPercentageText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb'
  },
  progressTrack: {
    width: '100%',
    height: 7,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  progressCounterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  progressBadgeGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  progressSuccessBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a'
  },
  progressFailedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626'
  },
  importDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14
  },
  filePickerBox: {
    borderWidth: 1.5,
    borderColor: '#ea580c',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  filePickerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ea580c',
    textAlign: 'center'
  },
  filePickerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  modalSecondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center'
  },
  modalPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff'
  }
});
