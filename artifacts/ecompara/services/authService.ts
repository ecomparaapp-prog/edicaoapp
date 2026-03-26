import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth for Expo Go
//
// To activate Google login, add these secrets in Replit:
//   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID  — Android OAuth Client ID (from Google Cloud Console)
//   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS      — iOS OAuth Client ID
//   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB      — Web OAuth Client ID
//
// In Google Cloud Console:
//   1. Create a project at https://console.cloud.google.com
//   2. Enable "Google Sign-In" (Identity → OAuth consent screen)
//   3. Create OAuth 2.0 credentials for Android, iOS, and Web
//   4. For Expo Go, use the package name: host.exp.exponent
//      and SHA-1 fingerprint from: expo fetch:android:hashes
//
// Once the env vars are set, replace the mock login in (auth)/login.tsx
// with: const result = await signInWithGoogle("customer") or ("retailer")
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_IDS = {
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ?? "",
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? "",
  web: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? "",
};

export function isGoogleAuthConfigured(): boolean {
  if (Platform.OS === "android") return !!GOOGLE_CLIENT_IDS.android;
  if (Platform.OS === "ios") return !!GOOGLE_CLIENT_IDS.ios;
  return !!GOOGLE_CLIENT_IDS.web;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  photo: string | null;
}

export interface GoogleAuthResult {
  ok: boolean;
  user?: GoogleUser;
  error?: string;
}

/**
 * Sign in with Google using the Expo auth proxy.
 * Works in Expo Go without a standalone build.
 *
 * @param role   "customer" | "retailer" — determines which scope/redirect is used
 */
export async function signInWithGoogle(role: "customer" | "retailer"): Promise<GoogleAuthResult> {
  if (!isGoogleAuthConfigured()) {
    return {
      ok: false,
      error: "Google OAuth não configurado. Adicione os Client IDs nas variáveis de ambiente.",
    };
  }

  // Dynamic import to avoid crashing when expo-auth-session is not installed
  try {
    const AuthSession = await import("expo-auth-session");
    const Google = await import("expo-auth-session/providers/google");

    const [_request, response, promptAsync] = Google.useAuthRequest({
      androidClientId: GOOGLE_CLIENT_IDS.android,
      iosClientId: GOOGLE_CLIENT_IDS.ios,
      webClientId: GOOGLE_CLIENT_IDS.web,
    });

    const result = await promptAsync();

    if (result?.type === "success" && result.authentication?.accessToken) {
      const userRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${result.authentication.accessToken}` },
      });

      if (!userRes.ok) {
        return { ok: false, error: "Falha ao obter dados do Google." };
      }

      const data = await userRes.json() as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };

      return {
        ok: true,
        user: {
          id: `g_${data.id}`,
          email: data.email,
          name: data.name,
          photo: data.picture ?? null,
        },
      };
    }

    if (result?.type === "cancel" || result?.type === "dismiss") {
      return { ok: false, error: "Login cancelado." };
    }

    return { ok: false, error: "Falha no login com Google." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: `Erro ao iniciar Google Auth: ${message}` };
  }
}
