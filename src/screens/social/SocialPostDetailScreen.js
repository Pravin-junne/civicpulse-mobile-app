import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainHeader } from '../../components';

/**
 * User Profile Silhouette Avatar
 */
const UserAvatar = ({ size = 34 }) => (
  <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.avatarHead, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
    <View style={[styles.avatarShoulders, { width: size * 0.58, height: size * 0.3, borderTopLeftRadius: size * 0.29, borderTopRightRadius: size * 0.29 }]} />
  </View>
);

/**
 * Official Seal / Emblem Avatar for Team Response
 */
const OfficialEmblemAvatar = () => (
  <View style={styles.officialEmblemBox}>
    <View style={styles.emblemOuterRing}>
      <View style={styles.emblemSpoke1} />
      <View style={styles.emblemSpoke2} />
      <View style={styles.emblemCenterDot} />
    </View>
  </View>
);

/**
 * Video Play Button Overlay
 */
const PlayButtonOverlay = () => (
  <View style={styles.playOverlay}>
    <View style={styles.playTriangle} />
  </View>
);

/**
 * Vector Heart Icon
 */
const HeartIcon = () => (
  <View style={styles.heartIconBox}>
    <View style={[styles.heartLobe, styles.heartLeftLobe]} />
    <View style={[styles.heartLobe, styles.heartRightLobe]} />
    <View style={styles.heartPoint} />
  </View>
);

/**
 * Vector Comment Bubble Icon
 */
const CommentIcon = () => (
  <View style={styles.commentIconBox}>
    <View style={styles.commentBubble} />
    <View style={styles.commentTail} />
  </View>
);

/**
 * Vector Share / Upload Icon
 */
const ShareIcon = () => (
  <View style={styles.shareIconBox}>
    <View style={styles.shareArrow} />
    <View style={styles.shareStem} />
    <View style={styles.shareTray} />
  </View>
);

export default function SocialPostDetailScreen({
  navigation,
  onBack,
  postData,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [replyText, setReplyText] = useState('');
  const [likesCount, setLikesCount] = useState(140);
  const [hasLiked, setHasLiked] = useState(false);

  // Discussion threads state
  const [comments, setComments] = useState([
    {
      id: 1,
      author: 'Dr. Amit Patil',
      time: '2 hours ago',
      text: 'Composting guidelines are really easy to follow! Already started implementing it in my apartment society at Ward 4. Excellent initiative. 🌱',
      officialReply: {
        author: 'Official Team Response',
        time: '1 hour ago',
        text: 'Thank you Dr. Amit Patil for the prompt adoption! Let us know if your society needs dedicated bins or informational pamphlets.'
      }
    },
    {
      id: 2,
      author: 'Sujata Deshmukh',
      time: '4 hours ago',
      text: "Is there an organic waste pick-up schedule for Ward 4? Couldn't find it on the main portal.",
      officialReply: null
    }
  ]);

  const handleToggleLike = () => {
    if (hasLiked) {
      setLikesCount((prev) => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount((prev) => prev + 1);
      setHasLiked(true);
    }
  };

  const handlePostOfficialResponse = () => {
    if (!replyText.trim()) {
      Alert.alert('Response Required', 'Please enter your response text before posting.');
      return;
    }

    const newCommentEntry = {
      id: Date.now(),
      author: 'Official Team Response',
      time: 'Just now',
      text: replyText.trim(),
      isOfficial: true,
      officialReply: null
    };

    setComments((prev) => [...prev, newCommentEntry]);
    setReplyText('');
    Alert.alert('Response Published', 'Your official response has been added to the citizen discussion.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Portal Main Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
        unreadCount={unreadCount}
        onBack={onBack}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Screen Title & Meta Live Connected Pill */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Social Interactions</Text>
              {onBack && (
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Feed</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.statusBadgeRow}>
              <View style={styles.livePill}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.livePillText}>Meta Live connected</Text>
              </View>
            </View>
          </View>

          {/* 3. Main Social Post & Discussion Card */}
          <View style={styles.mainCard}>
            {/* Post Header */}
            <View style={styles.postHeader}>
              <View style={styles.authorRow}>
                <UserAvatar size={38} />
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>Instagram Official IG</Text>
                  <Text style={styles.postDate}>6/13/2026, 6:21:27 PM</Text>
                </View>
              </View>

              {/* Instagram Badge */}
              <View style={styles.instagramBadge}>
                <Text style={styles.instagramBadgeText}>INSTAGRAM</Text>
              </View>
            </View>

            {/* Post Caption */}
            <Text style={styles.captionText}>
              Healthy living isn't about strict diets. It's about making better choices every day. 🌱 #pune #gardencity #cleanpune
            </Text>

            {/* Media Image Container with Center Play Overlay */}
            <View style={styles.mediaContainer}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80'
                }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
              <PlayButtonOverlay />
            </View>

            {/* Engagement Stats Row */}
            <View style={styles.engagementRow}>
              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.7}
                onPress={handleToggleLike}
              >
                <HeartIcon />
                <Text style={[styles.statLabel, hasLiked && styles.statLabelActive]}>
                  {likesCount} Likes
                </Text>
              </TouchableOpacity>

              <View style={styles.statItem}>
                <CommentIcon />
                <Text style={styles.statLabel}>
                  {comments.length + 1} Comments
                </Text>
              </View>

              <View style={styles.statItem}>
                <ShareIcon />
                <Text style={styles.statLabel}>35 Shares</Text>
              </View>
            </View>

            {/* Thin Divider */}
            <View style={styles.sectionDivider} />

            {/* Comments & Citizen Discussion Heading */}
            <Text style={styles.commentsHeading}>Comments & Citizen Discussion</Text>

            {/* Comments Thread List */}
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentBlock}>
                  {/* Citizen / Comment Author Row */}
                  <View style={styles.commentHeader}>
                    {comment.isOfficial ? (
                      <OfficialEmblemAvatar />
                    ) : (
                      <UserAvatar size={32} />
                    )}
                    <View style={styles.commentAuthorDetails}>
                      <Text style={styles.commentAuthorName}>{comment.author}</Text>
                      <Text style={styles.commentTime}>{comment.time}</Text>
                    </View>
                  </View>

                  {/* Comment Body */}
                  <Text style={styles.commentText}>{comment.text}</Text>

                  {/* Nested Official Team Response */}
                  {comment.officialReply && (
                    <View style={styles.officialReplyWrapper}>
                      <View style={styles.threadLine} />
                      <View style={styles.officialReplyBox}>
                        <View style={styles.commentHeader}>
                          <OfficialEmblemAvatar />
                          <View style={styles.commentAuthorDetails}>
                            <Text style={styles.officialAuthorName}>
                              {comment.officialReply.author}
                            </Text>
                            <Text style={styles.commentTime}>
                              {comment.officialReply.time}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.commentText}>
                          {comment.officialReply.text}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* 4. Bottom Response Box: "Add official response" */}
          <View style={styles.responseBox}>
            <Text style={styles.responseBoxTitle}>Add official response</Text>
            
            <TextInput
              style={styles.responseInput}
              placeholder="Write an official statement or citizen guidance..."
              placeholderTextColor="#94a3b8"
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />

            <View style={styles.responseBottomRow}>
              <OfficialEmblemAvatar />
              <TouchableOpacity
                style={styles.postButton}
                activeOpacity={0.8}
                onPress={handlePostOfficialResponse}
              >
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60, // 👈 Generous clearance for bottom response box & actions
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Title Section */
  titleSection: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0d9488',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    gap: 6,
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0d9488',
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },

  /* Main Card */
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 16,
  },

  /* Post Header */
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorInfo: {
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  postDate: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  instagramBadge: {
    backgroundColor: '#fce7f3',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  instagramBadgeText: {
    color: '#db2777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* Post Caption */
  captionText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 12,
  },

  /* Media Container */
  mediaContainer: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 0,
    borderBottomWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: '#ffffff',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },

  /* Engagement Stats Row */
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  statLabelActive: {
    color: '#ef4444',
  },

  /* Divider */
  sectionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },

  /* Comments Heading */
  commentsHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 14,
  },

  /* Comments Thread */
  commentsList: {
    gap: 16,
  },
  commentBlock: {
    gap: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  commentAuthorDetails: {
    justifyContent: 'center',
  },
  commentAuthorName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  officialAuthorName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  commentTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    fontWeight: '400',
    paddingLeft: 42,
  },

  /* Nested Official Reply */
  officialReplyWrapper: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 16,
  },
  threadLine: {
    width: 2,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
    borderRadius: 1,
  },
  officialReplyBox: {
    flex: 1,
    gap: 6,
  },

  /* Official Emblem Icon */
  officialEmblemBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b', // Dark Navy
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  emblemOuterRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemSpoke1: {
    position: 'absolute',
    width: 1.2,
    height: 14,
    backgroundColor: '#38bdf8',
  },
  emblemSpoke2: {
    position: 'absolute',
    width: 14,
    height: 1.2,
    backgroundColor: '#38bdf8',
  },
  emblemCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
  },

  /* User Avatar Icon */
  avatarCircle: {
    backgroundColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  avatarHead: {
    backgroundColor: '#ffffff',
    marginBottom: 2,
  },
  avatarShoulders: {
    backgroundColor: '#ffffff',
  },

  /* Icons */
  heartIconBox: {
    width: 14,
    height: 13,
    position: 'relative',
  },
  heartLobe: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  heartLeftLobe: {
    top: 0,
    left: 0,
  },
  heartRightLobe: {
    top: 0,
    right: 0,
  },
  heartPoint: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    width: 10,
    height: 8,
    backgroundColor: '#ef4444',
    transform: [{ rotate: '45deg' }],
  },
  commentIconBox: {
    width: 14,
    height: 13,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentBubble: {
    width: 13,
    height: 10,
    borderRadius: 3.5,
    borderWidth: 1.4,
    borderColor: '#3b82f6',
  },
  commentTail: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    width: 3,
    height: 3,
    borderLeftWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: '#3b82f6',
    transform: [{ rotate: '45deg' }],
  },
  shareIconBox: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shareArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0d9488',
    marginBottom: -1,
  },
  shareStem: {
    width: 1.6,
    height: 5,
    backgroundColor: '#0d9488',
    marginBottom: 1,
  },
  shareTray: {
    width: 11,
    height: 4,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: '#0d9488',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  /* 4. Bottom Response Box */
  responseBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  responseBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  responseInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 40,
    marginBottom: 10,
  },
  responseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  officerAvatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  postButton: {
    backgroundColor: '#0d9488', // Teal
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  postButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
