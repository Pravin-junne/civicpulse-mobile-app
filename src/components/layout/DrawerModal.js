import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated
} from 'react-native';
import Sidebar from './Sidebar';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DrawerModal({
  visible = false,
  onClose,
  activeRoute = 'dashboard',
  onNavigate,
  onOpenProfile,
  onSignOut,
  user
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop touch to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Slide-in Sidebar Container */}
        <View style={styles.drawerContent}>
          <Sidebar
            activeRoute={activeRoute}
            onNavigate={(routeId) => {
              if (onNavigate) onNavigate(routeId);
              if (onClose) onClose();
            }}
            onClose={onClose}
            onOpenProfile={onOpenProfile}
            onSignOut={onSignOut}
            user={user}
            style={styles.sidebarFill}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerContent: {
    width: Math.min(SCREEN_WIDTH * 0.82, 300),
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 100,
  },
  sidebarFill: {
    width: '100%',
    height: '100%',
    borderRightWidth: 0,
  },
});
