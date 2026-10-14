import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Linking,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav } from '../../components';
import api, { resolveFileUrl } from '../../services/api';
import { downloadAndShareRemoteFile } from '../../utils/fileExport';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isImageFile = (filename, url) => {
  const target = (filename || url || '').toLowerCase().split('?')[0];
  return (
    target.endsWith('.jpg') ||
    target.endsWith('.jpeg') ||
    target.endsWith('.png') ||
    target.endsWith('.webp') ||
    target.endsWith('.gif') ||
    target.endsWith('.bmp') ||
    target.endsWith('.heic')
  );
};

export default function CitizenTrackComplaintScreen({
  navigation,
  activeTab = 'track',
  onTabPress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [complaintResult, setComplaintResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [previewPhotoName, setPreviewPhotoName] = useState('');
  const [openingDocId, setOpeningDocId] = useState(null);

  const handleOpenDocument = async (doc, idx) => {
    const rawUrl = doc.url || doc.uri;
    if (!rawUrl) {
      Alert.alert('File Unavailable', 'Attachment link is missing or broken.');
      return;
    }
    const resolvedUri = resolveFileUrl(rawUrl);

    if (isImageFile(doc.filename, rawUrl)) {
      setPreviewPhotoName(doc.filename || `Photo-${idx + 1}`);
      setPreviewPhotoUrl(resolvedUri);
      return;
    }

    const filename = doc.filename || `Document-${idx + 1}.pdf`;
    setOpeningDocId(idx);
    try {
      await downloadAndShareRemoteFile(resolvedUri, filename);
    } catch (err) {
      try {
        await Linking.openURL(resolvedUri);
      } catch (linkErr) {
        Alert.alert('Error', `Could not open document: ${linkErr.message || 'Please check network connection.'}`);
      }
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleSearch = async () => {
    if (!trackingNumber.trim()) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.get(`/complaints/track/${trackingNumber.trim().toUpperCase()}`);
      if (data) {
        const stepNum =
          data.status === 'RESOLVED' || data.status === 'CLOSED'
            ? 4
            : data.status === 'IN_PROGRESS' || data.status === 'ON_HOLD'
            ? 3
            : data.status === 'ASSIGNED'
            ? 2
            : 1;

        setComplaintResult({
          id: data.complaintNumber || trackingNumber.trim().toUpperCase(),
          date: data.complaintDate || data.createdAt ? new Date(data.complaintDate || data.createdAt).toLocaleDateString() : 'Recent',
          citizenName: data.citizenName || 'Citizen',
          mobile: data.mobileNumber || data.mobile || 'N/A',
          location: data.address || data.landmark || 'Pune',
          ward: typeof data.ward === 'object' ? (data.ward?.name || 'N/A') : (data.ward || 'N/A'),
          department: typeof data.department === 'object' ? (data.department?.name || data.department?.title || 'Municipal Works') : (data.department || 'Municipal Works'),
          priority: typeof data.priority === 'object' ? (data.priority?.name || 'Medium') : (data.priority || 'Medium'),
          status: typeof data.status === 'object' ? (data.status?.name || 'IN_PROGRESS') : (data.status || 'IN_PROGRESS'),
          description: typeof data.description === 'object' ? data.description?.name : (data.description || data.subject || 'No description provided'),
          assignedOfficer: Array.isArray(data.officers) && data.officers.length > 0
            ? (typeof data.officers[0] === 'object' ? data.officers[0].name : data.officers[0])
            : (typeof data.assignedOfficer === 'object' ? data.assignedOfficer?.name : (data.assignedOfficer || 'PMC Assigned Team')),
          expectedResolution: data.slaDeadline ? new Date(data.slaDeadline).toLocaleString() : 'Within 48 Hours',
          currentStep: stepNum,
          attachments: Array.isArray(data.attachments) ? data.attachments : []
        });
        setSearched(true);
      }
    } catch (err) {
      console.warn('Track API error:', err.message);
      setErrorMsg(err.message || 'No grievance record found with this token.');
      setSearched(true);
      setComplaintResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
        return { label: 'Resolved', bg: '#ecfdf5', fg: '#059669', dot: '#10b981' };
      case 'IN_PROGRESS':
        return { label: 'In Progress', bg: '#fffbeb', fg: '#d97706', dot: '#f59e0b' };
      case 'OPEN':
        return { label: 'Open', bg: '#eff6ff', fg: '#2563eb', dot: '#3b82f6' };
      default:
        return { label: status, bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header */}
      <MainHeader
        title="Grievance Portal"
        subtitle="Citizen Tracking Desk"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Scrollable Body */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.screenTitle}>Track Grievance</Text>
          <Text style={styles.screenSubtitle}>Search your token ID for live resolution progress</Text>
        </View>

        {/* Search Box Card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchCardLabel}>Enter Complaint / Token Number:</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.tokenInput}
              placeholder="e.g. OKT-2026-0001"
              placeholderTextColor="#94a3b8"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              activeOpacity={0.8}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.searchBtnText}>Track 🔎</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Alert */}
        {errorMsg ? (
          <View style={styles.errorAlertCard}>
            <Text style={styles.errorAlertEmoji}>❌</Text>
            <View style={styles.errorAlertTextCol}>
              <Text style={styles.errorAlertTitle}>Grievance Not Found</Text>
              <Text style={styles.errorAlertSub}>{errorMsg}</Text>
            </View>
          </View>
        ) : null}

        {/* Search Result */}
        {searched && complaintResult && (
          <View style={styles.resultCard}>
            {/* Header */}
            <View style={styles.resultHeaderRow}>
              <View>
                <Text style={styles.resultIdText}>{complaintResult.id}</Text>
                <Text style={styles.resultDateText}>Logged on {complaintResult.date}</Text>
              </View>

              {(() => {
                const sb = getStatusBadge(complaintResult.status);
                return (
                  <View style={[styles.statusBadgePill, { backgroundColor: sb.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: sb.dot }]} />
                    <Text style={[styles.statusBadgeText, { color: sb.fg }]}>{sb.label}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Department Tag */}
            <View style={styles.deptTag}>
              <Text style={styles.deptTagText}>🏛️ {typeof complaintResult.department === 'object' ? (complaintResult.department?.name || 'Municipal Works') : complaintResult.department}</Text>
            </View>

            {/* Issue Description */}
            <Text style={styles.issueText}>{complaintResult.description}</Text>

            {/* Meta Grid */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Citizen:</Text>
                <Text style={styles.metaValue}>{complaintResult.citizenName}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Location:</Text>
                <Text style={styles.metaValue}>{complaintResult.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Assigned Officer:</Text>
                <Text style={[styles.metaValue, { color: '#0f172a', fontWeight: '700' }]}>
                  {complaintResult.assignedOfficer}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Target Resolution:</Text>
                <Text style={[styles.metaValue, { color: '#ea580c', fontWeight: '700' }]}>
                  {complaintResult.expectedResolution}
                </Text>
              </View>
            </View>

            {/* Resolution Progress Steps */}
            <Text style={styles.progressHeading}>Resolution Progress</Text>
            <View style={styles.trackerStepper}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Text style={styles.stepTick}>✓</Text>
                </View>
                <Text style={styles.stepLabelDone}>Received</Text>
              </View>
              <View style={[styles.stepBar, styles.stepBarDone]} />

              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Text style={styles.stepTick}>✓</Text>
                </View>
                <Text style={styles.stepLabelDone}>Assigned</Text>
              </View>
              <View
                style={[
                  styles.stepBar,
                  complaintResult.currentStep >= 3 && styles.stepBarDone
                ]}
              />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    complaintResult.currentStep >= 3 && styles.stepDotActive
                  ]}
                >
                  <Text style={styles.stepTickActive}>3</Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    complaintResult.currentStep >= 3 && styles.stepLabelActive
                  ]}
                >
                  Action In Field
                </Text>
              </View>
              <View
                style={[
                  styles.stepBar,
                  complaintResult.currentStep >= 4 && styles.stepBarDone
                ]}
              />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    complaintResult.currentStep >= 4 && styles.stepDotDone
                  ]}
                >
                  <Text style={styles.stepTick}>4</Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    complaintResult.currentStep >= 4 && styles.stepLabelDone
                  ]}
                >
                  Resolved
                </Text>
              </View>
            </View>

            {/* Uploaded Photos & Documents Section */}
            {complaintResult.attachments && complaintResult.attachments.length > 0 ? (
              <View style={styles.attachmentsSection}>
                <Text style={styles.attachmentsSectionTitle}>Attached Photos & Documents</Text>
                
                {/* Photos */}
                {complaintResult.attachments.filter(a => a.type === 'COMPLAINT_PHOTO' || a.type === 'PHOTO' || isImageFile(a.filename, a.url)).length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.attachmentSubLabel}>COMPLAINT PHOTOS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {complaintResult.attachments
                        .filter(a => a.type === 'COMPLAINT_PHOTO' || a.type === 'PHOTO' || isImageFile(a.filename, a.url))
                        .map((photo, idx) => {
                          const resolvedUri = resolveFileUrl(photo.url);
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                setPreviewPhotoName(photo.filename || `Photo-${idx + 1}`);
                                setPreviewPhotoUrl(resolvedUri);
                              }}
                              style={styles.photoThumbWrap}
                            >
                              <Image source={{ uri: resolvedUri }} style={styles.photoThumb} resizeMode="cover" />
                              <View style={styles.photoZoomBadge}>
                                <Ionicons name="expand" size={10} color="#ffffff" />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                )}

                {/* Documents */}
                {complaintResult.attachments.filter(a => a.type === 'COMPLAINT_DOCUMENT' || a.type === 'DOCUMENT' || (!isImageFile(a.filename, a.url) && a.type !== 'COMPLETION_PHOTO')).length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={styles.attachmentSubLabel}>DOCUMENTS & FILES</Text>
                    {complaintResult.attachments
                      .filter(a => a.type === 'COMPLAINT_DOCUMENT' || a.type === 'DOCUMENT' || (!isImageFile(a.filename, a.url) && a.type !== 'COMPLETION_PHOTO'))
                      .map((doc, idx) => {
                        const isImg = isImageFile(doc.filename, doc.url);
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={styles.docItemRow}
                            activeOpacity={0.7}
                            onPress={() => handleOpenDocument(doc, idx)}
                            disabled={openingDocId === idx}
                          >
                            <Ionicons name={isImg ? "image-outline" : "document-text-outline"} size={16} color="#ea580c" style={{ marginRight: 8 }} />
                            <Text style={styles.docItemName} numberOfLines={1}>{doc.filename || `Document-${idx + 1}`}</Text>
                            <View style={styles.docActionBadge}>
                              {openingDocId === idx ? (
                                <ActivityIndicator size="small" color="#ea580c" />
                              ) : (
                                <>
                                  <Ionicons name={isImg ? "eye-outline" : "download-outline"} size={12} color="#475569" style={{ marginRight: 3 }} />
                                  <Text style={styles.docActionText}>{isImg ? 'View' : 'Download 📥'}</Text>
                                </>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                )}

                {/* Completion Photos */}
                {complaintResult.attachments.filter(a => a.type === 'COMPLETION_PHOTO').length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.attachmentSubLabel, { color: '#059669' }]}>RESOLUTION PROOF PHOTOS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {complaintResult.attachments
                        .filter(a => a.type === 'COMPLETION_PHOTO')
                        .map((photo, idx) => {
                          const resolvedUri = resolveFileUrl(photo.url);
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                setPreviewPhotoName(photo.filename || `Resolution-Proof-${idx + 1}`);
                                setPreviewPhotoUrl(resolvedUri);
                              }}
                              style={[styles.photoThumbWrap, { borderColor: '#10b981' }]}
                            >
                              <Image source={{ uri: resolvedUri }} style={styles.photoThumb} resizeMode="cover" />
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Photo Preview Modal */}
      {previewPhotoUrl ? (
        <Modal
          visible={!!previewPhotoUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhotoUrl(null)}
        >
          <View style={styles.photoModalOverlay}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle} numberOfLines={1}>{previewPhotoName || 'Photo Preview'}</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.photoHeaderIconBtn}
                  onPress={() => Linking.openURL(previewPhotoUrl).catch(() => {})}
                >
                  <Ionicons name="globe-outline" size={18} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoCloseBtn}
                  onPress={() => setPreviewPhotoUrl(null)}
                >
                  <Ionicons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.photoContainer}>
              <ScrollView
                style={{ width: '100%', height: '100%' }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
              >
                <Image source={{ uri: previewPhotoUrl }} style={styles.fullScreenPhoto} resizeMode="contain" />
              </ScrollView>
            </View>
            <View style={styles.photoModalFooter}>
              <TouchableOpacity
                style={styles.photoModalActionBtn}
                onPress={() => downloadAndShareRemoteFile(previewPhotoUrl, previewPhotoName)}
              >
                <Ionicons name="download-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.photoModalActionText}>Download to Device 📥</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 3. Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
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
    paddingBottom: 120 // 👈 Generous clearance above persistent BottomNav bar
  },
  titleSection: {
    marginBottom: 16
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
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16
  },
  searchCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  tokenInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  searchBtn: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  quickTokensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  quickTokensLabel: {
    fontSize: 11,
    color: '#64748b'
  },
  quickTokenChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  quickTokenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  resultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  resultIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f97316'
  },
  resultDateText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  deptTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  deptTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c'
  },
  issueText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 14
  },
  metaGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 16
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metaLabel: {
    fontSize: 11.5,
    color: '#64748b'
  },
  metaValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0f172a'
  },
  progressHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 12
  },
  trackerStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4
  },
  stepItem: {
    alignItems: 'center',
    width: 60
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  stepDotDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  stepDotActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316'
  },
  stepTick: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  stepTickActive: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  stepBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginTop: -16
  },
  stepBarDone: {
    backgroundColor: '#10b981'
  },
  stepLabel: {
    fontSize: 9.5,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '600'
  },
  stepLabelDone: {
    fontSize: 9.5,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '700'
  },
  stepLabelActive: {
    color: '#f97316',
    fontWeight: '800'
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  errorAlertEmoji: {
    fontSize: 22,
    marginRight: 10
  },
  errorAlertTextCol: {
    flex: 1
  },
  errorAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991b1b'
  },
  errorAlertSub: {
    fontSize: 11.5,
    color: '#b91c1c',
    marginTop: 2
  },

  /* Attachments Section */
  attachmentsSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  attachmentsSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.2
  },
  attachmentSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.3
  },
  photoThumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative'
  },
  photoThumb: {
    width: '100%',
    height: '100%'
  },
  photoZoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 4,
    padding: 2
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  docItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1
  },
  docActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  docActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },

  /* Photo Modal */
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 28) + 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 16
  },
  photoModalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    paddingBottom: 8
  },
  photoModalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10
  },
  photoHeaderIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoContainer: {
    width: SCREEN_WIDTH * 0.94,
    height: SCREEN_HEIGHT * 0.72,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullScreenPhoto: {
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_HEIGHT * 0.68
  },
  photoModalFooter: {
    width: '100%',
    alignItems: 'center'
  },
  photoModalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20
  },
  photoModalActionText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  }
});
