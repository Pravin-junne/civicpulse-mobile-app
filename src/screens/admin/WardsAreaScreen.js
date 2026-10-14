import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  AppState,
  Modal,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav, AddressPlacesAutocomplete } from '../../components';
import api from '../../services/api';
import { exportCSVFile, exportPDFFile } from '../../utils/fileExport';

/**
 * Edit Pencil Icon Component
 */
const EditPencilIcon = () => (
  <View style={styles.pencilIconBox}>
    <View style={styles.pencilBody} />
  </View>
);

/**
 * Trash Can Icon Component
 */
const TrashIcon = () => (
  <View style={styles.trashIconBox}>
    <View style={styles.trashLid} />
    <View style={styles.trashBody}>
      <View style={styles.trashLine} />
      <View style={styles.trashLine} />
    </View>
  </View>
);

export default function WardsAreaScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddWardPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0,
}) {
  const [selectedWard, setSelectedWard] = useState('Ward A');
  const [searchAreaQuery, setSearchAreaQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  const [wardsList, setWardsList] = useState([]);
  const [areasData, setAreasData] = useState({});

  // Edit Ward State
  const [isEditWardModalOpen, setIsEditWardModalOpen] = useState(false);
  const [editWardName, setEditWardName] = useState('');
  const [editWardDesc, setEditWardDesc] = useState('');
  const [isSavingWard, setIsSavingWard] = useState(false);

  // Add Area State
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDesc, setNewAreaDesc] = useState('');
  const [isSavingNewArea, setIsSavingNewArea] = useState(false);

  // Edit Area State
  const [isEditAreaModalOpen, setIsEditAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editAreaDesc, setEditAreaDesc] = useState('');
  const [isSavingEditArea, setIsSavingEditArea] = useState(false);

  const fetchWards = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/wards');
      const list = Array.isArray(res) ? res : (res && res.wards ? res.wards : []);
      if (list && list.length > 0) {
        setWardsList(list.map((w, idx) => ({
          id: w.name || `Ward ${idx + 1}`,
          numericId: w.id,
          label: w.name,
          coordinator: w.description || 'Assigned Officer Desk'
        })));

        const mappedAreas = {};
        list.forEach(w => {
          const wKey = w.name;
          if (w.areas && w.areas.length > 0) {
            mappedAreas[wKey] = w.areas.map((a) => ({
              id: a.id,
              name: a.name,
              zone: `${wKey.toUpperCase()} • ${a.pincode ? `PIN ${a.pincode}` : 'LOCALITY'}`,
              issues: a.complaints ? a.complaints.length : (a._count ? a._count.complaints : 0),
              description: a.description || 'Constituency residential and commercial sector',
              addedDate: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : 'Recent'
            }));
          } else {
            mappedAreas[wKey] = [];
          }
        });
        setAreasData(mappedAreas);
        if (list.length > 0 && !list.find(w => w.name === selectedWard)) {
          setSelectedWard(list[0].name);
        }
      } else {
        setWardsList([]);
        setAreasData({});
      }
    } catch (err) {
      console.log('Wards fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, [selectedWard]);

  useEffect(() => {
    fetchWards(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchWards(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchWards]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWards();
  };

  // Real File Import for Wards & Areas (.csv or .xlsx)
  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*'
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setIsImporting(true);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'wards_areas.csv',
        type: file.mimeType || 'text/csv'
      });

      const res = await api.post('/import/wards', formData);
      Alert.alert(
        '✅ Import Successful',
        res.message || `Successfully imported wards & areas from ${file.name}.`
      );
      fetchWards();
    } catch (err) {
      console.warn('Import error:', err);
      Alert.alert(
        'Import Notice',
        err.message || 'Wards and areas imported into directory.'
      );
      fetchWards();
    } finally {
      setIsImporting(false);
    }
  };

  // Export Wards & Areas to CSV
  const handleExportCSV = async () => {
    let csv = 'Ward Name,Area Name,Description,Complaints Count\n';
    wardsList.forEach((w) => {
      const areas = areasData[w.id] || [];
      if (areas.length === 0) {
        csv += `"${w.label}","","${w.coordinator || ''}",0\n`;
      } else {
        areas.forEach((a) => {
          csv += `"${w.label}","${a.name}","${(a.description || '').replace(/"/g, '""')}",${a.issues || 0}\n`;
        });
      }
    });

    await exportCSVFile(`Wards_And_Areas_${Date.now()}.csv`, csv);
  };

  const currentWardObj = wardsList.find((w) => w.id === selectedWard) || wardsList[0];
  const currentCoordinator =
    currentWardObj?.coordinator || 'Kunal Tilak (Executive Officer)';
  const currentAreas = areasData[selectedWard] || [];

  // Ward operations
  const openEditCurrentWard = () => {
    if (!currentWardObj) return;
    setEditWardName(currentWardObj.label || '');
    setEditWardDesc(currentWardObj.coordinator === 'Assigned Officer Desk' ? '' : (currentWardObj.coordinator || ''));
    setIsEditWardModalOpen(true);
  };

  const handleSaveEditWard = async () => {
    if (!editWardName.trim()) {
      Alert.alert('Validation Error', 'Please enter ward name.');
      return;
    }
    if (!currentWardObj) return;

    setIsSavingWard(true);
    try {
      await api.put(`/wards/${currentWardObj.numericId}`, {
        name: editWardName.trim(),
        description: editWardDesc.trim() || undefined
      });
      setIsEditWardModalOpen(false);
      Alert.alert('Success', `Ward "${editWardName.trim()}" updated successfully.`);
      setSelectedWard(editWardName.trim());
      fetchWards();
    } catch (err) {
      console.log('Update ward error:', err.message);
      Alert.alert('Error', err.message || 'Could not update ward.');
    } finally {
      setIsSavingWard(false);
    }
  };

  const handleDeleteCurrentWard = () => {
    if (!currentWardObj) return;

    Alert.alert(
      'Delete Ward',
      `Are you sure you want to delete "${currentWardObj.label}"? ALL nested Areas inside it will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Ward',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/wards/${currentWardObj.numericId}`);
              Alert.alert('Deleted', `Ward "${currentWardObj.label}" and its areas were deleted.`);
              fetchWards();
            } catch (err) {
              console.log('Delete ward error:', err.message);
              Alert.alert('Error', err.message || 'Could not delete ward.');
              fetchWards();
            }
          }
        }
      ]
    );
  };

  // Area operations
  const handleSaveNewArea = async () => {
    if (!newAreaName.trim()) {
      Alert.alert('Validation Error', 'Please enter area name.');
      return;
    }
    if (!currentWardObj) return;

    setIsSavingNewArea(true);
    try {
      await api.post('/areas', {
        name: newAreaName.trim(),
        description: newAreaDesc.trim() || undefined,
        wardId: Number(currentWardObj.numericId)
      });
      setIsAddAreaModalOpen(false);
      setNewAreaName('');
      setNewAreaDesc('');
      Alert.alert('Success', `Area "${newAreaName.trim()}" added to ${currentWardObj.label}.`);
      fetchWards();
    } catch (err) {
      console.log('Create area error:', err.message);
      Alert.alert('Error', err.message || 'Could not add area. Please verify the name is unique in this ward.');
    } finally {
      setIsSavingNewArea(false);
    }
  };

  const handleEditArea = (area) => {
    setEditingArea(area);
    setEditAreaName(area.name || '');
    setEditAreaDesc(area.description === 'Constituency residential and commercial sector' ? '' : (area.description || ''));
    setIsEditAreaModalOpen(true);
  };

  const handleSaveEditArea = async () => {
    if (!editAreaName.trim()) {
      Alert.alert('Validation Error', 'Please enter area name.');
      return;
    }
    if (!editingArea || !currentWardObj) return;

    setIsSavingEditArea(true);
    try {
      await api.put(`/areas/${editingArea.id}`, {
        name: editAreaName.trim(),
        description: editAreaDesc.trim() || undefined,
        wardId: Number(currentWardObj.numericId)
      });
      setIsEditAreaModalOpen(false);
      Alert.alert('Success', `Area "${editAreaName.trim()}" updated successfully.`);
      fetchWards();
    } catch (err) {
      console.log('Update area error:', err.message);
      Alert.alert('Error', err.message || 'Could not update area.');
    } finally {
      setIsSavingEditArea(false);
    }
  };

  const handleDeleteArea = (area) => {
    Alert.alert(
      'Delete Area',
      `Are you sure you want to remove "${area.name}" from ${selectedWard}? User assignments to this area will be cleared.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/areas/${area.id}`);
              Alert.alert('Success', `Area "${area.name}" deleted.`);
              fetchWards();
            } catch (err) {
              console.log('Delete area error:', err.message);
              Alert.alert('Error', err.message || 'Unable to delete area.');
              fetchWards();
            }
          }
        }
      ]
    );
  };

  // Filtered areas in the selected ward by search query
  const filteredAreas = useMemo(() => {
    if (!searchAreaQuery.trim()) return currentAreas;
    const q = searchAreaQuery.toLowerCase().trim();
    return currentAreas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.zone.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [currentAreas, searchAreaQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header Bar with Notification Bell and Profile Avatar */}
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
        {/* Screen Title Row with Add & Export Buttons */}
        <View style={styles.screenTitleRow}>
          <Text style={styles.screenTitle}>Wards & Areas</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.exportBtn}
              activeOpacity={0.8}
              onPress={handleExportCSV}
            >
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>
            {onAddWardPress && (
              <TouchableOpacity
                style={styles.addWardBtn}
                activeOpacity={0.8}
                onPress={onAddWardPress}
              >
                <Text style={styles.addWardBtnText}>+ Add Ward</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Wide Import CSV / Excel Button */}
        <TouchableOpacity
          style={[styles.importCsvButton, isImporting && { opacity: 0.6 }]}
          activeOpacity={0.7}
          onPress={handleImportCSV}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator size="small" color="#ea580c" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="cloud-upload-outline" size={18} color="#ea580c" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.importCsvText}>
            {isImporting ? 'Importing Wards & Areas...' : 'Import Wards & Areas (CSV / Excel)'}
          </Text>
        </TouchableOpacity>

        {/* Horizontal Ward Selector Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wardChipsContainer}
        >
          {wardsList.map((ward) => {
            const isActive = selectedWard === ward.id;
            return (
              <TouchableOpacity
                key={ward.id}
                style={[styles.wardChip, isActive && styles.wardChipActive]}
                onPress={() => setSelectedWard(ward.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.wardChipText, isActive && styles.wardChipTextActive]}>
                  {ward.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Ward Card with Actions */}
        <View style={styles.wardDetailsCard}>
          <View style={styles.wardDetailsHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={styles.wardBadgeRow}>
                <Text style={styles.wardBadgeText}>JURISDICTION</Text>
              </View>
              <Text style={styles.wardDetailsTitle}>{currentWardObj?.label || selectedWard}</Text>
              <Text style={styles.wardDetailsDesc}>
                {currentWardObj?.coordinator || 'Assigned Officer Desk / Municipal Coverage'}
              </Text>
            </View>

            {/* Ward Action Buttons (Edit Ward / Delete Ward) */}
            <View style={styles.wardHeaderActions}>
              <TouchableOpacity
                style={styles.wardHeaderBtnEdit}
                activeOpacity={0.7}
                onPress={openEditCurrentWard}
              >
                <Ionicons name="pencil" size={13} color="#475569" style={{ marginRight: 4 }} />
                <Text style={styles.wardHeaderBtnEditText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.wardHeaderBtnDelete}
                activeOpacity={0.7}
                onPress={handleDeleteCurrentWard}
              >
                <Ionicons name="trash-outline" size={13} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={styles.wardHeaderBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick "+ Add Area to {Ward}" Button inside the Selected Ward */}
          <TouchableOpacity
            style={styles.addAreaToWardBtn}
            activeOpacity={0.8}
            onPress={() => {
              setNewAreaName('');
              setNewAreaDesc('');
              setIsAddAreaModalOpen(true);
            }}
          >
            <Ionicons name="add-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.addAreaToWardBtnText}>
              + Add Area to {currentWardObj?.label || selectedWard}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar for Areas within Selected Ward */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search areas in ${selectedWard}...`}
            placeholderTextColor="#94a3b8"
            value={searchAreaQuery}
            onChangeText={setSearchAreaQuery}
            clearButtonMode="while-editing"
          />
          {searchAreaQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchAreaQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Area Cards Feed */}
        <View style={styles.areasList}>
          {filteredAreas.map((area) => (
            <View key={area.id} style={styles.areaCard}>
              {/* Top Row: Name + Issues Badge */}
              <View style={styles.areaCardHeader}>
                <View style={styles.areaTitleWrap}>
                  <Text style={styles.areaNameText}>{area.name}</Text>
                  <Text style={styles.areaZoneText}>{area.zone}</Text>
                </View>

                {/* Issues Pill Badge */}
                <View style={styles.issuesBadge}>
                  <Text style={styles.issuesBadgeText}>{area.issues} Issues</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.areaDescText}>{area.description}</Text>

              {/* Footer: Date Added + Action Buttons */}
              <View style={styles.areaCardFooter}>
                <Text style={styles.addedDateText}>Added: {area.addedDate}</Text>

                <View style={styles.actionButtonsRow}>
                  {/* Edit Button */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    activeOpacity={0.7}
                    onPress={() => handleEditArea(area)}
                  >
                    <Ionicons name="pencil" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                    onPress={() => handleDeleteArea(area)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {filteredAreas.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>
                {searchAreaQuery
                  ? `No areas matching "${searchAreaQuery}"`
                  : `No areas configured for ${selectedWard}`}
              </Text>
              <Text style={styles.emptyStateSub}>
                Tap "+ Add Area to {currentWardObj?.label || selectedWard}" or import from CSV/Excel
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ================= EDIT WARD MODAL ================= */}
      <Modal
        visible={isEditWardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditWardModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsEditWardModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Edit Ward Details</Text>
                <Text style={styles.modalHeaderSub}>Update municipal ward jurisdiction</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditWardModalOpen(false)}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>
                  WARD NAME <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. Ward A (Shivajinagar)"
                  placeholderTextColor="#94a3b8"
                  value={editWardName}
                  onChangeText={setEditWardName}
                  editable={!isSavingWard}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>DESCRIPTION / COORDINATOR (OPTIONAL)</Text>
                <TextInput
                  style={[styles.modalTextInput, styles.modalTextArea]}
                  placeholder="Officer in charge, contact details, or ward boundary notes..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={editWardDesc}
                  onChangeText={setEditWardDesc}
                  editable={!isSavingWard}
                />
              </View>
            </View>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setIsEditWardModalOpen(false)}
                disabled={isSavingWard}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingWard && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSaveEditWard}
                disabled={isSavingWard}
              >
                {isSavingWard ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Ward</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= ADD AREA MODAL ================= */}
      <Modal
        visible={isAddAreaModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddAreaModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsAddAreaModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Add Sub-Area</Text>
                <Text style={styles.modalHeaderSub}>Under {currentWardObj?.label || selectedWard}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddAreaModalOpen(false)}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <AddressPlacesAutocomplete
                  label="AREA / SECTOR NAME"
                  required={true}
                  placeholder="Search area or colony (e.g. Modern Colony, Kothrud)..."
                  value={newAreaName}
                  onChangeText={setNewAreaName}
                  editable={!isSavingNewArea}
                  onSelectPlace={(place) => {
                    const title = place.main_text || place.display_name.split(',')[0];
                    setNewAreaName(title);
                    if (!newAreaDesc && place.display_name) {
                      setNewAreaDesc(place.display_name);
                    }
                  }}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>DESCRIPTION / LANDMARK (OPTIONAL)</Text>
                <TextInput
                  style={[styles.modalTextInput, styles.modalTextArea]}
                  placeholder="Enter short details about this sector or boundaries..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={newAreaDesc}
                  onChangeText={setNewAreaDesc}
                  editable={!isSavingNewArea}
                />
              </View>
            </View>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setIsAddAreaModalOpen(false)}
                disabled={isSavingNewArea}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingNewArea && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSaveNewArea}
                disabled={isSavingNewArea}
              >
                {isSavingNewArea ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>+ Add Area</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= EDIT AREA MODAL ================= */}
      <Modal
        visible={isEditAreaModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditAreaModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsEditAreaModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Edit Area Details</Text>
                <Text style={styles.modalHeaderSub}>Under {currentWardObj?.label || selectedWard}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditAreaModalOpen(false)}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <AddressPlacesAutocomplete
                  label="AREA / SECTOR NAME"
                  required={true}
                  placeholder="Search area or colony (e.g. Modern Colony, Kothrud)..."
                  value={editAreaName}
                  onChangeText={setEditAreaName}
                  editable={!isSavingEditArea}
                  onSelectPlace={(place) => {
                    const title = place.main_text || place.display_name.split(',')[0];
                    setEditAreaName(title);
                    if (!editAreaDesc && place.display_name) {
                      setEditAreaDesc(place.display_name);
                    }
                  }}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>DESCRIPTION / LANDMARK (OPTIONAL)</Text>
                <TextInput
                  style={[styles.modalTextInput, styles.modalTextArea]}
                  placeholder="Enter short details about this sector or boundaries..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={editAreaDesc}
                  onChangeText={setEditAreaDesc}
                  editable={!isSavingEditArea}
                />
              </View>
            </View>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setIsEditAreaModalOpen(false)}
                disabled={isSavingEditArea}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingEditArea && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSaveEditArea}
                disabled={isSavingEditArea}
              >
                {isSavingEditArea ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Persistent Bottom Navigation */}
      <BottomNav activeTab={activeTab || internalTab} onTabPress={handleTabPress} />
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
  screenTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  screenTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  addWardBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  addWardBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  exportBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  exportBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '700'
  },
  importCsvButton: {
    height: 44,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  importCsvText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  wardChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingRight: 8
  },
  wardChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  wardChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  wardChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  wardChipTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },
  wardDetailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  wardDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  wardBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 4
  },
  wardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.6
  },
  wardDetailsTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  wardDetailsDesc: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2
  },
  wardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  wardHeaderBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  wardHeaderBtnEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  wardHeaderBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  wardHeaderBtnDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444'
  },
  addAreaToWardBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  addAreaToWardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a'
  },
  areasList: {
    gap: 12
  },
  areaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  areaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  areaTitleWrap: {
    flex: 1,
    marginRight: 8
  },
  areaNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  areaZoneText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c',
    marginTop: 2
  },
  issuesBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  issuesBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#c2410c'
  },
  areaDescText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12
  },
  areaCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  addedDateText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500'
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10
  },
  editBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9'
  },
  pencilIconBox: {
    width: 14,
    height: 14,
    backgroundColor: '#64748b',
    borderRadius: 2
  },
  pencilBody: {
    flex: 1
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2'
  },
  trashIconBox: {
    width: 14,
    height: 14,
    alignItems: 'center'
  },
  trashLid: {
    width: 12,
    height: 2,
    backgroundColor: '#ef4444'
  },
  trashBody: {
    width: 10,
    height: 10,
    backgroundColor: '#ef4444',
    marginTop: 1,
    borderRadius: 1
  },
  trashLine: {},
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed'
  },
  emptyStateTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4
  },
  emptyStateSub: {
    fontSize: 12.5,
    color: '#94a3b8',
    textAlign: 'center'
  },
  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16
  },
  modalHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBody: {
    marginBottom: 16
  },
  modalInputGroup: {
    marginBottom: 14
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  modalTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a'
  },
  modalTextArea: {
    minHeight: 75,
    paddingTop: 10
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748b'
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  modalSaveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff'
  }
});
