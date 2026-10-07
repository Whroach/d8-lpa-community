import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** The signed-in member's token, straight from the persisted auth store. */
function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('spark-auth') || '{}')?.state?.token || null;
  } catch {
    return null;
  }
}

export const getSocket = (): Socket => {
  if (!socket) {
    // Remove /api suffix from API_URL for Socket.io connection
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const socketUrl = apiUrl.replace(/\/api$/, '');

    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      // Keep trying: a phone that has been asleep for an hour should pick the
      // conversation back up, not sit silent until the page is reloaded.
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      // The server only accepts connections that prove who they are. Evaluated
      // on every (re)connection, so a fresh login is picked up automatically.
      auth: (cb) => cb({ token: readToken() }),
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
