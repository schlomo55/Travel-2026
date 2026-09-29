/* The "Remind me" sheet's words (Reminders, Part 4). Apart from strings.ts
   for the reason lib/i18n/reminders.ts gives: they ride in the sheet's lazy
   chunk, not in the start-up bundle. The bell's own label, which every cold
   start draws, is in strings.ts (S.remind). */
export const R2 = {
  title: 'Remind me',
  hourBefore: '1 hour before',
  eveningBefore: 'The evening before',
  thatMorning: 'That morning',
  pick: 'Pick a time',
  pickDate: 'Day',
  pickTime: 'Time',
  save: 'Remind me then',
  past: 'That time has already passed.',
  made: (day: string, time: string) => `Reminder set · ${day}, ${time}`,
} as const;
