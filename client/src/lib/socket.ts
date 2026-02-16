import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let trainerSocket: Socket | null = null;
let traineeSocket: Socket | null = null;

export function getTrainerSocket(): Socket {
  if (!trainerSocket) {
    trainerSocket = io(`${WS_URL}/trainer`, {
      autoConnect: false,
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('token') : '',
      },
    });
  }
  return trainerSocket;
}

export function getTraineeSocket(): Socket {
  if (!traineeSocket) {
    traineeSocket = io(`${WS_URL}/trainee`, {
      autoConnect: false,
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('token') : '',
      },
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
