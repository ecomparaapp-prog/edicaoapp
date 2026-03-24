import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { fetchNearbyMissions, type NearbyMission } from "./missionService";

const isExpoGo = Constants.appOwnership === "expo";

async function getNotifications() {
  if (isExpoGo || Platform.OS === "web") return null;
  return import("expo-notifications");
}

export const GEOFENCE_TASK = "ECOMPARA_GEOFENCE_CHECK";
export const LOCATION_TASK = "ECOMPARA_BACKGROUND_LOCATION";

const GEOFENCE_RADIUS_KM = 0.3;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 7;
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between notifications per store

let lastNotifiedStore: Record<string, number> = {};

function isNightMode(): boolean {
  const hour = new Date().getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync("missions", {
    name: "Missões Relâmpago",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#CC0000",
    sound: "default",
  });
}

export async function configurePushHandler() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowList: true,
    }),
  });
}

function buildMissionNotification(mission: NearbyMission) {
  const xp = mission.xpMultiplier >= 2 ? "X2 de Pontos (40 XP)" : "+20 XP";
  const count = mission.totalNeedy;
  return {
    title: `📍 Você está perto d${/^[aeiou]/i.test(mission.name) ? "a" : "o"} ${mission.name}!`,
    body: `Ajude a vizinhança: valide ${Math.min(count, 3)} preços carentes e ganhe ${xp} agora!`,
    data: {
      screen: "missions",
      placeId: mission.googlePlaceId,
      placeName: mission.name,
    },
    sound: "default",
  };
}

export async function checkGeofenceAndNotify(
  lat: number,
  lng: number,
): Promise<NearbyMission[]> {
  if (isNightMode()) return [];

  const missions = await fetchNearbyMissions(lat, lng, GEOFENCE_RADIUS_KM);
  if (!missions.length) return missions;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return missions;

  const now = Date.now();
  const urgentMission = missions.find(
    (m) =>
      !lastNotifiedStore[m.googlePlaceId] ||
      now - lastNotifiedStore[m.googlePlaceId] > NOTIFICATION_COOLDOWN_MS,
  );

  if (urgentMission) {
    const Notifications = await getNotifications();
    if (Notifications) {
      const notif = buildMissionNotification(urgentMission);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          data: notif.data,
          sound: "default",
          ...(Platform.OS === "android" ? { channelId: "missions" } : {}),
        },
        trigger: null,
      });
    }
    lastNotifiedStore[urgentMission.googlePlaceId] = now;
  }

  return missions;
}

// ── Background location task ──────────────────────────────────────────────────
// Define the task so it's available globally (must be at module level)
if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(
    LOCATION_TASK,
    async ({
      data,
      error,
    }: {
      data?: { locations?: Location.LocationObject[] };
      error?: any;
    }) => {
      if (error || !data?.locations?.length) return;
      const location = data.locations[data.locations.length - 1];
      await checkGeofenceAndNotify(
        location.coords.latitude,
        location.coords.longitude,
      );
    },
  );
}

export async function startBackgroundGeofencing(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") return false;

    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!alreadyRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000, // check every 5 min
        distanceInterval: 150, // or every 150m moved
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: "eCompara",
          notificationBody: "Monitorando missões próximas…",
          notificationColor: "#CC0000",
        },
        pausesUpdatesAutomatically: true,
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundGeofencing() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {}
}
