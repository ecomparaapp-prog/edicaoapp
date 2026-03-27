import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth for Expo Go
//
// To activate Google login:
//   1. Install the dependency: pnpm --filter @workspace/ecompara add expo-auth-session expo-crypto
//   2. Add these secrets in Replit:
//        EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID  — Android OAuth Client ID
//        EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS      — iOS OAuth Client ID
//        EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB      — Web OAuth Client ID
//   3. Replace handleLogin in (auth)/login.tsx with:
//        const { promptAsync } = useGoogleSignIn("customer", async (result) => {
//          if (result.ok && result.user) { await setUser({ ...result.user, role: "customer", ... }); }
//        });
//        <Button onPress={() => promptAsync?.()} title="Continuar com Google" />
//
// IMPORTANT: useGoogleSignIn is a React hook — it MUST be called at the top
// level of a component, never inside a callback or async function.
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
 * React hook for Google Sign-In using expo-auth-session.
 *
 * Must be called at the top level of a React component (not inside a callback
 * or async function). Returns null when Google is not configured or the
 * expo-auth-session package is not installed.
 *
 * @param role       "customer" | "retailer"
 * @param onResult   Called with the auth result after the sign-in flow completes
 *
 * @example
 *   const auth = useGoogleSignIn("customer", (r) => r.ok && setUser(r.user!));
 *   <Pressable onPress={() => auth?.promptAsync()}>Login</Pressable>
 */
export function useGoogleSignIn(
  role: "customer" | "retailer",
  onResult: (result: GoogleAuthResult) => void,
): { promptAsync: () => void; loading: boolean } | null {
  if (!isGoogleAuthConfigured()) return null;

  // expo-auth-session must be installed for this hook to work.
  // Returning null here avoids a crash when the package is absent.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Google = require("expo-auth-session/providers/google") as {
      useAuthRequest: (config: {
        androidClientId: string;
        iosClientId: string;
        webClientId: string;
      }) => [unknown, { type?: string; authentication?: { accessToken: string } } | null, () => Promise<{ type?: string; authentication?: { accessToken: string } | null }>];
    };

    const { useEffect, useState } = require("react") as typeof import("react");

    const [_request, response, promptAsyncInternal] = Google.useAuthRequest({
      androidClientId: GOOGLE_CLIENT_IDS.android,
      iosClientId: GOOGLE_CLIENT_IDS.ios,
      webClientId: GOOGLE_CLIENT_IDS.web,
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!response) return;

      const handleResponse = async () => {
        setLoading(true);
        try {
          if (response.type === "success" && response.authentication?.accessToken) {
            const userRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
              headers: { Authorization: `Bearer ${response.authentication.accessToken}` },
            });

            if (!userRes.ok) {
              onResult({ ok: false, error: "Falha ao obter dados do Google." });
              return;
            }

            const data = await userRes.json() as {
              id: string;
              email: string;
              name: string;
              picture?: string;
            };

            onResult({
              ok: true,
              user: {
                id: `g_${data.id}`,
                email: data.email,
                name: data.name,
                photo: data.picture ?? null,
              },
            });
          } else if (response.type === "cancel" || response.type === "dismiss") {
            onResult({ ok: false, error: "Login cancelado." });
          } else {
            onResult({ ok: false, error: "Falha no login com Google." });
          }
        } finally {
          setLoading(false);
        }
      };

      void handleResponse();
    }, [response]);

    return {
      promptAsync: () => { void promptAsyncInternal(); },
      loading,
    };
  } catch {
    return null;
  }
}
