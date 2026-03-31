import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { configurePushHandler, setupNotificationChannel } from "@/services/geofenceService";

const isExpoGo = Constants.appOwnership === "expo";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="product/[ean]" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="store/[id]" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="scanner" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="retailer-scanner" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="missions/[placeId]" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="merchant-register" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="register-price" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="settings/location" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="settings/privacy" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="settings/notifications" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="settings/help" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="settings/profile-edit" options={{ presentation: "card", headerShown: false }} />
      <Stack.Screen name="portal-supermercado" options={{ presentation: "card", headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const responseListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (isExpoGo) return;

    configurePushHandler();
    setupNotificationChannel();

    import("expo-notifications").then((Notifications) => {
      responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as {
            screen?: string;
            placeId?: string;
            placeName?: string;
          };
          if (data?.screen === "missions" && data?.placeId) {
            router.push({
              pathname: "/missions/[placeId]",
              params: { placeId: data.placeId, placeName: data.placeName ?? "Loja", xpMultiplier: "2" },
            });
          }
        },
      );
    });

    return () => {
      responseListenerRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AppProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AppProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
