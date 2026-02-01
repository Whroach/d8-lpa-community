import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserNotificationSettings extends Document {
  user_id: mongoose.Types.ObjectId;
  matches: boolean;
  messages: boolean;
  likes: boolean;
  events: boolean;
  admin_news: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserNotificationSettingsSchema = new Schema<IUserNotificationSettings>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  matches: { type: Boolean, default: true },
  messages: { type: Boolean, default: true },
  likes: { type: Boolean, default: true },
  events: { type: Boolean, default: true },
  admin_news: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

UserNotificationSettingsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const UserNotificationSettings: Model<IUserNotificationSettings> = 
  mongoose.models.UserNotificationSettings || 
  mongoose.model<IUserNotificationSettings>('UserNotificationSettings', UserNotificationSettingsSchema);

export default UserNotificationSettings;
