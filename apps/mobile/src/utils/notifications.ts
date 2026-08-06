import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Fixed the Promise return type error by adding shouldShowBanner and shouldShowList
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleWeddingReminders(weddingDateString: string) {
  try {
    // 2. Cast to any to bypass compiler issues resolving properties from extended PermissionResponse
    const permissionResponse = (await Notifications.getPermissionsAsync()) as any;
    let granted = permissionResponse.granted;

    if (!granted) {
      const askResponse = (await Notifications.requestPermissionsAsync()) as any;
      granted = askResponse.granted;
    }

    if (!granted) {
      console.log('Notification permissions denied by user.');
      return;
    }

    // Clear any old scheduled reminders to prevent double-ups
    await Notifications.cancelAllScheduledNotificationsAsync();

    const weddingDate = new Date(weddingDateString);
    const now = new Date();

    // Calculate days remaining
    const timeDiff = weddingDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysLeft <= 0) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // --- MILESTONE 1: 1 Month Before ---
    // 3. Fixed: Use Notifications.SchedulableTriggerInputTypes.DATE enum member and skip if past
    if (daysLeft > 30) {
      const oneMonthBefore = new Date(weddingDate);
      oneMonthBefore.setDate(oneMonthBefore.getDate() - 30);
      oneMonthBefore.setHours(10, 0, 0);

      if (oneMonthBefore.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "BrideGuide: 1 Month to Go! ⏳",
            body: "Exactly one month until your big day! Let's check your final checklist items.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: oneMonthBefore,
          },
        });
      }
    }

    // --- MILESTONE 2: 1 Week Before ---
    if (daysLeft > 7) {
      const oneWeekBefore = new Date(weddingDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      oneWeekBefore.setHours(10, 0, 0);

      if (oneWeekBefore.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "One week out! 💕",
            body: "The countdown is in single digits! Take a deep breath, you've got this.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: oneWeekBefore,
          },
        });
      }
    }

    // --- MILESTONE 3: The Day Before ---
    if (daysLeft > 1) {
      const dayBefore = new Date(weddingDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(12, 0, 0);

      if (dayBefore.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Tomorrow is the day! 💍",
            body: "Everything is ready. Rest up, enjoy every second, and get ready to marry your best friend!",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dayBefore,
          },
        });
      }
    }

    console.log("Successfully scheduled milestone reminders!");
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
}