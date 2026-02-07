import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['message', 'like', 'match', 'event', 'news', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  avatar: {
    type: String // URL to avatar image
  },
  related_user: {
    type: String
  },
  related_match: {
    type: String
  },
  related_event: {
    type: String
  },
  read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: 'updated_at' }
});

notificationSchema.index({ user_id: 1, timestamp: -1 });
notificationSchema.index({ user_id: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
