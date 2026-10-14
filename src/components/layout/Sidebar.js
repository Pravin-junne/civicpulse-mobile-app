import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * Fallback Orange Circular Emblem matching brand
 */
const FallbackEmblem = () => (
  <View style={styles.emblemContainer}>
    <View style={styles.emblemInnerCircle}>
      <View style={styles.emblemLeaf} />
    </View>
  </View>
);

/**
 * Icon Renderer Helper using clean React Native shapes / glyphs
 */
const NavIcon = ({ name, color = '#64748b' }) => {
  switch (name) {
    case 'dashboard':
      return (
        <View style={styles.iconBox}>
          <View style={styles.grid2x2}>
            <View style={[styles.gridCell, { borderColor: color }]} />
            <View style={[styles.gridCell, { borderColor: color }]} />
            <View style={[styles.gridCell, { borderColor: color }]} />
            <View style={[styles.gridCell, { borderColor: color }]} />
          </View>
        </View>
      );
    case 'complaints':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.fileIcon, { borderColor: color }]}>
            <View style={[styles.fileLine, { backgroundColor: color }]} />
            <View style={[styles.fileLine, { backgroundColor: color, width: '50%' }]} />
          </View>
        </View>
      );
    case 'new_complaint':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.circlePlus, { borderColor: color }]}>
            <View style={[styles.plusH, { backgroundColor: color }]} />
            <View style={[styles.plusV, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'track_grievance':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.trackCircle, { borderColor: color }]}>
            <View style={[styles.trackDot, { backgroundColor: color }]} />
            <View style={[styles.trackHandle, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'appointments':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.calendarIcon, { borderColor: color }]}>
            <View style={[styles.calLine, { backgroundColor: color }]} />
            <View style={[styles.calDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'live_tracking':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.pinIcon, { borderColor: color }]}>
            <View style={[styles.pinDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'officer_performance':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.perfShield, { borderColor: color }]}>
            <View style={[styles.perfStar, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'manage_users':
      return (
        <View style={styles.iconBox}>
          <View style={styles.userIconWrap}>
            <View style={[styles.userHead, { borderColor: color }]} />
            <View style={[styles.userBody, { borderColor: color }]} />
          </View>
        </View>
      );
    case 'departments':
      return (
        <View style={styles.iconBox}>
          <View style={styles.layerStack}>
            <View style={[styles.layerItem, { borderColor: color }]} />
            <View style={[styles.layerItem, { borderColor: color, marginTop: -3 }]} />
            <View style={[styles.layerItem, { borderColor: color, marginTop: -3 }]} />
          </View>
        </View>
      );
    case 'wards':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.mapIcon, { borderColor: color }]}>
            <View style={[styles.mapFold, { borderColor: color }]} />
          </View>
        </View>
      );
    case 'reports':
      return (
        <View style={styles.iconBox}>
          <View style={styles.chartBars}>
            <View style={[styles.chartBar, { height: 6, backgroundColor: color }]} />
            <View style={[styles.chartBar, { height: 12, backgroundColor: color }]} />
            <View style={[styles.chartBar, { height: 9, backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'assets':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.assetBox, { borderColor: color }]}>
            <View style={[styles.assetTape, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'file_manager':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.folderBody, { borderColor: color }]}>
            <View style={[styles.folderTab, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'budget':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.walletIcon, { borderColor: color }]}>
            <View style={[styles.walletFlap, { borderColor: color }]} />
            <View style={[styles.walletDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'expenses':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.cardIcon, { borderColor: color }]}>
            <View style={[styles.cardStripe, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'events':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.calendarIcon, { borderColor: color }]}>
            <View style={[styles.calLine, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'contacts':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.phoneIcon, { borderColor: color }]} />
        </View>
      );
    case 'social':
      return (
        <View style={styles.iconBox}>
          <View style={styles.shareNodes}>
            <View style={[styles.shareDot, { backgroundColor: color }]} />
            <View style={[styles.shareDot, { backgroundColor: color, left: 10, top: 4 }]} />
            <View style={[styles.shareDot, { backgroundColor: color, left: 0, top: 8 }]} />
          </View>
        </View>
      );
    default:
      return <View style={styles.iconBox} />;
  }
};

/**
 * Modern Close '✕' Icon
 */
const CloseIcon = ({ color = '#475569' }) => (
  <View style={styles.closeIconBox}>
    <View style={[styles.closeLine, styles.closeLine1, { backgroundColor: color }]} />
    <View style={[styles.closeLine, styles.closeLine2, { backgroundColor: color }]} />
  </View>
);

/**
 * Professional Vector Log Out Icon
 */
const LogoutVectorIcon = ({ color = '#dc2626', size = 16 }) => (
  <View style={[styles.logoutIconBox, { width: size, height: size }]}>
    <View style={[styles.logoutBracket, { borderColor: color }]} />
    <View style={[styles.logoutArrowShaft, { backgroundColor: color }]} />
    <View style={[styles.logoutArrowHeadTop, { backgroundColor: color }]} />
    <View style={[styles.logoutArrowHeadBot, { backgroundColor: color }]} />
  </View>
);

export default function Sidebar({
  activeRoute = 'dashboard',
  onNavigate = () => {},
  onClose,
  onOpenProfile,
  onSignOut,
  user = { name: 'PMC Administrator', role: 'Administrator' },
  style
}) {
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'complaints', label: 'Complaints Directory', icon: 'complaints' },
    { id: 'appointments', label: 'Appointments & Visits', icon: 'appointments' },
    { id: 'live_tracking', label: 'Live Field Tracking', icon: 'live_tracking' },
    { id: 'departments', label: 'Departments', icon: 'departments' },
    { id: 'wards', label: 'Wards & Areas', icon: 'wards' },
    { id: 'manage_users', label: 'Manage Users', icon: 'manage_users' },
    { id: 'reports', label: 'Reports Panel', icon: 'reports' },
  ];

  const officeNavItems = [
    { id: 'assets', label: 'Asset Management', icon: 'assets' },
    { id: 'file_manager', label: 'File Manager & Vault', icon: 'file_manager' },
    { id: 'budget', label: 'Budget Management', icon: 'budget' },
    { id: 'expenses', label: 'Office Expenses', icon: 'expenses' },
    { id: 'events', label: 'Event Management', icon: 'events' },
    { id: 'contacts', label: 'Contact Directory', icon: 'contacts' },
    { id: 'social', label: 'Social Media Feed', icon: 'social' },
  ];

  const isItemActive = (itemId, route) => {
    if (itemId === route) return true;
    if (itemId === 'manage_users' && (route === 'users' || route === 'add_user')) return true;
    if (itemId === 'departments' && (route === 'departments' || route === 'add_dept')) return true;
    if (itemId === 'wards' && (route === 'wards' || route === 'add_ward')) return true;
    if (itemId === 'complaints' && (route === 'complaints' || route === 'new_complaint' || route === 'complaint_detail')) return true;
    if (itemId === 'appointments' && (route === 'appointments' || route === 'add_appointment')) return true;
    if (itemId === 'assets' && (route === 'assets' || route === 'add_asset')) return true;
    if (itemId === 'file_manager' && route === 'file_manager') return true;
    if (itemId === 'budget' && (route === 'budget' || route === 'add_budget')) return true;
    if (itemId === 'expenses' && (route === 'expenses' || route === 'add_expense')) return true;
    if (itemId === 'events' && (route === 'events' || route === 'create_event')) return true;
    if (itemId === 'contacts' && (route === 'contacts' || route === 'add_contact')) return true;
    if (itemId === 'social' && (route === 'social' || route === 'social_detail')) return true;
    return false;
  };

  return (
    <SafeAreaView style={[styles.sidebarContainer, style]} edges={['top', 'bottom', 'left']}>
      {/* Brand Header with Close Button */}
      <View style={styles.brandHeader}>
        <View style={styles.brandInfoLeft}>
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 40, height: 40, resizeMode: 'contain' }}
          />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              Office of Kunal Tilak
            </Text>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              Politician Portal
            </Text>
          </View>
        </View>

        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Close Navigation Menu"
            accessibilityRole="button"
          >
            <CloseIcon />
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Navigation Items */}
      <ScrollView
        style={styles.navScrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navContentContainer}
      >
        {/* Main Section */}
        <View style={styles.menuGroup}>
          {mainNavItems.map((item) => {
            const isActive = isItemActive(item.id, activeRoute);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => onNavigate(item.id)}
                activeOpacity={0.7}
              >
                <NavIcon
                  name={item.icon}
                  color={isActive ? '#ffffff' : '#8da4be'}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Office Management Section */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeaderTitle}>OFFICE MANAGEMENT</Text>
        </View>

        <View style={styles.menuGroup}>
          {officeNavItems.map((item) => {
            const isActive = isItemActive(item.id, activeRoute);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => onNavigate(item.id)}
                activeOpacity={0.7}
              >
                <NavIcon
                  name={item.icon}
                  color={isActive ? '#ffffff' : '#8da4be'}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Profile Footer */}
      <View style={styles.footerCard}>
        <TouchableOpacity
          style={styles.profileTouchArea}
          activeOpacity={0.7}
          onPress={() => {
            if (onOpenProfile) {
              if (onClose) onClose();
              onOpenProfile();
            }
          }}
        >
          <View style={styles.avatarWrapper}>
            {user && user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={14} color="#0f172a" />
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileNameText} numberOfLines={1}>
              {user ? user.name || 'PMC Administrator' : 'PMC Administrator'}
            </Text>
            <View style={styles.rolePill}>
              <Text style={styles.profileRoleText} numberOfLines={1}>
                {user?.role ? user.role.replace(/_/g, ' ') : 'ADMINISTRATOR'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {onSignOut && (
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => {
              if (onClose) onClose();
              onSignOut();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Sign Out"
          >
            <LogoutVectorIcon color="#dc2626" size={15} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebarContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingTop: 16,
    paddingBottom: 20,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  /* Brand Header */
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 2,
  },
  brandInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  closeIconBox: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 13,
    height: 2,
    borderRadius: 1,
  },
  closeLine1: {
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  emblemContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emblemInnerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemLeaf: {
    width: 9,
    height: 12,
    backgroundColor: '#f97316',
    borderTopLeftRadius: 7,
    borderBottomRightRadius: 7,
    transform: [{ rotate: '-20deg' }],
  },
  brandTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8da4be',
    marginTop: 1,
  },

  /* Navigation Scroll */
  navScrollView: {
    flex: 1,
  },
  navContentContainer: {
    gap: 4,
    paddingBottom: 10,
  },
  menuGroup: {
    gap: 4,
  },

  /* Section Header */
  sectionHeaderWrap: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  sectionHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#8da4be',
    letterSpacing: 0.6,
  },

  /* Navigation Items */
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 12,
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Custom Vector Icons */
  iconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 2x2 Grid */
  grid2x2: {
    width: 14,
    height: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridCell: {
    width: 5.5,
    height: 5.5,
    borderWidth: 1.4,
    borderRadius: 1.5,
  },

  /* File Icon */
  fileIcon: {
    width: 13,
    height: 15,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingTop: 3,
    paddingLeft: 2,
    gap: 2,
  },
  fileLine: {
    height: 1.5,
    width: '70%',
    borderRadius: 1,
  },

  /* Plus Circle */
  circlePlus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
  },
  plusV: {
    width: 1.5,
    height: 8,
    borderRadius: 1,
    position: 'absolute',
  },

  /* Track / Radar Circle */
  trackCircle: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  trackHandle: {
    position: 'absolute',
    bottom: -3,
    right: -2,
    width: 5,
    height: 1.8,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },

  /* Pin Icon */
  pinIcon: {
    width: 14,
    height: 16,
    borderWidth: 1.5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 7,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  /* Performance Shield */
  perfShield: {
    width: 14,
    height: 16,
    borderWidth: 1.5,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfStar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* User Icon */
  userIconWrap: {
    alignItems: 'center',
  },
  userHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  userBody: {
    width: 14,
    height: 6,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: 1,
  },

  /* Layers Icon */
  layerStack: {
    alignItems: 'center',
  },
  layerItem: {
    width: 14,
    height: 5,
    borderWidth: 1.4,
    borderRadius: 2,
    transform: [{ rotate: '-8deg' }],
  },

  /* Map Icon */
  mapIcon: {
    width: 15,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
    flexDirection: 'row',
  },
  mapFold: {
    width: '50%',
    height: '100%',
    borderRightWidth: 1.2,
  },

  /* Chart Bars */
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 14,
  },
  chartBar: {
    width: 2.5,
    borderRadius: 1,
  },

  /* Asset Box */
  assetBox: {
    width: 15,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetTape: {
    width: 7,
    height: 2,
    borderRadius: 1,
  },

  /* Folder Icon */
  folderBody: {
    width: 15,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    marginTop: 2,
  },
  folderTab: {
    position: 'absolute',
    top: -3,
    left: 1,
    width: 6,
    height: 2.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  /* Wallet Icon */
  walletIcon: {
    width: 15,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  walletFlap: {
    position: 'absolute',
    top: 2,
    right: 0,
    width: 5,
    height: 6,
    borderWidth: 1.2,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  walletDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
  },

  /* Card Icon */
  cardIcon: {
    width: 15,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingTop: 2,
  },
  cardStripe: {
    width: '100%',
    height: 2,
  },

  /* Calendar Icon */
  calendarIcon: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingTop: 3,
  },
  calLine: {
    width: '100%',
    height: 1.5,
  },
  calDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 2,
    alignSelf: 'center',
  },

  /* Phone Icon */
  phoneIcon: {
    width: 13,
    height: 13,
    borderWidth: 1.8,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ rotate: '45deg' }],
  },

  /* Share Nodes Icon */
  shareNodes: {
    width: 14,
    height: 14,
    position: 'relative',
  },
  shareDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },

  /* Footer Card */
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  profileTouchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    marginRight: 9,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#ea580c',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },
  avatarText: {
    fontSize: 16,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
  },
  profileRoleText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.3,
  },
  signOutBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Professional Vector Logout Icon */
  logoutIconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBracket: {
    position: 'absolute',
    left: 1,
    top: 1.5,
    bottom: 1.5,
    width: 6.5,
    borderLeftWidth: 1.8,
    borderTopWidth: 1.8,
    borderBottomWidth: 1.8,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  logoutArrowShaft: {
    position: 'absolute',
    right: 1,
    top: 6.5,
    width: 8,
    height: 1.8,
    borderRadius: 0.9,
  },
  logoutArrowHeadTop: {
    position: 'absolute',
    right: 1.2,
    top: 4,
    width: 4.5,
    height: 1.8,
    borderRadius: 0.9,
    transform: [{ rotate: '45deg' }],
  },
  logoutArrowHeadBot: {
    position: 'absolute',
    right: 1.2,
    top: 9,
    width: 4.5,
    height: 1.8,
    borderRadius: 0.9,
    transform: [{ rotate: '-45deg' }],
  },
});
