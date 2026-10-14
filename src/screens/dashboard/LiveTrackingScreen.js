import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  AppState,
  Modal,
  Linking,
  ActivityIndicator,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MainHeader, BottomNav } from '../../components';
import LiveTrackingMap from '../../components/dashboard/LiveTrackingMap';
import api from '../../services/api';
import { playGrievanceAlertSound, soundService } from '../../utils/soundHelper';

const DEFAULT_PUNE_COORDS = {
  latitude: 18.5113,
  longitude: 73.8340,
  accuracy: 15
};

const RADIUS_OPTIONS = [
  { value: 200, label: '200 Meters (Immediate Area)', shortLabel: '200m' },
  { value: 500, label: '500 Meters (0.5 km)', shortLabel: '500m' },
  { value: 1000, label: '1 Kilometer (1.0 km)', shortLabel: '1 km' },
  { value: 2000, label: '2 Kilometers (2.0 km)', shortLabel: '2 km' },
  { value: 5000, label: '5 Kilometers (5.0 km)', shortLabel: '5 km' }
];

export default function LiveTrackingScreen({
  navigation,
  activeTab = 'track',
  onTabPress,
  onViewComplaintDetail,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [isTracking, setIsTracking] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(500);
  const [radiusModalVisible, setRadiusModalVisible] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // GPS State
  const [currentCoords, setCurrentCoords] = useState(DEFAULT_PUNE_COORDS);
  const [gpsSource, setGpsSource] = useState('Municipal Zone (Pune)');
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Grievance Data & Proximity
  const [nearbyGrievances, setNearbyGrievances] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);
  const [lastApiUpdated, setLastApiUpdated] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'OPEN' | 'RESOLVED'

  // Interactive Selected Map Pin Callout
  const [selectedPinGrievance, setSelectedPinGrievance] = useState(null);

  // Proximity Alert Modal
  const [activeAlertGrievance, setActiveAlertGrievance] = useState(null);
  const alertedIdsRef = useRef(new Set());
  const locationSubscriptionRef = useRef(null);

  // Pulse animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [pulseAnim]);

  // Query Backend Proximity API
  const fetchNearbyGrievances = useCallback(async (lat, lng, radius, isSilent = false) => {
    const queryLat = lat || currentCoords.latitude;
    const queryLng = lng || currentCoords.longitude;
    const queryRad = radius || selectedRadius;

    if (!isSilent) setIsFetchingNearby(true);
    try {
      const res = await api.get(`/location/nearby-grievances?lat=${queryLat}&lng=${queryLng}&radius=${queryRad}`);
      const rawList = Array.isArray(res) ? res : (res?.data || []);

      if (rawList && rawList.length > 0) {
        const formatted = rawList.map((c, idx) => {
          const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
          const isCritical = c.priority === 'CRITICAL' || c.priority === 'HIGH';
          const isMedium = c.priority === 'MEDIUM' || c.status === 'IN_PROGRESS';

          let color = '#3b82f6';
          let bgBadge = '#eff6ff';
          let textBadge = '#2563eb';

          if (isResolved) {
            color = '#10b981';
            bgBadge = '#ecfdf5';
            textBadge = '#059669';
          } else if (isCritical) {
            color = '#ef4444';
            bgBadge = '#fef2f2';
            textBadge = '#dc2626';
          } else if (isMedium) {
            color = '#f59e0b';
            bgBadge = '#fffbeb';
            textBadge = '#d97706';
          }

          const safeDept = typeof c.department === 'object' ? (c.department?.name || 'General Administration') : (c.department || 'General Administration');
          const safeWard = typeof c.ward === 'object' ? (c.ward?.name || 'Pune Central') : (c.ward || 'Pune Central');
          const safeArea = typeof c.area === 'object' ? (c.area?.name || 'N/A') : (c.area || 'N/A');
          const safeCitizen = typeof c.citizenName === 'object' ? (c.citizenName?.name || 'Citizen') : (c.citizenName || 'Citizen');
          const safeOfficer = typeof c.officerName === 'object' ? (c.officerName?.name || 'Unassigned') : (typeof c.assignedOfficer === 'object' ? (c.assignedOfficer?.name || 'Unassigned') : (c.officerName || 'Unassigned'));
          const safeInOffice = typeof c.inOfficeName === 'object' ? (c.inOfficeName?.name || 'Unassigned') : (typeof c.inOfficePerson === 'object' ? (c.inOfficePerson?.name || 'Unassigned') : (c.inOfficeName || 'Unassigned'));

          return {
            id: c.complaintNumber || (c.id ? `GR-2026-${String(c.id).padStart(3, '0')}` : `GR-${idx + 1}`),
            rawId: c.id,
            title: c.subject || 'Citizen Grievance Request',
            subject: c.subject || 'Citizen Grievance Request',
            description: c.description || 'No description provided.',
            citizenName: safeCitizen,
            mobileNumber: c.mobileNumber || '',
            department: safeDept,
            ward: safeWard,
            area: safeArea,
            landmark: c.landmark || '',
            address: c.address || '',
            priority: (c.priority || 'MEDIUM').toUpperCase(),
            status: (c.status || 'PENDING').toUpperCase(),
            officerName: safeOfficer,
            inOfficeName: safeInOffice,
            distanceMeters: typeof c.distanceMeters === 'number' ? c.distanceMeters : (idx + 1) * 150,
            distanceText: typeof c.distanceMeters === 'number'
              ? (c.distanceMeters < 1000 ? `${c.distanceMeters}m` : `${(c.distanceMeters / 1000).toFixed(1)}km`)
              : `${(idx + 1) * 150}m`,
            lat: c.lat || (queryLat + ((idx % 3 === 0 ? 1 : -1) * (0.0015 * (idx + 1)))),
            lng: c.lng || (queryLng + ((idx % 2 === 0 ? 1 : -1) * (0.0018 * (idx + 1)))),
            color,
            bgBadge,
            textBadge
          };
        });

        // Sort by closest distance
        formatted.sort((a, b) => a.distanceMeters - b.distanceMeters);
        setNearbyGrievances(formatted);

        const openCount = formatted.filter(g => g.status !== 'RESOLVED' && g.status !== 'CLOSED').length;
        setActiveAlerts(openCount);
        setLastApiUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        // Proximity alert detection: alert on closest open grievance within geofence
        const firstUnseenOpen = formatted.find(
          g => g.status !== 'RESOLVED' && g.status !== 'CLOSED' && g.distanceMeters <= queryRad && !alertedIdsRef.current.has(g.rawId || g.id)
        );

        if (firstUnseenOpen && isTracking) {
          alertedIdsRef.current.add(firstUnseenOpen.rawId || firstUnseenOpen.id);
          setActiveAlertGrievance(firstUnseenOpen);
          if (!isSoundMuted) {
            playGrievanceAlertSound();
          }
        }
      } else {
        setNearbyGrievances([]);
        setActiveAlerts(0);
        setLastApiUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.log('Nearby complaints fetch error:', e.message);
    } finally {
      if (!isSilent) setIsFetchingNearby(false);
    }
  }, [currentCoords.latitude, currentCoords.longitude, selectedRadius, isTracking, isSoundMuted]);

  // Acquire Hardware GPS Location
  const acquireCurrentGps = useCallback(async () => {
    setIsGpsLoading(true);
    setGpsError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Location permission was denied. Using Pune Municipal Zone coordinates.');
        setGpsSource('Municipal Fallback');
        setCurrentCoords(DEFAULT_PUNE_COORDS);
        fetchNearbyGrievances(DEFAULT_PUNE_COORDS.latitude, DEFAULT_PUNE_COORDS.longitude, selectedRadius);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      if (loc && loc.coords) {
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || 10
        };
        setCurrentCoords(newCoords);
        setGpsSource('Live Hardware GPS');
        fetchNearbyGrievances(newCoords.latitude, newCoords.longitude, selectedRadius);
      }
    } catch (err) {
      console.log('[GPS Acquisition notice]:', err.message);
      setGpsSource('Pune Municipal HQ');
      setCurrentCoords(DEFAULT_PUNE_COORDS);
      fetchNearbyGrievances(DEFAULT_PUNE_COORDS.latitude, DEFAULT_PUNE_COORDS.longitude, selectedRadius);
    } finally {
      setIsGpsLoading(false);
    }
  }, [fetchNearbyGrievances, selectedRadius]);

  // Live Location Watcher (When Tracking is ON)
  useEffect(() => {
    if (!isTracking) {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const startLocationWatch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10
          },
          (loc) => {
            if (!isMounted || !loc.coords) return;
            const newCoords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy || 10
            };
            setCurrentCoords(newCoords);
            setGpsSource('Live Hardware GPS (Active)');
            fetchNearbyGrievances(newCoords.latitude, newCoords.longitude, selectedRadius, true);
          }
        );

        locationSubscriptionRef.current = sub;
      } catch (e) {
        console.log('[GPS Watch Exception]:', e.message);
      }
    };

    startLocationWatch();

    return () => {
      isMounted = false;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [isTracking, fetchNearbyGrievances, currentCoords.latitude, currentCoords.longitude, selectedRadius]);

  // Mount effect & AppState listener
  useEffect(() => {
    acquireCurrentGps();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchNearbyGrievances(currentCoords.latitude, currentCoords.longitude, selectedRadius, true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [acquireCurrentGps, fetchNearbyGrievances, currentCoords.latitude, currentCoords.longitude, selectedRadius]);

  // Tab switcher
  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // Toggle Live Tracking
  const toggleTracking = () => {
    if (!isTracking) {
      setIsTracking(true);
      acquireCurrentGps();
      Alert.alert(
        'Live Telemetry Started 🛰️',
        `High-accuracy GPS telemetry active. Geofencing radius set to ${selectedRadius}m around your live coordinates.`
      );
    } else {
      setIsTracking(false);
      Alert.alert('Live Telemetry Paused', 'Background GPS proximity tracking stopped.');
    }
  };

  // Handle radius selection change
  const handleSelectRadiusOption = (val) => {
    setSelectedRadius(val);
    setRadiusModalVisible(false);
    fetchNearbyGrievances(currentCoords.latitude, currentCoords.longitude, val);
  };

  // Open Google Maps Directions for a single grievance
  const handleNavigateToGrievance = (g) => {
    let mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`;
    if (g.address || g.landmark) {
      const q = encodeURIComponent(`${g.address || g.landmark} Pune Maharashtra`);
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    }
    Linking.openURL(mapUrl).catch(() => {
      Alert.alert('Navigation Error', 'Could not launch Google Maps.');
    });
  };

  // Filtered grievances list
  const filteredGrievances = nearbyGrievances.filter((item) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'CRITICAL') return item.priority === 'CRITICAL' || item.priority === 'HIGH';
    if (statusFilter === 'ASSIGNED') return (item.status || '').toUpperCase() === 'ASSIGNED';
    if (statusFilter === 'OPEN') return (item.status || '').toUpperCase() === 'PENDING' || (item.status || '').toUpperCase() === 'OPEN';
    if (statusFilter === 'RESOLVED') return item.status === 'RESOLVED' || item.status === 'CLOSED';
    return true;
  });

  // Nearby Tickets Pagination
  const [nearbyPage, setNearbyPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setNearbyPage(1);
  }, [statusFilter, nearbyGrievances.length, selectedRadius]);

  const totalNearbyPages = Math.max(1, Math.ceil(filteredGrievances.length / ITEMS_PER_PAGE));
  const paginatedNearbyGrievances = filteredGrievances.slice(
    (nearbyPage - 1) * ITEMS_PER_PAGE,
    nearbyPage * ITEMS_PER_PAGE
  );

  const selectedRadiusOption = RADIUS_OPTIONS.find(o => o.value === selectedRadius) || RADIUS_OPTIONS[1];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header with Notification Bell and Profile Avatar */}
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
      >
        {/* Screen Title */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Live Proximity Telemetry</Text>
        </View>

        {/* ======================================================== */}
        {/* CARD 1: TELEMETRY CONTROL BOX                            */}
        {/* ======================================================== */}
        <View style={styles.cardContainer}>
          {/* Coordinates Header with Refresh Trigger */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={styles.labelMuted}>CURRENT COMMISSIONER COORDINATES</Text>
            <TouchableOpacity
              onPress={acquireCurrentGps}
              style={styles.smallActionPill}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={11} color="#ea580c" />
              <Text style={[styles.smallActionPillText, { color: '#ea580c' }]}>GPS</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.coordinatesValue}>
            {currentCoords.latitude.toFixed(4)}° N, {currentCoords.longitude.toFixed(4)}° E{' '}
            <Text style={styles.subCity}>({gpsSource})</Text>
          </Text>

          {gpsError ? (
            <View style={styles.gpsErrorBox}>
              <Ionicons name="information-circle-outline" size={14} color="#b45309" style={{ marginRight: 4 }} />
              <Text style={styles.gpsErrorText}>{gpsError}</Text>
            </View>
          ) : null}

          {/* Alert Radius Selector */}
          <Text style={[styles.labelMuted, { marginTop: 12 }]}>ALERT RADIUS</Text>
          <TouchableOpacity
            style={styles.dropdownInput}
            activeOpacity={0.7}
            onPress={() => setRadiusModalVisible(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="radio-outline" size={16} color="#ea580c" />
              <Text style={styles.dropdownText}>{selectedRadiusOption.label}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          {/* Alerts Telemetry Status & Last API Sync */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
            <Text style={styles.labelMuted}>ALERTS TELEMETRY</Text>
            {lastApiUpdated ? (
              <Text style={{ fontSize: 10.5, color: '#94a3b8' }}>Sync: {lastApiUpdated}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={styles.alertsDetectedBadge}>
              <View style={[styles.onlineDot, { backgroundColor: activeAlerts > 0 ? '#ea580c' : '#10b981' }]} />
              <Text style={[styles.alertsDetectedText, { color: activeAlerts > 0 ? '#c2410c' : '#059669' }]}>
                {activeAlerts > 0 ? `${activeAlerts} Active Nearby` : '0 Active Detected'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                style={[styles.radiusTagPill, isSoundMuted && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}
                activeOpacity={0.7}
                onPress={() => {
                  const nextMuted = !isSoundMuted;
                  setIsSoundMuted(nextMuted);
                  soundService.setSoundEnabled(!nextMuted);
                }}
              >
                <Ionicons
                  name={isSoundMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                  size={12}
                  color={isSoundMuted ? '#64748b' : '#ea580c'}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.radiusTagText, isSoundMuted && { color: '#64748b' }]}>
                  {isSoundMuted ? 'Muted' : 'Sound ON'}
                </Text>
              </TouchableOpacity>

              <View style={styles.radiusTagPill}>
                <Text style={styles.radiusTagText}>Range: {selectedRadiusOption.shortLabel}</Text>
              </View>
            </View>
          </View>

          {/* Start / Pause Live Tracking Action Button */}
          <TouchableOpacity
            style={[styles.startTrackingBtn, isTracking && styles.trackingActiveBtn]}
            activeOpacity={0.8}
            onPress={toggleTracking}
          >
            <Ionicons name={isTracking ? 'pause' : 'play'} size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.startTrackingBtnText}>
              {isTracking ? 'Pause Live Tracking' : 'Start Live Tracking'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* CARD 2: INTERACTIVE GOOGLE MAPS PROXIMITY TELEMETRY VIEW */}
        {/* ======================================================== */}
        <LiveTrackingMap
          currentCoords={currentCoords}
          nearbyGrievances={nearbyGrievances}
          selectedRadius={selectedRadius}
          isTracking={isTracking}
          selectedPinGrievance={selectedPinGrievance}
          onSelectPin={(g) => setSelectedPinGrievance(g)}
          onViewComplaintDetail={onViewComplaintDetail}
          onNavigateToGrievance={handleNavigateToGrievance}
        />

        {/* Floating Quick Action / Callout when Pin Selected */}
        {selectedPinGrievance ? (
          <View style={[styles.pinCalloutCard, { marginBottom: 12 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={styles.pinCalloutId}>{selectedPinGrievance.id}</Text>
                <View style={[styles.statusIndicatorDot, { backgroundColor: selectedPinGrievance.color }]} />
              </View>
              <Text style={styles.pinCalloutSubject} numberOfLines={1}>
                {typeof selectedPinGrievance.subject === 'object' ? selectedPinGrievance.subject?.name : selectedPinGrievance.subject}
              </Text>
              <Text style={styles.pinCalloutDistance}>
                {selectedPinGrievance.distanceText} away • {typeof selectedPinGrievance.department === 'object' ? selectedPinGrievance.department?.name : selectedPinGrievance.department}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.pinCalloutNavBtn}
                onPress={() => handleNavigateToGrievance(selectedPinGrievance)}
              >
                <Ionicons name="navigate" size={14} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinCalloutDetailBtn}
                onPress={() => {
                  if (onViewComplaintDetail) onViewComplaintDetail(selectedPinGrievance);
                }}
              >
                <Ionicons name="arrow-forward" size={14} color="#ea580c" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedPinGrievance(null)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ======================================================== */}
        {/* MAP LEGEND ROW                                           */}
        {/* ======================================================== */}
        <View style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Critical</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>In Progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Resolved</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Your GPS</Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 3: NEARBY GRIEVANCES                             */}
        {/* ======================================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            NEARBY GRIEVANCES ({selectedRadiusOption.shortLabel})
          </Text>

          {/* Quick Filter Tabs */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {['ALL', 'OPEN', 'ASSIGNED', 'CRITICAL', 'RESOLVED'].map((f) => {
              const isActive = statusFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPillBtn, isActive && styles.filterPillBtnActive]}
                  activeOpacity={0.7}
                  onPress={() => setStatusFilter(f)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isFetchingNearby ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#ea580c" />
            <Text style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>Scanning nearby coordinates...</Text>
          </View>
        ) : filteredGrievances.length > 0 ? (
          <>
            <View style={styles.nearbyList}>
              {paginatedNearbyGrievances.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.nearbyCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (onViewComplaintDetail) {
                      onViewComplaintDetail(item);
                    }
                  }}
                >
                  <View style={styles.nearbyLeftRow}>
                    {/* Clean Status Dot */}
                    <View style={[styles.statusIndicatorDot, { backgroundColor: item.color }]} />

                    {/* Grievance Info */}
                    <View style={styles.nearbyInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.nearbyIdText}>{item.id}</Text>
                        <Text style={styles.nearbyDeptTag}>{typeof item.department === 'object' ? item.department?.name : item.department}</Text>
                      </View>
                      <Text style={styles.nearbyTitleText} numberOfLines={1}>
                        {typeof item.title === 'object' ? item.title?.name : item.title}
                      </Text>
                      <Text style={styles.nearbyCitizenMeta}>
                        Citizen: {typeof item.citizenName === 'object' ? item.citizenName?.name : item.citizenName} {item.mobileNumber ? `(${item.mobileNumber})` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Right Action Side: Distance Pill & Navigation Button */}
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.distanceBadge, { backgroundColor: item.bgBadge }]}>
                      <Text style={[styles.distanceText, { color: item.textBadge }]}>
                        {item.distanceText}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.cardNavMapBtn}
                      activeOpacity={0.7}
                      onPress={() => handleNavigateToGrievance(item)}
                    >
                      <Text style={styles.cardNavMapBtnText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Pagination Controls */}
            {filteredGrievances.length > ITEMS_PER_PAGE && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  disabled={nearbyPage === 1}
                  style={[styles.pageBtn, nearbyPage === 1 && styles.pageBtnDisabled]}
                  onPress={() => setNearbyPage((p) => Math.max(1, p - 1))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, nearbyPage === 1 && styles.pageBtnTextDisabled]}>
                    ← Prev
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfoText}>
                  Page {nearbyPage} of {totalNearbyPages} ({filteredGrievances.length} tickets)
                </Text>

                <TouchableOpacity
                  disabled={nearbyPage === totalNearbyPages}
                  style={[styles.pageBtn, nearbyPage === totalNearbyPages && styles.pageBtnDisabled]}
                  onPress={() => setNearbyPage((p) => Math.min(totalNearbyPages, p + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, nearbyPage === totalNearbyPages && styles.pageBtnTextDisabled]}>
                    Next →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyGrievanceBox}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color="#10b981" />
            <Text style={styles.emptyGrievanceTitle}>No active grievances in this zone</Text>
            <Text style={styles.emptyGrievanceSubtitle}>
              Try expanding your alert radius or initiating a patrol in another ward.
            </Text>
          </View>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* 3. RADIUS SELECTION MODAL                                */}
      {/* ======================================================== */}
      <Modal
        visible={radiusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRadiusModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRadiusModalVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Select Proximity Radius</Text>
              <TouchableOpacity onPress={() => setRadiusModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginTop: 12 }}>
              {RADIUS_OPTIONS.map((opt) => {
                const isSelected = selectedRadius === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.radiusOptRow, isSelected && styles.radiusOptRowActive]}
                    onPress={() => handleSelectRadiusOption(opt.value)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? '#ea580c' : '#94a3b8'}
                      />
                      <Text style={[styles.radiusOptText, isSelected && styles.radiusOptTextActive]}>
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#ea580c" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* 4. PROXIMITY ALERT MODAL (Matching Web Alert Popup)      */}
      {/* ======================================================== */}
      <Modal
        visible={!!activeAlertGrievance}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveAlertGrievance(null)}
      >
        <View style={styles.alertModalOverlay}>
          <View style={styles.alertModalCard}>
            {/* Glowing Alert Header */}
            <View style={styles.alertHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🚨</Text>
                <View>
                  <Text style={styles.alertHeaderTitle}>PROXIMITY ALERT DETECTED!</Text>
                  <Text style={styles.alertHeaderSubtitle}>Location matches active grievance coordinates</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setActiveAlertGrievance(null)}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Alert Body */}
            {activeAlertGrievance && (
              <View style={styles.alertBody}>
                <View style={styles.alertDistanceRow}>
                  <View style={styles.alertDistanceBadge}>
                    <Text style={styles.alertDistanceBadgeText}>
                      📍 {activeAlertGrievance.distanceText} away
                    </Text>
                  </View>

                  <View style={[styles.alertPriorityBadge, { backgroundColor: activeAlertGrievance.bgBadge }]}>
                    <Text style={[styles.alertPriorityBadgeText, { color: activeAlertGrievance.textBadge }]}>
                      {activeAlertGrievance.priority} PRIORITY
                    </Text>
                  </View>
                </View>

                <View style={styles.alertDetailBox}>
                  <Text style={styles.alertIdText}>{activeAlertGrievance.id}</Text>
                  <Text style={styles.alertSubjectText}>{typeof activeAlertGrievance.subject === 'object' ? activeAlertGrievance.subject?.name : activeAlertGrievance.subject}</Text>

                  <View style={styles.alertMetaGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertMetaLabel}>Citizen</Text>
                      <Text style={styles.alertMetaValue}>{typeof activeAlertGrievance.citizenName === 'object' ? activeAlertGrievance.citizenName?.name : activeAlertGrievance.citizenName}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertMetaLabel}>Department</Text>
                      <Text style={styles.alertMetaValue}>{typeof activeAlertGrievance.department === 'object' ? activeAlertGrievance.department?.name : activeAlertGrievance.department}</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.alertMetaLabel}>Address</Text>
                    <Text style={styles.alertMetaValue} numberOfLines={2}>
                      {typeof activeAlertGrievance.address === 'object' ? activeAlertGrievance.address?.name : (activeAlertGrievance.address || activeAlertGrievance.landmark || 'Pune')}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.alertFooterRow}>
                  <TouchableOpacity
                    style={styles.alertDismissBtn}
                    onPress={() => setActiveAlertGrievance(null)}
                  >
                    <Text style={styles.alertDismissBtnText}>Dismiss</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.alertNavBtn}
                    onPress={() => {
                      const target = activeAlertGrievance;
                      setActiveAlertGrievance(null);
                      handleNavigateToGrievance(target);
                    }}
                  >
                    <Ionicons name="compass" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.alertNavBtnText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 5. Persistent Bottom Navigation */}
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
    paddingTop: 12,
    paddingBottom: 110,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Title Row */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  onlineBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  /* Card Containers */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  labelMuted: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8da4be',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  coordinatesValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subCity: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  gpsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  gpsErrorText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
    flex: 1,
  },
  smallActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  smallActionPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  dropdownInput: {
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dropdownText: {
    fontSize: 13.5,
    color: '#334155',
    fontWeight: '600',
  },
  alertsDetectedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  alertsDetectedText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  radiusTagPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  radiusTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  startTrackingBtn: {
    height: 46,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  trackingActiveBtn: {
    backgroundColor: '#c2410c',
  },
  startTrackingBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Radar Map Canvas */
  mapCardContainer: {
    height: 230,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  mapCanvas: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  mapGridLine1: {
    position: 'absolute',
    top: '25%',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  mapGridLine2: {
    position: 'absolute',
    top: '75%',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  mapGridLine3: {
    position: 'absolute',
    left: '25%',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  mapGridLine4: {
    position: 'absolute',
    left: '75%',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  mapGridDiagonal1: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  mapGridDiagonal2: {
    position: 'absolute',
    left: '50%',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  radarCircleOuter: {
    position: 'absolute',
    top: '15%',
    left: '18%',
    right: '18%',
    bottom: '15%',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  radarCircleInner: {
    position: 'absolute',
    top: '32%',
    left: '32%',
    right: '32%',
    bottom: '32%',
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  radarPulseWave: {
    position: 'absolute',
    top: '25%',
    left: '25%',
    right: '25%',
    bottom: '25%',
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  pinRippleCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinSolidDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  userGpsRipple: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  userGpsOuterRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  userGpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },

  /* Pin Callout Card */
  pinCalloutCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  pinCalloutId: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  pinCalloutSubject: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  pinCalloutDistance: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  pinCalloutNavBtn: {
    backgroundColor: '#2563eb',
    padding: 6,
    borderRadius: 6,
  },
  pinCalloutDetailBtn: {
    backgroundColor: '#ffedd5',
    padding: 6,
    borderRadius: 6,
  },

  /* Legend */
  legendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  /* Nearby Section */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  filterPillBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillBtnActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  filterPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  nearbyList: {
    gap: 8,
    marginBottom: 14,
  },
  nearbyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nearbyLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ea580c',
  },
  nearbyDeptTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nearbyTitleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  nearbyCitizenMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  distanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardNavMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cardNavMapBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  emptyGrievanceBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  emptyGrievanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  emptyGrievanceSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },

  /* Selected Area Meta */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  metaLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500',
  },
  metaValueDark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaValueRed: {
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Patrol Route Button */
  patrolRouteBtn: {
    height: 48,
    backgroundColor: '#ea580c',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  patrolRouteText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },

  /* Radius Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  radiusOptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  radiusOptRowActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  radiusOptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  radiusOptTextActive: {
    fontWeight: '700',
    color: '#c2410c',
  },

  /* Proximity Alert Modal */
  alertModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  alertModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  alertHeader: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  alertHeaderSubtitle: {
    fontSize: 10.5,
    color: '#fee2e2',
  },
  alertBody: {
    padding: 16,
  },
  alertDistanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertDistanceBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  alertDistanceBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  alertPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertPriorityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  alertDetailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  alertIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  alertSubjectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
    marginBottom: 8,
  },
  alertMetaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 12,
  },
  alertMetaLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  alertMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  alertFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  alertDismissBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  alertDismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  alertNavBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pageBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageInfoText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
});
