import mongoose from 'mongoose';

// A private bookmark: "I'd like to find this profile again". Unlike a Like it
// is never shown to the other person and never creates a match.
const favoriteSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  favorite_user_id: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

favoriteSchema.index({ user_id: 1, favorite_user_id: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);

export default Favorite;
