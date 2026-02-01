import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    buttonText: "#000000",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#E8BA30",
    link: "#E8BA30",
    gold: "#E8BA30",
    goldEnd: "#DA840B",
    backgroundRoot: "#000000",
    backgroundDefault: "#1A1A1A",
    backgroundSecondary: "#2A2A2A",
    backgroundTertiary: "#353535",
    success: "#10B981",
    warning: "#E8BA30",
    error: "#EF4444",
    border: "#333333",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    buttonText: "#000000",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#E8BA30",
    link: "#E8BA30",
    gold: "#E8BA30",
    goldEnd: "#DA840B",
    backgroundRoot: "#000000",
    backgroundDefault: "#1A1A1A",
    backgroundSecondary: "#2A2A2A",
    backgroundTertiary: "#353535",
    success: "#10B981",
    warning: "#E8BA30",
    error: "#EF4444",
    border: "#333333",
  },
};

export const GradientColors = {
  gold: ["#E8BA30", "#DA840B"] as const,
  goldReverse: ["#DA840B", "#E8BA30"] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
  miniPlayerHeight: 72,
  artworkSm: 48,
  artworkMd: 64,
  artworkLg: 120,
  artworkXl: 280,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
    fontFamily: "GoogleSansFlex",
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    fontFamily: "GoogleSansFlex",
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    fontFamily: "GoogleSansFlex",
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
    fontFamily: "GoogleSansFlex",
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
    fontFamily: "GoogleSansFlex",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: "GoogleSansFlex",
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    fontFamily: "GoogleSansFlex",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    fontFamily: "GoogleSansFlex",
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
    fontFamily: "GoogleSansFlex",
  },
};

export const Fonts = {
  sans: "GoogleSansFlex",
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};

export const Shadows = {
  player: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
};
