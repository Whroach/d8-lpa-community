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
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

UserNotificationSettingsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const UserNotificationSettings = mongoose.model('UserNotificationSettings', UserNotificationSettingsSchema);

export default UserNotificationSettings;
