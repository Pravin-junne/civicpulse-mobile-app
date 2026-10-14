import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOOGLE_TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

/**
 * LiveTrackingMap
 * Executive Google Maps + Leaflet telemetry component for Live Field Tracking screen.
 */
export default function LiveTrackingMap({
  currentCoords,
  nearbyGrievances = [],
  selectedRadius = 500,
  isTracking = false,
  selectedPinGrievance = null,
  onSelectPin,
  onViewComplaintDetail,
  onNavigateToGrievance
}) {
  const [isMapReady, setIsMapReady] = useState(false);
  const webViewRef = useRef(null);

  const centerLat = currentCoords?.latitude || 18.5113;
  const centerLng = currentCoords?.longitude || 73.8340;

  // Send real-time updates to Leaflet WebView without reloading
  const syncMapData = useCallback(() => {
    if (!webViewRef.current) return;

    const payload = {
      type: 'SYNC_TRACKING_DATA',
      tileUrl: GOOGLE_TILE_URL,
      currentCoords: {
        latitude: centerLat,
        longitude: centerLng
      },
      selectedRadius,
      isTracking,
      selectedPinId: selectedPinGrievance?.id || selectedPinGrievance?.rawId || null,
      grievances: (nearbyGrievances || []).map((g, idx) => ({
        id: g.id || `GR-${idx + 1}`,
        rawId: g.rawId || g.id,
        subject: typeof g.subject === 'object' ? g.subject?.name : (g.subject || g.title || 'Citizen Grievance'),
        department: typeof g.department === 'object' ? g.department?.name : (g.department || 'General Administration'),
        citizenName: typeof g.citizenName === 'object' ? g.citizenName?.name : (g.citizenName || 'Citizen'),
        mobileNumber: g.mobileNumber || '',
        status: g.status || 'PENDING',
        priority: g.priority || 'MEDIUM',
        distanceText: g.distanceText || `${g.distanceMeters || 100}m`,
        distanceMeters: g.distanceMeters || 100,
        lat: Number(g.lat) || (centerLat + 0.001),
        lng: Number(g.lng) || (centerLng + 0.001),
        color: g.color || '#ef4444',
        bgBadge: g.bgBadge || '#fef2f2',
        textBadge: g.textBadge || '#dc2626'
      }))
    };

    const js = `
      if (window.handleTrackingUpdate) {
        window.handleTrackingUpdate(${JSON.stringify(payload)});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [centerLat, centerLng, selectedRadius, isTracking, selectedPinGrievance, nearbyGrievances]);

  useEffect(() => {
    syncMapData();
  }, [syncMapData]);

  // Handle messages posted from Leaflet map
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'SELECT_PIN') {
        const found = nearbyGrievances.find(
          g => String(g.id) === String(data.id) || String(g.rawId) === String(data.id)
        );
        if (found && onSelectPin) {
          onSelectPin(found);
        }
      } else if (data.action === 'VIEW_DETAILS') {
        const found = nearbyGrievances.find(
          g => String(g.id) === String(data.id) || String(g.rawId) === String(data.id)
        );
        if (found && onViewComplaintDetail) {
          onViewComplaintDetail(found);
        }
      } else if (data.action === 'NAVIGATE') {
        const found = nearbyGrievances.find(
          g => String(g.id) === String(data.id) || String(g.rawId) === String(data.id)
        );
        if (found) {
          if (onNavigateToGrievance) {
            onNavigateToGrievance(found);
          } else {
            const dest = `${found.lat},${found.lng}`;
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
          }
        }
      }
    } catch (e) {
      console.log('Live tracking map message parse error:', e.message);
    }
  };

  const recenterMap = () => {
    if (webViewRef.current) {
      const js = `
        if (window.recenterToUser) {
          window.recenterToUser();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const zoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('if (window.mapInstance) { window.mapInstance.zoomIn(); } true;');
    }
  };

  const zoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('if (window.mapInstance) { window.mapInstance.zoomOut(); } true;');
    }
  };

  // Self-contained HTML with Leaflet 1.9.4 and custom styling
  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; overflow: hidden; }
    
    /* Leaflet popup styling */
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.25);
      padding: 2px;
    }
    .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.4;
    }
    .popup-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .popup-dist-badge {
      font-size: 10px;
      font-weight: 700;
      color: #ea580c;
      background: #ffedd5;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .popup-subject {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 3px;
    }
    .popup-meta {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .popup-actions-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .popup-btn-nav {
      flex: 1;
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }
    .popup-btn-details {
      flex: 1;
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }

    /* Pulse wave animations */
    @keyframes radar-pulse-fast {
      0% {
        transform: scale(0.6);
        opacity: 0.85;
      }
      70% {
        transform: scale(1.6);
        opacity: 0.15;
      }
      100% {
        transform: scale(1.9);
        opacity: 0;
      }
    }

    @keyframes radar-pulse-delayed {
      0% {
        transform: scale(0.6);
        opacity: 0.7;
      }
      70% {
        transform: scale(1.5);
        opacity: 0.1;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }

    @keyframes radar-scan-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .pulse-layer-1 {
      position: absolute;
      top: -45px;
      left: -45px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 2px solid #3b82f6;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.08) 65%, transparent 100%);
      animation: radar-pulse-fast 2.4s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
      pointer-events: none;
    }

    .pulse-layer-2 {
      position: absolute;
      top: -45px;
      left: -45px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 1.5px solid #60a5fa;
      background: radial-gradient(circle, rgba(96, 165, 250, 0.25) 0%, transparent 80%);
      animation: radar-pulse-delayed 2.4s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 1.2s;
      pointer-events: none;
    }

    .user-beacon-center {
      position: absolute;
      top: -11px;
      left: -11px;
      width: 22px;
      height: 22px;
      background: #2563eb;
      border: 3.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 14px rgba(37, 99, 235, 0.85);
      z-index: 100;
    }

    /* Grievance Marker Pin */
    .grievance-pin-container {
      position: relative;
      width: 24px;
      height: 24px;
      cursor: pointer;
    }
    .grievance-pin-core {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2.5px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .grievance-pin-pulse {
      position: absolute;
      top: -6px;
      left: -6px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      opacity: 0.45;
      animation: radar-pulse-fast 2s infinite;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var map;
    var tileLayer;
    var userMarker = null;
    var geofenceCircle = null;
    var grievanceMarkers = [];
    var currentData = null;

    function initMap() {
      map = L.map('map', {
        center: [${centerLat}, ${centerLng}],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      window.mapInstance = map;

      tileLayer = L.tileLayer('${GOOGLE_TILE_URL}', {
        maxZoom: 20,
        subdomains: ['a', 'b', 'c', 'd']
      }).addTo(map);

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'MAP_READY' }));
      }
    }

    window.recenterToUser = function() {
      if (currentData && currentData.currentCoords && map) {
        map.flyTo([currentData.currentCoords.latitude, currentData.currentCoords.longitude], 16, {
          duration: 1.2
        });
      }
    };

    window.handleTrackingUpdate = function(data) {
      currentData = data;
      if (!map) return;

      // 1. Update Tile URL
      if (tileLayer && data.tileUrl) {
        tileLayer.setUrl(data.tileUrl);
      }

      var userLat = data.currentCoords.latitude;
      var userLng = data.currentCoords.longitude;

      // 2. Update Geofence Range Circle
      var radiusMeters = data.selectedRadius || 500;
      if (geofenceCircle) {
        geofenceCircle.setLatLng([userLat, userLng]);
        geofenceCircle.setRadius(radiusMeters);
        geofenceCircle.setStyle({
          color: data.isTracking ? '#2563eb' : '#64748b',
          fillColor: data.isTracking ? '#3b82f6' : '#94a3b8',
          fillOpacity: data.isTracking ? 0.08 : 0.04
        });
      } else {
        geofenceCircle = L.circle([userLat, userLng], {
          radius: radiusMeters,
          color: data.isTracking ? '#2563eb' : '#64748b',
          weight: 1.8,
          dashArray: '5, 5',
          fillColor: data.isTracking ? '#3b82f6' : '#94a3b8',
          fillOpacity: data.isTracking ? 0.08 : 0.04
        }).addTo(map);
      }

      // 3. Update User GPS Beacon Marker
      var radarHtml = data.isTracking ? '<div class="pulse-layer-1"></div><div class="pulse-layer-2"></div>' : '';
      var userIcon = L.divIcon({
        className: 'user-gps-beacon',
        html: '<div style="position: relative; width: 0; height: 0;"><div class="user-beacon-center" style="background-color: ' + (data.isTracking ? '#2563eb' : '#64748b') + '"></div>' + radarHtml + '</div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      if (!userMarker) {
        userMarker = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarker.setIcon(userIcon);
        userMarker.setLatLng([userLat, userLng]);
      }

      // 4. Update Grievance Markers
      grievanceMarkers.forEach(function(m) {
        try { map.removeLayer(m); } catch (e) {}
      });
      grievanceMarkers = [];

      (data.grievances || []).forEach(function(g) {
        if (!g.lat || !g.lng) return;

        var isSelected = String(g.id) === String(data.selectedPinId) || String(g.rawId) === String(data.selectedPinId);
        var isCritical = g.priority === 'CRITICAL' || g.priority === 'HIGH';
        var pulseHtml = isCritical ? '<div class="grievance-pin-pulse" style="background-color: ' + g.color + '"></div>' : '';

        var pinIcon = L.divIcon({
          className: 'custom-grievance-marker',
          html: '<div class="grievance-pin-container">' +
                  pulseHtml +
                  '<div class="grievance-pin-core" style="background-color: ' + g.color + '; ' + (isSelected ? 'transform: scale(1.3); border-color: #ea580c;' : '') + '">' +
                    '<div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>' +
                  '</div>' +
                '</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        var popupHtml = '<div style="min-width: 170px;">' +
          '<div class="popup-title">' +
            '<span>' + g.id + '</span>' +
            '<span class="popup-dist-badge">' + g.distanceText + '</span>' +
          '</div>' +
          '<div class="popup-subject">' + g.subject + '</div>' +
          '<div class="popup-meta">🏢 ' + g.department + '</div>' +
          '<div class="popup-actions-row">' +
            '<button class="popup-btn-nav" onclick="window.sendNavAction(\\\'' + g.id + '\\\')">🧭 Directions</button>' +
            '<button class="popup-btn-details" onclick="window.sendDetailsAction(\\\'' + g.id + '\\\')">Details →</button>' +
          '</div>' +
        '</div>';

        var marker = L.marker([g.lat, g.lng], { icon: pinIcon })
          .addTo(map)
          .bindPopup(popupHtml);

        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              action: 'SELECT_PIN',
              id: g.id
            }));
          }
        });

        grievanceMarkers.push(marker);
      });
    };

    window.sendNavAction = function(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          action: 'NAVIGATE',
          id: id
        }));
      }
    };

    window.sendDetailsAction = function(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          action: 'VIEW_DETAILS',
          id: id
        }));
      }
    };

    window.onload = initMap;
  </script>
</body>
</html>
    `;
  }, [centerLat, centerLng]);

  return (
    <View style={styles.container}>
      {/* Map WebView */}
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => {
            setIsMapReady(true);
            setTimeout(syncMapData, 200);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ea580c" />
              <Text style={styles.loadingText}>Initializing Google Maps Radar...</Text>
            </View>
          )}
        />

        {/* Top-Right Floating Control Panel (Recenter, Zoom) */}
        <View style={styles.floatingControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={recenterMap}
          >
            <Ionicons name="locate" size={17} color="#2563eb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={zoomIn}
          >
            <Ionicons name="add" size={18} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={zoomOut}
          >
            <Ionicons name="remove" size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Top-Left Telemetry Status Pill */}
        <View style={styles.topStatusPill}>
          <View style={[styles.statusDot, { backgroundColor: isTracking ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.statusPillText}>
            {isTracking ? `Live Radar • ${selectedRadius}m Geofence` : `Radar Range: ${selectedRadius}m`}
          </Text>
        </View>

        {/* Bottom-Left Live Detected Counter */}
        <View style={styles.bottomCounterPill}>
          <Ionicons name="radio" size={12} color="#ea580c" style={{ marginRight: 4 }} />
          <Text style={styles.bottomCounterText}>
            {nearbyGrievances.length} Detected
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 12
  },
  mapWrapper: {
    width: '100%',
    height: 310,
    position: 'relative',
    backgroundColor: '#f1f5f9'
  },
  webView: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  floatingControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 20
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2
  },
  topStatusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 20
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a'
  },
  bottomCounterPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 20
  },
  bottomCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c'
  }
});
