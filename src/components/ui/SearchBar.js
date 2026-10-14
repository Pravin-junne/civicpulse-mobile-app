import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity
} from 'react-native';

const SearchIcon = () => (
  <View style={styles.searchIconBox}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

const SlidersIcon = () => (
  <View style={styles.slidersIconBox}>
    <View style={styles.sliderCol}>
      <View style={styles.sliderLine} />
      <View style={[styles.sliderKnob, { top: 2 }]} />
    </View>
    <View style={styles.sliderCol}>
      <View style={styles.sliderLine} />
      <View style={[styles.sliderKnob, { top: 8 }]} />
    </View>
    <View style={styles.sliderCol}>
      <View style={styles.sliderLine} />
      <View style={[styles.sliderKnob, { top: 4 }]} />
    </View>
  </View>
);

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onFilterPress,
  showFilter = true,
  style
}) {
  return (
    <View style={[styles.searchContainer, style]}>
      <SearchIcon />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
      />
      {showFilter && (
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.7}
          onPress={onFilterPress}
        >
          <SlidersIcon />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    marginLeft: 8,
    marginRight: 6,
  },
  filterButton: {
    padding: 4,
  },
  searchIconBox: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#64748b',
  },
  searchHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 5,
    height: 1.5,
    backgroundColor: '#64748b',
    borderRadius: 0.75,
    transform: [{ rotate: '45deg' }],
  },
  slidersIconBox: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderCol: {
    width: 4,
    height: 16,
    alignItems: 'center',
    position: 'relative',
  },
  sliderLine: {
    width: 1.4,
    height: '100%',
    backgroundColor: '#475569',
    borderRadius: 0.7,
  },
  sliderKnob: {
    position: 'absolute',
    width: 4,
    height: 3,
    backgroundColor: '#475569',
    borderRadius: 1,
  },
});
