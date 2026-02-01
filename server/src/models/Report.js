import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reported_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewed_at: {
    type: Date
  },
  action_taken: {
    type: String,
    enum: ['none', 'warning', 'suspension', 'ban'],
    default: 'none'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

reportSchema.index({ status: 1, created_at: -1 });
reportSchema.index({ reported_user: 1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
