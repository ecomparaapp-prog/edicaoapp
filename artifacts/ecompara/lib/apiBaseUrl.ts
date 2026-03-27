import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Returns the base API URL appropriate for the current platform and environment.
 * Used by all service modules to avoid duplication.
 */
export function getApiBaseUrl(): string {
  const domain =
    Constants.expoConfig?.extra?.domain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "";

  if (Platform.OS === "web") return "/api";
  if (domain) return `https://${domain}/api`;
  return "http://localhost:80/api";
}
