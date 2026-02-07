import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema({
  blocker: {
    type: String,
    required: true
  },
  blocked: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index to ensure one block per user pair
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1 });

const Block = mongoose.model('Block', blockSchema);

export default Block;
