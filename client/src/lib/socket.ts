import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let trainerSocket: Socket | null = null;
let traineeSocket: Socket | null = null;

export function getTrainerSocket(): Socket {
  if (!trainerSocket) {
    trainerSocket = io(`${WS_URL}/trainer`, {
      autoConnect: false,
      withCredentials: true, // C-1: Send httpOnly cookies on handshake
    });
  }
  return trainerSocket;
}

export function getTraineeSocket(): Socket {
  if (!traineeSocket) {
    traineeSocket = io(`${WS_URL}/trainee`, {
      autoConnect: false,
      withCredentials: true, // C-1: Send httpOnly cookies on handshake
    });
  }
  return traineeSocket;
}

export function disconnectAll() {
  trainerSocket?.disconnect();
  traineeSocket?.disconnect();
  trainerSocket = null;
  traineeSocket = null;
}

/**
 * H-9: Force reconnect all active sockets (called after token refresh).
 * This ensures sockets pick up the new access token cookie.
 */
export function reconnectAll() {
  if (trainerSocket?.connected) {
    trainerSocket.disconnect();
    trainerSocket.connect();
  }
  if (traineeSocket?.connected) {
    traineeSocket.disconnect();
    traineeSocket.connect();
  }
}
