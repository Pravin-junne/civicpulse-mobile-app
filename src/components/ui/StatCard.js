import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function StatCard({
  label,
  value,
  variant = 'navy', // 'navy' | 'blue' | 'orange' | 'green' | 'red'
  style,
  onPress
}) {
  const getValueColor = () => {
    switch (variant) {
      case 'blue':
        return '#2563eb';
      case 'orange':
        return '#ea580c';
      case 'green':
        return '#16a34a';
      case 'red':
        return '#dc2626';
      case 'navy':
      default:
        return '#0f172a';
    }
  };

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[styles.card, style]}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: getValueColor() }]}>{value}</Text>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
