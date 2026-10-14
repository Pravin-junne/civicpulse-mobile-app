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
  AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api, { API_BASE_URL, authService } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadFileDirectlyToDevice } from '../../utils/fileExport';

const formatINR = (num) => {
  if (!num) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
};

const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function AssetManagementScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddAssetPress,
  onEditAssetPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Pagination & Limit States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  // Transfer Modal State
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [newCustodianId, setNewCustodianId] = useState('');
  const [newOfficeId, setNewOfficeId] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Dynamic Lookups
  const [usersList, setUsersList] = useState([]);
  const [officesList, setOfficesList] = useState([]);
  const [assetsList, setAssetsList] = useState([]);

  const fetchAssets = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/assets');
      const list = Array.isArray(res) ? res : (res && res.assets ? res.assets : []);
      setAssetsList(list.map(item => {
        let purchaseDateStr = 'Recent';
        if (item.purchaseDate) {
          const pd = new Date(item.purchaseDate);
          if (!isNaN(pd.getTime())) {
            purchaseDateStr = pd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        }
        let warrantyStr = 'N/A';
        if (item.warrantyExpiry) {
          const we = new Date(item.warrantyExpiry);
          if (!isNaN(we.getTime())) {
            warrantyStr = we.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        }

        return {
          id: item.id,
          assetCode: item.assetCode || `AST-2026-${String(item.id).padStart(4, '0')}`,
          name: item.name || 'Asset Item',
          category: item.category || 'Other',
          serialNumber: item.invoiceNumber || item.assetCode || 'N/A',
          purchasePrice: Number(item.purchasePrice) || 0,
          purchaseDate: purchaseDateStr,
          warrantyExpiry: warrantyStr,
          rawPurchaseDate: item.purchaseDate,
          rawWarrantyExpiry: item.warrantyExpiry,
          vendor: item.vendor || '',
          invoiceNumber: item.invoiceNumber || '',
          description: item.description || '',
          currentLocation: item.currentLocation || (item.office ? item.office.name : 'Municipal Office'),
          officeName: item.office ? item.office.name : '',
          officeId: item.officeId,
          custodian: item.assignedTo ? item.assignedTo.name : 'General Custody',
          assignedToId: item.assignedToId,
          condition: item.condition || 'GOOD',
          status: item.status || 'ACTIVE'
        };
      }));
    } catch (err) {
      console.log('Assets fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets(false);
    // Fetch users & offices for lookup
    const fetchLookups = async () => {
      try {
        const [usersRes, officesRes] = await Promise.all([
          api.get('/users').catch(() => null),
          api.get('/performance/units').catch(() => null)
        ]);
        const rawUsers = usersRes?.users || (Array.isArray(usersRes) ? usersRes : []);
        if (rawUsers.length > 0) {
          setUsersList(rawUsers.map(u => ({ id: u.id, name: u.name || u.username, role: u.role })));
        }
        if (officesRes && Array.isArray(officesRes)) {
          setOfficesList(officesRes);
        }
      } catch (err) {
        console.log('Asset lookups fetch error:', err.message);
      }
    };
    fetchLookups();

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchAssets(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchAssets]);

  // Reset to page 1 whenever filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, itemsPerPage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const operationalStatusOptions = [
    { id: 'ALL', label: 'All Statuses', icon: 'layers-outline' },
    { id: 'ACTIVE', label: 'Active', dot: '#10b981' },
    { id: 'IN_USE', label: 'In Use', dot: '#3b82f6' },
    { id: 'AVAILABLE', label: 'Available in Store', dot: '#8b5cf6' },
    { id: 'UNDER_REPAIR', label: 'In Repair', dot: '#f59e0b' },
    { id: 'DAMAGED', label: 'Damaged', dot: '#ef4444' },
    { id: 'DISPOSED', label: 'Disposed', dot: '#94a3b8' }
  ];

  const filteredAssets = useMemo(() => {
    return assetsList.filter((item) => {
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;

      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (item.assetCode && item.assetCode.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(query)) ||
        (item.custodian && item.custodian.toLowerCase().includes(query)) ||
        (item.currentLocation && item.currentLocation.toLowerCase().includes(query)) ||
        (item.officeName && item.officeName.toLowerCase().includes(query))
      );
    });
  }, [assetsList, selectedStatus, searchQuery]);

  // Total pages based on filtered results
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAssets.length / itemsPerPage));
  }, [filteredAssets.length, itemsPerPage]);

  // Paginated asset items for current page
  const paginatedAssets = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredAssets.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredAssets, currentPage, itemsPerPage]);

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

  const showingStart = filteredAssets.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = Math.min(currentPage * itemsPerPage, filteredAssets.length);

  const hasActiveFilters = selectedStatus !== 'ALL' || searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Active', bg: '#ecfdf5', fg: '#059669', dot: '#10b981', border: '#a7f3d0' };
      case 'IN_USE':
        return { label: 'In Use', bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6', border: '#bfdbfe' };
      case 'AVAILABLE':
        return { label: 'Available in Store', bg: '#f5f3ff', fg: '#7c3aed', dot: '#8b5cf6', border: '#ddd6fe' };
      case 'UNDER_REPAIR':
        return { label: 'Under Repair', bg: '#fffbeb', fg: '#d97706', dot: '#f59e0b', border: '#fde68a' };
      case 'DAMAGED':
        return { label: 'Damaged', bg: '#fef2f2', fg: '#dc2626', dot: '#ef4444', border: '#fecaca' };
      case 'DISPOSED':
        return { label: 'Disposed', bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', border: '#e2e8f0' };
      default:
        return { label: status, bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', border: '#e2e8f0' };
    }
  };

  const getConditionColor = (cond) => {
    switch (cond) {
      case 'NEW':
        return { text: '#059669', bg: '#ecfdf5', label: 'Brand New', icon: 'sparkles-outline' };
      case 'GOOD':
        return { text: '#2563eb', bg: '#eff6ff', label: 'Good', icon: 'checkmark-circle-outline' };
      case 'FAIR':
        return { text: '#d97706', bg: '#fffbeb', label: 'Fair / Usable', icon: 'shield-outline' };
      case 'DAMAGED':
        return { text: '#dc2626', bg: '#fef2f2', label: 'Needs Repair', icon: 'alert-circle-outline' };
      default:
        return { text: '#475569', bg: '#f1f5f9', label: cond, icon: 'information-circle-outline' };
    }
  };

  const totalValuation = assetsList.reduce((acc, item) => acc + (item.purchasePrice || 0), 0);

  const handleExportCSV = async () => {
    if (!filteredAssets || filteredAssets.length === 0) {
      Alert.alert('No Records Found', 'There are no asset records matching the current filters to export.');
      return;
    }
    setIsExportingCsv(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);

      const downloadRes = await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/assets/export/csv?${params.toString()}`,
        `Assets_Export_${Date.now()}.csv`,
        token
      );

      if (!downloadRes || !downloadRes.success) {
        // Direct local CSV fallback
        const headers = 'Asset Code,Asset Name,Category,Status,Condition,Purchase Date,Purchase Price,Current Value,Vendor,Invoice No,Location,Office Unit,Custodian,Department,Warranty Expiry';
        const rows = filteredAssets.map(a => {
          const esc = str => `"${String(str ?? '').replace(/"/g, '""')}"`;
          return [
            esc(a.assetCode || `#${a.id}`),
            esc(a.name || ''),
            esc(a.category || ''),
            esc(a.status || 'ACTIVE'),
            esc(a.condition || 'GOOD'),
            esc(a.purchaseDate || ''),
            esc(a.purchasePrice || ''),
            esc(a.purchasePrice || ''),
            esc(a.vendor || ''),
            esc(a.invoiceNumber || ''),
            esc(a.currentLocation || ''),
            esc(a.officeName || ''),
            esc(a.assignedToName || ''),
            esc(a.departmentName || ''),
            esc(a.warrantyExpiry || '')
          ].join(',');
        });
        await exportCSVFile(`Assets_Export_${Date.now()}.csv`, [headers, ...rows].join('\r\n'));
      }
    } catch (err) {
      console.error('Asset CSV Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filteredAssets || filteredAssets.length === 0) {
      Alert.alert('No Records Found', 'There are no asset records matching the current filters to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const token = await authService.getToken();
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);

      await downloadFileDirectlyToDevice(
        `${API_BASE_URL}/assets/export/pdf?${params.toString()}`,
        `Assets_Register_${Date.now()}.pdf`,
        token
      );
    } catch (err) {
      console.error('Asset PDF Export error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export PDF register.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenTransferModal = (asset) => {
    setSelectedAsset(asset);
    setNewCustodianId(asset.assignedToId ? String(asset.assignedToId) : '');
    setNewOfficeId(asset.officeId ? String(asset.officeId) : '');
    setTransferRemarks('');
    setTransferModalVisible(true);
  };

  const handleTransferCustodian = async () => {
    if (!selectedAsset) return;
    const targetAsset = selectedAsset;

    setIsTransferring(true);
    try {
      await api.post(`/assets/${targetAsset.id}/transfer`, {
        toUserId: newCustodianId ? parseInt(newCustodianId) : undefined,
        toOfficeId: newOfficeId ? parseInt(newOfficeId) : undefined,
        remarks: transferRemarks.trim() || undefined
      });
      Alert.alert('Asset Reassigned', `${targetAsset.name} reassigned successfully.`);
      setTransferModalVisible(false);
      fetchAssets();
    } catch (err) {
      console.log('Transfer asset error:', err.message);
      Alert.alert('Notice', err.response?.data?.message || 'Asset reassignment updated.');
      setTransferModalVisible(false);
      fetchAssets();
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeleteAsset = (asset) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete "${asset.name}" (${asset.assetCode})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete(`/assets/${asset.id}`);
              Alert.alert('Success', 'Asset deleted successfully.');
              fetchAssets();
            } catch (err) {
              console.log('Delete asset error:', err.message);
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete asset. Please try again.');
            } finally {
              setLoading(false);
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
        subtitle="Asset & Inventory Registry"
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
            <Text style={styles.screenTitle}>Asset Registry</Text>
            <Text style={styles.screenSubtitle}>Track municipal equipment, hardware & vehicles</Text>
          </View>

          <View style={styles.topActionsRow}>
            {/* Add Asset Button */}
            {onAddAssetPress && (
              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.8}
                onPress={onAddAssetPress}
              >
                <Ionicons name="add" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Valuation Banner */}
        <View style={styles.valuationBanner}>
          <View>
            <Text style={styles.valBannerLabel}>Total Inventory Asset Value</Text>
            <Text style={styles.valBannerAmount}>{formatINR(totalValuation)}</Text>
          </View>
          <View style={styles.assetCountBox}>
            <Text style={styles.assetCountNumber}>{assetsList.length}</Text>
            <Text style={styles.assetCountLabel}>Total Units</Text>
          </View>
        </View>

        {/* Quick KPI Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>
              {assetsList.filter((a) => a.status === 'ACTIVE' || a.status === 'IN_USE').length}
            </Text>
            <Text style={styles.statLabel}>Operational</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>
              {assetsList.filter((a) => a.status === 'UNDER_REPAIR').length}
            </Text>
            <Text style={styles.statLabel}>In Repair</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.statNumber, { color: '#dc2626' }]}>
              {assetsList.filter((a) => a.status === 'DAMAGED').length}
            </Text>
            <Text style={styles.statLabel}>Damaged</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tag, serial, custodian, office..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
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

        {/* Operational Status Filters Header & Bar */}
        <View style={{ marginBottom: 12 }}>
          <View style={styles.filterHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="funnel-outline" size={13} color="#ea580c" style={{ marginRight: 5 }} />
              <Text style={styles.filterSectionTitle}>Operational Status</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Limit Pill Selector */}
              <TouchableOpacity
                style={[styles.limitPill, itemsPerPage !== 10 && styles.limitPillActive]}
                onPress={() => setIsLimitModalOpen(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="options-outline"
                  size={12}
                  color={itemsPerPage !== 10 ? '#ea580c' : '#64748b'}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.limitPillText, itemsPerPage !== 10 && styles.limitPillTextActive]}>
                  {itemsPerPage} / pg
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={11}
                  color={itemsPerPage !== 10 ? '#ea580c' : '#64748b'}
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>

              {hasActiveFilters && (
                <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.7} style={styles.resetFiltersBtn}>
                  <Ionicons name="refresh-outline" size={12} color="#ea580c" style={{ marginRight: 3 }} />
                  <Text style={styles.resetFiltersBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsContainer}
          >
            {operationalStatusOptions.map((st) => {
              const isActive = selectedStatus === st.id;
              const count = st.id === 'ALL'
                ? assetsList.length
                : assetsList.filter((a) => a.status === st.id).length;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setSelectedStatus(st.id)}
                  activeOpacity={0.7}
                >
                  {st.dot ? (
                    <View style={[styles.filterPillDot, { backgroundColor: isActive ? '#ffffff' : st.dot }]} />
                  ) : (
                    <Ionicons
                      name={st.icon || 'layers-outline'}
                      size={12}
                      color={isActive ? '#ffffff' : '#64748b'}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {st.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Paginated Asset Cards List */}
        <View style={styles.cardsList}>
          {paginatedAssets.map((asset) => {
            const statusStyle = getStatusBadge(asset.status);
            const conditionStyle = getConditionColor(asset.condition);

            return (
              <View key={asset.id} style={styles.assetCard}>
                {/* Header: ID + Office Name + Status Pill */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.idSerialWrap}>
                    <View style={styles.assetCodeBadge}>
                      <Ionicons name="barcode-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                      <Text style={styles.cardIdText}>{asset.assetCode}</Text>
                    </View>
                    {asset.officeName ? (
                      <View style={styles.officeTag}>
                        <Ionicons name="business-outline" size={11} color="#64748b" style={{ marginRight: 3 }} />
                        <Text style={styles.serialNumberText} numberOfLines={1} ellipsizeMode="tail">
                          {asset.officeName}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                    <Text style={[styles.statusBadgeText, { color: statusStyle.fg }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                {/* Asset Name & Category */}
                <Text style={styles.assetNameText}>{asset.name}</Text>
                <View style={styles.tagsRow}>
                  <View style={styles.categoryTag}>
                    <Ionicons name="cube-outline" size={11} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.categoryTagText}>{asset.category}</Text>
                  </View>
                  <View style={[styles.conditionTag, { backgroundColor: conditionStyle.bg }]}>
                    <Ionicons name={conditionStyle.icon} size={11} color={conditionStyle.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.conditionTagText, { color: conditionStyle.text }]}>
                      {conditionStyle.label}
                    </Text>
                  </View>
                </View>

                {/* Location & Value Info */}
                <View style={styles.infoBlock}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                      {asset.currentLocation}
                    </Text>
                  </View>
                  <View style={styles.financialRow}>
                    <View style={styles.priceWrap}>
                      <Ionicons name="pricetag-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.priceLabel}>
                        Value: <Text style={styles.priceValue}>{formatINR(asset.purchasePrice)}</Text>
                      </Text>
                    </View>
                    <View style={styles.warrantyWrap}>
                      <Ionicons name="shield-checkmark-outline" size={12} color="#0d9488" style={{ marginRight: 3 }} />
                      <Text style={styles.warrantyText}>Exp: {asset.warrantyExpiry}</Text>
                    </View>
                  </View>
                </View>

                {/* Custodian & Action Footer */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.custodianWrap}>
                    <Text style={styles.custodianLabel}>Custodian / In-Charge</Text>
                    <View style={styles.custodianNameRow}>
                      <Ionicons name="person-outline" size={12} color="#0f172a" style={{ marginRight: 4 }} />
                      <Text style={styles.custodianNameText} numberOfLines={1}>
                        {asset.custodian}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionsGroup}>
                    <TouchableOpacity
                      style={styles.editActionBtn}
                      activeOpacity={0.7}
                      onPress={() => onEditAssetPress && onEditAssetPress(asset)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="create-outline" size={14} color="#0284c7" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteActionBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteAsset(asset)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reassignBtn}
                      activeOpacity={0.7}
                      onPress={() => handleOpenTransferModal(asset)}
                    >
                      <Ionicons name="swap-horizontal" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                      <Text style={styles.reassignBtnText}>Reassign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredAssets.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={44} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>No assets found</Text>
              <Text style={styles.emptyStateSub}>No equipment matches your search filter</Text>
            </View>
          )}
        </View>

        {/* Professional Pagination Controls */}
        {filteredAssets.length > 0 && (
          <View style={styles.paginationContainer}>
            {/* Header: Range Summary & Limit Selector Chip */}
            <View style={styles.paginationHeader}>
              <Text style={styles.paginationCountText}>
                Showing <Text style={styles.paginationCountBold}>{showingStart}</Text> - <Text style={styles.paginationCountBold}>{showingEnd}</Text> of <Text style={styles.paginationCountBold}>{filteredAssets.length}</Text> units
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

      {/* 3. Transfer Custodian Modal */}
      <Modal
        visible={transferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTransferModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="swap-horizontal" size={19} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Reassign Custodian</Text>
              </View>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{selectedAsset?.name} ({selectedAsset?.assetCode})</Text>

            {/* Select User / Custodian */}
            <View style={styles.modalInputWrap}>
              <Text style={styles.modalLabel}>Select New Custodian Officer:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {usersList.map((u) => {
                    const isSelected = newCustodianId === String(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[
                          styles.modalPill,
                          isSelected && styles.modalPillActive
                        ]}
                        onPress={() => setNewCustodianId(String(u.id))}
                      >
                        <Ionicons
                          name="person-outline"
                          size={12}
                          color={isSelected ? '#ffffff' : '#64748b'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                          {u.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Select Office */}
            {officesList.length > 0 && (
              <View style={styles.modalInputWrap}>
                <Text style={styles.modalLabel}>Transfer to Office Location:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {officesList.map((off) => {
                      const isSelected = newOfficeId === String(off.id);
                      return (
                        <TouchableOpacity
                          key={off.id}
                          style={[
                            styles.modalPill,
                            isSelected && styles.modalPillActive
                          ]}
                          onPress={() => setNewOfficeId(String(off.id))}
                        >
                          <Ionicons
                            name="business-outline"
                            size={12}
                            color={isSelected ? '#ffffff' : '#64748b'}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                            {off.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.modalInputWrap}>
              <Text style={styles.modalLabel}>Transfer Remarks (Optional):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Relocated to Ward B Office Desk #2"
                placeholderTextColor="#94a3b8"
                value={transferRemarks}
                onChangeText={setTransferRemarks}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTransferModalVisible(false)}
                disabled={isTransferring}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isTransferring && { opacity: 0.6 }]}
                onPress={handleTransferCustodian}
                disabled={isTransferring}
              >
                {isTransferring ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Confirm Transfer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Items Per Page Limit Selection Modal */}
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
                        {lim} assets
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

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsLimitModalOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. Bottom Nav */}
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
    paddingBottom: 120 // Generous clearance above persistent BottomNav bar
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  valuationBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  valBannerLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5
  },
  valBannerAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
    marginTop: 2
  },
  assetCountBox: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center'
  },
  assetCountNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff'
  },
  assetCountLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600'
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 3.5
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800'
  },
  statLabel: {
    fontSize: 10.5,
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
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a'
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  limitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  limitPillActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  limitPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  limitPillTextActive: {
    color: '#ea580c'
  },
  resetFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5'
  },
  resetFiltersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c'
  },
  filterPillsContainer: {
    gap: 8,
    paddingBottom: 6
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
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
  filterPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6
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
  modalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c'
  },
  cardsList: {
    gap: 12
  },
  assetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  idSerialWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  assetCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffedd5'
  },
  cardIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c'
  },
  officeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 140
  },
  serialNumberText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700'
  },
  assetNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  categoryTagText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600'
  },
  conditionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  conditionTagText: {
    fontSize: 11,
    fontWeight: '700'
  },
  infoBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  locationText: {
    fontSize: 12,
    color: '#475569',
    flex: 1
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  priceLabel: {
    fontSize: 11.5,
    color: '#64748b'
  },
  priceValue: {
    fontWeight: '800',
    color: '#0f172a'
  },
  warrantyWrap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  warrantyText: {
    fontSize: 11,
    color: '#0d9488',
    fontWeight: '600'
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  custodianWrap: {
    flex: 1,
    marginRight: 8
  },
  custodianLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600'
  },
  custodianNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  custodianNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1
  },
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  editActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5'
  },
  reassignBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
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
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  // Professional Pagination Styles
  paginationContainer: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
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
    marginBottom: 4
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16
  },
  modalInputWrap: {
    marginBottom: 14
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    marginTop: 6
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#ea580c',
    borderRadius: 10,
    marginTop: 6,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
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
