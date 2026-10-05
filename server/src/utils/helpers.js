import Block from '../models/Block.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';

export const isValidId = (value) =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

/** Express param guard: a malformed id is a 404, not a 500 from a CastError. */
export const validateIdParams = (...names) => (req, res, next) => {
  for (const name of names) {
    if (!isValidId(req.params[name])) {
      return res.status(404).json({ message: 'Not found' });
    }
  }
  next();
};

export function calculateAge(birthdate, today = new Date()) {
  if (!birthdate) return null;
  const birthDate = new Date(birthdate);
  if (Number.isNaN(birthDate.getTime())) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const NOTIFICATION_SETTING_FOR_TYPE = {
  match: 'matches',
  message: 'messages',
  like: 'likes',
  event: 'events',
  news: 'admin_news',
  system: true // Always send system notifications
};

/** Whether this member wants this type of notification (default: yes). */
export async function shouldCreateNotification(userId, notificationType) {
  const settings = await UserNotificationSettings.findOne({ user_id: String(userId) });
  if (!settings) return true;
  const settingField = NOTIFICATION_SETTING_FOR_TYPE[notificationType];
  return settingField === true || settings[settingField] !== false;
}

/** True if either member has blocked the other. */
export async function isBlockedBetween(userA, userB) {
  const a = String(userA);
  const b = String(userB);
  const block = await Block.findOne({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a }
    ]
  });
  return Boolean(block);
}

/** Trim and cap free text so one field can't hold a novel. */
export function cleanText(value, max) {
  if (typeof value !== 'string') return value;
  return value.trim().slice(0, max);
}

/**
 * Photo lists sent by the client may only reorder or drop photos the member
 * has already uploaded - never introduce a URL of the client's choosing.
 */
export function keepOwnPhotos(requested, existing) {
  if (!Array.isArray(requested)) return existing || [];
  const owned = new Set(existing || []);
  const seen = new Set();
  return requested.filter((url) => {
    if (typeof url !== 'string' || !owned.has(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/** Turns a Mongoose validation failure into a sentence a member can act on. */
export function validationMessage(error) {
  if (error?.name !== 'ValidationError') return null;
  const first = Object.values(error.errors || {})[0];
  if (!first) return 'Some of the details could not be saved. Please check them and try again.';
  if (first.kind === 'maxlength') {
    return `"${first.path.replace(/_/g, ' ')}" is too long. Please shorten it and try again.`;
  }
  return `Please check "${first.path.replace(/_/g, ' ')}" and try again.`;
}

/**
 * "Who I'd like to meet" values. Older screens sent "non-binary" while gender
 * is stored as "non_binary", so that choice never matched anyone.
 */
export function normalizeLookingFor(values) {
  if (!Array.isArray(values)) return [];
  const allowed = ['male', 'female', 'non_binary', 'everyone'];
  const out = [];
  for (const raw of values) {
    const value = String(raw).toLowerCase().replace('-', '_');
    if (allowed.includes(value) && !out.includes(value)) out.push(value);
  }
  return out;
}
