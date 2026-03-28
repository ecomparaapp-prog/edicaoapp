import { Alert } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/context/AppContext";

export function useRequireAuth() {
  const { user, isLoggedIn } = useApp();

  function requireAuth(action: () => void) {
    if (!isLoggedIn || !user) {
      Alert.alert(
        "Login necessário",
        "Para realizar esta ação, você precisa estar logado.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Fazer Login",
            style: "default",
            onPress: () => router.push("/(auth)/login"),
          },
        ],
      );
      return;
    }
    action();
  }

  return { user, isLoggedIn: !!user, requireAuth };
}
