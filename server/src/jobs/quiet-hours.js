/**
 * Server-side quiet hours check (used before sending a digest email).
 * The server does not know each member's time zone, so this uses the
 * community's: US Central, which covers District 8.
 */
const COMMUNITY_TIME_ZONE = process.env.COMMUNITY_TIME_ZONE || 'America/Chicago';

const toMinutes = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function isWithinQuietHoursServer(settings, now = new Date()) {
  if (!settings?.quiet_hours_enabled) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMMUNITY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const current =
    Number(parts.find((p) => p.type === 'hour').value) * 60 +
    Number(parts.find((p) => p.type === 'minute').value);
  const start = toMinutes(settings.quiet_hours_start || '21:00');
  const end = toMinutes(settings.quiet_hours_end || '08:00');
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}
