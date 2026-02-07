import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to check if user wants this type of notification
async function shouldCreateNotification(userId, notificationType) {
  const settings = await UserNotificationSettings.findOne({ user_id: userId });
  if (!settings) return true; // Default to enabled if no settings found
  
  const typeMap = {
    'match': 'matches',
    'message': 'messages',
    'like': 'likes',
    'event': 'events',
    'news': 'admin_news',
    'system': true
  };
  
  const settingField = typeMap[notificationType];
  return settingField === true || settings[settingField] !== false;
}

// GET /api/messages - Get all conversations
router.get('/', auth, async (req, res) => {
  try {
    // Get all matches (active and inactive) to show conversation history
    const matches = await Match.find({
      users: req.userId
    }).sort({ last_message_at: -1, created_at: -1 });

    const conversations = await Promise.all(matches.map(async (match) => {
      const otherUserId = match.users.find(id => id.toString() !== req.userId.toString());
      const otherUser = await User.findById(otherUserId);

      if (!otherUser) return null;

      // Fetch profile to get photos
      const otherProfile = await Profile.findOne({ user_id: otherUserId });

      const unreadCount = match.unread_counts?.get(req.userId.toString()) || 0;

      // Get the last few messages for preview
      const recentMessages = await Message.find({
        match_id: match._id,
        deleted_by: { $ne: req.userId }
      })
        .sort({ created_at: -1 })
        .limit(3)
        .lean();

      return {
        id: match._id,
        match_id: match._id,
        user: {
          id: otherUser._id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          photos: otherProfile?.photos || []
        },
        last_message: match.last_message,
        last_message_at: match.last_message_at,
        unread_count: unreadCount,
        recent_messages: recentMessages.reverse(), // Return in chronological order
        has_messages: recentMessages.length > 0,
        is_active: match.is_active
      };
    }));

    // Sort: conversations with messages first, then by most recent activity
    const sorted = conversations
      .filter(c => c !== null)
      .sort((a, b) => {
        // Prioritize conversations with messages
        if (a.has_messages && !b.has_messages) return -1;
        if (!a.has_messages && b.has_messages) return 1;
        
        // Then sort by last message time
        if (a.last_message_at && b.last_message_at) {
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        }
        if (a.last_message_at) return -1;
        if (b.last_message_at) return 1;
        
        return 0;
      });

    res.json(sorted);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// GET /api/messages/:matchId - Get messages for a conversation
router.get('/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.userId
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Get messages not deleted by this user
    const messages = await Message.find({
      match_id: match._id,
      deleted_by: { $ne: req.userId }
    }).sort({ created_at: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        match_id: match._id,
        sender_id: { $ne: req.userId },
        read: false
      },
      {
        read: true,
        read_at: new Date()
      }
    );

    // Reset unread count
    if (match.unread_counts) {
      match.unread_counts.set(req.userId.toString(), 0);
      await match.save();
    }

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// POST /api/messages/:matchId - Send a message
router.post('/:matchId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const io = req.app.get('io');

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content required' });
    }

    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.userId,
      is_active: true
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Create message
    const message = await Message.create({
      match_id: match._id,
      sender_id: req.userId,
      content: content.trim()
    });

    // Update match with last message info
    const otherUserId = match.users.find(id => id.toString() !== req.userId.toString());
    
    match.last_message = content.trim();
    match.last_message_at = new Date();
    match.last_message_sender = req.userId;
    
    // Increment unread count for other user
    if (!match.unread_counts) {
      match.unread_counts = new Map();
    }
    const currentUnread = match.unread_counts.get(otherUserId.toString()) || 0;
    match.unread_counts.set(otherUserId.toString(), currentUnread + 1);
    
    await match.save();

    // Check if this is the first message from this user in this conversation
    const previousMessages = await Message.countDocuments({
      match_id: match._id,
      sender_id: req.userId
    });
    
    const isFirstMessage = previousMessages === 1; // Count is 1 because we just created the message

    // Only create notification for the first message from this user
    if (isFirstMessage && await shouldCreateNotification(otherUserId, 'message')) {
      await Notification.create({
        user_id: otherUserId,
        type: 'message',
        title: 'New Message',
        message: `${req.user.first_name} sent you a message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
        avatar: req.user.photos[0],
        related_user: req.userId,
        related_match: match._id
      });
    }

    const messageResponse = {
      id: message._id,
      _id: message._id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
      read: message.read
    };

    // Emit real-time message to the match room
    io.to(`match-${match._id}`).emit('new-message', messageResponse);

    // Emit notification to other user (for real-time badge update)
    if (isFirstMessage) {
      io.to(otherUserId.toString()).emit('new-notification', {
        type: 'message',
        match_id: match._id
      });
    }

    res.status(201).json(messageResponse);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// DELETE /api/messages/:matchId - Delete conversation (soft delete for user)
router.delete('/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.userId
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Add current user to deleted_by array for all messages
    await Message.updateMany(
      { match_id: match._id },
      { $addToSet: { deleted_by: req.userId } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Error deleting conversation' });
  }
});

// POST /api/messages/broadcast - Broadcast message to socket.io clients
router.post('/broadcast', async (req, res) => {
  try {
    const { matchId, message, otherUserId } = req.body;
    logger.debug('[BROADCAST] Received broadcast request for match:', matchId);
    
    const io = req.app.get('io');
    
    if (!io) {
      logger.error('[BROADCAST] Socket.io not initialized');
      return res.status(500).json({ message: 'Socket.io not initialized' });
    }

    logger.debug('[BROADCAST] Emitting to match room: match-' + matchId);
    logger.debug('[BROADCAST] Emitting to user room:', otherUserId);
    
    // Emit to the conversation room and to the other user's personal room
    io.to(`match-${matchId}`).emit('new-message', message);
    if (otherUserId) {
      io.to(otherUserId).emit('new-message', message);
    }

    logger.debug('[BROADCAST] Broadcast complete');
    res.json({ success: true });
  } catch (error) {
    logger.error('[BROADCAST] Error:', error.message);
    res.status(500).json({ message: 'Error broadcasting message' });
  }
});

export default router;
