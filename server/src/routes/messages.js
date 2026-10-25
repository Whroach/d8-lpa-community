import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import { shouldCreateNotification, isBlockedBetween, validateIdParams } from '../utils/helpers.js';
import { isOnline, sharesOnlineStatus, sendsReadReceipts } from '../realtime.js';

const router = express.Router();

const MAX_MESSAGE_LENGTH = 2000;

// One shape for every message the API returns, so the client never has to
// guess whether it got a raw document or a hand-built response object.
// `showRead` is false when the reader has switched read receipts off: the
// sender then never learns whether the message was opened.
function serializeMessage(message, showRead = true) {
  return {
    id: message._id.toString(),
    _id: message._id.toString(),
    match_id: message.match_id.toString(),
    sender_id: message.sender_id.toString(),
    content: message.is_unsent ? '' : message.content,
    created_at: message.created_at,
    read: showRead ? Boolean(message.read) : false,
    edited_at: message.edited_at || null,
    is_unsent: Boolean(message.is_unsent),
    unsent_at: message.unsent_at || null
  };
}

const otherUserIdOf = (match, userId) =>
  match.users.find(id => id.toString() !== userId.toString());

// GET /api/messages - Get all conversations
router.get('/', auth, async (req, res) => {
  try {
    // Get all matches (active and inactive) to show conversation history
    const matches = await Match.find({
      users: req.userId.toString()
    }).sort({ last_message_at: -1, created_at: -1 });

    const conversations = await Promise.all(matches.map(async (match) => {
      const otherUserId = otherUserIdOf(match, req.userId);
      if (!otherUserId) return null;
      const otherUser = await User.findById(otherUserId);

      if (!otherUser) return null;

      // Hide conversations with deleted users
      if (otherUser.is_deleted) return null;

      // Fetch profile to get photos
      const otherProfile = await Profile.findOne({ user_id: otherUserId });

      const unreadCount = match.unread_counts?.get(req.userId.toString()) || 0;

      // Get the last few messages for preview
      const recentMessages = await Message.find({
        match_id: match._id,
        deleted_by: { $ne: req.userId.toString() }
      })
        .sort({ created_at: -1 })
        .limit(3)
        .lean();

      const online = match.is_active !== false &&
        isOnline(otherUserId) && await sharesOnlineStatus(otherUserId);

      return {
        id: match._id,
        match_id: match._id,
        user: {
          id: otherUser._id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          photos: otherProfile?.photos || [],
          // The chat renders this next to each incoming bubble; the dedicated
          // profile picture wins over the first photo in the gallery.
          profile_picture_url: otherProfile?.profile_picture_url || otherProfile?.photos?.[0] || null,
          interests: otherProfile?.interests || [],
          is_online: Boolean(online),
          email_verified: Boolean(otherUser.email_verified)
        },
        last_message: recentMessages.length > 0 ? match.last_message : null,
        last_message_at: match.last_message_at,
        unread_count: unreadCount,
        recent_messages: recentMessages.reverse().map(m => serializeMessage(m)), // chronological order
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
    logger.error('Get conversations error:', error.message);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// GET /api/messages/:matchId - Get messages for a conversation
router.get('/:matchId', auth, validateIdParams('matchId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: me
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Get messages not deleted by this user
    const messages = await Message.find({
      match_id: match._id,
      deleted_by: { $ne: me }
    }).sort({ created_at: 1 });

    // Mark messages as read
    const marked = await Message.updateMany(
      {
        match_id: match._id,
        sender_id: { $ne: me },
        read: false
      },
      {
        read: true,
        read_at: new Date()
      }
    );

    // Reset unread count
    if (match.unread_counts) {
      match.unread_counts.set(me, 0);
      await match.save();
    }

    const otherUserId = otherUserIdOf(match, me);

    // Tell the sender their messages were seen - unless this reader has
    // switched read receipts off.
    if (marked.modifiedCount > 0 && otherUserId && await sendsReadReceipts(me)) {
      const io = req.app.get('io');
      io?.to(otherUserId.toString()).emit('messages-read', {
        match_id: match._id.toString(),
        reader_id: me,
        read_at: new Date().toISOString()
      });
    }

    // Whether *my* sent messages show as read depends on the other person's
    // read-receipt choice.
    const otherSharesReceipts = otherUserId ? await sendsReadReceipts(otherUserId) : true;

    res.json(messages.map(m =>
      serializeMessage(m, m.sender_id.toString() === me ? otherSharesReceipts : true)
    ));
  } catch (error) {
    logger.error('Get messages error:', error.message);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// POST /api/messages/:matchId - Send a message
router.post('/:matchId', auth, validateIdParams('matchId'), async (req, res) => {
  try {
    const { content } = req.body;
    const io = req.app.get('io');
    const me = req.userId.toString();

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Please write a message first.' });
    }
    const text = content.trim();
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `That message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`
      });
    }

    const match = await Match.findOne({
      _id: req.params.matchId,
      users: me,
      is_active: true
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const otherUserId = otherUserIdOf(match, me);
    if (!otherUserId) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Blocking removes the match, but check anyway so a block can never be
    // talked around.
    if (await isBlockedBetween(me, otherUserId)) {
      return res.status(403).json({ message: 'You can no longer message this member.' });
    }
    const recipient = await User.findById(otherUserId).select('is_deleted is_banned');
    if (!recipient || recipient.is_deleted || recipient.is_banned) {
      return res.status(403).json({ message: 'This member is no longer available.' });
    }

    // Create message
    const message = await Message.create({
      match_id: match._id,
      sender_id: me,
      content: text
    });

    // Update match with last message info
    match.last_message = text;
    match.last_message_at = new Date();
    match.last_message_sender = me;

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
      sender_id: me
    });

    const isFirstMessage = previousMessages === 1; // Count is 1 because we just created the message

    // Only create notification for the first message from this user.
    // The message is already saved at this point, so a notification failure
    // must never fail the send - the recipient would get the message while
    // the sender saw an error and re-sent it, duplicating the conversation.
    try {
      if (isFirstMessage && await shouldCreateNotification(otherUserId, 'message')) {
        // Photos live on Profile, not User.
        const senderProfile = await Profile.findOne({ user_id: me });
        await Notification.create({
          user_id: otherUserId,
          type: 'message',
          title: 'New Message',
          message: `${req.user.first_name} sent you a message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
          avatar: senderProfile?.profile_picture_url || senderProfile?.photos?.[0] || '',
          related_user: me,
          related_match: match._id
        });
      }
    } catch (notificationError) {
      logger.error('[MESSAGES] Failed to create message notification:', notificationError.message);
    }

    // serializeMessage carries match_id, which the client uses to decide which
    // open thread an incoming realtime message belongs to.
    const messageResponse = serializeMessage(message, false);

    // Emit real-time message to the match room (reaches whoever has this
    // thread open).
    io.to(`match-${match._id}`).emit('new-message', messageResponse);

    // Ping the recipient's personal room on every message, not just the first.
    // The app-wide realtime provider listens here to bump the unread badge and
    // play the chime, so this has to fire wherever they are in the app.
    io.to(otherUserId.toString()).emit('new-notification', {
      type: 'message',
      match_id: match._id.toString(),
      message_id: message._id.toString(),
      preview: text.substring(0, 80),
      from: req.user.first_name
    });

    res.status(201).json(messageResponse);
  } catch (error) {
    logger.error('Send message error:', error.message);
    res.status(500).json({ message: 'Your message was not sent. Please try again.' });
  }
});

// Shared lookup for the edit/unsend routes: resolves the message only when the
// caller is in the match AND wrote the message themselves.
async function findOwnMessage(req) {
  const match = await Match.findOne({
    _id: req.params.matchId,
    users: req.userId.toString()
  });
  if (!match) return { error: { status: 404, message: 'Conversation not found' } };

  const message = await Message.findOne({
    _id: req.params.messageId,
    match_id: match._id.toString()
  });
  if (!message) return { error: { status: 404, message: 'Message not found' } };

  if (message.sender_id.toString() !== req.userId.toString()) {
    return { error: { status: 403, message: 'You can only change your own messages' } };
  }
  if (message.is_unsent) {
    return { error: { status: 409, message: 'This message was already unsent' } };
  }
  return { match, message };
}

// Keep the conversation preview honest after an edit or unsend - otherwise the
// sidebar keeps showing text the sender just changed or took back.
async function syncConversationPreview(match, message) {
  const isLatest = !match.last_message_at ||
    new Date(message.created_at).getTime() >= new Date(match.last_message_at).getTime() - 1000;
  if (!isLatest) return;

  match.last_message = message.is_unsent ? 'Message unsent' : message.content;
  await match.save();
}

// PUT /api/messages/:matchId/:messageId - Edit one of your own messages
router.put('/:matchId/:messageId', auth, validateIdParams('matchId', 'messageId'), async (req, res) => {
  try {
    const { content } = req.body;
    const io = req.app.get('io');

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Please write a message first.' });
    }
    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: 'Message is too long' });
    }

    const { match, message, error } = await findOwnMessage(req);
    if (error) return res.status(error.status).json({ message: error.message });

    if (message.content === content.trim()) {
      return res.json(serializeMessage(message, false));
    }

    message.content = content.trim();
    message.edited_at = new Date();
    await message.save();

    await syncConversationPreview(match, message);

    const payload = serializeMessage(message, false);
    io.to(`match-${match._id}`).emit('message-updated', payload);

    const otherUserId = otherUserIdOf(match, req.userId);
    if (otherUserId) {
      io.to(otherUserId.toString()).emit('message-updated', payload);
    }

    res.json(payload);
  } catch (error) {
    logger.error('[MESSAGES] Edit message error:', error.message);
    res.status(500).json({ message: 'Error editing message' });
  }
});

// DELETE /api/messages/:matchId/:messageId - Unsend one of your own messages
router.delete('/:matchId/:messageId', auth, validateIdParams('matchId', 'messageId'), async (req, res) => {
  try {
    const io = req.app.get('io');

    const { match, message, error } = await findOwnMessage(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const wasUnread = !message.read;
    message.is_unsent = true;
    message.unsent_at = new Date();
    message.content = '';
    await message.save();

    // A message taken back before it was read should not leave the other
    // person with an unread badge pointing at nothing.
    const otherUserId = otherUserIdOf(match, req.userId);
    if (wasUnread && otherUserId && match.unread_counts) {
      const current = match.unread_counts.get(otherUserId.toString()) || 0;
      match.unread_counts.set(otherUserId.toString(), Math.max(0, current - 1));
      await match.save();
    }

    await syncConversationPreview(match, message);

    const payload = serializeMessage(message, false);
    io.to(`match-${match._id}`).emit('message-updated', payload);

    if (otherUserId) {
      io.to(otherUserId.toString()).emit('message-updated', payload);
    }

    res.json(payload);
  } catch (error) {
    logger.error('[MESSAGES] Unsend message error:', error.message);
    res.status(500).json({ message: 'Error unsending message' });
  }
});

// DELETE /api/messages/:matchId - Delete conversation (soft delete for user)
router.delete('/:matchId', auth, validateIdParams('matchId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: me
    });

    if (!match) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Add current user to deleted_by array for all messages
    await Message.updateMany(
      { match_id: match._id },
      { $addToSet: { deleted_by: me } }
    );

    if (match.unread_counts) {
      match.unread_counts.set(me, 0);
      await match.save();
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete conversation error:', error.message);
    res.status(500).json({ message: 'Error deleting conversation' });
  }
});

// The old POST /broadcast endpoint is gone. It took no authentication and let
// any caller push a fabricated "new-message" into any member's chat; nothing
// in the app called it (messages are broadcast by the send route above).

export default router;
