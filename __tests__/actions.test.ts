/**
 * Tests for action execution service.
 *
 * Mocks expo-calendar, expo-notifications, and insforge to test
 * the executeAction dispatcher and individual action executors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-calendar
vi.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: vi.fn(),
  getCalendarsAsync: vi.fn(),
  createCalendarAsync: vi.fn(),
  createEventAsync: vi.fn(),
  EntityTypes: { EVENT: 'event' },
  CalendarType: { LOCAL: 'local' },
  CalendarAccessLevel: { OWNER: 'owner' },
}));

// Mock expo-notifications
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

// Mock react-native
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock insforge service
vi.mock('@/services/insforge', () => ({
  updateActionStatus: vi.fn(),
  triggerSummarize: vi.fn(),
}));

import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import {
  updateActionStatus as mockUpdateActionStatus,
  triggerSummarize as mockTriggerSummarize,
} from '@/services/insforge';
import {
  executeAction,
  executeCalendarAction,
  executeReminderAction,
  executeSummarizeAction,
  ActionError,
} from '@/services/actions';
import type { Action } from '@/types/action';

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    user_id: 'u1',
    item_id: 'item-1',
    type: 'add_to_calendar',
    status: 'suggested',
    action_data: {},
    result: null,
    created_at: '2026-02-18T00:00:00Z',
    completed_at: null,
    ...overrides,
  };
}

describe('actions service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── executeAction dispatcher ──────────────────────────────────

  describe('executeAction', () => {
    it('routes add_to_calendar to calendar executor', async () => {
      vi.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Calendar.requestCalendarPermissionsAsync>>,
      );
      vi.mocked(Calendar.getCalendarsAsync).mockResolvedValue([
        {
          id: 'cal-1',
          allowsModifications: true,
          isPrimary: true,
          title: 'Primary',
          color: '#000',
          source: { name: 'Default', type: 'local' },
          type: 'local',
          entityType: 'event',
        },
      ] as Awaited<ReturnType<typeof Calendar.getCalendarsAsync>>);
      vi.mocked(Calendar.createEventAsync).mockResolvedValue('event-123');
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const action = makeAction({
        type: 'add_to_calendar',
        action_data: {
          title: 'Team meeting',
          start_time: '2026-03-01T10:00:00Z',
        },
      });

      const result = await executeAction(action);
      expect(result).toEqual({ eventId: 'event-123' });
    });

    it('routes set_reminder to reminder executor', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
      );
      vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('notif-1');
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const action = makeAction({
        type: 'set_reminder',
        action_data: {
          message: 'Remember this',
          remind_at: futureDate,
        },
      });

      const result = await executeAction(action);
      expect(result).toEqual({ notificationId: 'notif-1' });
    });

    it('routes summarize to summarize executor', async () => {
      vi.mocked(mockTriggerSummarize).mockResolvedValue(undefined);

      const action = makeAction({ type: 'summarize' });
      const result = await executeAction(action);
      expect(result).toEqual({ triggered: true });
      expect(mockTriggerSummarize).toHaveBeenCalledWith('item-1', 'action-1');
    });

    it('marks placeholder actions as approved', async () => {
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      for (const type of ['save_contact', 'create_note', 'track_price'] as const) {
        const action = makeAction({ type });
        const result = await executeAction(action);
        expect(result).toEqual({ status: 'approved' });
      }

      expect(mockUpdateActionStatus).toHaveBeenCalledTimes(3);
    });

    it('throws ActionError for unknown action type', async () => {
      const action = makeAction({ type: 'unknown_action' as Action['type'] });

      await expect(executeAction(action)).rejects.toThrow(ActionError);
      await expect(executeAction(action)).rejects.toThrow(
        'Unknown action type: unknown_action',
      );
    });
  });

  // ─── Calendar Action ────────────────────────────────────────────

  describe('executeCalendarAction', () => {
    it('creates event with correct data', async () => {
      vi.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Calendar.requestCalendarPermissionsAsync>>,
      );
      vi.mocked(Calendar.getCalendarsAsync).mockResolvedValue([
        {
          id: 'cal-1',
          allowsModifications: true,
          isPrimary: true,
        },
      ] as Awaited<ReturnType<typeof Calendar.getCalendarsAsync>>);
      vi.mocked(Calendar.createEventAsync).mockResolvedValue('ev-1');
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const action = makeAction({
        action_data: {
          title: 'Birthday Party',
          start_time: '2026-04-15T18:00:00Z',
          end_time: '2026-04-15T22:00:00Z',
          location: 'Central Park',
          description: 'Bring a gift',
          all_day: false,
        },
      });

      const result = await executeCalendarAction(action);
      expect(result.eventId).toBe('ev-1');

      expect(Calendar.createEventAsync).toHaveBeenCalledWith('cal-1', {
        title: 'Birthday Party',
        startDate: new Date('2026-04-15T18:00:00Z'),
        endDate: new Date('2026-04-15T22:00:00Z'),
        location: 'Central Park',
        notes: 'Bring a gift',
        allDay: false,
      });

      expect(mockUpdateActionStatus).toHaveBeenCalledWith(
        'action-1',
        'completed',
        { eventId: 'ev-1' },
      );
    });

    it('defaults end_time to 1 hour after start when not provided', async () => {
      vi.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Calendar.requestCalendarPermissionsAsync>>,
      );
      vi.mocked(Calendar.getCalendarsAsync).mockResolvedValue([
        { id: 'cal-1', allowsModifications: true, isPrimary: true },
      ] as Awaited<ReturnType<typeof Calendar.getCalendarsAsync>>);
      vi.mocked(Calendar.createEventAsync).mockResolvedValue('ev-2');
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const action = makeAction({
        action_data: {
          title: 'Quick meeting',
          start_time: '2026-03-01T09:00:00Z',
        },
      });

      await executeCalendarAction(action);

      const callArgs = vi.mocked(Calendar.createEventAsync).mock.calls[0]?.[1];
      expect(callArgs).toBeDefined();
      const expectedEnd = new Date(
        new Date('2026-03-01T09:00:00Z').getTime() + 3600000,
      );
      expect(callArgs!.endDate).toEqual(expectedEnd);
    });

    it('throws ActionError when calendar permission denied', async () => {
      vi.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue(
        { status: 'denied' } as Awaited<ReturnType<typeof Calendar.requestCalendarPermissionsAsync>>,
      );

      const action = makeAction({
        action_data: {
          title: 'Test',
          start_time: '2026-03-01T09:00:00Z',
        },
      });

      await expect(executeCalendarAction(action)).rejects.toThrow(
        'Calendar permission denied',
      );
    });

    it('creates a new calendar when no modifiable calendar exists', async () => {
      vi.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Calendar.requestCalendarPermissionsAsync>>,
      );
      vi.mocked(Calendar.getCalendarsAsync).mockResolvedValue(
        [] as Awaited<ReturnType<typeof Calendar.getCalendarsAsync>>,
      );
      vi.mocked(Calendar.createCalendarAsync).mockResolvedValue('new-cal-id');
      vi.mocked(Calendar.createEventAsync).mockResolvedValue('ev-3');
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const action = makeAction({
        action_data: {
          title: 'New calendar test',
          start_time: '2026-03-01T09:00:00Z',
        },
      });

      await executeCalendarAction(action);

      expect(Calendar.createCalendarAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ada',
          color: '#6366F1',
        }),
      );
      expect(Calendar.createEventAsync).toHaveBeenCalledWith(
        'new-cal-id',
        expect.anything(),
      );
    });
  });

  // ─── Reminder Action ────────────────────────────────────────────

  describe('executeReminderAction', () => {
    it('schedules notification for future date', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
      );
      vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue(
        'notif-123',
      );
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const action = makeAction({
        type: 'set_reminder',
        action_data: {
          message: 'Call dentist',
          remind_at: futureDate,
        },
      });

      const result = await executeReminderAction(action);
      expect(result.notificationId).toBe('notif-123');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Ada Reminder',
          body: 'Call dentist',
          data: { actionId: 'action-1', itemId: 'item-1' },
          sound: true,
        },
        trigger: {
          type: 'date',
          date: new Date(futureDate),
        },
      });
    });

    it('throws ActionError when reminder time is in the past', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
      );

      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const action = makeAction({
        type: 'set_reminder',
        action_data: {
          message: 'Too late',
          remind_at: pastDate,
        },
      });

      await expect(executeReminderAction(action)).rejects.toThrow(
        'Reminder time must be at least 10 seconds in the future',
      );
    });

    it('requests permission when not already granted', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
        { status: 'denied' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
      );
      vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(
        { status: 'granted' } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>,
      );
      vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue(
        'notif-456',
      );
      vi.mocked(mockUpdateActionStatus).mockResolvedValue(undefined);

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const action = makeAction({
        type: 'set_reminder',
        action_data: {
          message: 'Test',
          remind_at: futureDate,
        },
      });

      const result = await executeReminderAction(action);
      expect(result.notificationId).toBe('notif-456');
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('throws ActionError when notification permission denied', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(
        { status: 'denied' } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
      );
      vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(
        { status: 'denied' } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>,
      );

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const action = makeAction({
        type: 'set_reminder',
        action_data: {
          message: 'Test',
          remind_at: futureDate,
        },
      });

      await expect(executeReminderAction(action)).rejects.toThrow(
        'Notification permission denied',
      );
    });
  });

  // ─── Summarize Action ───────────────────────────────────────────

  describe('executeSummarizeAction', () => {
    it('triggers summarize edge function with correct args', async () => {
      vi.mocked(mockTriggerSummarize).mockResolvedValue(undefined);

      const action = makeAction({
        type: 'summarize',
        item_id: 'item-42',
        id: 'action-42',
      });

      await executeSummarizeAction(action);
      expect(mockTriggerSummarize).toHaveBeenCalledWith('item-42', 'action-42');
    });

    it('propagates errors from edge function', async () => {
      vi.mocked(mockTriggerSummarize).mockRejectedValue(
        new Error('Edge function failed'),
      );

      const action = makeAction({ type: 'summarize' });
      await expect(executeSummarizeAction(action)).rejects.toThrow(
        'Edge function failed',
      );
    });
  });

  // ─── ActionError ──────────────────────────────────────────────

  describe('ActionError', () => {
    it('has correct name property', () => {
      const err = new ActionError('test');
      expect(err.name).toBe('ActionError');
    });

    it('extends Error', () => {
      const err = new ActionError('test message');
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('test message');
    });
  });
});
