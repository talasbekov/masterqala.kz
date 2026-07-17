import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1$/, '');
    socket = io(base, { auth: { token: localStorage.getItem('token') } });
  }
  return socket;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
