import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  birthdate: Date;
  gender: string;
  location_state: string;
  district_number: string;
  lpa_membership_id: string;
  looking_for: string[];
  looking_for_relationship: string;
  photos: string[];
  favorite_music: string;
  animals: string;
  pet_peeves: string;
  role: 'user' | 'admin';
  is_banned: boolean;
  is_suspended: boolean;
  is_disabled: boolean;
  is_deleted: boolean;
  has_warning: boolean;
  warning_count: number;
  warning_message: string;
  email_verified: boolean;
  verification_code?: string;
  verification_code_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  disabled_at?: Date;
  deleted_at?: Date;
  disable_reason?: string;
  delete_reason?: string;
  onboarding_completed: boolean;
  last_active: Date;
  created_at: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  birthdate: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'non-binary', 'other', ''], default: '' },
  location_state: { type: String, default: '' },
  district_number: { type: String, default: '' },
  lpa_membership_id: { type: String, default: '' },
  looking_for: [{ type: String, enum: ['male', 'female', 'non-binary', 'everyone'] }],
  looking_for_relationship: { type: String, enum: ['long-term', 'short-term', 'casual', 'friendship', 'not-sure', ''], default: '' },
  photos: [{ type: String }],
  favorite_music: { type: String, default: '' },
  animals: { type: String, default: '' },
  pet_peeves: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  is_banned: { type: Boolean, default: false },
  is_suspended: { type: Boolean, default: false },
  is_disabled: { type: Boolean, default: false },
  is_deleted: { type: Boolean, default: false },
  has_warning: { type: Boolean, default: false },
  warning_count: { type: Number, default: 0 },
  warning_message: { type: String, default: '' },
  email_verified: { type: Boolean, default: false },
  verification_code: { type: String },
  verification_code_expires: { type: Date },
  password_reset_token: { type: String },
  password_reset_expires: { type: Date },
  disabled_at: { type: Date },
  deleted_at: { type: Date },
  disable_reason: { type: String },
  delete_reason: { type: String },
  onboarding_completed: { type: Boolean, default: false },
  last_active: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verification_code;
  delete obj.verification_code_expires;
  delete obj.password_reset_token;
  delete obj.password_reset_expires;
  return obj;
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
