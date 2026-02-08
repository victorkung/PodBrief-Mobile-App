import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import Slider from "@react-native-community/slider";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius, GradientColors } from "@/constants/theme";

const WEEKS_PER_MONTH = 4;
const PODBRIEF_COST = 19;
const SUMMARY_DURATION = 7.5;

const FREE_FEATURES = [
  "Unlimited podcast listening",
  "Follow unlimited shows",
  "Build your episode library",
  "5 AI summaries included",
];

const PRO_FEATURES = [
  "Full episode transcription",
  "AI-generated summary for reading",
  "AI-narrated summary for listening",
  "Download audio for offline listening",
  "Translation to 10+ languages",
  "Ability to share with friends at no cost",
];

const FAQ_ITEMS = [
  {
    question: "What's included with each credit?",
    answer:
      "One credit gives you the ability to generate a brief for a single podcast episode. Each brief comes with a full podcast transcription, a written AI-generated summary, and a premium AI-narration of your summary to listen to. Translations to 10+ languages are supported.",
  },
  {
    question: "Do credits roll over?",
    answer:
      "Credits from your monthly Pro subscription do not roll over each billing cycle. Make the most of your 30 credits each month!",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can cancel your Pro subscription at any time. You'll always have access to your existing transcriptions and summaries.",
  },
  {
    question: "What podcasts are supported?",
    answer:
      "PodBrief works with virtually any podcast available on major platforms. Simply search for your favorite show and we'll find it for you. If you cannot find your show for whatever reason, let us know and we'll make sure to add it to our library.",
  },
  {
    question: "How long does it take to generate a summary?",
    answer:
      "Most summaries are generated within 2-5 minutes, depending on the length of the episode. You'll receive a notification when your summary is ready.",
  },
  {
    question: "Can I listen offline?",
    answer:
      "Yes, you can download the audio for full episodes and summaries for offline listening. Perfect for commutes or when you're away from WiFi.",
  },
];

export default function PricingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { profile, refreshProfile } = useAuth();

  const isPro = profile?.plan === "pro";

  const [podcastLength, setPodcastLength] = useState(60);
  const [podcastsPerWeek, setPodcastsPerWeek] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(30);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const timeSavedPerPodcast = podcastLength - SUMMARY_DURATION;
  const totalMinutesSaved =
    timeSavedPerPodcast * podcastsPerWeek * WEEKS_PER_MONTH;
  const hoursSaved = totalMinutesSaved / 60;
  const grossValue = Math.round(hoursSaved * hourlyRate);
  const netSavings = Math.max(0, Math.round(grossValue - PODBRIEF_COST));
  const roiMultiplier = Math.round(grossValue / PODBRIEF_COST);

  const handleUpgrade = useCallback(async () => {
    setIsCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-checkout",
        {
          body: { source: "mobile" },
        }
      );
      if (error) throw error;
      await WebBrowser.openBrowserAsync(data.url);
      await refreshProfile();
    } catch (error) {
      console.error("Error creating checkout:", error);
      Alert.alert("Error", "Unable to open checkout. Please try again.");
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [refreshProfile]);

  const toggleFaq = useCallback(
    (index: number) => {
      setExpandedFaq(expandedFaq === index ? null : index);
    },
    [expandedFaq]
  );

  const renderFeature = (feature: string, index: number) => (
    <View key={index} style={styles.featureRow}>
      <Feather name="check" size={14} color={theme.gold} />
      <ThemedText type="caption" style={styles.featureText}>
        {feature}
      </ThemedText>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        {isPro ? (
          <>
            <ThemedText type="h1" style={styles.headerTitle}>
              <Text>{"Your "}</Text>
              <Text style={{ color: theme.gold }}>{"Plan"}</Text>
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            >
              {"You're on the Pro plan with " +
                (profile?.credits || 0) +
                " credits remaining."}
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="h1" style={styles.headerTitle}>
              <Text>{"Complete Your "}</Text>
              <Text style={{ color: theme.gold }}>{"Upgrade"}</Text>
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            >
              {
                "You're one step away from saving hours every week with AI-powered summaries."
              }
            </ThemedText>
          </>
        )}
      </View>

      <View style={styles.planCardsContainer}>
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <ThemedText
            type="caption"
            style={[styles.planLabel, { color: theme.textSecondary }]}
          >
            FREE
          </ThemedText>
          <ThemedText type="h2" style={styles.planPrice}>
            $0
          </ThemedText>
          <ThemedText
            type="caption"
            style={[styles.planSubtitle, { color: theme.textSecondary }]}
          >
            For casual podcast listeners
          </ThemedText>
          <View style={styles.featuresContainer}>
            {FREE_FEATURES.map(renderFeature)}
          </View>
        </View>

        <View
          style={[
            styles.planCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.gold + "4D",
              borderWidth: 1,
            },
          ]}
        >
          <View
            style={[styles.popularBadge, { backgroundColor: theme.gold }]}
          >
            <ThemedText
              type="caption"
              style={{ color: theme.buttonText, fontWeight: "700" }}
            >
              Most Popular
            </ThemedText>
          </View>
          <ThemedText
            type="caption"
            style={[styles.planLabel, { color: theme.gold }]}
          >
            PRO
          </ThemedText>
          <View style={styles.proPriceRow}>
            <ThemedText type="h2" style={styles.planPrice}>
              $19
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
            >
              /month
            </ThemedText>
          </View>
          <ThemedText
            type="caption"
            style={[styles.planSubtitle, { color: theme.textSecondary }]}
          >
            For podcast enthusiasts who value their time
          </ThemedText>
          <ThemedText
            type="caption"
            style={[styles.creditInfo, { color: theme.text }]}
          >
            <Text style={{ fontWeight: "700" }}>{"30 credits per month. "}</Text>
            <Text>
              {"1 credit = 1 AI generated brief, which includes:"}
            </Text>
          </ThemedText>
          <View style={styles.featuresContainer}>
            {PRO_FEATURES.map(renderFeature)}
          </View>
        </View>
      </View>

      <View style={styles.ctaSection}>
        {isPro ? (
          <View
            style={[
              styles.disabledButton,
              { backgroundColor: theme.backgroundTertiary },
            ]}
          >
            <ThemedText
              type="body"
              style={[styles.ctaText, { color: theme.textTertiary }]}
            >
              {"You're on Pro!"}
            </ThemedText>
          </View>
        ) : (
          <>
            <Pressable
              onPress={handleUpgrade}
              disabled={isCheckoutLoading}
              testID="button-upgrade-now"
            >
              <LinearGradient
                colors={GradientColors.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <ThemedText
                  type="body"
                  style={[styles.ctaText, { color: theme.buttonText }]}
                >
                  Upgrade Now
                </ThemedText>
              </LinearGradient>
            </Pressable>
            <ThemedText
              type="caption"
              style={[styles.cancelText, { color: theme.textSecondary }]}
            >
              Cancel anytime.
            </ThemedText>
          </>
        )}
      </View>

      <View style={styles.roiSection}>
        <ThemedText type="h2" style={styles.roiTitle}>
          <Text>{"See How Much Time You'll "}</Text>
          <Text style={{ color: theme.gold }}>{"Save"}</Text>
          <Text>{" With Our AI Audio Summaries"}</Text>
        </ThemedText>

        <View
          style={[
            styles.sliderCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.sliderItem}>
            <View style={styles.sliderLabelRow}>
              <ThemedText type="small" style={{ color: theme.text }}>
                Average podcast length
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.gold, fontWeight: "600" }}
              >
                {podcastLength + " min"}
              </ThemedText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={15}
              maximumValue={180}
              step={5}
              value={podcastLength}
              onValueChange={setPodcastLength}
              minimumTrackTintColor={theme.gold}
              maximumTrackTintColor={theme.backgroundTertiary}
              thumbTintColor={theme.gold}
            />
            <View style={styles.sliderMinMax}>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                15 min
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                180 min
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderItem}>
            <View style={styles.sliderLabelRow}>
              <ThemedText type="small" style={{ color: theme.text }}>
                Podcasts per week
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.gold, fontWeight: "600" }}
              >
                {String(podcastsPerWeek)}
              </ThemedText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={20}
              step={1}
              value={podcastsPerWeek}
              onValueChange={setPodcastsPerWeek}
              minimumTrackTintColor={theme.gold}
              maximumTrackTintColor={theme.backgroundTertiary}
              thumbTintColor={theme.gold}
            />
            <View style={styles.sliderMinMax}>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                1
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                20
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderItem}>
            <View style={styles.sliderLabelRow}>
              <ThemedText type="small" style={{ color: theme.text }}>
                Value of your time
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.gold, fontWeight: "600" }}
              >
                {"$" + hourlyRate + "/hr"}
              </ThemedText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={10}
              maximumValue={200}
              step={5}
              value={hourlyRate}
              onValueChange={setHourlyRate}
              minimumTrackTintColor={theme.gold}
              maximumTrackTintColor={theme.backgroundTertiary}
              thumbTintColor={theme.gold}
            />
            <View style={styles.sliderMinMax}>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                $10/hr
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                $200/hr
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderItem}>
            <View style={styles.sliderLabelRow}>
              <ThemedText type="small" style={{ color: theme.text }}>
                Average summary length
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.gold, fontWeight: "600" }}
              >
                7.5 min
              </ThemedText>
            </View>
            <ThemedText
              type="caption"
              style={[
                styles.staticSubtitle,
                { color: theme.textTertiary },
              ]}
            >
              Based on our average AI summary duration
            </ThemedText>
          </View>
        </View>

        <View style={styles.resultsRow}>
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <ThemedText
              type="h1"
              style={[styles.resultNumber, { color: theme.text }]}
            >
              {hoursSaved.toFixed(1)}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              hours saved/month
            </ThemedText>
          </View>
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <ThemedText
              type="h1"
              style={[styles.resultNumber, { color: theme.text }]}
            >
              {"$" + grossValue}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              value of time
            </ThemedText>
          </View>
        </View>

        <View style={styles.savingsBreakdown}>
          <View style={styles.savingsRow}>
            <ThemedText type="small" style={{ color: theme.text }}>
              PodBrief Pro
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.text }}>
              - $19/month
            </ThemedText>
          </View>
          <ThemedText
            type="h1"
            style={[styles.netSavingsNumber, { color: theme.gold }]}
          >
            {"$" + netSavings}
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.netSavingsLabel, { color: theme.textSecondary }]}
          >
            your net savings per month
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.roiText, { color: theme.textSecondary }]}
          >
            <Text>{"That's a "}</Text>
            <Text style={{ color: theme.gold, fontWeight: "700" }}>
              {roiMultiplier + "x"}
            </Text>
            <Text>{" return on investment"}</Text>
          </ThemedText>
        </View>
      </View>

      {isPro ? null : (
        <View style={styles.bottomCtaSection}>
          <Pressable
            onPress={handleUpgrade}
            disabled={isCheckoutLoading}
            testID="button-start-saving"
          >
            <LinearGradient
              colors={GradientColors.gold}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <ThemedText
                type="body"
                style={[styles.ctaText, { color: theme.buttonText }]}
              >
                Start Saving Time Today
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <View style={styles.faqSection}>
        <ThemedText type="h2" style={styles.faqTitle}>
          Frequently Asked Questions
        </ThemedText>
        <View
          style={[
            styles.faqContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              borderRadius: BorderRadius.md,
            },
          ]}
        >
          {FAQ_ITEMS.map((item, index) => (
            <View key={index}>
              {index > 0 ? (
                <View
                  style={[
                    styles.faqDivider,
                    { backgroundColor: theme.border },
                  ]}
                />
              ) : null}
              <Pressable
                onPress={() => toggleFaq(index)}
                style={styles.faqQuestion}
                testID={"button-faq-" + index}
              >
                <ThemedText
                  type="small"
                  style={[styles.faqQuestionText, { color: theme.text }]}
                >
                  {item.question}
                </ThemedText>
                <Feather
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
              {expandedFaq === index ? (
                <View style={styles.faqAnswer}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {item.answer}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    marginBottom: Spacing["2xl"],
  },
  headerTitle: {
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    marginTop: Spacing.xs,
  },
  planCardsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  planCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    zIndex: 1,
  },
  planLabel: {
    fontWeight: "700",
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  planPrice: {
    marginBottom: Spacing.xs,
  },
  proPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.xs,
  },
  planSubtitle: {
    marginBottom: Spacing.md,
  },
  creditInfo: {
    marginBottom: Spacing.md,
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  ctaSection: {
    marginBottom: Spacing["5xl"],
  },
  gradientButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  disabledButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  ctaText: {
    fontWeight: "600",
    fontFamily: "GoogleSansFlex",
  },
  cancelText: {
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  roiSection: {
    marginBottom: Spacing["5xl"],
  },
  roiTitle: {
    marginBottom: Spacing.xl,
  },
  sliderCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sliderItem: {
    marginBottom: Spacing.xl,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderMinMax: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -Spacing.xs,
  },
  staticSubtitle: {
    marginTop: Spacing.xs,
  },
  resultsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resultCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
  },
  resultNumber: {
    marginBottom: Spacing.xs,
  },
  savingsBreakdown: {
    alignItems: "center",
  },
  savingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: Spacing.md,
  },
  netSavingsNumber: {
    fontSize: 40,
    lineHeight: 48,
    marginBottom: Spacing.xs,
  },
  netSavingsLabel: {
    marginBottom: Spacing.sm,
  },
  roiText: {
    textAlign: "center",
  },
  bottomCtaSection: {
    marginBottom: Spacing["5xl"],
  },
  faqSection: {
    marginBottom: Spacing.xl,
  },
  faqTitle: {
    marginBottom: Spacing.lg,
  },
  faqContainer: {
    overflow: "hidden",
  },
  faqDivider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  faqQuestionText: {
    flex: 1,
    fontWeight: "500",
  },
  faqAnswer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: 0,
  },
});
