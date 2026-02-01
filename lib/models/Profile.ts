import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProfile extends Document {
  user_id: mongoose.Types.ObjectId;
  bio: string;
  occupation: string;
  height: number;
  education: string;
  drinking: string;
  smoking: string;
  wants_kids: string;
  interests: string[];
  favorite_music: string[];
  animals: string[];
  pet_peeves: string[];
  looking_for_description: string[];
  life_goals: string[];
  languages: string[];
  cultural_background: string;
  religion: string;
  personal_preferences: string;
  prompt_good_at: string;
  prompt_perfect_weekend: string;
  prompt_message_if: string;
  district_number: number;
  location_city: string;
  location_state: string;
  location_coordinates: { lat: number; lng: number };
  age_preference_min: number;
  age_preference_max: number;
  distance_preference: number;
}

const ProfileSchema = new Schema<IProfile>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, default: '' },
  occupation: { type: String, default: '' },
  height: { type: Number },
  education: { type: String, enum: ['high-school', 'some-college', 'bachelors', 'masters', 'doctorate', 'trade-school', 'other', ''], default: '' },
  drinking: { type: String, enum: ['never', 'rarely', 'socially', 'often', ''], default: '' },
  smoking: { type: String, enum: ['never', 'socially', 'often', ''], default: '' },
  wants_kids: { type: String, enum: ['yes', 'no', 'someday', 'have-kids', 'not-sure', ''], default: '' },
  interests: [{ type: String }],
  favorite_music: [{ type: String }],
  animals: [{ type: String }],
  pet_peeves: [{ type: String }],
  looking_for_description: [{ type: String }],
  life_goals: [{ type: String }],
  languages: [{ type: String }],
  cultural_background: { type: String, default: '' },
  religion: { type: String, default: '' },
  personal_preferences: { type: String, default: '' },
  prompt_good_at: { type: String, default: '' },
  prompt_perfect_weekend: { type: String, default: '' },
  prompt_message_if: { type: String, default: '' },
  district_number: { type: Number, default: 1 },
  location_city: { type: String, default: '' },
  location_state: { type: String, default: '' },
  location_coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  age_preference_min: { type: Number, default: 18 },
  age_preference_max: { type: Number, default: 100 },
  distance_preference: { type: Number, default: 50 }
}, { timestamps: true });

const Profile: Model<IProfile> = mongoose.models.Profile || mongoose.model<IProfile>('Profile', ProfileSchema);

export default Profile;
