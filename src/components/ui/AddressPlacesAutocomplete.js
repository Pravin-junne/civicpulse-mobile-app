import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

/**
 * AddressPlacesAutocomplete
 * Reusable auto-suggesting address/places text input component.
 * Automatically queries Google Places API & Neopace Location backend as user types.
 */
export default function AddressPlacesAutocomplete({
  value = '',
  onChangeText,
  onSelectPlace,
  placeholder = 'Search or type address (e.g. Kothrud, Karve Road, Pune)...',
  placeholderTextColor = '#94a3b8',
  label = null,
  required = false,
  containerStyle = null,
  inputStyle = null,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  cityContext = 'Pune',
  showIcon = true
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const latestQueryRef = useRef(value);

  useEffect(() => {
    latestQueryRef.current = value;
  }, [value]);

  // Query Backend Places / Location API
  const fetchPlaces = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    try {
      // 1. Primary: Call backend Google Places & Location API endpoint
      const res = await api.get(`/location/search?q=${encodeURIComponent(query.trim())}`);
      const rawList = Array.isArray(res) ? res : (res?.data || []);

      if (rawList && rawList.length > 0) {
        const formatted = rawList.map((item, idx) => ({
          id: item.place_id || `place-${idx}`,
          display_name: item.display_name || item.formatted_address || item.name || query,
          main_text: (item.display_name || item.name || query).split(',')[0].trim(),
          sub_text: (item.display_name || '').split(',').slice(1).join(',').trim(),
          lat: item.lat ? parseFloat(item.lat) : null,
          lon: item.lon ? parseFloat(item.lon) : (item.lng ? parseFloat(item.lng) : null),
          source: item.source === 'google' ? 'Google Places' : 'Neopace Maps'
        }));
        setSuggestions(formatted);
      } else {
        // 2. Resilient fallback: Direct OpenStreetMap geocode with city context
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${cityContext} ${query}`)}&limit=5`,
            { headers: { 'User-Agent': 'NeopaceGrievanceSystem/1.0' } }
          );
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            if (Array.isArray(osmData) && osmData.length > 0) {
              const formatted = osmData.map((item, idx) => ({
                id: item.place_id ? String(item.place_id) : `osm-${idx}`,
                display_name: item.display_name,
                main_text: (item.display_name || '').split(',')[0].trim(),
                sub_text: (item.display_name || '').split(',').slice(1).join(',').trim(),
                lat: item.lat ? parseFloat(item.lat) : null,
                lon: item.lon ? parseFloat(item.lon) : null,
                source: 'Google Places'
              }));
              setSuggestions(formatted);
              return;
            }
          }
        } catch (osmErr) {
          // Ignore fallback error
        }
        setSuggestions([]);
      }
    } catch (err) {
      console.log('[Places Search Notice]:', err.message);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [cityContext]);

  // Handle typing with debounce
  const handleChangeText = (text) => {
    if (onChangeText) {
      onChangeText(text);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchPlaces(text);
    }, 300);
  };

  // Handle place selection
  const handleSelect = (item) => {
    setShowDropdown(false);
    setSuggestions([]);
    if (onChangeText) {
      onChangeText(item.display_name);
    }
    if (onSelectPlace) {
      onSelectPlace(item);
    }
  };

  // Clear input
  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
    setSuggestions([]);
    setShowDropdown(false);
    if (onSelectPlace) {
      onSelectPlace({ display_name: '', lat: null, lon: null });
    }
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label} {required && <Text style={styles.requiredStar}>*</Text>}
          </Text>
          {isSearching && (
            <View style={styles.searchingBadge}>
              <ActivityIndicator size="small" color="#ea580c" style={{ transform: [{ scale: 0.7 }] }} />
              <Text style={styles.searchingText}>Searching places...</Text>
            </View>
          )}
        </View>
      )}

      {/* Input Box with Icon & Clear Trigger */}
      <View style={[styles.inputBox, multiline && styles.inputBoxMultiline]}>
        {showIcon && (
          <Ionicons
            name="location-sharp"
            size={18}
            color="#ea580c"
            style={[styles.leftIcon, multiline && styles.leftIconMultiline]}
          />
        )}

        <TextInput
          style={[
            styles.textInput,
            showIcon ? styles.textInputWithIcon : null,
            multiline && styles.textInputMultiline,
            inputStyle
          ]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          value={value}
          onChangeText={handleChangeText}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowDropdown(true);
            }
          }}
        />

        {/* Right Status / Action: Clear Icon or Spinner */}
        {isSearching && !label ? (
          <ActivityIndicator size="small" color="#ea580c" style={styles.rightAction} />
        ) : value && value.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            activeOpacity={0.7}
            onPress={handleClear}
          >
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Auto-suggested Places Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdownCard}>
          <View style={styles.dropdownHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="navigate" size={13} color="#ea580c" />
              <Text style={styles.dropdownHeaderTitle}>
                Matched Addresses ({suggestions.length})
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowDropdown(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionsScroll}
          >
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={item.id || `sugg-${index}`}
                style={[
                  styles.suggestionRow,
                  index === suggestions.length - 1 && styles.suggestionRowLast
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.pinIconWrap}>
                  <Ionicons name="location" size={16} color="#2563eb" />
                </View>
                <View style={styles.suggestionContent}>
                  <View style={styles.suggestionMainRow}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {item.main_text}
                    </Text>
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>{item.source}</Text>
                    </View>
                  </View>
                  {item.sub_text ? (
                    <Text style={styles.suggestionSubText} numberOfLines={2}>
                      {item.sub_text}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 10
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2
  },
  requiredStar: {
    color: '#ef4444',
    fontWeight: '900'
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  searchingText: {
    fontSize: 10.5,
    color: '#ea580c',
    fontWeight: '600'
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    position: 'relative'
  },
  inputBoxMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 8,
    minHeight: 80
  },
  leftIcon: {
    marginRight: 8
  },
  leftIconMultiline: {
    marginTop: 4
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    paddingVertical: 6,
    paddingRight: 28
  },
  textInputWithIcon: {
    paddingLeft: 0
  },
  textInputMultiline: {
    minHeight: 64,
    paddingTop: 2
  },
  rightAction: {
    position: 'absolute',
    right: 12
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    padding: 4
  },

  /* Suggestions Dropdown */
  dropdownCard: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    zIndex: 999
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa'
  },
  dropdownHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.3
  },
  suggestionsScroll: {
    maxHeight: 210
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  suggestionRowLast: {
    borderBottomWidth: 0
  },
  pinIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  suggestionContent: {
    flex: 1
  },
  suggestionMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6
  },
  suggestionMainText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1
  },
  sourceBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b'
  },
  suggestionSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1.5
  }
});
