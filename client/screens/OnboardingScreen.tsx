import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, GradientColors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BACKGROUND_COLOR = "#0D1117";

interface OnboardingScreenProps {
  onComplete: () => void;
  onLogin: () => void;
}

interface SlideData {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  titleHighlight?: string;
  subtitle: string;
  features?: string[];
  showIllustration?: boolean;
  stat?: {
    value: string;
    label: string;
    subValue?: string;
    subLabel?: string;
    badge?: string;
  };
}

const SLIDES: SlideData[] = [
  {
    id: "welcome",
    icon: "headphones",
    title: "Listen to Podcasts.",
    titleHighlight: "Or Their Summaries.",
    subtitle:
      "PodBrief is an intuitive podcast player that allows you to listen to full episodes or AI-narrated summaries of any podcast.",
    features: [
      "Stream millions of episodes",
      "AI summaries in 10+ languages",
      "Download for offline listening",
    ],
  },
  {
    id: "player",
    icon: "play-circle",
    title: "Free Podcast Player",
    titleHighlight: "Listen to any podcast, anytime.",
    subtitle:
      "Listen to your favorite podcasts using our beautiful, intuitive audio player designed for the modern listener.",
    features: [
      "Stream from your favorite shows",
      "Follow shows and build your feed",
      "Save episodes to listen later",
    ],
  },
  {
    id: "summaries",
    icon: "zap",
    title: "AI Podcast Player",
    titleHighlight: "Stop Losing Hours to Long-Form Audio.",
    subtitle:
      "Turn lengthy podcasts into 5-minute summaries that you can read or listen to in your preferred language. Perfect for busy professionals.",
    features: [
      "Turn episodes into 5-minute summaries",
      "Read or listen to AI summaries on the go",
      "Summaries available in 10+ languages",
    ],
  },
  {
    id: "offline",
    icon: "download-cloud",
    title: "Listen Anywhere.",
    titleHighlight: "Even Offline.",
    subtitle:
      "Download full episodes and summaries for offline listening. Perfect for commutes, flights, and areas with poor connectivity.",
    showIllustration: true,
  },
];

export default function OnboardingScreen({
  onComplete,
  onLogin,
}: OnboardingScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== currentPage && page >= 0 && page < SLIDES.length) {
      setCurrentPage(page);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const goToPage = (page: number) => {
    scrollViewRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
  };

  const handleGetStarted = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onComplete();
  };

  const handleLogin = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onLogin();
  };

  const isLastPage = currentPage === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}>
      <LinearGradient
        colors={["rgba(232, 186, 48, 0.08)", "transparent"]}
        style={styles.topGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Pressable onPress={handleLogin} style={styles.loginButton}>
          <ThemedText style={styles.loginText}>Log In</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={[styles.page, { width: SCREEN_WIDTH }]}>
            <SlideContent slide={slide} theme={theme} />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              currentPage={currentPage}
              onPress={() => goToPage(index)}
            />
          ))}
        </View>

        <Button
          onPress={isLastPage ? handleGetStarted : () => goToPage(currentPage + 1)}
          variant="primary"
          style={styles.ctaButton}
        >
          {isLastPage ? "Start Listening Free" : "Next"}
        </Button>

        <ThemedText style={styles.freeBriefsText}>
          5 free AI summaries included. No credit card required.
        </ThemedText>
      </View>
    </View>
  );
}

function SlideContent({
  slide,
  theme,
}: {
  slide: SlideData;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={styles.slideContent}>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={GradientColors.gold}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name={slide.icon} size={32} color="#000" />
        </LinearGradient>
      </View>

      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>
          {slide.title}
          {slide.titleHighlight ? (
            <ThemedText style={styles.titleHighlight}>
              {"\n"}
              {slide.titleHighlight}
            </ThemedText>
          ) : null}
        </ThemedText>

        <ThemedText style={styles.subtitle}>{slide.subtitle}</ThemedText>

        {slide.features ? (
          <View style={styles.featuresContainer}>
            {slide.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Feather name="check" size={14} color="#E8BA30" />
                </View>
                <ThemedText style={styles.featureText}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {slide.stat ? (
          <View style={styles.statContainer}>
            <LinearGradient
              colors={["rgba(232, 186, 48, 0.15)", "rgba(218, 132, 11, 0.08)"]}
              style={styles.statCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statRow}>
                <View style={styles.statBlock}>
                  <ThemedText style={styles.statValue}>{slide.stat.value}</ThemedText>
                  <ThemedText style={styles.statLabel}>{slide.stat.label}</ThemedText>
                </View>
                {slide.stat.subValue ? (
                  <View style={styles.statBlock}>
                    <ThemedText style={styles.statValue}>{slide.stat.subValue}</ThemedText>
                    <ThemedText style={styles.statLabel}>{slide.stat.subLabel}</ThemedText>
                  </View>
                ) : null}
              </View>
              {slide.stat.badge ? (
                <View style={styles.badgeContainer}>
                  <LinearGradient
                    colors={GradientColors.gold}
                    style={styles.badge}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <ThemedText style={styles.badgeText}>{slide.stat.badge}</ThemedText>
                  </LinearGradient>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        ) : null}

        {slide.showIllustration ? (
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationRow}>
              <View style={styles.illustrationItem}>
                <LinearGradient
                  colors={["rgba(232, 186, 48, 0.2)", "rgba(218, 132, 11, 0.1)"]}
                  style={styles.illustrationIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather name="smartphone" size={24} color="#E8BA30" />
                </LinearGradient>
                <ThemedText style={styles.illustrationLabel}>Phone</ThemedText>
              </View>
              <View style={styles.illustrationConnector}>
                <Feather name="arrow-right" size={20} color="#E8BA30" />
              </View>
              <View style={styles.illustrationItem}>
                <LinearGradient
                  colors={["rgba(232, 186, 48, 0.2)", "rgba(218, 132, 11, 0.1)"]}
                  style={styles.illustrationIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather name="headphones" size={24} color="#E8BA30" />
                </LinearGradient>
                <ThemedText style={styles.illustrationLabel}>Listen</ThemedText>
              </View>
              <View style={styles.illustrationConnector}>
                <Feather name="arrow-right" size={20} color="#E8BA30" />
              </View>
              <View style={styles.illustrationItem}>
                <LinearGradient
                  colors={["rgba(232, 186, 48, 0.2)", "rgba(218, 132, 11, 0.1)"]}
                  style={styles.illustrationIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather name="wifi-off" size={24} color="#E8BA30" />
                </LinearGradient>
                <ThemedText style={styles.illustrationLabel}>Anywhere</ThemedText>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PaginationDot({
  index,
  currentPage,
  onPress,
}: {
  index: number;
  currentPage: number;
  onPress: () => void;
}) {
  const isActive = index === currentPage;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(isActive ? 24 : 8),
      opacity: withSpring(isActive ? 1 : 0.4),
    };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          styles.dot,
          animatedStyle,
          isActive && styles.dotActive,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    zIndex: 10,
  },
  logo: {
    width: 140,
    height: 40,
  },
  loginButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  loginText: {
    color: "#E8BA30",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    justifyContent: "center",
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing["3xl"],
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 36,
  },
  titleHighlight: {
    color: "#E8BA30",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.sm,
  },
  featuresContainer: {
    width: "100%",
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(232, 186, 48, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 15,
    color: "#FFFFFF",
    flex: 1,
  },
  statContainer: {
    width: "100%",
    marginTop: Spacing.md,
  },
  statCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(232, 186, 48, 0.2)",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBlock: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#E8BA30",
  },
  statLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: Spacing.xs,
  },
  badgeContainer: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  badge: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8BA30",
  },
  dotActive: {
    backgroundColor: "#E8BA30",
  },
  ctaButton: {
    width: "100%",
  },
  freeBriefsText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  illustrationContainer: {
    width: "100%",
    marginTop: Spacing.xl,
    alignItems: "center",
  },
  illustrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  illustrationItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  illustrationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(232, 186, 48, 0.3)",
  },
  illustrationLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  illustrationConnector: {
    opacity: 0.6,
  },
});
