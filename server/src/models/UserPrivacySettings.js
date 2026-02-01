import mongoose from 'mongoose';

const UserPrivacySettingsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

UserPrivacySettingsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const UserPrivacySettings = mongoose.model('UserPrivacySettings', UserPrivacySettingsSchema);

export default UserPrivacySettings;
