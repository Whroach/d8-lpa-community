import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  height: {
    type: Number // in cm
  },
  body_type: {
    type: String,
    enum: ['slim', 'athletic', 'average', 'curvy', 'plus-size', '']
  },
  ethnicity: {
    type: String
  },
  occupation: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  religion: {
    type: String
  },
  drinking: {
    type: String,
    enum: ['never', 'rarely', 'socially', 'regularly', '']
  },
  smoking: {
    type: String,
    enum: ['never', 'socially', 'regularly', '']
  },
  wants_kids: {
    type: String,
    enum: ['yes', 'no', 'someday', 'have-kids', 'not-sure', '']
  },
  interests: [{
    type: String
  }],
  
  // Music, Animals, Pet Peeves
  favorite_music: [{
    type: String
  }],
  custom_music: {
    type: String,
    default: ''
  },
  animals: [{
    type: String
  }],
  custom_animal: {
    type: String,
    default: ''
  },
  pet_peeves: [{
    type: String
  }],
  custom_peeve: {
    type: String,
    default: ''
  },

  // New profile fields
  looking_for_description: [{
    type: String
  }],
  life_goals: [{
    type: String
  }],
  languages: [{
    type: String
  }],
  cultural_background: {
    type: String,
    default: ''
  },
  personal_preferences: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // LPA Related
  lpa_membership_id: {
    type: String,
    default: ''
  },
  district_number: {
    type: String,
    default: ''
  },
  membership_duration: {
    type: String,
    default: ''
  },
  lpa_positions: {
    type: String,
    default: ''
  },
  
  // Looking For
  looking_for_gender: [{
    type: String
  }],
  connection_type: [{
    type: String
  }],
  
  // Match Preferences
  preferred_state: {
    type: String,
    default: ''
  },
  match_same_religion: {
    type: Boolean,
    default: false
  },
  match_same_lifestyle: {
    type: Boolean,
    default: false
  },
  match_same_area: {
    type: Boolean,
    default: false
  },
  
  // Profile Settings
  profile_visible: {
    type: Boolean,
    default: true
  },
  only_show_to_liked: {
    type: Boolean,
    default: false
  },
  
  // Prompts
  prompt_good_at: {
    type: String,
    maxlength: 500,
    default: ''
  },
  prompt_perfect_weekend: {
    type: String,
    maxlength: 500,
    default: ''
  },
  prompt_message_if: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Preferences
  distance_preference: {
    type: Number,
    default: 25 // in miles
  },
  age_preference_min: {
    type: Number,
    default: 18
  },
  age_preference_max: {
    type: Number,
    default: 99
  },
  
  // Location
  location_city: {
    type: String,
    default: ''
  },
  location_state: {
    type: String,
    default: ''
  },
  location_country: {
    type: String,
    default: 'United States'
  },
  location_coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create geospatial index for location-based queries
profileSchema.index({ location_coordinates: '2dsphere' });

const Profile = mongoose.model('Profile', profileSchema);

export default Profile;
