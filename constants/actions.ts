/**
 * Action type display labels.
 * Short labels for pills/badges, full labels for detail views.
 */

export const ACTION_LABELS_SHORT: Record<string, string> = {
  add_to_calendar: 'Calendar',
  set_reminder: 'Remind',
  save_contact: 'Contact',
  summarize: 'Summarize',
  create_note: 'Note',
  track_price: 'Track',
};

export const ACTION_LABELS: Record<string, string> = {
  add_to_calendar: 'Add to Calendar',
  set_reminder: 'Set Reminder',
  save_contact: 'Save Contact',
  summarize: 'Summarize',
  create_note: 'Create Note',
  track_price: 'Track Price',
};

/** Action types that are not yet implemented. */
export const PLACEHOLDER_ACTIONS = new Set([
  'save_contact',
  'create_note',
  'track_price',
]);
