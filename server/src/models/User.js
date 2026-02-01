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
    enum: ['male', 'female', 'non-binary', 'other', '']
  },
  looking_for: [{
    type: String,
    enum: ['male', 'female', 'non-binary', 'everyone']
  }],
  looking_for_relationship: {
    type: String,
    enum: ['long-term', 'short-term', 'casual', 'friendship', 'not-sure', '']
  },
  photos: [{
    type: String // URLs to photos
  }],
  location_state: {
    type: String,
    default: ''
  },
  district_number: {
    type: String,
    default: ''
  },
  lpa_membership_id: {
    type: String,
    default: ''
  },
  occupation: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  favorite_music: [{
    type: String
  }],
  animals: [{
    type: String
  }],
  pet_peeves: [{
    type: String
  }],
  onboarding_completed: {
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
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
