import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  users: [{
    type: String,
    required: true
  }],
  matched_at: {
    type: Date,
    default: Date.now
  },
  last_message: {
    type: String,
    default: null
  },
  last_message_at: {
    type: Date,
    default: null
  },
  last_message_sender: {
    type: String
  },
  // Track unread messages per user
  unread_counts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for finding matches by user
matchSchema.index({ users: 1 });
matchSchema.index({ matched_at: -1 });

const Match = mongoose.model('Match', matchSchema);

export default Match;
