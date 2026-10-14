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
  Modal,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainHeader, BottomNav } from '../../components';

/**
 * Equalizer / Filter Sliders Vector Icon
 */
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

/**
 * Search Magnifier Vector Icon
 */
const SearchIcon = () => (
  <View style={styles.searchIconBox}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

/**
 * Heart Vector Icon
 */
const HeartIcon = () => (
  <View style={styles.heartIconBox}>
    <View style={[styles.heartLobe, styles.heartLeftLobe]} />
    <View style={[styles.heartLobe, styles.heartRightLobe]} />
    <View style={styles.heartPoint} />
  </View>
);

/**
 * Comment Bubble Vector Icon
 */
const CommentIcon = () => (
  <View style={styles.commentIconBox}>
    <View style={styles.commentBubble} />
    <View style={styles.commentTail} />
  </View>
);

/**
 * Share / Upload Vector Icon
 */
const ShareIcon = () => (
  <View style={styles.shareIconBox}>
    <View style={styles.shareArrow} />
    <View style={styles.shareStem} />
    <View style={styles.shareTray} />
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
 * User Profile Avatar Placeholder
 */
const ProfileAvatar = () => (
  <View style={styles.avatarCircle}>
    <View style={styles.avatarHead} />
    <View style={styles.avatarShoulders} />
  </View>
);

export default function SocialMediaScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddPostPress,
  onViewPostDetails,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New post form modal state
  const [newCaption, setNewCaption] = useState('');
  const [newPlatform, setNewPlatform] = useState('INSTAGRAM');
  const [newImageUri, setNewImageUri] = useState('');

  // Social Feed Posts
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: 'Instagram Official IG',
      date: '6/13/2026',
      platform: 'INSTAGRAM',
      badgeBg: '#fce7f3',
      badgeColor: '#db2777',
      image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
      caption: "Healthy living isn't about strict diets. It's about making better choices every day. 🌱 #pune #gardencity #cleanpune",
      likes: 140,
      comments: 3,
      shares: 35,
      reach: '1.9K',
      isVideo: true
    },
    {
      id: 2,
      author: 'Instagram Official IG',
      date: '6/25/2026',
      platform: 'INSTAGRAM',
      badgeBg: '#fce7f3',
      badgeColor: '#db2777',
      image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=800&q=80',
      caption: 'The taste that takes you back home. Every spoonful of pure traditional grains brings the warmth and love.',
      likes: 108,
      comments: 0,
      shares: 27,
      reach: '1.5K',
      isVideo: true
    },
    {
      id: 3,
      author: 'Office of Kunal Tilak (Official)',
      date: '7/02/2026',
      platform: 'FACEBOOK',
      badgeBg: '#eff6ff',
      badgeColor: '#2563eb',
      image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      caption: 'Inspected Ward 12 drainage renovation and resolved resident waterlogging complaints on priority. #PuneDevelopment',
      likes: 312,
      comments: 18,
      shares: 64,
      reach: '5.2K',
      isVideo: false
    }
  ]);

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleFilterPress = () => {
    Alert.alert(
      'Filter Social Feed',
      'Select network feed to display',
      [
        { text: 'All Feeds', onPress: () => setSelectedFilter('ALL') },
        { text: 'Instagram Only', onPress: () => setSelectedFilter('INSTAGRAM') },
        { text: 'Facebook Only', onPress: () => setSelectedFilter('FACEBOOK') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handlePostDetails = (post) => {
    if (onViewPostDetails) {
      onViewPostDetails(post);
    } else {
      Alert.alert(
        post.author,
        `Platform: ${post.platform}\nDate: ${post.date}\nReach: ${post.reach}\nLikes: ${post.likes} | Comments: ${post.comments} | Shares: ${post.shares}\n\nCaption: ${post.caption}`,
        [
          { text: 'View on ' + post.platform, onPress: () => console.log('Open external link') },
          { text: 'Close', style: 'cancel' }
        ]
      );
    }
  };

  const handleCreatePost = () => {
    if (!newCaption.trim()) {
      Alert.alert('Validation Error', 'Please enter a post caption or update text.');
      return;
    }

    const createdPost = {
      id: Date.now(),
      author: newPlatform === 'INSTAGRAM' ? 'Instagram Official IG' : 'Office of Kunal Tilak',
      date: new Date().toLocaleDateString('en-US'),
      platform: newPlatform,
      badgeBg: newPlatform === 'INSTAGRAM' ? '#fce7f3' : '#eff6ff',
      badgeColor: newPlatform === 'INSTAGRAM' ? '#db2777' : '#2563eb',
      image: newImageUri.trim() || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      caption: newCaption.trim(),
      likes: 0,
      comments: 0,
      shares: 0,
      reach: '0.1K',
      isVideo: true
    };

    setPosts([createdPost, ...posts]);
    setNewCaption('');
    setNewImageUri('');
    setShowCreateModal(false);
    Alert.alert('Published!', 'New social media interaction posted successfully.');
  };

  // Filtered posts by search query & filter
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      selectedFilter === 'ALL' || post.platform === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Header Bar with Emblem, Portal Branding, Notification Bell, and Officer Avatar */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Main Scrollable Container */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
        }
      >
        {/* Screen Title & Live Connection Status Badge */}
        <View style={styles.titleSection}>
          <Text style={styles.screenTitle}>Social Interactions</Text>
          <View style={styles.statusBadgeRow}>
            <View style={styles.livePill}>
              <View style={styles.liveGreenDot} />
              <Text style={styles.livePillText}>Meta Live connected</Text>
            </View>
          </View>
        </View>

        {/* 2 Summary Metric Cards (Engagement & Total Reach) */}
        <View style={styles.metricsRow}>
          {/* Card 1: Engagement */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Engagement</Text>
            <Text style={styles.metricValueNavy}>774</Text>
          </View>

          {/* Card 2: Total Reach */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Reach</Text>
            <Text style={styles.metricValueBlue}>8,661</Text>
          </View>
        </View>

        {/* Search Posts Bar with Filter Sliders */}
        <View style={styles.searchBarContainer}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.slidersButton}
            activeOpacity={0.7}
            onPress={handleFilterPress}
          >
            <SlidersIcon />
          </TouchableOpacity>
        </View>

        {/* Section Heading: Recent Citizen Feed */}
        <Text style={styles.sectionHeading}>Recent Citizen Feed</Text>

        {/* Feed Posts List */}
        <View style={styles.feedList}>
          {filteredPosts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              {/* Card Header: Avatar, Name, Date & Platform Badge */}
              <View style={styles.postHeader}>
                <View style={styles.authorRow}>
                  <ProfileAvatar />
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{post.author}</Text>
                    <Text style={styles.postDate}>{post.date}</Text>
                  </View>
                </View>

                {/* Platform Badge */}
                <View style={[styles.platformBadge, { backgroundColor: post.badgeBg }]}>
                  <Text style={[styles.platformBadgeText, { color: post.badgeColor }]}>
                    {post.platform}
                  </Text>
                </View>
              </View>

              {/* Media Container with Thumbnail & Centered Play Icon */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.mediaContainer}
                onPress={() => handlePostDetails(post)}
              >
                <Image
                  source={{ uri: post.image }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
                {post.isVideo && <PlayButtonOverlay />}
              </TouchableOpacity>

              {/* Caption Text */}
              <Text style={styles.captionText}>{post.caption}</Text>

              {/* Engagement Stats Row (Likes, Comments, Shares) */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <HeartIcon />
                  <Text style={styles.statCount}>{post.likes}</Text>
                </View>

                <View style={styles.statItem}>
                  <CommentIcon />
                  <Text style={styles.statCount}>{post.comments}</Text>
                </View>

                <View style={styles.statItem}>
                  <ShareIcon />
                  <Text style={styles.statCount}>{post.shares}</Text>
                </View>
              </View>

              {/* Bottom Reach & View Details Row */}
              <View style={styles.cardFooterRow}>
                <Text style={styles.reachText}>Reach: {post.reach}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handlePostDetails(post)}
                  style={styles.viewDetailsBtn}
                >
                  <Text style={styles.viewDetailsText}>View Details →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredPosts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No posts found</Text>
              <Text style={styles.emptySubtitle}>Try changing your search query or filters</Text>
            </View>
          )}
        </View>

        {/* Bottom Spacer for FAB and Bottom Nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 3. Floating Action Button (FAB) with Plus Symbol in Teal Bottom Circle */}
      <TouchableOpacity
        style={styles.fabButton}
        activeOpacity={0.85}
        onPress={() => {
          if (onAddPostPress) onAddPostPress();
          else setShowCreateModal(true);
        }}
      >
        <Text style={styles.fabPlusSymbol}>+</Text>
      </TouchableOpacity>

      {/* 4. Create Post Modal Form */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Social Post</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Target Platform</Text>
            <View style={styles.platformSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.platformOption,
                  newPlatform === 'INSTAGRAM' && styles.platformOptionActive
                ]}
                onPress={() => setNewPlatform('INSTAGRAM')}
              >
                <Text
                  style={[
                    styles.platformOptionText,
                    newPlatform === 'INSTAGRAM' && styles.platformOptionTextActive
                  ]}
                >
                  Instagram
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.platformOption,
                  newPlatform === 'FACEBOOK' && styles.platformOptionActive
                ]}
                onPress={() => setNewPlatform('FACEBOOK')}
              >
                <Text
                  style={[
                    styles.platformOptionText,
                    newPlatform === 'FACEBOOK' && styles.platformOptionTextActive
                  ]}
                >
                  Facebook
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Post Caption / Update</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="Write announcement or citizen engagement message..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={newCaption}
              onChangeText={setNewCaption}
            />

            <Text style={styles.formLabel}>Media Image / Video URL</Text>
            <TextInput
              style={styles.formInput}
              placeholder="https://... (Leave blank for default media)"
              placeholderTextColor="#94a3b8"
              value={newImageUri}
              onChangeText={setNewImageUri}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreatePost}
              >
                <Text style={styles.modalSubmitText}>Publish Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Persistent Bottom Navigation */}
      <BottomNav
        activeTab={activeTab || internalTab}
        onTabPress={handleTabPress}
      />
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
    paddingBottom: 120, // 👈 Generous clearance above persistent BottomNav bar
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  /* Title & Status Badge */
  titleSection: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccfbf1', // soft mint/teal background
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    gap: 6,
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0d9488', // Teal/Green dot
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },

  /* Metrics Summary Cards */
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  metricLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  metricValueNavy: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  metricValueBlue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563eb', // Vibrant Blue
    letterSpacing: -0.3,
  },

  /* Search Bar */
  searchBarContainer: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0f172a',
    marginLeft: 10,
    marginRight: 6,
  },
  slidersButton: {
    padding: 4,
  },

  /* Search Icon */
  searchIconBox: {
    width: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: '#64748b',
  },
  searchHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 5.5,
    height: 1.5,
    backgroundColor: '#64748b',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },

  /* Sliders Equalizer Icon */
  slidersIconBox: {
    width: 18,
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
    width: 1.5,
    height: '100%',
    backgroundColor: '#475569',
    borderRadius: 1,
  },
  sliderKnob: {
    position: 'absolute',
    width: 4.5,
    height: 3,
    backgroundColor: '#475569',
    borderRadius: 1,
  },

  /* Section Heading */
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 14,
  },

  /* Feed Posts */
  feedList: {
    gap: 16,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  postDate: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  platformBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* Avatar */
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarHead: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ffffff',
    marginBottom: 2,
  },
  avatarShoulders: {
    width: 18,
    height: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#ffffff',
  },

  /* Media */
  mediaContainer: {
    width: '100%',
    height: 195,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
    paddingLeft: 3, // nudge for triangle center
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

  /* Caption */
  captionText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 12,
  },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statCount: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Heart Icon */
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

  /* Comment Icon */
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

  /* Share Icon */
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

  /* Card Footer Row */
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reachText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  viewDetailsBtn: {
    paddingVertical: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488', // Teal link
  },

  /* Floating Action Button (Teal Circle with Plus Symbol) */
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0d9488', // Teal matching the screenshot
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 30,
    zIndex: 999,
  },
  fabPlusSymbol: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 34,
    textAlign: 'center',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94a3b8',
    padding: 4,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  platformSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  platformOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  platformOptionActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  platformOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  platformOptionTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },
  formInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 14,
  },
  formTextArea: {
    height: 85,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
