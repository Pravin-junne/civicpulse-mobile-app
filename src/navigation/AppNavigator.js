import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { DrawerModal, NotificationModal, ProfileModal } from '../components';
import api, { authService } from '../services/api';

// Import all domain screens from master barrel
import {
  // Authentication
  OnboardingScreen,
  LoginScreen,
  // Dashboard & Tracking
  DashboardScreen,
  LiveTrackingScreen,
  // Grievances
  ComplaintsScreen,
  NewComplaintScreen,
  ComplaintDetailsScreen,
  CitizenTrackComplaintScreen,
  // Appointments & Delegations
  AppointmentScreen,
  AddAppointmentScreen,
  // Municipal Assets
  AssetManagementScreen,
  AddAssetScreen,
  // File Manager & Vault
  FileManagerScreen,
  // Budget & Expenses
  BudgetScreen,
  AddBudgetScreen,
  ExpenseScreen,
  AddExpenseScreen,
  // Events
  EventManagementScreen,
  CreateEventScreen,
  // Contacts
  ContactDirectoryScreen,
  AddContactScreen,
  // Social Media
  SocialMediaScreen,
  SocialPostDetailScreen,
  // Administration
  DepartmentScreen,
  AddDepartmentScreen,
  WardsAreaScreen,
  AddWardScreen,
  UserScreen,
  AddUserScreen,
  ReportScreen
} from '../screens';

export default function AppNavigator({ initialRoute = null }) {
  const [historyStack, setHistoryStack] = useState([
    { route: initialRoute || 'onboarding', params: null }
  ]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const currentEntry = historyStack[historyStack.length - 1] || { route: initialRoute || 'onboarding', params: null };
  const currentRoute = currentEntry.route;
  const routeParams = currentEntry.params;

  // Operational Live Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  // Profile Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Fetch notifications from live backend
  const fetchNotifications = useCallback(async (isSilent = true) => {
    try {
      const token = await authService.getToken();
      if (!token) return;
      if (!isSilent) setIsNotifLoading(true);
      const res = await api.get('/notifications');
      if (res && res.notifications) {
        setNotifications(res.notifications);
        const unread = typeof res.unreadCount === 'number'
          ? res.unreadCount
          : res.notifications.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      // Silently handle
    } finally {
      if (!isSilent) setIsNotifLoading(false);
    }
  }, []);

  // Sync notifications on mount and when app returns to active foreground
  useEffect(() => {
    if (currentUser) {
      fetchNotifications(false);

      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          fetchNotifications(true);
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [currentUser, fetchNotifications]);

  // Restore stored session and check onboarding on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = await authService.getStoredUser();
        const token = await authService.getToken();
        if (storedUser && token) {
          setCurrentUser(storedUser);
          if (!initialRoute) {
            setHistoryStack([{ route: 'dashboard', params: null }]);
          }
        } else if (!initialRoute) {
          const hasSeen = await authService.hasSeenOnboarding();
          if (!hasSeen) {
            setHistoryStack([{ route: 'onboarding', params: null }]);
          } else {
            setHistoryStack([{ route: 'login', params: null }]);
          }
        }
      } catch (err) {
        console.warn('Could not restore auth session:', err);
        if (!initialRoute) {
          setHistoryStack([{ route: 'login', params: null }]);
        }
      }
    };
    restoreSession();
  }, [initialRoute]);

  // Synchronize bottom navigation tab with current route
  const getActiveTab = () => {
    switch (currentRoute) {
      case 'dashboard':
        return 'dashboard';
      case 'complaints':
      case 'new_complaint':
      case 'complaint_detail':
        return 'complaints';
      case 'live_tracking':
      case 'track_grievance':
        return 'track';
      case 'reports':
        return 'reports';
      case 'contacts':
      case 'add_contact':
        return 'contacts';
      default:
        return 'dashboard';
    }
  };

  /**
   * Navigate to a screen and push to history stack
   */
  const navigate = useCallback((routeName, params = null) => {
    setHistoryStack((prev) => [...prev, { route: routeName, params }]);
    setIsDrawerOpen(false);
  }, []);

  /**
   * Return to previous screen
   */
  const goBack = useCallback(() => {
    setHistoryStack((prev) => {
      if (prev.length <= 1) {
        return [{ route: 'dashboard', params: null }];
      }
      return prev.slice(0, -1);
    });
  }, []);

  /**
   * Handle Bottom Tab navigation
   */
  const handleTabPress = useCallback((tabId) => {
    switch (tabId) {
      case 'dashboard':
        navigate('dashboard');
        break;
      case 'complaints':
        navigate('complaints');
        break;
      case 'track':
        navigate('live_tracking');
        break;
      case 'reports':
        navigate('reports');
        break;
      case 'contacts':
      case 'contact':
        navigate('contacts');
        break;
      case 'more':
        setIsDrawerOpen(true);
        break;
      default:
        navigate('dashboard');
        break;
    }
  }, [navigate]);

  /**
   * Sidebar Drawer navigation item mapping
   */
  const handleDrawerNavigate = useCallback((routeId) => {
    switch (routeId) {
      case 'dashboard':
        navigate('dashboard');
        break;
      case 'complaints':
        navigate('complaints');
        break;
      case 'new_complaint':
        navigate('new_complaint');
        break;
      case 'track_grievance':
        navigate('track_grievance');
        break;
      case 'appointments':
        navigate('appointments');
        break;
      case 'live_tracking':
        navigate('live_tracking');
        break;
      case 'manage_users':
        navigate('users');
        break;
      case 'departments':
        navigate('departments');
        break;
      case 'wards':
        navigate('wards');
        break;
      case 'reports':
        navigate('reports');
        break;
      case 'assets':
        navigate('assets');
        break;
      case 'file_manager':
        navigate('file_manager');
        break;
      case 'budget':
        navigate('budget');
        break;
      case 'expenses':
        navigate('expenses');
        break;
      case 'events':
        navigate('events');
        break;
      case 'contacts':
        navigate('contacts');
        break;
      case 'social':
        navigate('social');
        break;
      default:
        navigate(routeId);
        break;
    }
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      // Ignore
    }
    setCurrentUser(null);
    navigate('login');
  }, [navigate]);

  // Notification Modal Handlers
  const handleOpenNotifications = useCallback(() => {
    setIsNotificationOpen(true);
    fetchNotifications(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read', { all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to mark all as read:', e);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      await api.post('/notifications/clear', { all: true });
      setNotifications([]);
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to clear notifications:', e);
    }
  }, []);

  const handleSelectNotification = useCallback(
    async (item) => {
      try {
        api.post('/notifications/read', { id: item.id }).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {}

      setIsNotificationOpen(false);

      if (item.targetRoute === 'complaint_detail' && item.rawPayload) {
        navigate('complaint_detail', item.rawPayload);
      } else if (item.targetRoute) {
        navigate(item.targetRoute);
      }
    },
    [navigate]
  );

  const handleOpenProfile = useCallback(() => {
    setIsProfileOpen(true);
  }, []);

  // Current Active Tab
  const activeTab = getActiveTab();

  /**
   * Render Current Screen Component with contextual navigation props
   */
  const renderScreen = () => {
    switch (currentRoute) {
      // 0. Authentication & Onboarding
      case 'onboarding':
        return (
          <OnboardingScreen
            onFinish={() => navigate('login')}
          />
        );

      case 'login':
        return (
          <LoginScreen
            onLoginSuccess={(user) => {
              if (user) setCurrentUser(user);
              navigate('dashboard');
            }}
            onNavigateTrack={() => navigate('track_grievance')}
          />
        );

      // 1. Dashboard & Tracking
      case 'dashboard':
        return (
          <DashboardScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onNavigateGrievances={(filters) => navigate('complaints', filters)}
            onNavigateLiveTrack={() => navigate('live_tracking')}
            onNavigateDepartments={() => navigate('departments')}
            onNavigateAppointments={() => navigate('appointments')}
            onNavigateAssets={() => navigate('assets')}
            onNavigateBudget={() => navigate('budget')}
            onNavigateExpenses={() => navigate('expenses')}
            onNavigateEvents={() => navigate('events')}
            onNavigatePerformance={() => navigate('reports')}
            onNavigateReports={() => navigate('reports')}
            onNavigateContacts={() => navigate('contacts')}
            onNavigateFileManager={() => navigate('file_manager')}
            onViewComplaintDetail={(complaint) => navigate('complaint_detail', complaint)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
            navigation={{ navigate, goBack }}
          />
        );

      case 'live_tracking':
        return (
          <LiveTrackingScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onViewComplaintDetail={(complaint) => navigate('complaint_detail', complaint)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
            navigation={{ navigate, goBack }}
          />
        );

      // 2. Grievance / Complaints Management
      case 'complaints':
        return (
          <ComplaintsScreen
            initialFilters={routeParams}
            routeParams={routeParams}
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddComplaintPress={() => navigate('new_complaint')}
            onViewComplaintDetail={(complaint) => navigate('complaint_detail', complaint)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'new_complaint':
        return (
          <NewComplaintScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('complaints')}
          />
        );

      case 'complaint_detail':
        return (
          <ComplaintDetailsScreen
            complaintData={routeParams}
            onBack={goBack}
            onStatusChangeSuccess={() => {}}
          />
        );

      case 'track_grievance':
        return (
          <CitizenTrackComplaintScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      // 3. Appointments & Delegations
      case 'appointments':
        return (
          <AppointmentScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddAppointmentPress={() => navigate('add_appointment')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_appointment':
        return (
          <AddAppointmentScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('appointments')}
          />
        );

      // 4. Municipal Assets
      case 'assets':
        return (
          <AssetManagementScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddAssetPress={() => navigate('add_asset')}
            onEditAssetPress={(asset) => navigate('add_asset', { asset, isEdit: true })}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_asset':
        return (
          <AddAssetScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('assets')}
            asset={routeParams?.asset || null}
            isEdit={Boolean(routeParams?.isEdit || routeParams?.asset)}
          />
        );

      // 5. File Manager & Vault
      case 'file_manager':
        return (
          <FileManagerScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      // 6. Budget & Expenses
      case 'budget':
        return (
          <BudgetScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddBudgetPress={() => navigate('add_budget')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_budget':
        return (
          <AddBudgetScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('budget')}
          />
        );

      case 'expenses':
        return (
          <ExpenseScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddExpensePress={() => navigate('add_expense')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_expense':
        return (
          <AddExpenseScreen
            navigation={{ navigate, goBack }}
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('expenses')}
          />
        );

      // 7. Events
      case 'events':
        return (
          <EventManagementScreen
            navigation={{ navigate, goBack }}
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddEventPress={() => navigate('create_event')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'create_event':
        return (
          <CreateEventScreen
            navigation={{ navigate, goBack }}
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('events')}
          />
        );

      // 8. Contacts
      case 'contacts':
        return (
          <ContactDirectoryScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddContactPress={() => navigate('add_contact')}
            onEditContactPress={(contact) => navigate('add_contact', { contact, isEdit: true })}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_contact':
        return (
          <AddContactScreen
            contact={routeParams?.contact || null}
            isEdit={Boolean(routeParams?.isEdit || routeParams?.contact)}
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('contacts')}
          />
        );

      // 9. Social Media
      case 'social':
        return (
          <SocialMediaScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onViewPostDetails={(post) => navigate('social_detail', post)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'social_detail':
        return (
          <SocialPostDetailScreen
            postData={routeParams}
            onBack={goBack}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      // 10. Administration
      case 'departments':
        return (
          <DepartmentScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddDepartmentPress={() => navigate('add_dept')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_dept':
        return (
          <AddDepartmentScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('departments')}
          />
        );

      case 'wards':
        return (
          <WardsAreaScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddWardPress={() => navigate('add_ward')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_ward':
        return (
          <AddWardScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('wards')}
          />
        );

      case 'users':
        return (
          <UserScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onAddUserPress={() => navigate('add_user')}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      case 'add_user':
        return (
          <AddUserScreen
            onBack={goBack}
            onCancel={goBack}
            onSubmitSuccess={() => navigate('users')}
          />
        );

      case 'reports':
        return (
          <ReportScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );

      default:
        return (
          <DashboardScreen
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
            unreadCount={unreadCount}
          />
        );
    }
  };

  return (
    <View style={styles.navigatorContainer}>
      {/* Active Screen */}
      {renderScreen()}

      {/* Global Slide-Over Navigation Drawer */}
      <DrawerModal
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeRoute={currentRoute}
        onNavigate={handleDrawerNavigate}
        onOpenProfile={handleOpenProfile}
        onSignOut={handleSignOut}
        user={currentUser}
      />

      {/* Global Real-Time Operational Notification Modal */}
      <NotificationModal
        visible={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        loading={isNotifLoading}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
        onSelectNotification={handleSelectNotification}
      />

      {/* Global Officer Profile & Account Modal */}
      <ProfileModal
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onSignOut={handleSignOut}
        onNavigate={handleDrawerNavigate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  navigatorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
