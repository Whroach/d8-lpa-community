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
    // Unsending clears the text so it cannot leak back out through the
    // conversation preview, logs, or any endpoint that returns the message.
    required: function () { return !this.is_unsent; },
    default: '',
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
  }],
  // Set the first time the sender edits the message. Its presence is what the
  // client renders the "Edited" marker from, so it doubles as the flag.
  edited_at: {
    type: Date,
    default: null
  },
  // Unsent messages are kept as tombstones rather than removed, so the other
  // participant sees that something was taken back instead of silently losing
  // a message they had already read.
  is_unsent: {
    type: Boolean,
    default: false
  },
  unsent_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for fetching messages by match
messageSchema.index({ match_id: 1, created_at: 1 });
messageSchema.index({ sender_id: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
