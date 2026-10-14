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
  RefreshControl,
  Alert,
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api from '../../services/api';
import { exportCSVFile, exportPDFFile } from '../../utils/fileExport';

/**
 * Clean 3-Dots Vertical Menu Icon Component
 */
const ThreeDotsIcon = () => (
  <Ionicons name="ellipsis-vertical" size={18} color="#94a3b8" />
);

export default function UserScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddUserPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Action Menu Modal
  const [selectedUserForAction, setSelectedUserForAction] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // Edit User Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Helper to extract uppercase initials for avatar placeholder
  const getInitials = (name = '') => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper to format role names cleanly matching reference design
  const formatRoleLabel = (role, name = '') => {
    if (!role) return 'Staff';
    const r = role.toUpperCase();
    if (r === 'SUPERADMIN' || r === 'ADMIN') return 'Administrator';
    if (r === 'OFFICER') return 'PMC Officer';
    if (r === 'IN_OFFICE_PERSON') return 'In-Office Person';
    if (r === 'AGENT') return 'Agent (Operator)';
    return role.replace(/_/g, ' ');
  };

  // Helper to resolve office / department name
  const resolveOfficeName = (u) => {
    if (u.office && typeof u.office === 'string' && u.office.trim()) return u.office;
    if (u.department) {
      return typeof u.department === 'object' ? u.department.name : u.department;
    }
    if (Array.isArray(u.departments) && u.departments.length > 0) {
      return u.departments.map((d) => (typeof d === 'object' ? d.name : d)).join(', ');
    }
    const r = (u.role || '').toUpperCase();
    if (r === 'SUPERADMIN' || r === 'ADMIN') return 'PMC Admin Office';
    return 'PMC Central Office';
  };

  // Fetch users & departments from backend
  const fetchUsers = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [userRes, deptRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/departments')
      ]);

      if (deptRes.status === 'fulfilled') {
        const dList = Array.isArray(deptRes.value)
          ? deptRes.value
          : (deptRes.value && deptRes.value.departments ? deptRes.value.departments : []);
        setDepartments(dList);
      }

      if (userRes.status === 'fulfilled') {
        const res = userRes.value;
        const list = Array.isArray(res) ? res : (res && res.users ? res.users : []);

        setUsers(
          list.map((u, i) => ({
            id: u.id,
            rawRole: u.role,
            username: u.username,
            name: u.name || u.username,
            email: u.email || '',
            mobileNumber: u.mobileNumber || '',
            role: formatRoleLabel(u.role, u.name || u.username),
            office: resolveOfficeName(u),
            departmentId: u.departmentId || (u.department ? u.department.id : null),
            isOnline: u.isActive !== undefined ? Boolean(u.isActive) : true,
            avatar: u.avatar || null
          }))
        );
      }
    } catch (err) {
      console.log('Users fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(false);

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchUsers(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchUsers]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleAddUser = () => {
    if (onAddUserPress) {
      onAddUserPress();
    } else if (navigation && navigation.navigate) {
      navigation.navigate('add_user');
    }
  };

  const handleOpenActionModal = (user) => {
    setSelectedUserForAction(user);
    setIsActionModalOpen(true);
  };

  // Toggle user active status
  const handleToggleUserStatus = async (user) => {
    const updatedStatus = !user.isOnline;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isOnline: updatedStatus } : u))
    );
    setIsActionModalOpen(false);

    try {
      await api.put(`/users/${user.id}`, { isActive: updatedStatus });
    } catch (e) {
      console.log('Status update error:', e.message);
    }
  };

  // Open Edit Modal
  const handleStartEdit = (user) => {
    setIsActionModalOpen(false);
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditMobile(user.mobileNumber || '');
    setEditDepartmentId(user.departmentId || (departments.length > 0 ? departments[0].id : null));
    setEditIsActive(user.isOnline);
    setIsEditModalOpen(true);
  };

  // Save Edit Handler
  const handleSaveEdit = async () => {
    if (!editName || editName.trim().length < 2) {
      Alert.alert('Validation Error', 'Please enter a valid full name.');
      return;
    }
    if (editMobile && !/^\d{10}$/.test(editMobile)) {
      Alert.alert('Validation Error', 'Mobile number must be exactly 10 digits.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const payload = {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        mobileNumber: editMobile.trim() || undefined,
        departmentId: editDepartmentId ? parseInt(editDepartmentId) : undefined,
        departmentIds: editDepartmentId ? [parseInt(editDepartmentId)] : undefined,
        isActive: editIsActive
      };

      await api.put(`/users/${editingUser.id}`, payload);

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === editingUser.id) {
            const matchedDept = departments.find((d) => d.id === editDepartmentId);
            return {
              ...u,
              name: editName.trim(),
              email: editEmail.trim(),
              mobileNumber: editMobile.trim(),
              office: matchedDept ? matchedDept.name : u.office,
              departmentId: editDepartmentId,
              isOnline: editIsActive
            };
          }
          return u;
        })
      );

      setIsEditModalOpen(false);
      Alert.alert('Success', 'Personnel record updated successfully.');
    } catch (err) {
      Alert.alert('Update Notice', err.response?.data?.message || err.message || 'Could not update user.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = (user) => {
    setIsActionModalOpen(false);
    Alert.alert(
      'Reset Password',
      `Send temporary login credentials to ${user.name}? (Default will be set to PMC@User2026)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Password',
          onPress: async () => {
            try {
              await api.post(`/users/${user.id}/reset-password`, { newPassword: 'PMC@User2026' });
              Alert.alert('Password Reset', `Password for ${user.name} was reset successfully.\nDefault: PMC@User2026`);
            } catch (e) {
              Alert.alert('Notice', `Password reset request initiated for ${user.name}.`);
            }
          }
        }
      ]
    );
  };

  // Delete User Handler
  const handleDeleteUser = (user) => {
    setIsActionModalOpen(false);
    Alert.alert(
      'Delete Personnel',
      `Are you sure you want to remove ${user.name} from the directory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            try {
              await api.delete(`/users/${user.id}`);
              Alert.alert('Removed', `User ${user.name} has been removed.`);
            } catch (e) {
              console.log('Delete user notice:', e.message);
            }
          }
        }
      ]
    );
  };

  // Export handlers
  const handleExportExcel = async () => {
    try {
      const headers = 'ID,Name,Role,Office / Department,Status,Email,Mobile\n';
      const rows = filteredUsers
        .map(
          (u) =>
            `"${u.id}","${(u.name || '').replace(/"/g, '""')}","${u.role}","${(u.office || '').replace(/"/g, '""')}","${
              u.isOnline ? 'Active' : 'Inactive'
            }","${u.email}","${u.mobileNumber}"`
        )
        .join('\n');
      const csvData = headers + rows;

      await exportCSVFile(`Users_Directory_${Date.now()}.csv`, csvData);
    } catch (err) {
      Alert.alert('Export Error', `Could not export users: ${err.message}`);
    }
  };

  const handleExportPDF = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Users & Personnel Directory</title>
            <style>
              @page { size: A4 landscape; margin: 10mm 8mm; }
              * { box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; background: #ffffff; }
              .header { border-bottom: 2px solid #ea580c; padding-bottom: 8px; margin-bottom: 12px; }
              h1 { color: #0f172a; font-size: 18px; margin: 0 0 4px 0; }
              .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; table-layout: fixed; }
              th { background: #fff7ed; color: #ea580c; padding: 6px 4px; text-align: left; font-weight: 700; border: 1px solid #fed7aa; word-break: break-word; overflow-wrap: break-word; }
              td { padding: 5px 4px; border: 1px solid #e2e8f0; text-align: left; word-break: break-word; overflow-wrap: break-word; vertical-align: top; }
              tr:nth-child(even) { background: #fafafa; }
              .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>👥 Users & Personnel Directory</h1>
              <div class="meta">
                <strong>Generated on:</strong> ${new Date().toLocaleString()} | <strong>Total Records:</strong> ${filteredUsers.length}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">ID</th>
                  <th style="width: 25%;">Name</th>
                  <th style="width: 25%;">Role / Designation</th>
                  <th style="width: 25%;">Department / Office</th>
                  <th style="width: 15%;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUsers
                  .map(
                    (u) => `
                  <tr>
                    <td>#${u.id}</td>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.role}</td>
                    <td>${u.office || '—'}</td>
                    <td>${u.isOnline ? '<span style="color: #059669; font-weight: bold;">Active</span>' : '<span style="color: #94a3b8;">Inactive</span>'}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="footer">लोकप्रतिनिधी कार्यालय / Office of Kunal Tilak — Personnel Management</div>
          </body>
        </html>
      `;

      await exportPDFFile(`Users_Report_${Date.now()}.pdf`, htmlContent);
    } catch (err) {
      Alert.alert('Export PDF', `PDF generation error: ${err.message}`);
    }
  };

  const handleExportOptions = () => {
    Alert.alert('Export Personnel Directory', `Export ${filteredUsers.length} personnel records:`, [
      { text: 'Export Excel / CSV', onPress: handleExportExcel },
      { text: 'Export PDF Summary', onPress: handleExportPDF },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const roleFilters = [
    { id: 'ALL', label: 'All' },
    { id: 'OFFICER', label: 'PMC Officers' },
    { id: 'IN_OFFICE_PERSON', label: 'In-Office Staff' },
    { id: 'AGENT', label: 'Agents / Operators' }
  ];

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedRole !== 'ALL') {
        const r = (u.rawRole || u.role || '').toUpperCase();
        if (selectedRole === 'OFFICER' && !r.includes('OFFICER')) return false;
        if (selectedRole === 'IN_OFFICE_PERSON' && !r.includes('IN_OFFICE')) return false;
        if (selectedRole === 'AGENT' && !r.includes('AGENT') && !r.includes('OPERATOR')) return false;
      }
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.role && u.role.toLowerCase().includes(query)) ||
        (u.office && u.office.toLowerCase().includes(query))
      );
    });
  }, [users, selectedRole, searchQuery]);

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

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* Header Row: Title & Soft Peach Add (+) Button matching reference design */}
        <View style={styles.titleHeaderRow}>
          <Text style={styles.screenTitle}>Users & Personnel</Text>

          <View style={styles.headerActionsWrap}>
            {/* Quick Search Toggle */}
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Ionicons name="search-outline" size={18} color="#475569" />
            </TouchableOpacity>

            {/* Export Trigger */}
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={handleExportOptions}
            >
              <Ionicons name="document-text-outline" size={18} color="#475569" />
            </TouchableOpacity>

            {/* + Add Button matching reference */}
            <TouchableOpacity
              style={styles.headerAddButton}
              activeOpacity={0.7}
              onPress={handleAddUser}
            >
              <Ionicons name="add" size={20} color="#ea580c" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Search & Filter Bar */}
        {showSearch && (
          <View style={styles.searchFilterBox}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search by name, role or department..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsScroll}
            >
              {roleFilters.map((rf) => {
                const isActive = selectedRole === rf.id;
                return (
                  <TouchableOpacity
                    key={rf.id}
                    style={[
                      styles.filterPill,
                      isActive && styles.filterPillActive
                    ]}
                    onPress={() => setSelectedRole(rf.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive
                      ]}
                    >
                      {rf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && !refreshing && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#ea580c" />
          </View>
        )}

        {/* Personnel Card List matching reference screenshot */}
        <View style={styles.usersList}>
          {filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              activeOpacity={0.85}
              onPress={() => handleOpenActionModal(user)}
            >
              {/* Left Avatar with Status Dot Indicator */}
              <View style={styles.avatarWrapper}>
                {user.avatar ? (
                  <Image
                    source={{ uri: user.avatar }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{getInitials(user.name)}</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: user.isOnline ? '#10b981' : '#94a3b8' }
                  ]}
                />
              </View>

              {/* Center User Info Column */}
              <View style={styles.userInfoWrap}>
                <Text style={styles.userNameText} numberOfLines={1}>
                  {user.name}
                </Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{user.role}</Text>
                </View>

                <Text style={styles.officeText} numberOfLines={1}>
                  {user.office}
                </Text>
              </View>

              {/* Right 3-Dots Action Button */}
              <TouchableOpacity
                style={styles.moreButton}
                activeOpacity={0.6}
                onPress={() => handleOpenActionModal(user)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ThreeDotsIcon />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {filteredUsers.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Personnel Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search query or role filter.</Text>
            </View>
          )}
        </View>

        {/* Generous bottom clearance */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Sheet Modal */}
      <Modal
        visible={isActionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsActionModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsActionModalOpen(false)}
        >
          <View style={styles.actionSheetContainer}>
            {selectedUserForAction && (
              <>
                <View style={styles.actionSheetHeader}>
                  {selectedUserForAction.avatar ? (
                    <Image source={{ uri: selectedUserForAction.avatar }} style={styles.actionSheetAvatar} />
                  ) : (
                    <View style={styles.actionSheetAvatarFallback}>
                      <Text style={styles.actionSheetAvatarText}>{getInitials(selectedUserForAction.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionSheetName}>{selectedUserForAction.name}</Text>
                    <Text style={styles.actionSheetSub}>{selectedUserForAction.role} • {selectedUserForAction.office}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: selectedUserForAction.isOnline ? '#dcfce7' : '#f1f5f9' }
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: selectedUserForAction.isOnline ? '#15803d' : '#64748b' }
                      ]}
                    >
                      {selectedUserForAction.isOnline ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionSheetDivider} />

                {/* Edit Option */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleStartEdit(selectedUserForAction)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="create-outline" size={18} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.actionTitle}>Edit User Profile</Text>
                    <Text style={styles.actionDesc}>Modify name, email, contact, or department</Text>
                  </View>
                </TouchableOpacity>

                {/* Toggle Status */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleToggleUserStatus(selectedUserForAction)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#fff7ed' }]}>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#ea580c" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.actionTitle}>
                      {selectedUserForAction.isOnline ? 'Deactivate Account' : 'Activate Account'}
                    </Text>
                    <Text style={styles.actionDesc}>
                      {selectedUserForAction.isOnline ? 'Mark offline / inactive' : 'Mark active / online'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Reset Password */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleResetPassword(selectedUserForAction)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="key-outline" size={18} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.actionTitle}>Reset Password</Text>
                    <Text style={styles.actionDesc}>Generate temporary credentials</Text>
                  </View>
                </TouchableOpacity>

                {/* Delete Account */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleDeleteUser(selectedUserForAction)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#fef2f2' }]}>
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.actionTitle, { color: '#dc2626' }]}>Delete Personnel</Text>
                    <Text style={styles.actionDesc}>Permanently remove from system</Text>
                  </View>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.actionCancelBtn}
                  onPress={() => setIsActionModalOpen(false)}
                >
                  <Text style={styles.actionCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Personnel Details</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Full Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Engr. J. Patil"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Mobile Number */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number (10 Digits)</Text>
                <TextInput
                  style={styles.formInput}
                  value={editMobile}
                  onChangeText={setEditMobile}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="e.g. officer@pmc.gov.in"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Department Selection */}
              {departments.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Assigned Department</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {departments.map((dept) => {
                        const isSelected = editDepartmentId === dept.id;
                        return (
                          <TouchableOpacity
                            key={dept.id}
                            style={[
                              styles.deptChip,
                              isSelected && styles.deptChipSelected
                            ]}
                            onPress={() => setEditDepartmentId(dept.id)}
                          >
                            <Text
                              style={[
                                styles.deptChipText,
                                isSelected && styles.deptChipTextSelected
                              ]}
                            >
                              {dept.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Active Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Active Personnel Status</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    {editIsActive ? 'Active and available for assignments' : 'Marked inactive'}
                  </Text>
                </View>
                <Switch
                  value={editIsActive}
                  onValueChange={setEditIsActive}
                  trackColor={{ false: '#cbd5e1', true: '#fed7aa' }}
                  thumbColor={editIsActive ? '#ea580c' : '#f1f5f9'}
                />
              </View>
            </ScrollView>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.editCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveButton}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.editSaveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Persistent Bottom Navigation */}
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
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  /* Title Header Row matching reference */
  titleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff1e7', // Soft peach/orange tint matching reference
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddIcon: {
    fontSize: 26,
    fontWeight: '400',
    color: '#ea580c',
    lineHeight: 28,
    marginTop: -2,
  },

  /* Search & Filter Section */
  searchFilterBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  filterPillsScroll: {
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },

  /* Users List Container */
  usersList: {
    gap: 12,
  },

  /* User Card matching reference screenshot */
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e8edf2', // Crisp light border matching reference
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 0.5,
  },

  /* Avatar with Online/Offline Indicator */
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ea580c',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },

  /* User Info Middle Column */
  userInfoWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  officeText: {
    fontSize: 12.5,
    color: '#8da4be',
    fontWeight: '400',
  },

  /* Right 3-Dots Action Button */
  moreButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threeDotsBox: {
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCircle: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#8da4be',
  },

  /* Empty State */
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 4,
  },

  /* Action Sheet Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionSheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  actionSheetAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ea580c',
  },
  actionSheetName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionSheetSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  actionDesc: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  actionCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    alignItems: 'center',
  },
  actionCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },

  /* Edit Modal */
  editModalContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 40,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  deptChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deptChipSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  deptChipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  deptChipTextSelected: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 6,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
  },
  editCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  editSaveButton: {
    flex: 1.5,
    paddingVertical: 10,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    alignItems: 'center',
  },
  editSaveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
