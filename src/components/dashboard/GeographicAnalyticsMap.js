import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Coordinates dictionary for Pune localities
const PUNE_COORDINATES = {
  'kothrud': [18.5074, 73.8077],
  'karvenagar': [18.4900, 73.8200],
  'shivajinagar': [18.5314, 73.8446],
  'viman nagar': [18.5679, 73.9143],
  'kalyani nagar': [18.5463, 73.9033],
  'hadapsar': [18.5089, 73.9259],
  'katraj': [18.4575, 73.8677],
  'baner': [18.5590, 73.7799],
  'aundh': [18.5580, 73.8075],
  'deccan': [18.5167, 73.8417],
  'erandwane': [18.5113, 73.8340],
  'kasba peth': [18.5196, 73.8553],
  'swargate': [18.5018, 73.8636],
  'warje': [18.4842, 73.8043],
  'bibwewadi': [18.4728, 73.8600],
  'pashan': [18.5415, 73.7925],
  'bavdhan': [18.5140, 73.7745],
  'kharadi': [18.5510, 73.9420],
  'magarpatta': [18.5160, 73.9280],
  'hinjawadi': [18.5913, 73.7389],
  'pune': [18.5204, 73.8567]
};

const getAreaCoordinates = (name, index = 0) => {
  const cleanName = name ? name.toLowerCase().trim() : '';
  for (const [key, coords] of Object.entries(PUNE_COORDINATES)) {
    if (cleanName.includes(key)) {
      return coords;
    }
  }
  const angle = (index * 0.79) % (2 * Math.PI);
  const radius = 0.015 + (index * 0.004) % 0.03;
  return [18.5204 + radius * Math.sin(angle), 73.8567 + radius * Math.cos(angle)];
};

const getDeptColor = (name) => {
  const cleanName = name ? name.toLowerCase().trim() : '';
  if (cleanName.includes('road') || cleanName.includes('infra') || cleanName.includes('traffic')) return '#64748b';
  if (cleanName.includes('water')) return '#06b6d4';
  if (cleanName.includes('drainage') || cleanName.includes('sewage')) return '#3b82f6';
  if (cleanName.includes('light') || cleanName.includes('elect')) return '#eab308';
  if (cleanName.includes('sanitation') || cleanName.includes('health') || cleanName.includes('medical')) return '#10b981';
  if (cleanName.includes('garbage') || cleanName.includes('waste') || cleanName.includes('kachra')) return '#f97316';
  if (cleanName.includes('garden') || cleanName.includes('tree') || cleanName.includes('park')) return '#84cc16';
  if (cleanName.includes('building') || cleanName.includes('construct')) return '#a855f7';
  if (cleanName.includes('encroach')) return '#ef4444';
  if (cleanName.includes('tax') || cleanName.includes('revenue')) return '#14b8a6';
  if (cleanName.includes('education') || cleanName.includes('school')) return '#ec4899';
  if (cleanName.includes('fire') || cleanName.includes('disaster')) return '#dc2626';
  return '#8b5cf6';
};

const GOOGLE_TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

export default function GeographicAnalyticsMap({
  complaints = [],
  areaStats = [],
  onViewComplaintDetail,
  onNavigateGrievances
}) {
  const [mapMode, setMapMode] = useState('AREA'); // 'AREA', 'FREQUENCY', 'DEPARTMENT'
  const webViewRef = useRef(null);

  // Map Stats Calculation
  const activeGrievanceCount = complaints?.length || 0;
  const criticalHotspotsCount = useMemo(() => {
    return (complaints || []).filter(c => (c.priority || '').toUpperCase() === 'CRITICAL').length;
  }, [complaints]);

  const resolutionRate = useMemo(() => {
    if (!complaints || complaints.length === 0) return 0;
    const resolved = complaints.filter(c => ['RESOLVED', 'CLOSED'].includes((c.status || '').toUpperCase())).length;
    return Math.round((resolved / complaints.length) * 100);
  }, [complaints]);

  // Dynamic extraction of all unique departments from complaints
  const departmentStats = useMemo(() => {
    const deptMap = new Map();
    (complaints || []).forEach(c => {
      const name = c.department?.name || c.departmentName || (typeof c.department === 'string' ? c.department : null) || 'General';
      deptMap.set(name, (deptMap.get(name) || 0) + 1);
    });

    if (deptMap.size > 0) {
      return Array.from(deptMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          color: getDeptColor(name)
        }))
        .sort((a, b) => b.count - a.count);
    }

    const defaultDepts = [
      'Water Supply',
      'Roads & Infra',
      'Drainage & Sewage',
      'Street Lights',
      'Solid Waste Management',
      'Sanitation & Health',
      'Garden & Tree Authority',
      'Building Permission',
      'Encroachment Removal',
      'Property Tax & Revenue'
    ];
    return defaultDepts.map(name => ({
      name,
      count: 0,
      color: getDeptColor(name)
    }));
  }, [complaints]);

  // All Area entries for Area-wise resolution efficiency
  const allAreaEntries = useMemo(() => {
    if (areaStats && areaStats.length > 0) {
      return areaStats.map(a => {
        const total = a.total || 0;
        const resPercent = total > 0 ? Math.round(((a.completed || 0) / total) * 100) : 0;
        let color = '#ef4444';
        if (resPercent >= 75) color = '#10b981';
        else if (resPercent >= 35) color = '#f59e0b';
        return {
          name: a.area || a.name || 'Pune Area',
          total,
          pending: a.pending || 0,
          completed: a.completed || 0,
          resPercent,
          color
        };
      });
    }

    const aMap = new Map();
    (complaints || []).forEach(c => {
      const name = c.area ? (typeof c.area === 'object' ? c.area.name : c.area) : (c.landmark || 'Pune Central');
      if (!aMap.has(name)) aMap.set(name, { total: 0, completed: 0 });
      const r = aMap.get(name);
      r.total += 1;
      if (['RESOLVED', 'CLOSED'].includes((c.status || '').toUpperCase())) {
        r.completed += 1;
      }
    });

    return Array.from(aMap.entries()).map(([name, r]) => {
      const resPercent = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
      let color = '#ef4444';
      if (resPercent >= 75) color = '#10b981';
      else if (resPercent >= 35) color = '#f59e0b';
      return {
        name,
        total: r.total,
        resPercent,
        color
      };
    });
  }, [areaStats, complaints]);

  // Frequency-wise sorted areas
  const frequencyAreaEntries = useMemo(() => {
    const list = [...allAreaEntries].sort((a, b) => (b.total || 0) - (a.total || 0));
    const maxCount = list.length > 0 ? Math.max(...list.map(a => a.total || 0), 1) : 1;
    return list.map(a => {
      let freqColor = '#10b981';
      if (a.total >= 0.6 * maxCount && a.total > 0) {
        freqColor = '#dc2626';
      } else if (a.total >= 0.25 * maxCount && a.total > 0) {
        freqColor = '#f97316';
      }
      return {
        ...a,
        freqColor
      };
    });
  }, [allAreaEntries]);

  // Push updated data to WebView when mapMode or data changes
  const sendDataToMap = useCallback(() => {
    if (!webViewRef.current) return;

    const payload = {
      type: 'UPDATE_DATA',
      mapMode,
      tileUrl: GOOGLE_TILE_URL,
      complaints: (complaints || []).map(c => ({
        id: c.id,
        rawId: c.id,
        complaintNumber: c.complaintNumber || (c.id ? `OKT-${c.id}` : 'Ticket'),
        subject: c.subject || 'Citizen Grievance',
        status: c.status || 'PENDING',
        priority: c.priority || 'MEDIUM',
        departmentName: c.department?.name || c.departmentName || (typeof c.department === 'string' ? c.department : 'Other'),
        areaName: c.area ? (typeof c.area === 'object' ? c.area.name : c.area) : (c.landmark || 'Pune Central'),
        address: c.address || '',
        latitude: c.latitude,
        longitude: c.longitude
      })),
      areaStats: areaStats || []
    };

    const js = `
      if (window.handleDataUpdate) {
        window.handleDataUpdate(${JSON.stringify(payload)});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [mapMode, complaints, areaStats]);

  useEffect(() => {
    sendDataToMap();
  }, [sendDataToMap]);

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'VIEW_DETAILS') {
        const found = complaints.find(c => String(c.id) === String(data.id));
        if (found && onViewComplaintDetail) {
          onViewComplaintDetail(found);
        } else if (onNavigateGrievances) {
          onNavigateGrievances();
        }
      } else if (data.action === 'OPEN_NAV') {
        let destinationQuery = '';
        if (data.address && data.address.trim().length > 0) {
          const fullAddress = data.address.toLowerCase().includes('pune') ? data.address : `${data.address}, Pune, Maharashtra`;
          destinationQuery = encodeURIComponent(fullAddress.trim());
        } else if (data.lat && data.lng) {
          destinationQuery = `${data.lat},${data.lng}`;
        }
        if (destinationQuery) {
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`);
        }
      }
    } catch (e) {
      console.log('WebView message error:', e.message);
    }
  };

  // Generate self-contained HTML for Leaflet + Google Maps
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
    html, body, #map { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #e2e8f0; overflow: hidden; }
    
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
      padding: 4px;
    }
    .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.4;
    }
    .popup-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .popup-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .popup-info-row {
      font-size: 11.5px;
      color: #475569;
      margin-bottom: 3px;
    }
    .popup-btn-primary {
      width: 100%;
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      margin-top: 6px;
      cursor: pointer;
    }
    .popup-btn-nav {
      width: 100%;
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var PUNE_COORDS = ${JSON.stringify(PUNE_COORDINATES)};
    var map = L.map('map', {
      center: [18.5204, 73.8567],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });
    window.mapInstance = map;

    var tileLayer = L.tileLayer('${GOOGLE_TILE_URL}', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd']
    }).addTo(map);

    var markersGroup = L.layerGroup().addTo(map);

    function getAreaCoords(name, index) {
      var clean = name ? name.toLowerCase().trim() : '';
      for (var k in PUNE_COORDS) {
        if (clean.indexOf(k) !== -1) {
          return PUNE_COORDS[k];
        }
      }
      var angle = (index * 0.79) % (2 * Math.PI);
      var radius = 0.015 + (index * 0.004) % 0.03;
      return [18.5204 + radius * Math.sin(angle), 73.8567 + radius * Math.cos(angle)];
    }

    function getDeptColor(name) {
      var clean = name ? name.toLowerCase().trim() : '';
      if (clean.indexOf('road') !== -1 || clean.indexOf('infra') !== -1 || clean.indexOf('traffic') !== -1) return '#64748b';
      if (clean.indexOf('water') !== -1) return '#06b6d4';
      if (clean.indexOf('drainage') !== -1 || clean.indexOf('sewage') !== -1) return '#3b82f6';
      if (clean.indexOf('light') !== -1 || clean.indexOf('elect') !== -1) return '#eab308';
      if (clean.indexOf('sanitation') !== -1 || clean.indexOf('health') !== -1 || clean.indexOf('medical') !== -1) return '#10b981';
      if (clean.indexOf('garbage') !== -1 || clean.indexOf('waste') !== -1 || clean.indexOf('kachra') !== -1) return '#f97316';
      if (clean.indexOf('garden') !== -1 || clean.indexOf('tree') !== -1 || clean.indexOf('park') !== -1) return '#84cc16';
      if (clean.indexOf('building') !== -1 || clean.indexOf('construct') !== -1) return '#a855f7';
      if (clean.indexOf('encroach') !== -1) return '#ef4444';
      if (clean.indexOf('tax') !== -1 || clean.indexOf('revenue') !== -1) return '#14b8a6';
      if (clean.indexOf('education') !== -1 || clean.indexOf('school') !== -1) return '#ec4899';
      if (clean.indexOf('fire') !== -1 || clean.indexOf('disaster') !== -1) return '#dc2626';
      return '#8b5cf6';
    }

    window.triggerViewDetails = function(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'VIEW_DETAILS', id: id }));
      }
    };

    window.triggerOpenNav = function(address, lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'OPEN_NAV', address: address, lat: lat, lng: lng }));
      }
    };

    window.handleDataUpdate = function(payload) {
      if (!payload) return;
      
      if (payload.tileUrl) {
        tileLayer.setUrl(payload.tileUrl);
      }

      markersGroup.clearLayers();
      var mode = payload.mapMode || 'AREA';
      var complaints = payload.complaints || [];
      var areaStats = payload.areaStats || [];

      if (mode === 'AREA') {
        areaStats.forEach(function(area, idx) {
          var totalC = area.total || 0;
          if (totalC === 0) return;
          var coords = getAreaCoords(area.area, idx);
          var resPercent = totalC > 0 ? Math.round((area.completed / totalC) * 100) : 0;
          
          var color = '#ef4444';
          if (resPercent >= 75) color = '#10b981';
          else if (resPercent >= 35) color = '#f59e0b';

          var radiusMeters = 400 + (totalC * 200);

          var circle = L.circle(coords, {
            color: color,
            fillColor: color,
            fillOpacity: 0.45,
            radius: radiusMeters,
            weight: 2.5
          });

          var popupHtml = '<div style="min-width: 160px;">' +
            '<div class="popup-title">' + area.area + '</div>' +
            '<div class="popup-info-row"><strong>Total:</strong> ' + area.total + '</div>' +
            '<div class="popup-info-row"><strong>Active Pending:</strong> ' + area.pending + '</div>' +
            '<div class="popup-info-row"><strong>Resolved:</strong> ' + area.completed + '</div>' +
            '<div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 12px;">' +
              '<strong>Resolution:</strong> <span style="color:' + color + '; font-weight:700;">' + resPercent + '%</span>' +
            '</div>' +
          '</div>';

          circle.bindPopup(popupHtml);
          markersGroup.addLayer(circle);
        });
      } else if (mode === 'FREQUENCY') {
        var activeAreas = areaStats.filter(function(a) { return (a.total || 0) > 0; });
        var maxCount = 1;
        activeAreas.forEach(function(a) { if (a.total > maxCount) maxCount = a.total; });

        activeAreas.forEach(function(area, idx) {
          var totalC = area.total || 0;
          if (totalC === 0) return;
          var coords = getAreaCoords(area.area, idx);
          
          var color = '#10b981';
          var label = 'Low Density';
          if (totalC >= 0.6 * maxCount) {
            color = '#dc2626';
            label = 'High Density Hotspot';
          } else if (totalC >= 0.25 * maxCount) {
            color = '#f97316';
            label = 'Medium Density Hub';
          }

          var radiusMeters = 450 + (totalC * 220);

          var circle = L.circle(coords, {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: radiusMeters,
            weight: 2.5
          });

          var popupHtml = '<div style="min-width: 160px;">' +
            '<div class="popup-title">' + area.area + '</div>' +
            '<div class="popup-info-row"><strong>Density:</strong> <span style="color:' + color + '; font-weight:700;">' + label + '</span></div>' +
            '<div class="popup-info-row"><strong>Total Grievances:</strong> ' + totalC + '</div>' +
            '<div class="popup-info-row"><strong>Active Pending:</strong> ' + (area.pending || 0) + '</div>' +
          '</div>';

          circle.bindPopup(popupHtml);
          markersGroup.addLayer(circle);
        });
      } else if (mode === 'DEPARTMENT') {
        complaints.forEach(function(c, idx) {
          var coords = [18.5204, 73.8567];
          if (c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude) && parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0) {
            coords = [parseFloat(c.latitude), parseFloat(c.longitude)];
          } else {
            var center = getAreaCoords(c.areaName, idx);
            var angle = (idx * 0.95) % (2 * Math.PI);
            var jitter = 0.002 + (idx * 0.0003) % 0.003;
            coords = [center[0] + jitter * Math.sin(angle), center[1] + jitter * Math.cos(angle)];
          }

          var deptColor = getDeptColor(c.departmentName);

          var marker = L.circleMarker(coords, {
            color: deptColor,
            fillColor: deptColor,
            fillOpacity: 0.8,
            radius: 9,
            weight: 2
          });

          var safeAddr = (c.address || '').replace(/'/g, "\\'");

          var popupHtml = '<div style="min-width: 180px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
              '<span style="font-size:10px; font-weight:700; color:#64748b;">' + c.complaintNumber + '</span>' +
              '<span class="popup-badge" style="background-color:' + deptColor + '22; color:' + deptColor + '; border:1px solid ' + deptColor + '44;">' + c.departmentName + '</span>' +
            '</div>' +
            '<div class="popup-title">' + c.subject + '</div>' +
            '<div class="popup-info-row"><strong>Area:</strong> ' + c.areaName + '</div>' +
            '<div class="popup-info-row"><strong>Status:</strong> ' + c.status + '</div>' +
            '<div class="popup-info-row"><strong>Priority:</strong> ' + c.priority + '</div>' +
            '<button class="popup-btn-primary" onclick="triggerViewDetails(' + c.id + ')">View Details &rarr;</button>' +
            '<button class="popup-btn-nav" onclick="triggerOpenNav(\\'' + safeAddr + '\\', ' + (c.latitude || 'null') + ', ' + (c.longitude || 'null') + ')">🧭 Directions</button>' +
          '</div>';

          marker.bindPopup(popupHtml);
          markersGroup.addLayer(marker);
        });
      }
    };
  </script>
</body>
</html>
    `;
  }, []);

  return (
    <View style={styles.containerCard}>
      {/* 1. Header Bar: Title & Mode Selector Pills */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="map" size={16} color="#0284c7" />
            <Text style={styles.titleText}>Geographic Analytics Map</Text>
          </View>
          <Text style={styles.subtitleText}>Pune City Municipal Jurisdiction</Text>
        </View>

        {/* Mode Selector Pills */}
        <View style={styles.modePillGroup}>
          <TouchableOpacity
            style={[styles.modePill, mapMode === 'AREA' && styles.modePillActive]}
            onPress={() => setMapMode('AREA')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modePillText, mapMode === 'AREA' && styles.modePillTextActive]}>
              Area-wise Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modePill, mapMode === 'FREQUENCY' && styles.modePillActive]}
            onPress={() => setMapMode('FREQUENCY')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modePillText, mapMode === 'FREQUENCY' && styles.modePillTextActive]}>
              Frequency-wise
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modePill, mapMode === 'DEPARTMENT' && styles.modePillActive]}
            onPress={() => setMapMode('DEPARTMENT')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modePillText, mapMode === 'DEPARTMENT' && styles.modePillTextActive]}>
              Department Clusters
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Interactive Map Canvas Container */}
      <View style={styles.mapCanvasWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.mapWebView}
          onMessage={handleWebViewMessage}
          onLoadEnd={sendDataToMap}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.mapLoadingText}>Loading Geographic Analytics...</Text>
            </View>
          )}
        />

        {/* Floating Bottom-Left: Live Stats HUD Bar */}
        <View style={styles.floatingStatsHud}>
          <View style={styles.statHudItem}>
            <Text style={[styles.statHudValue, { color: '#38bdf8' }]}>{activeGrievanceCount}</Text>
            <Text style={styles.statHudLabel}>Active Grievances</Text>
          </View>
          <View style={styles.statHudDivider} />
          <View style={styles.statHudItem}>
            <Text style={[styles.statHudValue, { color: '#f43f5e' }]}>{criticalHotspotsCount}</Text>
            <Text style={styles.statHudLabel}>Critical Hotspots</Text>
          </View>
          <View style={styles.statHudDivider} />
          <View style={styles.statHudItem}>
            <Text style={[styles.statHudValue, { color: '#34d399' }]}>{resolutionRate}%</Text>
            <Text style={styles.statHudLabel}>Resolution Rate</Text>
          </View>
        </View>

        {/* Floating Bottom-Right: NeoPace Infotech Legend Box (Scrollable with All Entries) */}
        <View style={styles.floatingLegendBox}>
          <View style={styles.legendHeaderRow}>
            <Text style={styles.legendCompanyTitle}>NeoPace Infotech</Text>
            <Ionicons name="swap-vertical" size={10} color="#64748b" />
          </View>

          {mapMode === 'AREA' && (
            <View style={styles.legendModeContainer}>
              <Text style={styles.legendSectionTitle}>Resolution Efficiency</Text>
              <ScrollView
                style={styles.legendScroll}
                contentContainerStyle={styles.legendScrollContent}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.legendDotText}>High (≥75% res.)</Text>
                </View>
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.legendDotText}>Moderate (35-75%)</Text>
                </View>
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.legendDotText}>Low (&lt;35% res.)</Text>
                </View>

                {allAreaEntries.length > 0 && (
                  <>
                    <View style={styles.legendDivider} />
                    <Text style={styles.legendSubheaderText}>All Localities</Text>
                    {allAreaEntries.map((area, idx) => (
                      <View key={area.name || idx} style={styles.legendRowBetween}>
                        <View style={styles.legendLeftWrap}>
                          <View style={[styles.legendColorDot, { backgroundColor: area.color }]} />
                          <Text style={styles.legendDotText} numberOfLines={1}>
                            {area.name}
                          </Text>
                        </View>
                        <Text style={[styles.legendStatValue, { color: area.color }]}>
                          {area.resPercent}%
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          )}

          {mapMode === 'FREQUENCY' && (
            <View style={styles.legendModeContainer}>
              <Text style={styles.legendSectionTitle}>Grievance Frequency</Text>
              <ScrollView
                style={styles.legendScroll}
                contentContainerStyle={styles.legendScrollContent}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#dc2626' }]} />
                  <Text style={styles.legendDotText}>High Density</Text>
                </View>
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#f97316' }]} />
                  <Text style={styles.legendDotText}>Medium Density</Text>
                </View>
                <View style={styles.legendDotRow}>
                  <View style={[styles.legendColorDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.legendDotText}>Low Activity</Text>
                </View>

                {frequencyAreaEntries.length > 0 && (
                  <>
                    <View style={styles.legendDivider} />
                    <Text style={styles.legendSubheaderText}>Hotspots by Count</Text>
                    {frequencyAreaEntries.map((area, idx) => (
                      <View key={area.name || idx} style={styles.legendRowBetween}>
                        <View style={styles.legendLeftWrap}>
                          <View style={[styles.legendColorDot, { backgroundColor: area.freqColor }]} />
                          <Text style={styles.legendDotText} numberOfLines={1}>
                            {area.name}
                          </Text>
                        </View>
                        <Text style={[styles.legendStatValue, { color: area.freqColor }]}>
                          {area.total}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          )}

          {mapMode === 'DEPARTMENT' && (
            <View style={styles.legendModeContainer}>
              <Text style={styles.legendSectionTitle}>Departments ({departmentStats.length})</Text>
              <ScrollView
                style={styles.legendScroll}
                contentContainerStyle={styles.legendScrollContent}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {departmentStats.map((dept, idx) => (
                  <View key={dept.name || idx} style={styles.legendRowBetween}>
                    <View style={styles.legendLeftWrap}>
                      <View style={[styles.legendColorDot, { backgroundColor: dept.color }]} />
                      <Text style={styles.legendDotText} numberOfLines={1}>
                        {dept.name}
                      </Text>
                    </View>
                    {dept.count > 0 ? (
                      <Text style={[styles.legendStatValue, { color: dept.color }]}>
                        {dept.count}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  subtitleText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  modePillGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    marginTop: 10,
    gap: 4
  },
  modePill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modePillActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  modePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b'
  },
  modePillTextActive: {
    color: '#0f172a'
  },
  mapCanvasWrapper: {
    height: 380,
    position: 'relative',
    backgroundColor: '#e2e8f0'
  },
  mapWebView: {
    flex: 1
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  mapLoadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '600'
  },
  floatingStatsHud: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 20,
    gap: 8
  },
  statHudItem: {
    alignItems: 'center'
  },
  statHudValue: {
    fontSize: 12,
    fontWeight: '800'
  },
  statHudLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#94a3b8'
  },
  statHudDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  floatingLegendBox: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 145,
    maxHeight: 112,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3
  },
  legendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
    marginBottom: 3
  },
  legendCompanyTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  legendModeContainer: {
    flex: 1
  },
  legendSectionTitle: {
    fontSize: 8,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2
  },
  legendSubheaderText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 3,
    marginBottom: 2
  },
  legendScroll: {
    maxHeight: 68
  },
  legendScrollContent: {
    gap: 3,
    paddingRight: 2,
    paddingBottom: 2
  },
  legendDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4
  },
  legendLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1
  },
  legendColorDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25
  },
  legendDotText: {
    fontSize: 8,
    color: '#334155',
    fontWeight: '600',
    flex: 1
  },
  legendStatValue: {
    fontSize: 8,
    fontWeight: '800'
  },
  legendDivider: {
    height: 0.5,
    backgroundColor: '#e2e8f0',
    marginVertical: 2
  }
});
