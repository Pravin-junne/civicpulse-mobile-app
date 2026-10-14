import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Fallback Bell Icon component using pure React Native shapes & borders
 */
const FallbackBellIcon = ({ color = '#334155' }) => {
  return (
    <View style={styles.bellWrapper}>
      {/* Top ring / loop */}
      <View style={[styles.bellTopLoop, { borderColor: color }]} />
      {/* Main bell dome */}
      <View style={[styles.bellDome, { borderColor: color, borderTopColor: color }]} />
      {/* Bell base rim */}
      <View style={[styles.bellRim, { backgroundColor: color }]} />
      {/* Clapper / bottom ball */}
      <View style={[styles.bellClapper, { backgroundColor: color }]} />
    </View>
  );
};

/**
 * Fallback Orange Circular Emblem matching the design
 */
const FallbackEmblem = () => {
  return (
    <View style={styles.emblemContainer}>
      <View style={styles.emblemInnerCircle}>
        <View style={styles.emblemLeaf} />
      </View>
    </View>
  );
};

/**
 * Menu Hamburger Icon with modern staggered styling and brand accent
 */
const MenuIcon = ({ color = '#0f172a', accentColor = '#ea580c' }) => (
  <View style={styles.menuIconBox}>
    <View style={[styles.menuBarTop, { backgroundColor: color }]} />
    <View style={[styles.menuBarMid, { backgroundColor: accentColor }]} />
    <View style={[styles.menuBarBot, { backgroundColor: color }]} />
  </View>
);

/**
 * MainHeader Component
 * 
 * @param {string} title - Main title text (Default: "Office of Kunal Tilak")
 * @param {string} subtitle - Subtitle text (Default: "Government Portal")
 * @param {any} logoSource - Optional image source for logo (require/uri)
 * @param {function} onNotificationPress - Callback when bell icon is pressed
 * @param {boolean} showNotification - Whether to show the notification bell (Default: true)
 * @param {number|boolean} unreadCount - Number of unread notifications (or true for dot)
 * @param {function} onMenuPress - Callback when hamburger menu/emblem is pressed to open drawer
 * @param {function} onBack - Optional back button callback
 * @param {function} onAvatarPress - Callback when profile avatar button is pressed
 * @param {object} style - Custom container styles
 */
export default function MainHeader({
  title = 'Office of Kunal Tilak',
  subtitle = 'Politician Portal',
  logoSource = require('../../../assets/icon.png'),
  onNotificationPress,
  showNotification = true,
  unreadCount = 0,
  userAvatar,
  onAvatarPress,
  onOpenProfile,
  onOpenNotifications,
  onOpenDrawer,
  onMenuPress,
  onBack,
  style
}) {
  const handleMenuPress = onMenuPress || onOpenDrawer;
  const handleNotificationPress = onNotificationPress || onOpenNotifications;
  const handleAvatarPress = onAvatarPress || onOpenProfile;

  return (
    <View style={[styles.headerContainer, style]}>
      {/* Left Section: Back / Hamburger Menu + Logo & Brand Text */}
      <View style={styles.leftSection}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
            accessibilityRole="button"
          >
            <MenuIcon />
          </TouchableOpacity>
        )}

        {/* Emblem / Logo */}
        {logoSource ? (
          <TouchableOpacity
            activeOpacity={handleMenuPress ? 0.7 : 1}
            onPress={handleMenuPress}
            style={styles.emblemTouch}
          >
            <Image
              source={typeof logoSource === 'string' ? { uri: logoSource } : logoSource}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={handleMenuPress ? 0.7 : 1}
            onPress={handleMenuPress}
            style={styles.emblemTouch}
          >
            <FallbackEmblem />
          </TouchableOpacity>
        )}

        {/* Title & Subtitle */}
        <TouchableOpacity
          style={styles.textContainer}
          activeOpacity={handleMenuPress ? 0.7 : 1}
          onPress={handleMenuPress}
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Right Section: Notification Button & Professional Profile Button */}
      <View style={styles.rightSection}>
        {showNotification && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <FallbackBellIcon color="#1e293b" />

            {/* Optional Unread Notification Badge */}
            {Boolean(unreadCount) && (
              <View style={styles.badgeContainer}>
                {typeof unreadCount === 'number' && unreadCount > 0 ? (
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                ) : (
                  <View style={styles.badgeDot} />
                )}
              </View>
            )}
          </TouchableOpacity>
        )}

        {Boolean(handleAvatarPress) && (
          <TouchableOpacity
            style={styles.profileIconButton}
            onPress={handleAvatarPress}
            activeOpacity={0.75}
            accessibilityLabel="Officer Profile"
            accessibilityRole="button"
          >
            <View style={styles.profileIconCircle}>
              <Ionicons name="person" size={17} color="#ffffff" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 64,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  hamburgerButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emblemTouch: {
    marginRight: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backArrow: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '800',
    marginTop: -2,
  },
  menuIconBox: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuBarTop: {
    width: 18,
    height: 2.2,
    borderRadius: 1.2,
  },
  menuBarMid: {
    width: 12,
    height: 2.2,
    borderRadius: 1.2,
  },
  menuBarBot: {
    width: 16,
    height: 2.2,
    borderRadius: 1.2,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  emblemContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#ea580c', // Bright orange circular border
    backgroundColor: '#fff7ed', // Soft orange tint background
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemInnerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemLeaf: {
    width: 9,
    height: 12,
    backgroundColor: '#ea580c',
    borderTopLeftRadius: 7,
    borderBottomRightRadius: 7,
    transform: [{ rotate: '-20deg' }],
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a', // Dark Navy
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748b', // Muted Slate
    marginTop: 1,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9', // Soft light circle
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Custom Pure Bell Drawing
  bellWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellTopLoop: {
    width: 4,
    height: 3,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  bellDome: {
    width: 14,
    height: 10,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  bellRim: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  bellClapper: {
    width: 4,
    height: 2.5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: 0.5,
  },
  // Badge
  badgeContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
