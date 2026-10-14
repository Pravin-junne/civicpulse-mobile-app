import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  Dimensions,
  AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api, { resolveFileUrl } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Format file size in bytes into human-readable B / KB / MB / GB
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Format date into "18 Sep 2026"
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return 'Recently';
  }
};

/**
 * File icon and color configuration by type
 */
const getFileIconConfig = (type) => {
  switch ((type || '').toUpperCase()) {
    case 'IMAGE':
      return { iconName: 'image-outline', badge: 'IMAGE', bg: '#eff6ff', border: '#bfdbfe', badgeBg: '#0284c7', label: 'Photo / Image', iconColor: '#0284c7' };
    case 'VIDEO':
      return { iconName: 'videocam-outline', badge: 'VIDEO', bg: '#fff7ed', border: '#fed7aa', badgeBg: '#ea580c', label: 'Video Clip', iconColor: '#ea580c' };
    case 'PDF':
      return { iconName: 'document-text-outline', badge: 'PDF', bg: '#fef2f2', border: '#fecaca', badgeBg: '#dc2626', label: 'PDF Document', iconColor: '#dc2626' };
    case 'DOCX':
    case 'DOC':
      return { iconName: 'document-outline', badge: 'DOCX', bg: '#f0f9ff', border: '#bae6fd', badgeBg: '#2563eb', label: 'Word Document', iconColor: '#2563eb' };
    case 'EXCEL':
    case 'XLS':
    case 'XLSX':
    case 'CSV':
      return { iconName: 'grid-outline', badge: 'EXCEL', bg: '#ecfdf5', border: '#a7f3d0', badgeBg: '#16a34a', label: 'Spreadsheet', iconColor: '#16a34a' };
    default:
      return { iconName: 'document-attach-outline', badge: 'FILE', bg: '#f8fafc', border: '#e2e8f0', badgeBg: '#64748b', label: 'General File', iconColor: '#64748b' };
  }
};

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function FileManagerScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID' | 'LIST'
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [internalTab, setInternalTab] = useState(activeTab);

  // Pagination & Limit State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  // Folder Navigation State
  const [currentFolder, setCurrentFolder] = useState(null); // null = Root Vault
  const [folderHistory, setFolderHistory] = useState([]); // [{ id, name }]

  // Storage Stats State
  const [storageStats, setStorageStats] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalSizeBytes: 0,
    totalSizeFormatted: '0 B'
  });

  const [foldersList, setFoldersList] = useState([]);
  const [filesList, setFilesList] = useState([]);

  // Folder Modals
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const [folderActionModalVisible, setFolderActionModalVisible] = useState(false);
  const [selectedFolderForAction, setSelectedFolderForAction] = useState(null);
  const [renameFolderModalVisible, setRenameFolderModalVisible] = useState(false);
  const [renamedFolderName, setRenamedFolderName] = useState('');

  // Upload Modal States
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pickedFilesQueue, setPickedFilesQueue] = useState([]); // [{ uri, name, size, type, mimeType, isImage }]
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // File Details & Action Modals
  const [selectedFileItem, setSelectedFileItem] = useState(null);
  const [fileDetailsVisible, setFileDetailsVisible] = useState(false);
  const [renameFileModalVisible, setRenameFileModalVisible] = useState(false);
  const [renamedFileName, setRenamedFileName] = useState('');
  const [imagePreviewModalVisible, setImagePreviewModalVisible] = useState(false);

  // 1. Fetch Folders, Files & Stats from Database API
  const fetchFilesAndFolders = useCallback(async () => {
    try {
      setLoading(true);
      const parentParam = currentFolder ? currentFolder.id : 'root';
      const folderParam = currentFolder ? currentFolder.id : 'root';

      const typeQueryParam = selectedType !== 'ALL' ? `&fileType=${selectedType}` : '';
      const searchQueryParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : '';

      const [foldersRes, filesRes, statsRes] = await Promise.allSettled([
        api.get(`/files/folders?parentId=${parentParam}`),
        api.get(`/files?folderId=${folderParam}${typeQueryParam}${searchQueryParam}`),
        api.get('/files/stats')
      ]);

      // Process Folders
      if (foldersRes.status === 'fulfilled' && foldersRes.value) {
        const rawFolders = Array.isArray(foldersRes.value) ? foldersRes.value : [];
        const folderColors = ['#f97316', '#0284c7', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
        setFoldersList(
          rawFolders.map((f, idx) => ({
            id: f.id,
            name: f.name,
            parentId: f.parentId,
            itemCount: f._count?.files ?? 0,
            subfolderCount: f._count?.subfolders ?? 0,
            createdBy: f.createdBy?.name || 'Staff',
            createdAt: f.createdAt,
            color: folderColors[idx % folderColors.length]
          }))
        );
      } else {
        setFoldersList([]);
      }

      // Process Files
      if (filesRes.status === 'fulfilled' && filesRes.value) {
        const rawFiles = Array.isArray(filesRes.value)
          ? filesRes.value
          : (filesRes.value.files || []);

        setFilesList(
          rawFiles.map((f) => {
            const fullUrl = resolveFileUrl(f.fileUrl);
            const ext = (f.name?.split('.').pop() || '').toUpperCase();
            const resolvedType = (f.fileType || ext || 'OTHER').toUpperCase();

            return {
              id: f.id,
              name: f.name || f.originalName || 'Document',
              originalName: f.originalName || f.name,
              type: resolvedType,
              fileSize: f.fileSize || 0,
              sizeFormatted: formatFileSize(f.fileSize),
              rawDate: f.createdAt,
              dateFormatted: formatDate(f.createdAt),
              uploadedBy: f.uploadedBy?.name || 'Staff Officer',
              folderId: f.folderId,
              description: f.description || '',
              tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
              fileUrl: fullUrl
            };
          })
        );
      } else {
        setFilesList([]);
      }

      // Process Stats
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const stats = statsRes.value;
        setStorageStats({
          totalFiles: stats.totalFiles || 0,
          totalFolders: stats.totalFolders || 0,
          totalSizeBytes: stats.totalSizeBytes || 0,
          totalSizeFormatted: stats.totalSizeFormatted || formatFileSize(stats.totalSizeBytes || 0)
        });
      }
    } catch (err) {
      console.log('File manager fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [currentFolder, selectedType, searchQuery]);

  useEffect(() => {
    fetchFilesAndFolders();

    // Refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchFilesAndFolders();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchFilesAndFolders]);

  // Reset pagination on filter / folder changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolder, selectedType, searchQuery, itemsPerPage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFilesAndFolders();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // 2. Folder Navigation Handlers
  const handleEnterFolder = (folder) => {
    setFolderHistory((prev) => [...prev, folder]);
    setCurrentFolder(folder);
    setSearchQuery('');
  };

  const handleGoBackBreadcrumb = (index) => {
    if (index === -1) {
      setCurrentFolder(null);
      setFolderHistory([]);
    } else {
      const newHistory = folderHistory.slice(0, index + 1);
      setFolderHistory(newHistory);
      setCurrentFolder(newHistory[newHistory.length - 1]);
    }
    setSearchQuery('');
  };

  // 3. Create Folder Handler
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Required Field', 'Please enter a name for the new folder.');
      return;
    }
    const cleanName = newFolderName.trim();
    setIsSubmittingFolder(true);

    try {
      await api.post('/files/folders', {
        name: cleanName,
        parentId: currentFolder ? Number(currentFolder.id) : null
      });

      setNewFolderName('');
      setFolderModalVisible(false);
      Alert.alert('Success', `Folder "${cleanName}" created successfully.`);
      fetchFilesAndFolders();
    } catch (err) {
      Alert.alert('Creation Failed', err.message || 'Unable to create folder. Please try again.');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // 4. Rename & Delete Folder Handlers
  const handleRenameFolder = async () => {
    if (!selectedFolderForAction || !renamedFolderName.trim()) {
      Alert.alert('Required Field', 'Please enter a valid folder name.');
      return;
    }
    try {
      await api.put(`/files/folders/${selectedFolderForAction.id}`, {
        name: renamedFolderName.trim()
      });
      setRenameFolderModalVisible(false);
      setSelectedFolderForAction(null);
      setRenamedFolderName('');
      Alert.alert('Success', 'Folder renamed successfully.');
      fetchFilesAndFolders();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to rename folder.');
    }
  };

  const handleDeleteFolder = (folder) => {
    setFolderActionModalVisible(false);
    Alert.alert(
      'Delete Folder',
      `Delete folder "${folder.name}" and all its stored contents? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/files/folders/${folder.id}`);
              Alert.alert('Deleted', `Folder "${folder.name}" removed.`);
              fetchFilesAndFolders();
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete folder.');
            }
          }
        }
      ]
    );
  };

  // 5. File Picking Handlers (Camera, Gallery, Documents)
  const handlePickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `camera_photo_${Date.now()}.jpg`;
        setPickedFilesQueue((prev) => [
          ...prev,
          {
            uri: asset.uri,
            name: fileName,
            size: asset.fileSize ? formatFileSize(asset.fileSize) : 'Photo',
            type: 'IMAGE',
            mimeType: 'image/jpeg',
            isImage: true
          }
        ]);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery permission is required to select images/videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems = result.assets.map((asset, idx) => {
          let name = asset.fileName;
          if (!name) {
            const parts = asset.uri.split('/');
            name = parts[parts.length - 1] || `media_${Date.now()}_${idx}.jpg`;
          }
          const isVideo = asset.type === 'video' || name.toLowerCase().endsWith('.mp4');
          return {
            uri: asset.uri,
            name,
            size: asset.fileSize ? formatFileSize(asset.fileSize) : 'Media File',
            type: isVideo ? 'VIDEO' : 'IMAGE',
            mimeType: isVideo ? 'video/mp4' : (asset.mimeType || 'image/jpeg'),
            isImage: !isVideo
          };
        });

        setPickedFilesQueue((prev) => [...prev, ...newItems]);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not open gallery: ' + err.message);
    }
  };

  const handlePickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems = result.assets.map((doc) => {
          const ext = (doc.name.split('.').pop() || '').toLowerCase();
          let type = 'OTHER';
          let isImage = false;

          if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            type = 'IMAGE';
            isImage = true;
          } else if (['mp4', 'mov', 'avi'].includes(ext)) {
            type = 'VIDEO';
          } else if (ext === 'pdf') {
            type = 'PDF';
          } else if (['doc', 'docx', 'txt'].includes(ext)) {
            type = 'DOCX';
          } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
            type = 'EXCEL';
          }

          return {
            uri: doc.uri,
            name: doc.name,
            size: doc.size ? formatFileSize(doc.size) : 'Document',
            type,
            mimeType: doc.mimeType || 'application/octet-stream',
            isImage
          };
        });

        setPickedFilesQueue((prev) => [...prev, ...newItems]);
      }
    } catch (err) {
      Alert.alert('Document Picker Error', 'Could not pick document: ' + err.message);
    }
  };

  const handleRemoveFromQueue = (index) => {
    setPickedFilesQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 6. Submit Multipart Upload to Backend
  const handleUploadFiles = async () => {
    if (pickedFilesQueue.length === 0) {
      Alert.alert('No Files Selected', 'Please pick at least one photo, video, or document to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();

      for (let i = 0; i < pickedFilesQueue.length; i++) {
        const file = pickedFilesQueue[i];
        const fileUri = Platform.OS === 'android' ? file.uri : file.uri.replace('file://', '');

        let fileMime = file.mimeType;
        if (!fileMime || fileMime === 'application/octet-stream') {
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          if (['jpg', 'jpeg'].includes(ext)) fileMime = 'image/jpeg';
          else if (ext === 'png') fileMime = 'image/png';
          else if (ext === 'webp') fileMime = 'image/webp';
          else if (ext === 'pdf') fileMime = 'application/pdf';
          else if (['doc', 'docx'].includes(ext)) fileMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (['xls', 'xlsx'].includes(ext)) fileMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (['mp4', 'mov'].includes(ext)) fileMime = 'video/mp4';
          else fileMime = 'application/octet-stream';
        }

        formData.append('files', {
          uri: fileUri,
          name: file.name,
          type: fileMime
        });
      }

      if (currentFolder && currentFolder.id) {
        formData.append('folderId', String(currentFolder.id));
      }
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim());
      }
      if (uploadTags.trim()) {
        formData.append('tags', uploadTags.trim());
      }

      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert(
        'Upload Successful',
        `Successfully uploaded ${pickedFilesQueue.length} file(s) to ${currentFolder ? `"${currentFolder.name}"` : 'Root Directory'}.`
      );

      setPickedFilesQueue([]);
      setUploadDescription('');
      setUploadTags('');
      setUploadModalVisible(false);
      fetchFilesAndFolders();
    } catch (err) {
      console.log('Upload error:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload files. Check your connection.');
    } finally {
      setIsUploading(false);
    }
  };

  // 7. File Action Handlers (Rename, Delete, Open)
  const openRenameFileModal = (file) => {
    setSelectedFileItem(file);
    setRenamedFileName(file.name);
    setFileDetailsVisible(false);
    setRenameFileModalVisible(true);
  };

  const handleRenameFile = async () => {
    if (!selectedFileItem || !renamedFileName.trim()) {
      Alert.alert('Required Field', 'Please enter a valid file title.');
      return;
    }
    try {
      await api.put(`/files/${selectedFileItem.id}`, {
        name: renamedFileName.trim()
      });
      setRenameFileModalVisible(false);
      setSelectedFileItem(null);
      setRenamedFileName('');
      Alert.alert('Success', 'File title updated successfully.');
      fetchFilesAndFolders();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to rename file.');
    }
  };

  const handleDeleteFile = (file) => {
    setFileDetailsVisible(false);
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name}"? This file will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/files/${file.id}`);
              Alert.alert('Deleted', 'File removed from repository.');
              fetchFilesAndFolders();
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete file.');
            }
          }
        }
      ]
    );
  };

  const handleOpenFile = async (file) => {
    if (!file.fileUrl) {
      Alert.alert('Unavailable', 'File URL is not available.');
      return;
    }
    try {
      await Linking.openURL(file.fileUrl);
    } catch (err) {
      Alert.alert('Notice', 'Opening file: ' + file.fileUrl);
    }
  };

  const fileTypes = [
    { id: 'ALL', label: 'All Files', icon: 'layers-outline' },
    { id: 'IMAGE', label: 'Photos', icon: 'image-outline' },
    { id: 'VIDEO', label: 'Videos', icon: 'videocam-outline' },
    { id: 'PDF', label: 'PDFs', icon: 'document-text-outline' },
    { id: 'DOCX', label: 'Word Docs', icon: 'document-outline' },
    { id: 'EXCEL', label: 'Sheets', icon: 'grid-outline' },
    { id: 'OTHER', label: 'Other', icon: 'document-attach-outline' }
  ];

  // Filter folders in real-time by search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return foldersList;
    const q = searchQuery.toLowerCase().trim();
    return foldersList.filter((f) => f.name.toLowerCase().includes(q));
  }, [foldersList, searchQuery]);

  // Filter files in real-time by search query and file type
  const filteredFiles = useMemo(() => {
    return filesList.filter((f) => {
      if (selectedType !== 'ALL' && f.type !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesDesc = f.description?.toLowerCase().includes(q);
        const matchesUploader = f.uploadedBy?.toLowerCase().includes(q);
        const matchesTags = f.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesUploader && !matchesTags) {
          return false;
        }
      }
      return true;
    });
  }, [filesList, selectedType, searchQuery]);

  // Total pages based on filtered files
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredFiles.length / itemsPerPage));
  }, [filteredFiles.length, itemsPerPage]);

  // Paginated files for current page
  const paginatedFiles = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredFiles.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredFiles, currentPage, itemsPerPage]);

  // Smart page numbers array with ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  const showingStart = filteredFiles.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = Math.min(currentPage * itemsPerPage, filteredFiles.length);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Main Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Constituency File Manager"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Scrollable Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* Title and Top Action Buttons */}
        <View style={styles.titleRow}>
          <View style={styles.titleTextWrap}>
            <Text style={styles.screenTitle}>File Manager</Text>
            <Text style={styles.screenSubtitle}>
              {currentFolder ? `Inside: ${currentFolder.name}` : 'Constituency Cloud Repository'}
            </Text>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.folderAddBtn}
              activeOpacity={0.8}
              onPress={() => setFolderModalVisible(true)}
            >
              <Ionicons name="folder-add-outline" size={15} color="#334155" style={{ marginRight: 5 }} />
              <Text style={styles.folderAddBtnText}>New Folder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadBtn}
              activeOpacity={0.8}
              onPress={() => {
                setPickedFilesQueue([]);
                setUploadDescription('');
                setUploadTags('');
                setUploadModalVisible(true);
              }}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balanced 2-Card KPI Stats (Storage Consumed Card removed as requested) */}
        <View style={styles.statsGrid}>
          {/* Card 1: Total Folders */}
          <View style={[styles.statCard, { borderLeftColor: '#f97316' }]}>
            <View style={[styles.statIconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="folder-open-outline" size={18} color="#ea580c" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: '#c2410c' }]}>
                {storageStats.totalFolders || foldersList.length}
              </Text>
              <Text style={styles.statLabel}>Total Folders</Text>
            </View>
          </View>

          {/* Card 2: Stored Documents */}
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <View style={[styles.statIconBox, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="document-text-outline" size={18} color="#059669" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: '#059669' }]}>
                {storageStats.totalFiles || filesList.length}
              </Text>
              <Text style={styles.statLabel}>Stored Files</Text>
            </View>
          </View>
        </View>

        {/* Breadcrumb Navigation Trail */}
        <View style={styles.breadcrumbBar}>
          <TouchableOpacity
            onPress={() => handleGoBackBreadcrumb(-1)}
            activeOpacity={0.7}
            style={styles.breadcrumbTouch}
          >
            <Ionicons name="home-outline" size={13} color={!currentFolder ? '#ea580c' : '#64748b'} style={{ marginRight: 4 }} />
            <Text style={[styles.breadcrumbItem, !currentFolder && styles.breadcrumbActive]}>
              Root Directory
            </Text>
          </TouchableOpacity>

          {folderHistory.map((f, index) => (
            <View key={f.id} style={styles.breadcrumbStep}>
              <Ionicons name="chevron-forward" size={12} color="#94a3b8" style={{ marginHorizontal: 4 }} />
              <TouchableOpacity
                onPress={() => handleGoBackBreadcrumb(index)}
                activeOpacity={0.7}
                style={styles.breadcrumbTouch}
              >
                <Ionicons name="folder-outline" size={13} color={index === folderHistory.length - 1 ? '#ea580c' : '#64748b'} style={{ marginRight: 3 }} />
                <Text
                  style={[
                    styles.breadcrumbItem,
                    index === folderHistory.length - 1 && styles.breadcrumbActive
                  ]}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Search & View Mode Switcher Row */}
        <View style={styles.searchAndModeRow}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search file name, tag, or officer..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* View Mode Toggle (Grid / List) */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'GRID' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('GRID')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="grid-outline"
                size={14}
                color={viewMode === 'GRID' ? '#ea580c' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.viewModeBtnText, viewMode === 'GRID' && styles.viewModeBtnTextActive]}>
                Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'LIST' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('LIST')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list-outline"
                size={14}
                color={viewMode === 'LIST' ? '#ea580c' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.viewModeBtnText, viewMode === 'LIST' && styles.viewModeBtnTextActive]}>
                List
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* File Type Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {fileTypes.map((t) => {
            const isActive = selectedType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setSelectedType(t.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t.icon}
                  size={13}
                  color={isActive ? '#ea580c' : '#64748b'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Loading Spinner */}
        {loading && !refreshing && (
          <View style={styles.inlineLoadingBox}>
            <ActivityIndicator size="small" color="#ea580c" />
            <Text style={styles.inlineLoadingText}>Loading repository contents...</Text>
          </View>
        )}

        {/* Folders Section */}
        {filteredFolders.length > 0 && (
          <View style={styles.foldersSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="folder-outline" size={14} color="#ea580c" style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeading}>
                  {currentFolder ? 'Sub-Folders' : 'Folders'} ({filteredFolders.length})
                </Text>
              </View>
            </View>
            <View style={styles.folderGrid}>
              {filteredFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderCard}
                  activeOpacity={0.7}
                  onPress={() => handleEnterFolder(folder)}
                >
                  <View style={styles.folderCardTopRow}>
                    <View style={[styles.folderIconBox, { backgroundColor: (folder.color || '#f97316') + '15' }]}>
                      <Ionicons name="folder" size={20} color={folder.color || '#f97316'} />
                    </View>
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => {
                        setSelectedFolderForAction(folder);
                        setRenamedFolderName(folder.name);
                        setFolderActionModalVisible(true);
                      }}
                    >
                      <Ionicons name="ellipsis-vertical" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.folderNameText} numberOfLines={2}>
                    {folder.name}
                  </Text>
                  <Text style={styles.folderCountText}>{folder.itemCount} files</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Files Section List */}
        <View style={styles.filesSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-outline" size={14} color="#ea580c" style={{ marginRight: 6 }} />
              <Text style={styles.sectionHeading}>
                Files ({filteredFiles.length})
              </Text>
            </View>
          </View>

          {/* Empty Directory State */}
          {filteredFiles.length === 0 && filteredFolders.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={44} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>This folder is empty</Text>
              <Text style={styles.emptyStateSub}>
                Tap "+ New Folder" to create subfolders or "Upload" to store documents.
              </Text>
            </View>
          )}

          {/* Empty Filter State */}
          {filteredFiles.length === 0 && filteredFolders.length > 0 && !loading && (
            <View style={styles.emptyStateSmall}>
              <Text style={styles.emptyStateSub}>No files stored directly at this level.</Text>
            </View>
          )}

          {/* Grid View Mode */}
          {viewMode === 'GRID' && paginatedFiles.length > 0 && (
            <View style={styles.filesGrid}>
              {paginatedFiles.map((file) => {
                const typeConfig = getFileIconConfig(file.type);
                const isImg = file.type === 'IMAGE';
                const isVid = file.type === 'VIDEO';

                return (
                  <TouchableOpacity
                    key={file.id}
                    style={styles.fileGridCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedFileItem(file);
                      setFileDetailsVisible(true);
                    }}
                  >
                    {/* Media Thumbnail or Icon Container */}
                    {isImg && file.fileUrl ? (
                      <View style={styles.gridMediaThumbnailWrap}>
                        <Image
                          source={{ uri: file.fileUrl }}
                          style={styles.gridMediaThumbnailImg}
                          resizeMode="cover"
                        />
                        <View style={[styles.gridBadge, { backgroundColor: typeConfig.badgeBg }]}>
                          <Text style={styles.gridBadgeText}>IMAGE</Text>
                        </View>
                      </View>
                    ) : isVid ? (
                      <View style={[styles.gridMediaThumbnailWrap, { backgroundColor: '#0f172a' }]}>
                        <View style={styles.playCircleOverlay}>
                          <Ionicons name="play" size={18} color="#ffffff" />
                        </View>
                        <View style={[styles.gridBadge, { backgroundColor: '#ea580c' }]}>
                          <Text style={styles.gridBadgeText}>VIDEO</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.gridDocIconWrap, { backgroundColor: typeConfig.bg, borderColor: typeConfig.border }]}>
                        <Ionicons name={typeConfig.iconName} size={30} color={typeConfig.iconColor} />
                        <View style={[styles.gridBadge, { backgroundColor: typeConfig.badgeBg }]}>
                          <Text style={styles.gridBadgeText}>{typeConfig.badge}</Text>
                        </View>
                      </View>
                    )}

                    {/* File Info */}
                    <Text style={styles.gridFileName} numberOfLines={2}>
                      {file.name}
                    </Text>

                    {file.description ? (
                      <Text style={styles.gridFileDesc} numberOfLines={1}>
                        {file.description}
                      </Text>
                    ) : null}

                    <View style={styles.gridMetaRow}>
                      <Text style={styles.gridFileSize}>{file.sizeFormatted}</Text>
                      <Text style={styles.gridFileDate}>{file.dateFormatted}</Text>
                    </View>

                    {/* Quick Action Buttons Row */}
                    <View style={styles.gridCardActionsRow}>
                      <TouchableOpacity
                        style={styles.gridActionBtnPrimary}
                        onPress={() => handleOpenFile(file)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isVid ? 'play-outline' : isImg ? 'eye-outline' : 'open-outline'}
                          size={13}
                          color="#ea580c"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.gridActionBtnPrimaryText}>
                          {isVid ? 'Play' : isImg ? 'View' : 'Open'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gridActionBtnSecondary}
                        onPress={() => openRenameFileModal(file)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="pencil-outline" size={13} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gridActionBtnDanger}
                        onPress={() => handleDeleteFile(file)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="trash-outline" size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* List View Mode */}
          {viewMode === 'LIST' && paginatedFiles.length > 0 && (
            <View style={styles.filesList}>
              {paginatedFiles.map((file) => {
                const typeConfig = getFileIconConfig(file.type);
                const isImg = file.type === 'IMAGE';
                const isVid = file.type === 'VIDEO';

                return (
                  <TouchableOpacity
                    key={file.id}
                    style={styles.fileItemCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedFileItem(file);
                      setFileDetailsVisible(true);
                    }}
                  >
                    {/* Thumbnail or Icon */}
                    {isImg && file.fileUrl ? (
                      <Image
                        source={{ uri: file.fileUrl }}
                        style={styles.fileThumbnailImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.fileIconBox,
                          { backgroundColor: typeConfig.bg, borderColor: typeConfig.border }
                        ]}
                      >
                        <Ionicons name={typeConfig.iconName} size={22} color={typeConfig.iconColor} />
                      </View>
                    )}

                    {/* File Info */}
                    <View style={styles.fileInfoCol}>
                      <Text style={styles.fileNameText} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <View style={styles.fileMetaRow}>
                        <Text style={styles.fileSizeText}>{file.sizeFormatted}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.fileDateText}>{file.dateFormatted}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.fileAuthorText}>{file.uploadedBy}</Text>
                      </View>
                      {file.tags && file.tags.length > 0 ? (
                        <View style={styles.fileCardTagsRow}>
                          {file.tags.slice(0, 3).map((tg, idx) => (
                            <Text key={idx} style={styles.fileTagChip}>
                              #{tg}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    {/* Quick Open Action Button */}
                    <TouchableOpacity
                      style={styles.listQuickOpenBtn}
                      onPress={() => handleOpenFile(file)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isVid ? 'play-outline' : isImg ? 'eye-outline' : 'open-outline'}
                        size={15}
                        color="#ea580c"
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Pagination Controls */}
        {filteredFiles.length > 0 && (
          <View style={styles.paginationContainer}>
            <View style={styles.paginationHeader}>
              <Text style={styles.paginationCountText}>
                Showing <Text style={styles.paginationCountBold}>{showingStart}</Text> - <Text style={styles.paginationCountBold}>{showingEnd}</Text> of <Text style={styles.paginationCountBold}>{filteredFiles.length}</Text> files
              </Text>
              <TouchableOpacity
                style={styles.limitSelectorChip}
                activeOpacity={0.7}
                onPress={() => setIsLimitModalOpen(true)}
              >
                <Ionicons name="layers-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                <Text style={styles.limitSelectorChipText}>{itemsPerPage} per page</Text>
                <Ionicons name="chevron-down" size={12} color="#ea580c" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>

            {totalPages > 1 && (
              <View style={styles.paginationNavRow}>
                {/* Prev Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage <= 1 && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={15} color={currentPage <= 1 ? '#94a3b8' : '#0f172a'} />
                  <Text style={[styles.pageNavButtonText, currentPage <= 1 && styles.pageNavButtonTextDisabled]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                {/* Page Number Buttons */}
                <View style={styles.pageNumbersList}>
                  {pageNumbers.map((pageItem, index) => {
                    if (pageItem === '...') {
                      return (
                        <View key={`ellipsis-${index}`} style={styles.pageEllipsisWrap}>
                          <Text style={styles.pageEllipsisText}>•••</Text>
                        </View>
                      );
                    }
                    const isActive = currentPage === pageItem;
                    return (
                      <TouchableOpacity
                        key={pageItem}
                        style={[styles.pageNumberPill, isActive && styles.pageNumberPillActive]}
                        onPress={() => setCurrentPage(pageItem)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pageNumberPillText, isActive && styles.pageNumberPillTextActive]}>
                          {pageItem}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage >= totalPages && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNavButtonText, currentPage >= totalPages && styles.pageNavButtonTextDisabled]}>
                    Next
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={currentPage >= totalPages ? '#94a3b8' : '#0f172a'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Bottom Clearance Spacer */}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 3. New Folder Modal */}
      <Modal
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFolderModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="folder-add-outline" size={18} color="#ea580c" />
                </View>
                <Text style={styles.modalTitle}>
                  {currentFolder ? 'New Sub-Folder' : 'Create New Folder'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFolderModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {currentFolder ? `Creating inside "${currentFolder.name}"` : 'Organize documents & project files'}
            </Text>

            <View style={styles.modalInputWrap}>
              <Text style={styles.modalLabel}>
                Folder Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Kasba Peth Road Survey 2026"
                placeholderTextColor="#94a3b8"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setFolderModalVisible(false);
                  setNewFolderName('');
                }}
                disabled={isSubmittingFolder}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmittingFolder && { opacity: 0.7 }]}
                onPress={handleCreateFolder}
                disabled={isSubmittingFolder}
              >
                {isSubmittingFolder ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Folder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Folder Action Options Modal (Rename / Delete) */}
      <Modal
        visible={folderActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderActionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFolderActionModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="folder-outline" size={18} color="#ea580c" />
                </View>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedFolderForAction?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFolderActionModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Choose an action for this folder</Text>

            <View style={styles.fileDetailsActionsList}>
              <TouchableOpacity
                style={styles.actionItemBtn}
                onPress={() => {
                  setFolderActionModalVisible(false);
                  setRenameFolderModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={17} color="#0f172a" style={{ marginRight: 10 }} />
                <Text style={styles.actionItemText}>Rename Folder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItemBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                onPress={() => {
                  if (selectedFolderForAction) {
                    handleDeleteFolder(selectedFolderForAction);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={17} color="#dc2626" style={{ marginRight: 10 }} />
                <Text style={[styles.actionItemText, { color: '#dc2626' }]}>Delete Folder</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setFolderActionModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. Rename Folder Modal */}
      <Modal
        visible={renameFolderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameFolderModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRenameFolderModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="pencil-outline" size={18} color="#ea580c" />
                </View>
                <Text style={styles.modalTitle}>Rename Folder</Text>
              </View>
              <TouchableOpacity onPress={() => setRenameFolderModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Enter the new name for this folder</Text>

            <View style={styles.modalInputWrap}>
              <TextInput
                style={styles.modalInput}
                placeholder="Folder name"
                placeholderTextColor="#94a3b8"
                value={renamedFolderName}
                onChangeText={setRenamedFolderName}
                autoFocus
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRenameFolderModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRenameFolder}>
                <Text style={styles.modalSubmitBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 6. Upload Files / Images Modal */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isUploading) setUploadModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModalSheet}>
            <View style={styles.uploadModalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#ea580c" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Upload Files</Text>
                  <Text style={styles.modalSub} numberOfLines={1}>
                    {currentFolder ? `Uploading to: ${currentFolder.name}` : 'Uploading to: Root Directory'}
                  </Text>
                </View>
              </View>
              {!isUploading && (
                <TouchableOpacity onPress={() => setUploadModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Pick Source Buttons */}
              <Text style={styles.uploadSectionTitle}>Select Source:</Text>
              <View style={styles.pickerButtonsRow}>
                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromCamera}
                  disabled={isUploading}
                >
                  <Ionicons name="camera-outline" size={22} color="#ea580c" style={{ marginBottom: 4 }} />
                  <Text style={styles.pickerActionLabel}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickFromGallery}
                  disabled={isUploading}
                >
                  <Ionicons name="images-outline" size={22} color="#ea580c" style={{ marginBottom: 4 }} />
                  <Text style={styles.pickerActionLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  activeOpacity={0.7}
                  onPress={handlePickDocuments}
                  disabled={isUploading}
                >
                  <Ionicons name="document-attach-outline" size={22} color="#ea580c" style={{ marginBottom: 4 }} />
                  <Text style={styles.pickerActionLabel}>Documents</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Files Queue */}
              {pickedFilesQueue.length > 0 && (
                <View style={styles.queueContainer}>
                  <Text style={styles.queueHeaderTitle}>
                    Selected Files ({pickedFilesQueue.length}):
                  </Text>
                  {pickedFilesQueue.map((item, idx) => (
                    <View key={idx} style={styles.queueItemRow}>
                      <View style={styles.queueItemIconWrap}>
                        <Ionicons
                          name={item.type === 'IMAGE' ? 'image-outline' : item.type === 'PDF' ? 'document-text-outline' : 'document-outline'}
                          size={18}
                          color="#ea580c"
                        />
                      </View>
                      <View style={styles.queueItemInfo}>
                        <Text style={styles.queueItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.queueItemMeta}>
                          {item.type} • {item.size}
                        </Text>
                      </View>
                      {!isUploading && (
                        <TouchableOpacity
                          style={styles.queueRemoveBtn}
                          onPress={() => handleRemoveFromQueue(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Description Input */}
              <View style={styles.modalInputWrap}>
                <Text style={styles.modalLabel}>Description (Optional):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Drainage inspection site photo..."
                  placeholderTextColor="#94a3b8"
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  editable={!isUploading}
                />
              </View>


            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setUploadModalVisible(false)}
                disabled={isUploading}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (pickedFilesQueue.length === 0 || isUploading) && { opacity: 0.6 }
                ]}
                onPress={handleUploadFiles}
                disabled={pickedFilesQueue.length === 0 || isUploading}
              >
                {isUploading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.modalSubmitBtnText}>Uploading...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    Upload {pickedFilesQueue.length > 0 ? `(${pickedFilesQueue.length})` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. File Details & Action Modal */}
      <Modal
        visible={fileDetailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFileDetailsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFileDetailsVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#ea580c" />
                </View>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  File Details
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFileDetailsVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.detailsFileName} numberOfLines={2}>
              {selectedFileItem?.name}
            </Text>
            <Text style={styles.modalSub}>
              {selectedFileItem?.sizeFormatted} • {selectedFileItem?.type} • By {selectedFileItem?.uploadedBy}
            </Text>

            {/* Image Preview Thumbnail if Image */}
            {selectedFileItem?.type === 'IMAGE' && selectedFileItem?.fileUrl ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setImagePreviewModalVisible(true)}
                style={styles.detailsImgPreviewWrap}
              >
                <Image
                  source={{ uri: selectedFileItem.fileUrl }}
                  style={styles.detailsImgPreview}
                  resizeMode="cover"
                />
                <View style={styles.detailsImgOverlayPill}>
                  <Ionicons name="expand-outline" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.detailsImgTapHint}>Tap for full screen preview</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {selectedFileItem?.description ? (
              <View style={styles.detailsDescBox}>
                <Text style={styles.detailsDescLabel}>Description:</Text>
                <Text style={styles.detailsDescText}>{selectedFileItem.description}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.fileDetailsActionsList}>
              <TouchableOpacity
                style={styles.actionItemBtn}
                onPress={() => {
                  if (selectedFileItem) handleOpenFile(selectedFileItem);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={17} color="#ea580c" style={{ marginRight: 10 }} />
                <Text style={styles.actionItemText}>Open / Download File</Text>
              </TouchableOpacity>

              {selectedFileItem?.type === 'IMAGE' && (
                <TouchableOpacity
                  style={styles.actionItemBtn}
                  onPress={() => setImagePreviewModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={17} color="#0284c7" style={{ marginRight: 10 }} />
                  <Text style={styles.actionItemText}>View Full Image</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionItemBtn}
                onPress={() => {
                  if (selectedFileItem) openRenameFileModal(selectedFileItem);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={17} color="#475569" style={{ marginRight: 10 }} />
                <Text style={styles.actionItemText}>Rename File</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItemBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                onPress={() => {
                  if (selectedFileItem) handleDeleteFile(selectedFileItem);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={17} color="#dc2626" style={{ marginRight: 10 }} />
                <Text style={[styles.actionItemText, { color: '#dc2626' }]}>Delete File</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setFileDetailsVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 8. Rename File Modal */}
      <Modal
        visible={renameFileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameFileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRenameFileModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="pencil-outline" size={18} color="#ea580c" />
                </View>
                <Text style={styles.modalTitle}>Rename File</Text>
              </View>
              <TouchableOpacity onPress={() => setRenameFileModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Enter the new title for this document</Text>

            <View style={styles.modalInputWrap}>
              <TextInput
                style={styles.modalInput}
                placeholder="File name"
                placeholderTextColor="#94a3b8"
                value={renamedFileName}
                onChangeText={setRenamedFileName}
                autoFocus
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRenameFileModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRenameFile}>
                <Text style={styles.modalSubmitBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 9. Full-Screen Image Preview Modal */}
      <Modal
        visible={imagePreviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewModalVisible(false)}
      >
        <View style={styles.fullscreenImgOverlay}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setImagePreviewModalVisible(false)}
          >
            <Ionicons name="close" size={18} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.fullscreenCloseText}>Close</Text>
          </TouchableOpacity>

          {selectedFileItem?.fileUrl ? (
            <Image
              source={{ uri: selectedFileItem.fileUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}

          <TouchableOpacity
            style={styles.fullscreenOpenInBrowserBtn}
            onPress={() => {
              if (selectedFileItem) handleOpenFile(selectedFileItem);
            }}
          >
            <Ionicons name="globe-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.fullscreenOpenInBrowserText}>Open Original in Browser</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 10. Limit Selector Modal */}
      <Modal
        visible={isLimitModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLimitModalOpen(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="options-outline" size={19} color="#ea580c" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Files Per Page</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLimitModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 4 }}>
              {LIMIT_OPTIONS.map((lim) => {
                const isSelected = itemsPerPage === lim;
                return (
                  <TouchableOpacity
                    key={lim}
                    style={[
                      styles.limitSelectItem,
                      isSelected && styles.limitSelectItemActive
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setItemsPerPage(lim);
                      setCurrentPage(1);
                      setIsLimitModalOpen(false);
                    }}
                  >
                    <View style={styles.limitOptionLabelWrap}>
                      <Text style={[styles.limitSelectText, isSelected && styles.limitSelectTextActive]}>
                        {lim} files
                      </Text>
                      {lim === 20 && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsLimitModalOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 11. Bottom Navigation Bar */}
      <BottomNav activeTab={internalTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center'
  },

  /* Title Row */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  titleTextWrap: {
    flex: 1,
    paddingRight: 8
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  folderAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  folderAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },

  /* 2 KPI Stats Grid */
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statContent: {
    flex: 1
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1
  },

  /* Breadcrumb Navigation */
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    flexWrap: 'wrap'
  },
  breadcrumbTouch: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  breadcrumbStep: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  breadcrumbItem: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  breadcrumbActive: {
    color: '#ea580c',
    fontWeight: '800'
  },

  /* Search & View Mode Switcher */
  searchAndModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7
  },
  viewModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  viewModeBtnTextActive: {
    color: '#ea580c',
    fontWeight: '800'
  },

  /* Filter Pills */
  filterPillsContainer: {
    gap: 8,
    paddingBottom: 12
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterPillActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c'
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b'
  },
  filterPillTextActive: {
    color: '#ea580c',
    fontWeight: '700'
  },

  /* Inline Loading */
  inlineLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14
  },
  inlineLoadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },

  /* Section Headings */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  /* Folders Grid */
  foldersSection: {
    marginBottom: 16
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  folderCard: {
    width: (SCREEN_WIDTH - 42) / 2 > 230 ? 230 : (SCREEN_WIDTH - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1
  },
  folderCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  folderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  folderNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 17,
    marginBottom: 3
  },
  folderCountText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },

  /* Files Section */
  filesSection: {
    marginTop: 4
  },

  /* Grid View Mode */
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  fileGridCard: {
    width: (SCREEN_WIDTH - 42) / 2 > 230 ? 230 : (SCREEN_WIDTH - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  gridMediaThumbnailWrap: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  gridMediaThumbnailImg: {
    width: '100%',
    height: '100%'
  },
  playCircleOverlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(234, 88, 12, 0.85)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  gridDocIconWrap: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  gridBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#ffffff'
  },
  gridFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 16,
    marginBottom: 2
  },
  gridFileDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginBottom: 4
  },
  gridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8
  },
  gridFileSize: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569'
  },
  gridFileDate: {
    fontSize: 10,
    color: '#94a3b8'
  },
  gridCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8
  },
  gridActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
    borderWidth: 1,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gridActionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c'
  },
  gridActionBtnSecondary: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  gridActionBtnDanger: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center'
  },

  /* List View Mode */
  filesList: {
    gap: 8
  },
  fileItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1
  },
  fileThumbnailImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 10
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  fileInfoCol: {
    flex: 1
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  fileSizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  metaDot: {
    fontSize: 10,
    color: '#cbd5e1',
    marginHorizontal: 4
  },
  fileDateText: {
    fontSize: 11,
    color: '#64748b'
  },
  fileAuthorText: {
    fontSize: 11,
    color: '#94a3b8'
  },
  fileCardTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4
  },
  fileTagChip: {
    fontSize: 10,
    color: '#ea580c',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600'
  },
  listQuickOpenBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },

  /* Empty States */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 20
  },
  emptyStateSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    textAlign: 'center'
  },

  /* Pagination Styles */
  paginationContainer: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 12
  },
  paginationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  paginationCountText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500'
  },
  paginationCountBold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  limitSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  limitSelectorChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c'
  },
  paginationNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8
  },
  pageNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    gap: 4
  },
  pageNavButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#f8fafc'
  },
  pageNavButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  pageNavButtonTextDisabled: {
    color: '#94a3b8'
  },
  pageNumbersList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 1
  },
  pageNumberPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  pageNumberPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  pageNumberPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  pageNumberPillTextActive: {
    color: '#ffffff'
  },
  pageEllipsisWrap: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageEllipsisText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700'
  },

  /* Modals Common */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  modalHeaderIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12
  },
  detailsFileName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 2
  },
  uploadModalSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10
  },
  uploadModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  uploadSectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  pickerActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12
  },
  pickerActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  queueContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 14
  },
  queueHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 6
  },
  queueItemIconWrap: {
    marginRight: 8
  },
  queueItemInfo: {
    flex: 1
  },
  queueItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a'
  },
  queueItemMeta: {
    fontSize: 10,
    color: '#64748b'
  },
  queueRemoveBtn: {
    padding: 4
  },
  modalInputWrap: {
    marginBottom: 12
  },
  modalLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a'
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#ea580c',
    borderRadius: 10,
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  fileDetailsActionsList: {
    gap: 8,
    marginBottom: 12
  },
  actionItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12
  },
  actionItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  detailsImgPreviewWrap: {
    alignItems: 'center',
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative'
  },
  detailsImgPreview: {
    width: '100%',
    height: 150,
    backgroundColor: '#0f172a'
  },
  detailsImgOverlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  detailsImgTapHint: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600'
  },
  detailsDescBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  },
  detailsDescLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2
  },
  detailsDescText: {
    fontSize: 12,
    color: '#1e293b'
  },
  fullscreenImgOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10
  },
  fullscreenCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20
  },
  fullscreenCloseText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13
  },
  fullscreenImage: {
    width: '100%',
    height: '75%'
  },
  fullscreenOpenInBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#ea580c',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10
  },
  fullscreenOpenInBrowserText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  limitSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  limitSelectItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c'
  },
  limitOptionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  limitSelectText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155'
  },
  limitSelectTextActive: {
    color: '#ea580c',
    fontWeight: '800'
  },
  defaultBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b'
  }
});
