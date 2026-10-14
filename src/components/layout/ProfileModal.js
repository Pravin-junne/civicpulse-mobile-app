import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileModal({
  visible = false,
  onClose,
  user = null,
  onSignOut,
  onNavigate
}) {
  const insets = useSafeAreaInsets();

  const displayName = user?.name || user?.username || 'Mukhya Prashasak';
  const displayRole = (user?.role || 'SUPERADMIN').replace(/_/g, ' ').toUpperCase();
  const displayUsername = user?.username ? `@${user.username}` : '@superadmin';
  const displayEmail = user?.email || 'superadmin@municipal.gov.in';
  const displayPhone = user?.mobileNumber || user?.phone || '9999999999';
  const displayDept =
    user?.department?.name ||
    (Array.isArray(user?.departments) && user.departments.length > 0
      ? user.departments.map((d) => d.name || d).join(', ')
      : user?.departmentName || 'Central Administration');

  // Compute initials (e.g., MP for Mukhya Prashasak)
  const getInitials = (name) => {
    if (!name) return 'MP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleConfirmSignOut = () => {
    Alert.alert(
      'Sign Out Confirmation',
      'Are you sure you want to sign out from the portal session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            if (onClose) onClose();
            if (onSignOut) onSignOut();
          }
        }
      ]
    );
  };

  const shortcuts = [
    {
      id: 'dashboard',
      label: 'Constituency Dashboard',
      desc: 'Real-time overview & KPI metrics',
      icon: 'speedometer-outline',
      color: '#ea580c',
      bgColor: '#fff7ed'
    },
    {
      id: 'complaints',
      label: 'Grievance Redressal Desk',
      desc: 'Citizen complaints & resolution tracker',
      icon: 'warning-outline',
      color: '#ea580c',
      bgColor: '#fff7ed'
    },
    {
      id: 'appointments',
      label: 'Appointments & Visits',
      desc: 'Citizen schedules & delegation calendar',
      icon: 'calendar-outline',
      color: '#0284c7',
      bgColor: '#f0f9ff'
    },
    {
      id: 'manage_users',
      label: 'User & Role Management',
      desc: 'Staff directory & access control',
      icon: 'people-outline',
      color: '#0284c7',
      bgColor: '#eff6ff'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullScreenContainer} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* 1. Top Bar / Main Header Bar */}
        <View style={styles.topHeaderBar}>
          <View style={styles.headerBrandGroup}>
            {/* Logo Icon */}
            <View style={styles.headerLogoBox}>
              <Text style={{ fontSize: 18 }}>🏛️</Text>
            </View>

            {/* Titles */}
            <View>
              <Text style={styles.headerBrandTitle}>Office of Kunal Tilak</Text>
              <Text style={styles.headerBrandSubtitle}>Government Portal</Text>
            </View>
          </View>

          {/* Right Header Action Icons */}
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Scrollable Body Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Profile Hero Card matching reference design */}
          <View style={styles.heroCard}>
            {/* Circular Peach Accent Watermark on right */}
            <View style={styles.heroWatermark} />

            {/* Avatar and Name details */}
            <View style={styles.avatarRow}>
              {/* Orange Initials Avatar Circle */}
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
              </View>

              <View style={styles.heroTextWrap}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.heroUsername} numberOfLines={1}>
                  {displayUsername}
                </Text>

                {/* Orange Solid Role Badge */}
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{displayRole}</Text>
                </View>
              </View>
            </View>

            {/* Bottom Session Info Row */}
            <View style={styles.sessionStatusRow}>
              <View style={styles.statusIndicator}>
                <View style={styles.greenDot} />
                <Text style={styles.statusIndicatorText}>Active Secure Session</Text>
              </View>
              <Text style={styles.portalVersionText}>Portal v2.6</Text>
            </View>
          </View>

          {/* 3. Account & Department Section matching reference design */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionLabel}>ACCOUNT & DEPARTMENT</Text>

            <View style={styles.infoCardContainer}>
              {/* Official Email */}
              <View style={styles.infoItemRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="mail" size={20} color="#1e3a8a" />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoItemLabel}>OFFICIAL EMAIL</Text>
                  <Text style={styles.infoItemValue} numberOfLines={1}>
                    {displayEmail}
                  </Text>
                </View>
              </View>

              {/* Contact Number */}
              <View style={styles.infoItemRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="call" size={20} color="#1e3a8a" />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoItemLabel}>CONTACT NUMBER</Text>
                  <Text style={styles.infoItemValue}>
                    {displayPhone}
                  </Text>
                </View>
              </View>

              {/* Assigned Department */}
              <View style={[styles.infoItemRow, { borderBottomWidth: 0 }]}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="briefcase" size={20} color="#1e3a8a" />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoItemLabel}>ASSIGNED DEPARTMENT</Text>
                  <Text style={styles.infoItemValue} numberOfLines={1}>
                    {displayDept}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 4. Quick Navigation Shortcuts */}
          {onNavigate && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>QUICK SHORTCUTS</Text>

              <View style={styles.quickLinksCol}>
                {shortcuts.map((sc, idx) => (
                  <TouchableOpacity
                    key={sc.id}
                    style={[
                      styles.quickLinkRow,
                      idx === shortcuts.length - 1 && { borderBottomWidth: 0 }
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (onClose) onClose();
                      onNavigate(sc.id);
                    }}
                  >
                    <View style={styles.quickLinkLeft}>
                      <View style={[styles.quickLinkIconBox, { backgroundColor: sc.bgColor }]}>
                        <Ionicons name={sc.icon} size={18} color={sc.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quickLinkLabel}>{sc.label}</Text>
                        <Text style={styles.quickLinkDesc}>{sc.desc}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 5. Sign Out Button */}
          <View style={styles.signOutSection}>
            <TouchableOpacity
              style={styles.signOutButton}
              activeOpacity={0.8}
              onPress={handleConfirmSignOut}
            >
              <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
              <Text style={styles.signOutButtonText}>Sign Out from Portal</Text>
            </TouchableOpacity>
          </View>

          {/* Extra bottom padding for clearance */}
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  headerBrandTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerBrandSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },

  /* 1. Hero Card matching reference design */
  heroCard: {
    backgroundColor: '#fff4ea', // Soft light peach/cream background
    borderRadius: 22,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  heroWatermark: {
    position: 'absolute',
    right: -25,
    bottom: -35,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ffe2cb',
    opacity: 0.7,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ea580c', // Bright orange avatar circle
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarInitials: {
    fontSize: 23,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ea580c', // Orange bold name
    letterSpacing: -0.2,
  },
  heroUsername: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ea580c', // Orange solid badge
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    marginTop: 5,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ea580c',
  },
  portalVersionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },

  /* 2. Account & Department Section matching reference design */
  sectionWrap: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  infoCardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  infoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0f7ff', // Soft pastel light blue
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextCol: {
    flex: 1,
  },
  infoItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoItemValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },

  /* 3. Quick Shortcuts */
  quickLinksCol: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  quickLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  quickLinkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  quickLinkDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },

  /* 4. Sign Out Button */
  signOutSection: {
    marginTop: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 14,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#dc2626',
  },
});
