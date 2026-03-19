import { Server, Socket } from 'socket.io';
import {
  createRoom, joinRoom, removePlayer, startGame, startSoloGame,
  rematchRoom, getRoom, StartGameError,
} from '../game/RoomManager';
import { startGameLoop } from '../game/GameLoop';
import { createRoom as dbCreateRoom, updateRoomStatus } from '../db/roomRepository';
import { TEAM_COLORS } from '../../../shared/types';

const COUNTDOWN_SECS = 5;

function buildTeams(room: ReturnType<typeof getRoom>) {
  if (!room) return [];
  return room.answers.map((answer, i) => ({
    index: i,
    answer,
    color: TEAM_COLORS[i] ?? '#FFFFFF',
    count: room.players.filter(p => p.teamIndex === i).length,
  }));
}

function runCountdown(io: Server, room: ReturnType<typeof getRoom>, onDone: () => void) {
  if (!room) return;
  let count = COUNTDOWN_SECS;
  const interval = setInterval(() => {
    io.to(room.code).emit('countdown', { count });
    count--;
    if (count < 0) { clearInterval(interval); onDone(); }
  }, 1000);
}

export function registerHandlers(io: Server, socket: Socket) {
  // Peek at room info without joining
  socket.on('get_room', (data: { roomCode: string }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room || room.status !== 'waiting') {
      return cb?.({ error: 'Sala no encontrada o ya en juego.' });
    }
    cb?.({ question: room.question, answers: room.answers, teams: buildTeams(room), mode: room.mode });
  });

  // Create a new room (public or solo)
  socket.on('create_room', async (data: { question: string; answers: string[]; mode?: 'public' | 'solo' }, cb) => {
    try {
      if (!data.question?.trim() || !Array.isArray(data.answers) || data.answers.length < 2) {
        return cb?.({ error: 'Necesitas una pregunta y al menos 2 respuestas.' });
      }
      const answers = data.answers.slice(0, 4).map(a => a.trim()).filter(Boolean);
      if (answers.length < 2) return cb?.({ error: 'Mínimo 2 respuestas.' });

      const mode = data.mode === 'solo' ? 'solo' : 'public';
      const room = createRoom(socket.id, data.question.trim(), answers, mode);
      socket.join(room.code);
      dbCreateRoom(room.code, room.question, room.answers).catch(console.error);

      if (mode === 'solo') {
        // Auto-start immediately with fake balls
        const ballsPerTeam = typeof (data as any).ballsPerTeam === 'number' ? (data as any).ballsPerTeam : 5;
        const started = startSoloGame(room.code, room.hostToken, ballsPerTeam);
        if (typeof started === 'string') return cb?.({ error: 'Error al iniciar.' });

        updateRoomStatus(room.code, 'playing', { started_at: new Date().toISOString() }).catch(console.error);

        io.to(room.code).emit('game_started', {
          teams: buildTeams(room),
          question: room.question,
          answers: room.answers,
        });

        runCountdown(io, room, () => startGameLoop(io, started));

        cb?.({
          roomCode: room.code,
          hostToken: room.hostToken,
          question: room.question,
          answers: room.answers,
          teams: buildTeams(room),
          mode: 'solo',
          autoStart: true,
        });
      } else {
        cb?.({
          roomCode: room.code,
          hostToken: room.hostToken,
          question: room.question,
          answers: room.answers,
          teams: buildTeams(room),
          mode: 'public',
          autoStart: false,
        });
      }
    } catch (err) {
      cb?.({ error: 'Error al crear la sala.' });
    }
  });

  // Join an existing room
  socket.on('join_room', (data: { roomCode: string; teamIndex: number }, cb) => {
    const result = joinRoom(data.roomCode?.toUpperCase(), socket.id, data.teamIndex);
    if (!result) {
      return cb?.({ error: 'Sala no encontrada, llena o código inválido.' });
    }
    const { player, room } = result;
    socket.join(room.code);

    io.to(room.code).emit('room_update', { teams: buildTeams(room), status: room.status });

    cb?.({
      ballId: player.ballId,
      teamIndex: player.teamIndex,
      teamColor: TEAM_COLORS[player.teamIndex] ?? '#FFFFFF',
      question: room.question,
      answers: room.answers,
      teams: buildTeams(room),
    });
  });

  // Start the game (host only, public rooms)
  socket.on('start_game', (data: { roomCode: string; hostToken: string }, cb) => {
    const result = startGame(data.roomCode?.toUpperCase(), data.hostToken);
    if (typeof result === 'string') {
      const msgs: Record<StartGameError, string> = {
        not_found:        'Sala no encontrada.',
        bad_token:        'Token inválido — recarga la página.',
        wrong_status:     'La sala ya está en juego o terminada.',
        not_enough_teams: 'Necesitas al menos 1 jugador en 2 equipos distintos.',
      };
      return cb?.({ error: msgs[result] });
    }

    updateRoomStatus(result.code, 'playing', { started_at: new Date().toISOString() }).catch(console.error);

    io.to(result.code).emit('game_started', {
      teams: buildTeams(result),
      question: result.question,
      answers: result.answers,
    });

    runCountdown(io, result, () => startGameLoop(io, result));
    cb?.({ ok: true });
  });

  // Change team before game starts
  socket.on('change_team', (data: { roomCode: string; newTeamIndex: number }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room || room.status !== 'waiting') return cb?.({ error: 'Sala no disponible.' });
    if (data.newTeamIndex < 0 || data.newTeamIndex >= room.answers.length) return cb?.({ error: 'Equipo inválido.' });

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return cb?.({ error: 'No estás en esta sala.' });

    player.teamIndex = data.newTeamIndex;
    io.to(room.code).emit('room_update', { teams: buildTeams(room), status: room.status });
    cb?.({ teamIndex: data.newTeamIndex, teamColor: TEAM_COLORS[data.newTeamIndex] ?? '#FFFFFF' });
  });

  // Rematch — host resets room and restarts
  socket.on('rematch', (data: { roomCode: string; hostToken: string }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room || room.hostToken !== data.hostToken) return cb?.({ error: 'No autorizado.' });

    const reset = rematchRoom(room.code);
    if (!reset) return cb?.({ error: 'Sala no encontrada.' });

    if (reset.mode === 'solo') {
      const started = startSoloGame(reset.code, data.hostToken);
      if (typeof started === 'string') return cb?.({ error: 'Error al reiniciar.' });

      io.to(reset.code).emit('game_started', {
        teams: buildTeams(reset),
        question: reset.question,
        answers: reset.answers,
      });
      runCountdown(io, reset, () => startGameLoop(io, started));
      io.to(reset.code).emit('room_reset', { autoStart: true });
    } else {
      io.to(reset.code).emit('room_reset', { autoStart: false });
    }

    cb?.({ ok: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const result = removePlayer(socket.id);
    if (result) {
      const { room } = result;
      if (room.status === 'waiting') {
        io.to(room.code).emit('room_update', { teams: buildTeams(room), status: room.status });
      }
    }
  });
}