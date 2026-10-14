import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Icon Helper for Bottom Nav Tabs with precision geometric shapes
 */
const TabIcon = ({ name, active }) => {
  const activeColor = '#ea580c'; // Brand orange when active
  const inactiveColor = '#64748b'; // Muted slate when inactive
  const color = active ? activeColor : inactiveColor;

  switch (name) {
    case 'dashboard':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.gridCellTopLeft, { borderColor: color, backgroundColor: active ? '#ffedd5' : 'transparent' }]} />
          <View style={[styles.gridCellTopRight, { borderColor: color }]} />
          <View style={[styles.gridCellBottomLeft, { borderColor: color }]} />
          <View style={[styles.gridCellBottomRight, { borderColor: color }]} />
        </View>
      );
    case 'complaints':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.clipboardFrame, { borderColor: color }]}>
            <View style={[styles.clipboardClip, { backgroundColor: color }]} />
            <View style={[styles.clipboardLine, { backgroundColor: color }]} />
            <View style={[styles.clipboardLine, { backgroundColor: color, width: '55%' }]} />
          </View>
        </View>
      );
    case 'track':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.radarCircleOuter, { borderColor: color }]}>
            <View style={[styles.radarCircleInner, { borderColor: color }]}>
              <View style={[styles.radarCenterDot, { backgroundColor: color }]} />
            </View>
          </View>
        </View>
      );
    case 'reports':
      return (
        <View style={styles.iconBox}>
          <View style={styles.chartBars}>
            <View style={[styles.chartBar, { height: 7, backgroundColor: color }]} />
            <View style={[styles.chartBar, { height: 15, backgroundColor: color }]} />
            <View style={[styles.chartBar, { height: 11, backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'contacts':
    case 'contact':
      return (
        <View style={styles.iconBox}>
          <View style={[styles.contactAvatarWrap, { borderColor: color }]}>
            <View style={[styles.contactHead, { backgroundColor: color }]} />
            <View style={[styles.contactBody, { backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'more':
      return (
        <View style={styles.iconBox}>
          <View style={styles.dotsRow}>
            <View style={[styles.moreDot, { backgroundColor: color }]} />
            <View style={[styles.moreDot, { backgroundColor: color }]} />
            <View style={[styles.moreDot, { backgroundColor: color }]} />
          </View>
        </View>
      );
    default:
      return <View style={styles.iconBox} />;
  }
};

export default function BottomNav({
  activeTab = 'dashboard',
  onTabPress = () => {},
  style
}) {
  const insets = useSafeAreaInsets();
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'complaints', label: 'Complaints', icon: 'complaints' },
    { id: 'track', label: 'Track', icon: 'track' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
  ];

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }, style]}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              {/* Top Active Indicator Bar */}
              <View style={[styles.topIndicator, isActive && styles.topIndicatorActive]} />

              {/* Tab Content with Active Pill Container */}
              <View style={[styles.tabContentWrap, isActive && styles.tabContentWrapActive]}>
                <TabIcon name={tab.icon} active={isActive} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Home Indicator Bar */}
      <View style={styles.homeIndicatorWrapper}>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    zIndex: 100,
  },
  tabsRow: {
    flexDirection: 'row',
    height: 58,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
  },
  topIndicator: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },
  topIndicatorActive: {
    backgroundColor: '#ea580c',
  },
  tabContentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tabContentWrapActive: {
    backgroundColor: '#fff7ed',
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2.5,
  },
  tabLabelActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 2x2 Grid Icon */
  gridCellTopLeft: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 7.5,
    height: 7.5,
    borderWidth: 1.6,
    borderRadius: 2,
  },
  gridCellTopRight: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7.5,
    height: 7.5,
    borderWidth: 1.6,
    borderRadius: 2,
  },
  gridCellBottomLeft: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 7.5,
    height: 7.5,
    borderWidth: 1.6,
    borderRadius: 2,
  },
  gridCellBottomRight: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 7.5,
    height: 7.5,
    borderWidth: 1.6,
    borderRadius: 2,
  },
  /* Clipboard Icon */
  clipboardFrame: {
    width: 16,
    height: 19,
    borderWidth: 1.6,
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3.5,
  },
  clipboardClip: {
    position: 'absolute',
    top: -2.5,
    width: 7,
    height: 3,
    borderRadius: 1.5,
  },
  clipboardLine: {
    width: 9,
    height: 1.6,
    borderRadius: 0.8,
    marginVertical: 1.2,
  },
  /* Radar Icon */
  radarCircleOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  /* Chart Bars */
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 17,
  },
  chartBar: {
    width: 3.2,
    borderRadius: 1.5,
  },
  /* More Dots */
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  moreDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  /* Contact / User Avatar Icon */
  contactAvatarWrap: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    paddingTop: 2.2,
  },
  contactHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 1.5,
  },
  contactBody: {
    width: 12,
    height: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  homeIndicatorWrapper: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  homeIndicator: {
    width: 90,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#e2e8f0',
  },
});
