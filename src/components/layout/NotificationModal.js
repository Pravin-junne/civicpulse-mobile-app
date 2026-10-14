import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
  PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Visual styling configuration per notification category matching reference design
 */
const getCategoryStyle = (type = '', category = '') => {
  const t = (type || category || '').toUpperCase();

  if (t.includes('EVENT')) {
    return {
      iconName: 'calendar-outline',
      iconBg: '#fff7ed',
      iconColor: '#ea580c',
      badgeBg: '#fff7ed',
      badgeText: '#ea580c',
      badgeLabel: 'EVENT',
      linkText: '#ea580c'
    };
  }

  if (t.includes('APPT') || t.includes('APPOINTMENT') || t.includes('VISIT')) {
    return {
      iconName: 'person-outline',
      iconBg: '#f0f9ff',
      iconColor: '#0284c7',
      badgeBg: '#e0f2fe',
      badgeText: '#0284c7',
      badgeLabel: 'VISIT',
      linkText: '#ea580c'
    };
  }

  if (t.includes('ADVANCE') || t.includes('BUDGET') || t.includes('EXPENSE') || t.includes('FINANCE')) {
    return {
      iconName: 'wallet-outline',
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      badgeBg: '#ede9fe',
      badgeText: '#7c3aed',
      badgeLabel: 'FINANCIAL',
      linkText: '#ea580c'
    };
  }

  if (t.includes('COMPLAINT') || t.includes('GRIEVANCE')) {
    return {
      iconName: 'alert-circle-outline',
      iconBg: '#fff7ed',
      iconColor: '#ea580c',
      badgeBg: '#fff7ed',
      badgeText: '#ea580c',
      badgeLabel: 'GENERAL',
      linkText: '#1e3a8a'
    };
  }

  return {
    iconName: 'notifications-outline',
    iconBg: '#f8fafc',
    iconColor: '#ea580c',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    badgeLabel: 'OPERATIONS',
    linkText: '#ea580c'
  };
};

export default function NotificationModal({
  visible = false,
  onClose,
  notifications = [],
  loading = false,
  onMarkAllRead,
  onClearAll,
  onSelectNotification
}) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('ALL');

  const activeNotifications = useMemo(() => {
    if (notifications && notifications.length > 0) {
      return notifications.map((n) => ({
        ...n,
        timeAgo: n.timeAgo || n.time || (n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''),
        division: n.division || n.department?.name || ''
      }));
    }
    return [];
  }, [notifications]);

  // Full-screen / Slide-Up Snap Points
  const snapHalf = Math.min(SCREEN_HEIGHT * 0.85, SCREEN_HEIGHT - 60);
  const snapFull = SCREEN_HEIGHT;

  const [isFullScreen, setIsFullScreen] = useState(false);
  const animatedHeight = useRef(new Animated.Value(snapHalf)).current;

  useEffect(() => {
    if (visible) {
      setIsFullScreen(false);
      animatedHeight.setValue(snapHalf);
    }
  }, [visible, snapHalf]);

  const toggleFullScreen = (toFull) => {
    const target = typeof toFull === 'boolean' ? toFull : !isFullScreen;
    setIsFullScreen(target);
    Animated.spring(animatedHeight, {
      toValue: target ? snapFull : snapHalf,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14
    }).start();
  };

  // Drag Gesture PanResponder on header and grabber
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 8;
        },
        onPanResponderMove: (_, gestureState) => {
          const currentBase = isFullScreen ? snapFull : snapHalf;
          const newH = currentBase - gestureState.dy;
          if (newH >= 240 && newH <= snapFull) {
            animatedHeight.setValue(newH);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -50 || gestureState.vy < -0.4) {
            toggleFullScreen(true);
          } else if (gestureState.dy > 60 || gestureState.vy > 0.4) {
            if (isFullScreen) {
              toggleFullScreen(false);
            } else if (onClose) {
              onClose();
            }
          } else {
            toggleFullScreen(isFullScreen);
          }
        }
      }),
    [isFullScreen, snapFull, snapHalf, onClose]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'ALL') return activeNotifications;
    return activeNotifications.filter((n) => {
      const cat = (n.category || n.type || '').toLowerCase();
      if (activeFilter === 'advances') return cat.includes('advance') || cat.includes('budget') || cat.includes('expense');
      if (activeFilter === 'visits') return cat.includes('visit') || cat.includes('appt') || cat.includes('appointment');
      if (activeFilter === 'operations') return cat.includes('event') || cat.includes('operation') || cat.includes('asset');
      if (activeFilter === 'financials') return cat.includes('financial') || cat.includes('budget') || cat.includes('expense');
      return cat === activeFilter.toLowerCase();
    });
  }, [activeNotifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return activeNotifications.filter((n) => !n.isRead).length;
  }, [activeNotifications]);

  const visitsCount = useMemo(() => {
    return activeNotifications.filter((n) => {
      const cat = (n.category || n.type || '').toLowerCase();
      return cat.includes('visit') || cat.includes('appt') || cat.includes('appointment');
    }).length;
  }, [activeNotifications]);

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'advances', label: 'Advances' },
    { id: 'visits', label: 'Visits', count: visitsCount },
    { id: 'operations', label: 'Operations' },
    { id: 'financials', label: 'Financials' }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {!isFullScreen && (
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
        )}

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              height: animatedHeight,
              paddingTop: isFullScreen ? Math.max(insets.top + 6, 16) : 10,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopLeftRadius: isFullScreen ? 0 : 28,
              borderTopRightRadius: isFullScreen ? 0 : 28
            }
          ]}
        >
          {/* Top Grabber Handle */}
          <View {...panResponder.panHandlers} style={styles.grabberWrapper}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleFullScreen()}
              style={styles.grabberTouchable}
            >
              <View style={styles.grabberBar} />
            </TouchableOpacity>
          </View>

          {/* Section Header Row: Title, Badge, and Action Buttons matching reference image */}
          <View style={styles.headerRow}>
            {/* Title & Badge on Left */}
            <View style={styles.headerLeftGroup}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountBadgeText}>{unreadCount} New</Text>
                </View>
              )}
            </View>

            {/* Read All & Clear Buttons on Right */}
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.readAllButton}
                onPress={onMarkAllRead}
                activeOpacity={0.7}
              >
                <Text style={styles.readAllCheckIcon}>✓</Text>
                <Text style={styles.readAllButtonText}>Read All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={onClearAll}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Pills Horizontal Scroll */}
          <View style={styles.filterTabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabsScroll}
            >
              {filterTabs.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => setActiveFilter(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                      {tab.label}
                    </Text>
                    {tab.count !== undefined && tab.count > 0 && (
                      <View style={styles.tabCountCircle}>
                        <Text style={styles.tabCountText}>{tab.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Notifications List Scroll Area */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color="#ea580c" />
                <Text style={styles.loadingText}>Syncing notifications...</Text>
              </View>
            ) : filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>You are all caught up with your updates.</Text>
              </View>
            ) : (
              filteredNotifications.map((item) => {
                const config = getCategoryStyle(item.type, item.category);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.notificationCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (onSelectNotification) onSelectNotification(item);
                    }}
                  >
                    {/* Top Row: Icon + Title/Badge/Time + Unread Dot */}
                    <View style={styles.cardTopRow}>
                      {/* Left Category Icon Box */}
                      <View style={[styles.iconBox, { backgroundColor: config.iconBg }]}>
                        <Ionicons name={config.iconName} size={20} color={config.iconColor} />
                      </View>

                      {/* Middle Text Column */}
                      <View style={styles.cardContentCol}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {item.title}
                        </Text>

                        {/* Tag Pill + Time ago */}
                        <View style={styles.cardMetaRow}>
                          <View style={[styles.categoryTagPill, { backgroundColor: config.badgeBg }]}>
                            <Text style={[styles.categoryTagText, { color: config.badgeText }]}>
                              {config.badgeLabel}
                            </Text>
                          </View>
                          <Text style={styles.cardTimeText}>{item.timeAgo}</Text>
                        </View>
                      </View>

                      {/* Top Right Orange Unread Dot */}
                      {!item.isRead && <View style={styles.unreadDot} />}
                    </View>

                    {/* Bottom Row: Division Name + View Details Link */}
                    <View style={styles.cardBottomRow}>
                      <Text style={styles.divisionText}>{item.division || 'Municipal Division 4'}</Text>
                      <TouchableOpacity
                        style={styles.viewDetailsTouchable}
                        onPress={() => {
                          if (onSelectNotification) onSelectNotification(item);
                        }}
                      >
                        <Text style={[styles.viewDetailsText, { color: config.linkText }]}>
                          View Details
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={config.linkText} style={{ marginLeft: 2 }} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  grabberWrapper: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  grabberTouchable: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 24,
  },
  grabberBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },

  /* Header Row */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    backgroundColor: '#ea580c', // Bright orange matching reference
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
  },
  unreadCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff', // Soft light blue
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
    gap: 4,
  },
  readAllCheckIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
  },
  readAllButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Filter Tabs Bar */
  filterTabsContainer: {
    paddingVertical: 12,
  },
  filterTabsScroll: {
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#fff1e7', // Light peach/orange background
    borderColor: '#fed7aa',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  tabCountCircle: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },

  /* Notifications Scroll Area */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
    gap: 12,
  },

  /* Notification Card matching reference screenshot */
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContentCol: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 20,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardTimeText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
    position: 'absolute',
    top: 2,
    right: 0,
  },

  /* Bottom Card Row */
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  divisionText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  viewDetailsTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
});
