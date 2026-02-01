import express from 'express';
import { auth } from '../middleware/auth.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// GET /api/events - Get all events
router.get('/', auth, async (req, res) => {
  try {
    const { category, upcoming } = req.query;
    
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (upcoming === 'true') {
      query.start_date = { $gte: new Date() };
      query.is_cancelled = { $ne: true };
    }

    const events = await Event.find(query)
      .sort({ start_date: 1 })
      .populate('attendees', 'first_name photos');

    // Format events
    const formattedEvents = events.map(event => ({
      id: event._id,
      title: event.title,
      description: event.description,
      image: event.image,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      category: event.category,
      attendees: event.attendees.length,
      max_attendees: event.max_attendees,
      is_joined: event.attendees.some(a => a._id.toString() === req.userId.toString()),
      is_cancelled: event.is_cancelled || false
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Error fetching events' });
  }
});

// GET /api/events/:eventId
router.get('/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('attendees', 'first_name last_name photos');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({
      id: event._id,
      title: event.title,
      description: event.description,
      image: event.image,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      category: event.category,
      attendees: event.attendees.length,
      attendees_list: event.attendees,
      max_attendees: event.max_attendees,
      is_joined: event.attendees.some(a => a._id.toString() === req.userId.toString()),
      is_cancelled: event.is_cancelled || false
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Error fetching event' });
  }
});

// POST /api/events/:eventId/join
router.post('/:eventId/join', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.is_cancelled) {
      return res.status(400).json({ message: 'Event has been cancelled' });
    }

    if (event.attendees.includes(req.userId)) {
      return res.status(400).json({ message: 'Already joined this event' });
    }

    if (event.max_attendees && event.attendees.length >= event.max_attendees) {
      return res.status(400).json({ message: 'Event is full' });
    }

    event.attendees.push(req.userId);
    await event.save();

    res.json({ success: true, is_joined: true });
  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({ message: 'Error joining event' });
  }
});

// POST /api/events/:eventId/leave
router.post('/:eventId/leave', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.attendees = event.attendees.filter(
      id => id.toString() !== req.userId.toString()
    );
    await event.save();

    res.json({ success: true, is_joined: false });
  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({ message: 'Error leaving event' });
  }
});

export default router;
