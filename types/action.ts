/**
 * Action types for Ada.
 * Actions are things Ada can do with classified items.
 */

export type ActionType =
  | 'add_to_calendar'
  | 'set_reminder'
  | 'save_contact'
  | 'summarize'
  | 'create_note'
  | 'track_price';

export type ActionStatus =
  | 'suggested'
  | 'approved'
  | 'completed'
  | 'dismissed'
  | 'failed';

export interface Action {
  id: string;
  user_id: string;
  item_id: string;
  type: ActionType;
  status: ActionStatus;
  action_data: Record<string, unknown>;
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface CalendarActionData {
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  description?: string;
  all_day?: boolean;
}

export interface ReminderActionData {
  message: string;
  remind_at: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}
