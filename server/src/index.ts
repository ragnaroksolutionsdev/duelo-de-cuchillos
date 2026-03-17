import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PORT, CLIENT_ORIGIN } from './config';
import { registerHandlers } from './socket/roomHandlers';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  transports: ['websocket'],
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`🗡️  Duelo de Cuchillos server on :${PORT}`);
});
