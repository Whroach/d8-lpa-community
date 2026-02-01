# Real-Time Messaging Implementation

## Overview
The messaging system now uses Socket.io for real-time communication, allowing users to send and receive messages instantly without refreshing the page.

## How It Works

### Backend (Server)

1. **Socket.io Server Setup** (`server/src/index.js`)
   - Integrated Socket.io with Express HTTP server
   - CORS configured to allow connections from frontend
   - Socket connection handling with event listeners

2. **Socket Events**
   - `connection` - New client connects
   - `join` - User joins their personal room (userId)
   - `join-conversation` - User joins a specific conversation room (matchId)
   - `leave-conversation` - User leaves a conversation room
   - `disconnect` - Client disconnects

3. **Message Broadcasting** (`server/src/routes/messages.js`)
   - When a message is sent via POST `/api/messages/:matchId`:
     - Message is saved to MongoDB
     - `new-message` event is emitted to the conversation room
     - `new-notification` event is emitted to the recipient's personal room
   - All users in the conversation room receive the message instantly

### Frontend (Client)

1. **Socket.io Client** (`lib/socket.ts`)
   - Singleton socket instance
   - Auto-reconnection configured
   - Connection to `NEXT_PUBLIC_API_URL` (http://localhost:5001)

2. **Messages Page Integration** (`app/messages/page.tsx`)
   - Socket connects when component mounts
   - User joins their personal room for notifications
   - User joins/leaves conversation rooms when switching chats
   - Listens for `new-message` events and updates UI in real-time
   - Prevents duplicate messages

## Usage Flow

1. User A opens the messages page
   - Socket connects and joins User A's personal room
   
2. User A selects a conversation with User B
   - Socket joins the conversation room (match-{matchId})
   
3. User A sends a message
   - Message is sent via API POST request
   - Server saves message to database
   - Server emits `new-message` to conversation room
   - Both User A and User B (if online) receive the message instantly
   
4. User B sees the message appear in real-time
   - No page refresh needed
   - Conversation list updates with latest message

## Environment Variables

### Frontend (.env)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Backend (server/.env)
No additional variables needed - Socket.io uses the same port as Express (5001)

## Testing Real-Time Messaging

1. Open two browser windows/tabs
2. Log in as different users in each window
3. Ensure both users have matched with each other
4. Open the messages page in both windows
5. Select the conversation in both windows
6. Send a message from one window
7. The message should appear instantly in the other window

## Socket Rooms

- **Personal Room**: `userId` - Used for notifications
- **Conversation Room**: `match-{matchId}` - Used for real-time messages in specific conversations

## Benefits

- ✅ Instant message delivery
- ✅ No polling required
- ✅ Reduced server load
- ✅ Better user experience
- ✅ Real-time conversation updates
- ✅ Automatic reconnection on network issues
