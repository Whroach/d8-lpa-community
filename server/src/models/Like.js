import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
  from_user: {
    type: String,
    required: true
  },
  to_user: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'superlike', 'pass'],
    default: 'like'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index to ensure one interaction per user pair
likeSchema.index({ from_user: 1, to_user: 1 }, { unique: true });
likeSchema.index({ to_user: 1, type: 1 });

const Like = mongoose.model('Like', likeSchema);

export default Like;
