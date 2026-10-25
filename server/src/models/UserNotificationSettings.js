import mongoose from 'mongoose';

const UserNotificationSettingsSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  matches: {
    type: Boolean,
    default: true
  },
  messages: {
    type: Boolean,
    default: true
  },
  likes: {
    type: Boolean,
    default: true
  },
  events: {
    type: Boolean,
    default: true
  },
  admin_news: {
    type: Boolean,
    default: true
  },
  // Whether the app plays a chime when something arrives in real time. This is
  // a client-side playback preference, not a filter — turning it off still
  // creates the notification and updates the badge.
  sound: {
    type: Boolean,
    default: true
  },
  // Quiet hours: no chime between these times (the member's own clock).
  // Notifications still arrive and badges still update, silently.
  quiet_hours_enabled: {
    type: Boolean,
    default: false
  },
  quiet_hours_start: {
    type: String,
    default: '21:00'
  },
  quiet_hours_end: {
    type: String,
    default: '08:00'
  },
  // Opt-in email summary of unread messages and upcoming events.
  email_digest: {
    type: Boolean,
    default: false
  },
  email_digest_last_sent: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

UserNotificationSettingsSchema.pre('save', function() {
  this.updated_at = new Date();
});

const UserNotificationSettings = mongoose.model('UserNotificationSettings', UserNotificationSettingsSchema);

export default UserNotificationSettings;
