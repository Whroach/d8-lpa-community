/**
 * Socket.io wiring.
 *
 * Every connection must present the same JWT the REST API uses. Before this,
 * any visitor could connect and `join` another member's personal room or any
 * conversation room just by knowing (or guessing) an id, and would then
 * receive that member's messages and notifications in real time.
 *
 * Rooms:
 *   <userId>            personal room - badges, chime, read receipts
 *   match-<matchId>     an open conversation - new/edited messages, typing
 */
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Match from './models/Match.js';
import UserPrivacySettings from './models/UserPrivacySettings.js';
import logger from './utils/logger.js';

// userId -> number of live sockets. In-memory is fine for a single API
// instance; with several instances "online" simply becomes per-instance.
const onlineCounts = new Map();

export function isOnline(userId) {
  return (onlineCounts.get(String(userId)) || 0) > 0;
}

export async function findActiveMatchFor(matchId, userId) {
  if (typeof matchId !== 'string' || !/^[a-f0-9]{24}$/i.test(matchId)) return null;
  return Match.findOne({ _id: matchId, users: String(userId) });
}

export function setupRealtime(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== 'string') return next(new Error('unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(decoded.userId).select(
        'is_banned is_suspended is_deleted is_disabled'
      );
      if (!user || user.is_banned || user.is_suspended || user.is_deleted || user.is_disabled) {
        return next(new Error('unauthorized'));
      }
      socket.data.userId = user._id.toString();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);

    // A socket is always in its owner's personal room, and only that one.
    socket.join(userId);

    // Kept for older clients that still emit `join`: the id they send is
    // ignored, they only ever get their own room.
    socket.on('join', () => {
      socket.join(userId);
    });

    socket.on('join-conversation', async (matchId) => {
      try {
        const match = await findActiveMatchFor(matchId, userId);
        if (!match) return;
        socket.join(`match-${match._id}`);
      } catch (error) {
        logger.error('[SOCKET] join-conversation failed:', error.message);
      }
    });

    socket.on('leave-conversation', (matchId) => {
      if (typeof matchId === 'string') socket.leave(`match-${matchId}`);
    });

    // "Sam is typing..." - relayed only to the other person in a conversation
    // the sender really belongs to. Nothing is stored.
    socket.on('typing', async (payload) => {
      try {
        const matchId = payload?.match_id;
        const match = await findActiveMatchFor(matchId, userId);
        if (!match || match.is_active === false) return;
        socket.to(`match-${match._id}`).emit('typing', {
          match_id: match._id.toString(),
          user_id: userId,
          typing: payload?.typing !== false,
        });
      } catch (error) {
        logger.error('[SOCKET] typing failed:', error.message);
      }
    });

    socket.on('disconnect', () => {
      const remaining = (onlineCounts.get(userId) || 1) - 1;
      if (remaining <= 0) onlineCounts.delete(userId);
      else onlineCounts.set(userId, remaining);
    });
  });
}

/** Whether `ownerId` lets other members see that they are online. */
export async function sharesOnlineStatus(ownerId) {
  const settings = await UserPrivacySettings.findOne({ user_id: String(ownerId) });
  return settings?.show_online !== false;
}

/** Whether `ownerId` sends read receipts. */
export async function sendsReadReceipts(ownerId) {
  const settings = await UserPrivacySettings.findOne({ user_id: String(ownerId) });
  return settings?.read_receipts !== false;
}
