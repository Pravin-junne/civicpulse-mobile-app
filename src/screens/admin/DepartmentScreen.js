import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Switch,
  Alert,
  ActivityIndicator,
  AppState,
  Modal,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainHeader, BottomNav } from '../../components';
import api from '../../services/api';

/**
 * Custom Edit Pencil Icon
 */
const EditPencilIcon = () => (
  <View style={styles.pencilIconBox}>
    <View style={styles.pencilBody} />
    <View style={styles.pencilTip} />
  </View>
);

/**
 * Custom Trash Can Icon
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

export default function DepartmentScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddDepartmentPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); // 'All' | 'Active' | 'Inactive'
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  const [departments, setDepartments] = useState([]);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchDepartments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/departments');
      const list = Array.isArray(res) ? res : (res && res.departments ? res.departments : []);
      setDepartments(list.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description || 'Municipal civic service department',
        activeGrievances: d.complaints ? d.complaints.length : (d._count ? d._count.complaints : 0),
        isActive: d.isActive !== undefined ? d.isActive : true
      })));
    } catch (err) {
      console.log('Departments fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchDepartments(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchDepartments]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const handleAddDepartment = () => {
    if (onAddDepartmentPress) {
      onAddDepartmentPress();
    } else if (navigation && navigation.navigate) {
      navigation.navigate('add_dept');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDepartments();
  };

  // Toggle Department Status (Active / Inactive)
  const toggleDepartmentStatus = async (id) => {
    const dept = departments.find((d) => d.id === id);
    if (!dept) return;
    const updatedStatus = !dept.isActive;

    // Optimistic UI update
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: updatedStatus } : d))
    );

    try {
      await api.put(`/departments/${id}`, { isActive: updatedStatus });
    } catch (err) {
      console.log('Failed to update department status:', err.message);
      // Revert on failure
      setDepartments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isActive: !updatedStatus } : d))
      );
      Alert.alert('Error', 'Could not update department status. Please check your connection.');
    }
  };

  // Edit Department Action
  const handleEdit = (dept) => {
    setEditingDept(dept);
    setEditName(dept.name || '');
    setEditDescription(dept.description === 'Municipal civic service department' ? '' : (dept.description || ''));
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter department name.');
      return;
    }
    if (!editingDept) return;

    setIsSavingEdit(true);
    try {
      await api.put(`/departments/${editingDept.id}`, {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      });
      setIsEditModalOpen(false);
      Alert.alert('Success', `Department "${editName.trim()}" updated successfully.`);
      fetchDepartments();
    } catch (err) {
      console.log('Update department error:', err.message);
      Alert.alert('Error', err.message || 'Could not update department.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Department Action
  const handleDelete = (dept) => {
    Alert.alert(
      'Delete Department',
      `Are you sure you want to remove "${dept.name}"? This may affect ${dept.activeGrievances || 0} linked grievances.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/departments/${dept.id}`);
              Alert.alert('Deleted', `Department "${dept.name}" removed successfully.`);
              fetchDepartments();
            } catch (err) {
              console.log('Delete department error:', err.message);
              Alert.alert('Error', err.message || 'Could not delete department.');
              fetchDepartments();
            }
          }
        }
      ]
    );
  };

  // Filter & Search Logic
  const filteredDepartments = departments.filter((dept) => {
    // 1. Search Query
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      dept.name.toLowerCase().includes(query) ||
      dept.description.toLowerCase().includes(query);

    // 2. Chip Filter (All / Active / Inactive)
    if (activeFilter === 'Active') return matchesQuery && dept.isActive;
    if (activeFilter === 'Inactive') return matchesQuery && !dept.isActive;
    return matchesQuery;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Brand Header with Notification Bell and Profile Avatar */}
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
        {/* Screen Title & Top Actions */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Municipal Departments</Text>
            <Text style={styles.screenSubtitle}>Manage department actions & active services</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={handleAddDepartment}
          >
            <Text style={styles.addPlusIcon}>+</Text>
            <Text style={styles.addButtonText}>Add Dept</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input Box */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconBox}>
            <View style={styles.searchIconCircle} />
            <View style={styles.searchIconHandle} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search departments..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Chips (All, Active, Inactive) */}
        <View style={styles.filterChipsRow}>
          {['All', 'Active', 'Inactive'].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive
                ]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Departments Cards List */}
        <View style={styles.departmentList}>
          {filteredDepartments.map((dept) => (
            <View key={dept.id} style={styles.deptCard}>
              {/* Top Row: Name + Toggle Switch */}
              <View style={styles.deptCardHeader}>
                <Text style={styles.deptNameText}>{dept.name}</Text>
                <Switch
                  value={dept.isActive}
                  onValueChange={() => toggleDepartmentStatus(dept.id)}
                  trackColor={{ false: '#cbd5e1', true: '#ea580c' }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#cbd5e1"
                />
              </View>

              {/* Description */}
              <Text style={styles.deptDescText}>{dept.description}</Text>

              {/* Bottom Row: Active Grievances + Action Buttons */}
              <View style={styles.deptCardFooter}>
                <View style={styles.grievanceCountRow}>
                  {/* File Icon */}
                  <View style={styles.fileIconShape}>
                    <View style={styles.fileIconLine} />
                    <View style={styles.fileIconLine} />
                  </View>
                  <Text style={styles.grievanceCountText}>
                    {dept.activeGrievances} Active Grievances
                  </Text>
                </View>

                {/* Edit & Delete Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  {/* Edit Pencil Button */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    activeOpacity={0.7}
                    onPress={() => handleEdit(dept)}
                  >
                    <EditPencilIcon />
                  </TouchableOpacity>

                  {/* Delete Trash Button */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                    onPress={() => handleDelete(dept)}
                  >
                    <TrashIcon />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {filteredDepartments.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No departments found</Text>
              <Text style={styles.emptyStateSub}>Try searching with another keyword</Text>
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* EDIT DEPARTMENT MODAL */}
      <Modal
        visible={isEditModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Department</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalInputLabel}>
                DEPARTMENT NAME <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Electrical Division"
                placeholderTextColor="#94a3b8"
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={[styles.modalInputLabel, { marginTop: 14 }]}>
                DESCRIPTION (OPTIONAL)
              </Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextAreaInput]}
                placeholder="Enter details of functions..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={editDescription}
                onChangeText={setEditDescription}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={isSavingEdit}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingEdit && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Persistent Bottom Navigation */}
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120, // 👈 Generous clearance above persistent BottomNav bar
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Title & Subtitle */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed', // Soft orange tint
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  addPlusIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
    marginRight: 4,
  },
  addButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c',
  },

  /* Search Input */
  searchContainer: {
    height: 46,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIconBox: {
    width: 16,
    height: 16,
    marginRight: 10,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.8,
    borderColor: '#8da4be',
  },
  searchIconHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 4,
    height: 1.8,
    backgroundColor: '#8da4be',
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
  },

  /* Filter Chips */
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#ea580c', // Solid Orange
    borderColor: '#ea580c',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Department Cards */
  departmentList: {
    gap: 12,
  },
  deptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  deptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deptNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  deptDescText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
  },
  deptCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  grievanceCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fileIconShape: {
    width: 12,
    height: 14,
    borderWidth: 1.4,
    borderColor: '#ea580c',
    borderRadius: 2,
    padding: 1.5,
    justifyContent: 'center',
  },
  fileIconLine: {
    height: 1,
    backgroundColor: '#ea580c',
    marginBottom: 1.5,
  },
  grievanceCountText: {
    fontSize: 12,
    color: '#8da4be',
    fontWeight: '600',
  },

  /* Action Buttons (Edit & Delete) */
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilIconBox: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilBody: {
    width: 10,
    height: 3,
    backgroundColor: '#475569',
    borderRadius: 0.8,
    transform: [{ rotate: '-45deg' }],
  },
  pencilTip: {
    width: 0,
    height: 0,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2', // Soft light red
    borderWidth: 1,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIconBox: {
    width: 12,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashLid: {
    width: 11,
    height: 1.5,
    backgroundColor: '#ef4444',
    borderRadius: 0.8,
    marginBottom: 1,
  },
  trashBody: {
    width: 9,
    height: 10,
    borderWidth: 1.3,
    borderColor: '#ef4444',
    borderRadius: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 1,
  },
  trashLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#ef4444',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  /* Edit Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  modalTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  modalTextAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
