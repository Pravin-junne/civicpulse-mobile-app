import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Modern Interactive Calendar Picker Modal for Mobile
 * Formats output as 'YYYY-MM-DD'
 */
export default function CalendarPickerModal({
  visible,
  initialDate,
  title = 'Select Date',
  onSelectDate,
  onClose,
  minDate,
  maxDate
}) {
  const parseDate = (dStr) => {
    if (!dStr) return new Date();
    const parts = String(dStr).split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (visible) {
      const d = parseDate(initialDate);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
      if (initialDate) {
        setSelectedDate(formatYMD(d));
      } else {
        setSelectedDate(null);
      }
    }
  }, [visible, initialDate]);

  const formatYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handleDayPress = (day) => {
    const d = new Date(currentYear, currentMonth, day);
    const ymd = formatYMD(d);
    setSelectedDate(ymd);
    if (onSelectDate) {
      onSelectDate(ymd);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleSelectToday = () => {
    const today = new Date();
    const ymd = formatYMD(today);
    setSelectedDate(ymd);
    if (onSelectDate) {
      onSelectDate(ymd);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedDate(null);
    if (onSelectDate) {
      onSelectDate('');
    }
    if (onClose) {
      onClose();
    }
  };

  const todayYMD = formatYMD(new Date());

  // Generate grid cells
  const gridCells = [];
  // Empty offset cells
  for (let i = 0; i < firstDayIndex; i++) {
    gridCells.push({ key: `empty-${i}`, day: null });
  }
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    const ymd = formatYMD(d);
    gridCells.push({
      key: `day-${day}`,
      day,
      ymd,
      isSelected: selectedDate === ymd,
      isToday: todayYMD === ymd
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>{title}</Text>
              {selectedDate ? (
                <Text style={styles.selectedDateSubtitle}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              ) : (
                <Text style={styles.selectedDateSubtitle}>Tap a day to choose date</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Month / Year Navigator */}
          <View style={styles.navigatorRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.monthYearText}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Day of week headers */}
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map((d, index) => (
              <Text key={d} style={[styles.dayNameText, (index === 0 || index === 6) && styles.weekendText]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {gridCells.map((cell) => {
              if (!cell.day) {
                return <View key={cell.key} style={styles.dayCellEmpty} />;
              }
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    cell.isToday && !cell.isSelected && styles.dayCellToday,
                    cell.isSelected && styles.dayCellSelected
                  ]}
                  onPress={() => handleDayPress(cell.day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      cell.isToday && !cell.isSelected && styles.dayCellTextToday,
                      cell.isSelected && styles.dayCellTextSelected
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Quick Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={handleClear} style={styles.footerActionBtn}>
              <Text style={styles.clearBtnText}>Clear Date</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSelectToday} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Select Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  selectedDateSubtitle: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2
  },
  closeBtn: {
    padding: 4
  },
  navigatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 4
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b'
  },
  dayNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  dayNameText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  weekendText: {
    color: '#ea580c'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 38
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 1
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#2563eb'
  },
  dayCellSelected: {
    backgroundColor: '#2563eb'
  },
  dayCellText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#1e293b'
  },
  dayCellTextToday: {
    color: '#2563eb',
    fontWeight: '700'
  },
  dayCellTextSelected: {
    color: '#ffffff',
    fontWeight: '700'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  footerActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  clearBtnText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600'
  },
  todayBtn: {
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  todayBtnText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600'
  }
});
