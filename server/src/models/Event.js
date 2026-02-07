import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 2000
  },
  image: {
    type: String
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date
  },
  location: {
    type: String,
    required: true
  },
  location_coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  category: {
    type: String,
    enum: ['local-chapter', 'regional', 'national', 'dating', 'outdoor', 'food', 'social', 'fitness', 'arts'],
    default: 'local-chapter'
  },
  max_attendees: {
    type: Number
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  is_cancelled: {
    type: Boolean,
    default: false
  },
  cancelled_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Virtual for attendee count
eventSchema.virtual('attendee_count').get(function() {
  return this.attendees ? this.attendees.length : 0;
});

// Ensure virtuals are included in JSON
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

eventSchema.index({ start_date: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ location_coordinates: '2dsphere' });

const Event = mongoose.model('Event', eventSchema);

export default Event;
