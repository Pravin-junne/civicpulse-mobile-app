import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function FloatingActionButton({
  onPress,
  icon = '+',
  color = '#ea580c', // '#ea580c' orange or '#0d9488' teal
  style
}) {
  return (
    <TouchableOpacity
      style={[
        styles.fabButton,
        { backgroundColor: color, shadowColor: color },
        style
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Text style={styles.fabIcon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 30,
    zIndex: 999,
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 32,
    textAlign: 'center',
  },
});
