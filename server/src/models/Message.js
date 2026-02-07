import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  match_id: {
    type: String,
    required: true
  },
  sender_id: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date
  },
  // For soft delete (user deleted conversation on their end)
  deleted_by: [{
    type: String
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for fetching messages by match
messageSchema.index({ match_id: 1, created_at: 1 });
messageSchema.index({ sender_id: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
