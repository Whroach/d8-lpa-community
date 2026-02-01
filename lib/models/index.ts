import mongoose, { Schema, Document, Model } from 'mongoose';

// Match Model
export interface IMatch extends Document {
  users: mongoose.Types.ObjectId[];
  created_at: Date;
  last_message_at: Date;
  unread_count_user1: number;
  unread_count_user2: number;
}

const MatchSchema = new Schema<IMatch>({
  users: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  created_at: { type: Date, default: Date.now },
  last_message_at: { type: Date, default: Date.now },
  unread_count_user1: { type: Number, default: 0 },
  unread_count_user2: { type: Number, default: 0 }
});

export const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);

// Like Model
export interface ILike extends Document {
  from_user: mongoose.Types.ObjectId;
  to_user: mongoose.Types.ObjectId;
  type: 'like' | 'superlike' | 'pass';
  created_at: Date;
}

const LikeSchema = new Schema<ILike>({
  from_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'superlike', 'pass'], required: true },
  created_at: { type: Date, default: Date.now }
});

export const Like: Model<ILike> = mongoose.models.Like || mongoose.model<ILike>('Like', LikeSchema);

// Message Model
export interface IMessage extends Document {
  match_id: mongoose.Types.ObjectId;
  sender_id: mongoose.Types.ObjectId;
  content: string;
  read: boolean;
  deleted_for: mongoose.Types.ObjectId[];
  created_at: Date;
}

const MessageSchema = new Schema<IMessage>({
  match_id: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
  sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  deleted_for: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

// Event Model
export interface IEvent extends Document {
  title: string;
  description: string;
  image: string;
  start_date: Date;
  end_date: Date;
  location: string;
  category: string;
  event_type: string;
  max_attendees: number;
  attendees: mongoose.Types.ObjectId[];
  is_cancelled: boolean;
  is_hidden: boolean;
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
}

const EventSchema = new Schema<IEvent>({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  location: { type: String, default: '' },
  category: { type: String, default: '' },
  event_type: { type: String, enum: ['local_chapter', 'regional', 'national', ''], default: 'local_chapter' },
  max_attendees: { type: Number },
  attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  is_cancelled: { type: Boolean, default: false },
  is_hidden: { type: Boolean, default: false },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

export const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

// Notification Model
export interface INotification extends Document {
  user_id: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  avatar: string;
  read: boolean;
  related_user: mongoose.Types.ObjectId;
  related_match: mongoose.Types.ObjectId;
  related_event: mongoose.Types.ObjectId;
  created_at: Date;
}

const NotificationSchema = new Schema<INotification>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['match', 'message', 'like', 'event', 'news', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  avatar: { type: String, default: '' },
  read: { type: Boolean, default: false },
  related_user: { type: Schema.Types.ObjectId, ref: 'User' },
  related_match: { type: Schema.Types.ObjectId, ref: 'Match' },
  related_event: { type: Schema.Types.ObjectId, ref: 'Event' },
  created_at: { type: Date, default: Date.now }
});

export const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

// Block Model
export interface IBlock extends Document {
  blocker: mongoose.Types.ObjectId;
  blocked: mongoose.Types.ObjectId;
  created_at: Date;
}

const BlockSchema = new Schema<IBlock>({
  blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now }
});

export const Block: Model<IBlock> = mongoose.models.Block || mongoose.model<IBlock>('Block', BlockSchema);

// UserNotificationSettings Model
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

export const UserNotificationSettings: Model<IUserNotificationSettings> = 
  mongoose.models.UserNotificationSettings || 
  mongoose.model<IUserNotificationSettings>('UserNotificationSettings', UserNotificationSettingsSchema);

// UserPrivacySettings Model
export interface IUserPrivacySettings extends Document {
  user_id: mongoose.Types.ObjectId;
  profile_visible: boolean;
  selective_mode: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserPrivacySettingsSchema = new Schema<IUserPrivacySettings>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  profile_visible: { type: Boolean, default: true },
  selective_mode: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

UserPrivacySettingsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export const UserPrivacySettings: Model<IUserPrivacySettings> = 
  mongoose.models.UserPrivacySettings || 
  mongoose.model<IUserPrivacySettings>('UserPrivacySettings', UserPrivacySettingsSchema);

// AdminNote Model - For admin notes on users
export interface IAdminNote extends Document {
  user_id: mongoose.Types.ObjectId;
  content: string;
  admin_id: mongoose.Types.ObjectId;
  admin_name: string;
  created_at: Date;
}

const AdminNoteSchema = new Schema<IAdminNote>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  admin_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  admin_name: { type: String, default: 'Admin' },
  created_at: { type: Date, default: Date.now },
});

export const AdminNote: Model<IAdminNote> = 
  mongoose.models.AdminNote || 
  mongoose.model<IAdminNote>('AdminNote', AdminNoteSchema);

// AdminAnnouncement Model - For admin news/announcements
export interface IAdminAnnouncement extends Document {
  title: string;
  message: string;
  admin_id: mongoose.Types.ObjectId;
  admin_name: string;
  is_active: boolean;
  read_by: mongoose.Types.ObjectId[];
  created_at: Date;
}

const AdminAnnouncementSchema = new Schema<IAdminAnnouncement>({
  title: { type: String, required: true },
  message: { type: String, required: true },
  admin_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  admin_name: { type: String, default: 'Admin' },
  is_active: { type: Boolean, default: true },
  read_by: { type: [Schema.Types.ObjectId], default: [] },
  created_at: { type: Date, default: Date.now },
});

export const AdminAnnouncement: Model<IAdminAnnouncement> = 
  mongoose.models.AdminAnnouncement || 
  mongoose.model<IAdminAnnouncement>('AdminAnnouncement', AdminAnnouncementSchema);

// Report Model - For user reports
export interface IReport extends Document {
  reporter_id: mongoose.Types.ObjectId;
  reported_user_id: mongoose.Types.ObjectId;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: Date;
}

const ReportSchema = new Schema<IReport>({
  reporter_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reported_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  created_at: { type: Date, default: Date.now },
});

export const Report: Model<IReport> = 
  mongoose.models.Report || 
  mongoose.model<IReport>('Report', ReportSchema);
