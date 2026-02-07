import mongoose from 'mongoose';

const lpaMembershipSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  lpa_membership_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for fast lookup by membership ID
lpaMembershipSchema.index({ lpa_membership_id: 1 });
lpaMembershipSchema.index({ user_id: 1 });

const LPAMembership = mongoose.model('LPAMembership', lpaMembershipSchema);

export default LPAMembership;
