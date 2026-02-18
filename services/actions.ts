/**
 * Action execution service.
 *
 * Handles executing approved actions:
 * - add_to_calendar → expo-calendar
 * - set_reminder → expo-notifications
 * - summarize → InsForge AI (via edge function)
 * - save_contact → placeholder for now
 */

import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  updateActionStatus,
  triggerSummarize,
} from './insforge';
import type { Action } from '@/types/action';
import {
  isCalendarActionData,
  isReminderActionData,
} from '@/types/action';

// ─── Calendar ───────────────────────────────────────────────────────

async function getDefaultCalendarId(): Promise<string> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    throw new ActionError('Calendar permission denied');
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );

  const defaultCal =
    calendars.find((c) => c.allowsModifications && c.isPrimary) ??
    calendars.find((c) => c.allowsModifications);

  if (!defaultCal) {
    // Create a local calendar as fallback
    const newCalId = await Calendar.createCalendarAsync({
      title: 'Ada',
      color: '#6366F1',
      entityType: Calendar.EntityTypes.EVENT,
      source: {
        name: 'Ada',
        type: Platform.OS === 'ios'
          ? (Calendar.CalendarType.LOCAL as string)
          : 'com.google',
        isLocalAccount: true,
      },
      name: 'Ada',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      ownerAccount: 'ada',
    });
    return newCalId;
  }

  return defaultCal.id;
}

export async function executeCalendarAction(
  action: Action,
): Promise<{ eventId: string }> {
  if (!isCalendarActionData(action.action_data)) {
    throw new ActionError(
      'Invalid calendar action data: missing required fields',
    );
  }
  const data = action.action_data;

  const calId = await getDefaultCalendarId();

  const eventId = await Calendar.createEventAsync(calId, {
    title: data.title,
    startDate: new Date(data.start_time),
    endDate: data.end_time
      ? new Date(data.end_time)
      : new Date(new Date(data.start_time).getTime() + 60 * 60 * 1000),
    location: data.location,
    notes: data.description,
    allDay: data.all_day ?? false,
  });

  await updateActionStatus(action.id, 'completed', { eventId });
  return { eventId };
}

// ─── Reminders / Notifications ──────────────────────────────────────

async function ensureNotificationPermissions(): Promise<void> {
  const { status: existing } =
    await Notifications.getPermissionsAsync();
  if (existing === 'granted') return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new ActionError('Notification permission denied');
  }
}

export async function executeReminderAction(
  action: Action,
): Promise<{ notificationId: string }> {
  await ensureNotificationPermissions();

  if (!isReminderActionData(action.action_data)) {
    throw new ActionError(
      'Invalid reminder action data: missing required fields',
    );
  }
  const data = action.action_data;
  const triggerDate = new Date(data.remind_at);
  const now = new Date();

  // Minimum 10s in the future to avoid expo-notifications "time interval
  // must be greater than 0" race condition.
  const MIN_FUTURE_MS = 10_000;

  if (triggerDate.getTime() - now.getTime() < MIN_FUTURE_MS) {
    throw new ActionError(
      'Reminder time must be at least 10 seconds in the future',
    );
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ada Reminder',
      body: data.message,
      data: { actionId: action.id, itemId: action.item_id },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await updateActionStatus(action.id, 'completed', { notificationId });
  return { notificationId };
}

// ─── Summarize ──────────────────────────────────────────────────────

export async function executeSummarizeAction(
  action: Action,
): Promise<void> {
  await triggerSummarize(action.item_id, action.id);
  // Edge function updates the action status to 'completed' with result
}

// ─── Dispatcher ─────────────────────────────────────────────────────

export async function executeAction(
  action: Action,
): Promise<Record<string, unknown>> {
  switch (action.type) {
    case 'add_to_calendar':
      return executeCalendarAction(action);

    case 'set_reminder':
      return executeReminderAction(action);

    case 'summarize':
      await executeSummarizeAction(action);
      return { triggered: true };

    case 'save_contact':
    case 'create_note':
    case 'track_price':
      throw new ActionError(
        `${action.type.replace(/_/g, ' ')} is coming soon`,
      );

    default:
      throw new ActionError(`Unknown action type: ${action.type}`);
  }
}

// ─── Error ──────────────────────────────────────────────────────────

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}
