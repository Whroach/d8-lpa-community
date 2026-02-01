import mongoose, { Schema, model, models } from 'mongoose';

const EventSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String },
  start_date: { type: Date, required: true },
  start_time: { type: String },
  end_date: { type: Date },
  end_time: { type: String },
  location: { type: String, required: true },
  max_attendees: { type: Number },
  category: { type: String, required: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  is_cancelled: { type: Boolean, default: false },
  is_hidden: { type: Boolean, default: false },
}, { timestamps: true });

const Event = models.Event || model('Event', EventSchema);

export default Event;
