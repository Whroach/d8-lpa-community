import mongoose from 'mongoose';

const UserPrivacySettingsSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  profile_visible: {
    type: Boolean,
    default: true
  },
  selective_mode: {
    type: Boolean,
    default: false
  },
  // Added later; documents without these fields behave as "on", which is how
  // the app behaved before the settings existed.
  // Show other members a green "online" dot while this member is using the app.
  show_online: {
    type: Boolean,
    default: true
  },
  // Let the other person see "Seen" under a message this member has read.
  read_receipts: {
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

UserPrivacySettingsSchema.pre('save', function() {
  this.updated_at = new Date();
});

const UserPrivacySettings = mongoose.model('UserPrivacySettings', UserPrivacySettingsSchema);

export default UserPrivacySettings;
