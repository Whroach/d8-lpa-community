import mongoose from 'mongoose';

const actionHistorySchema = new mongoose.Schema({
  action_type: {
    type: String,
    enum: ['like', 'unlike', 'superlike', 'match', 'unmatch', 'block', 'unblock', 'report'],
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  target_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Store the original data for reference
  original_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Additional context
  reason: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for efficient queries
actionHistorySchema.index({ user_id: 1, created_at: -1 });
actionHistorySchema.index({ target_user_id: 1, created_at: -1 });
actionHistorySchema.index({ action_type: 1, created_at: -1 });
actionHistorySchema.index({ user_id: 1, target_user_id: 1, action_type: 1 });

const ActionHistory = mongoose.model('ActionHistory', actionHistorySchema);

export default ActionHistory;
