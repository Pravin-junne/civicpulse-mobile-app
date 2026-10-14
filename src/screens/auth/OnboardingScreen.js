import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Top Brand Emblem Component
const PortalBrandHeader = () => (
  <View style={styles.brandHeader}>
    <View style={styles.brandIconBadge}>
      <Ionicons name="business" size={18} color="#f97316" />
    </View>
    <Text style={styles.brandTitle}>
      <Text style={styles.brandTitleBold}>Office of Kunal Tilak</Text> Portal
    </Text>
    <Text style={styles.brandSubtitle}>Politician Portal</Text>
  </View>
);

const ONBOARDING_SLIDES = [
  {
    id: '1',
    stepNumber: 1,
    title: 'Report civic issues instantly',
    description:
      'File grievances, attach photos, and track resolution progress across roads, drainage, water supply, and waste management.',
    image: require('../../../assets/onboarding/slide1_civic.png'),
    imageOffset: -140
  },
  {
    id: '2',
    stepNumber: 2,
    title: 'Live Proximity Telemetry',
    description:
      'Track the exact location of dispatched field officers and commissioners on interactive maps as they resolve alerts.',
    image: require('../../../assets/onboarding/slide2_telemetry.png'),
    imageOffset: -135
  },
  {
    id: '3',
    stepNumber: 3,
    title: 'Events & Civic Budgets',
    description:
      'Stay updated on local municipal planning, community budgets, townhalls, and social initiatives.',
    image: require('../../../assets/onboarding/slide3_budgets.png'),
    imageOffset: -140
  }
];

export default function OnboardingScreen({ onFinish = () => {} }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleNext = async () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      await authService.setOnboardingCompleted();
      onFinish();
    }
  };

  const handleSkip = async () => {
    await authService.setOnboardingCompleted();
    onFinish();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  /**
   * Stepper Indicator (1 ── 2 ── 3)
   */
  const renderStepper = () => {
    const step = currentIndex + 1;
    return (
      <View style={styles.stepperContainer}>
        {/* Step 1 */}
        <View style={[styles.stepCircle, styles.stepCircleActive]}>
          <Text style={styles.stepCircleTextActive}>1</Text>
        </View>

        {/* Line 1-2 */}
        <View
          style={[
            styles.stepLine,
            step >= 2 ? styles.stepLineActive : styles.stepLineInactive
          ]}
        />

        {/* Step 2 */}
        <View
          style={[
            styles.stepCircle,
            step >= 2 ? styles.stepCircleActive : styles.stepCircleInactive
          ]}
        >
          <Text
            style={
              step >= 2
                ? styles.stepCircleTextActive
                : styles.stepCircleTextInactive
            }
          >
            2
          </Text>
        </View>

        {/* Line 2-3 */}
        <View
          style={[
            styles.stepLine,
            step >= 3 ? styles.stepLineActive : styles.stepLineInactive
          ]}
        />

        {/* Step 3 */}
        <View
          style={[
            styles.stepCircle,
            step >= 3 ? styles.stepCircleActive : styles.stepCircleInactive
          ]}
        >
          <Text
            style={
              step >= 3
                ? styles.stepCircleTextActive
                : styles.stepCircleTextInactive
            }
          >
            3
          </Text>
        </View>
      </View>
    );
  };

  const renderSlide = ({ item }) => {
    const illusHeight = Math.min(SCREEN_HEIGHT * 0.36, 290);
    return (
      <View style={[styles.slideWrap, { width: SCREEN_WIDTH }]}>
        {/* Illustration Canvas */}
        <View style={[styles.illustrationBox, { height: illusHeight }]}>
          <Image
            source={item.image}
            style={[styles.illustrationImage, { marginTop: item.imageOffset }]}
            resizeMode="contain"
          />
        </View>

        {/* Content Section */}
        <View style={styles.contentWrap}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Fixed Brand Header */}
      <PortalBrandHeader />

      {/* Swipeable Carousel */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        style={styles.carouselList}
      />

      {/* Stepper Indicator */}
      {renderStepper()}

      {/* Bottom Action Buttons */}
      <View style={styles.footerActions}>
        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.85}
          onPress={handleNext}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          activeOpacity={0.7}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>
            {currentIndex === 2 ? 'Skip to Sign In' : 'Skip'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  brandHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4
  },
  brandIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  brandTitle: {
    fontSize: 16.5,
    color: '#334155',
    fontWeight: '400',
    letterSpacing: -0.2
  },
  brandTitleBold: {
    fontWeight: '800',
    color: '#0f172a'
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2
  },
  carouselList: {
    flex: 1
  },
  slideWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  illustrationBox: {
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  illustrationImage: {
    width: SCREEN_WIDTH * 0.95,
    height: 844
  },
  contentWrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 8
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 10
  },
  slideDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 320
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    gap: 8
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepCircleActive: {
    backgroundColor: '#f97316'
  },
  stepCircleInactive: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0'
  },
  stepCircleTextActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff'
  },
  stepCircleTextInactive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b'
  },
  stepLine: {
    width: 32,
    height: 3.5,
    borderRadius: 2
  },
  stepLineActive: {
    backgroundColor: '#f97316'
  },
  stepLineInactive: {
    backgroundColor: '#e2e8f0'
  },
  footerActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center'
  },
  continueButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#f97316',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 4
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b'
  }
});
