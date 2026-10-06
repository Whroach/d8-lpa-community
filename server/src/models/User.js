import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  first_name: {
    type: String,
    trim: true,
    default: ''
  },
  last_name: {
    type: String,
    trim: true,
    default: ''
  },
  birthdate: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'non_binary', 'prefer_not_to_say', '']
  },
  onboarding_completed: {
    type: Boolean,
    default: false
  },
  agreed_to_guidelines: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'warned', 'suspended', 'banned'],
    default: 'active'
  },
  warnings: {
    type: Number,
    default: 0
  },
  is_suspended: {
    type: Boolean,
    default: false
  },
  is_banned: {
    type: Boolean,
    default: false
  },
  // Audit trail of moderation actions taken against this account. The admin
  // panel previously displayed a hardcoded sample list here.
  moderation_history: [{
    action: { type: String },
    reason: { type: String, default: '' },
    admin: { type: String, default: '' },
    // The member report this action answered, if any (optional, added later).
    report_id: { type: String },
    created_at: { type: Date, default: Date.now }
  }],
  // Free-form private notes written by admins about this account.
  admin_notes: [{
    content: { type: String, required: true },
    admin: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  }],
  last_active: {
    type: Date,
    default: Date.now
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  verification_code: {
    type: String
  },
  verification_code_expires: {
    type: Date
  },
  password_reset_token: {
    type: String
  },
  password_reset_expires: {
    type: Date
  },
  is_disabled: {
    type: Boolean,
    default: false
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  disabled_at: {
    type: Date
  },
  deleted_at: {
    type: Date
  },
  disable_reason: {
    type: String
  },
  delete_reason: {
    type: String
  },
  // Whether the member has been through (or skipped) the welcome tour.
  has_seen_tour: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Don't return password in JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verification_code;
  delete obj.verification_code_expires;
  delete obj.password_reset_token;
  delete obj.password_reset_expires;
  // Moderation records are for admins only; they used to be sent to the
  // member's own browser with every login and profile load.
  delete obj.admin_notes;
  delete obj.moderation_history;
  delete obj.delete_reason;
  delete obj.disable_reason;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
