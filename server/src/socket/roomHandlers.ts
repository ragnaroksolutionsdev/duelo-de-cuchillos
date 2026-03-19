import { Server, Socket } from 'socket.io';
import {
  createRoom, joinRoom, removePlayer, startGame, startSoloGame,
  rematchRoom, getRoom,
} from '../game/RoomManager';
import { startGameLoop } from '../game/GameLoop';
import { createRoom as dbCreateRoom, updateRoomStatus } from '../db/roomRepository';
import { TEAM_COLORS } from '../../../shared/types';

const LOBBY_COUNTDOWN_SECS = 5; // public: countdown in lobby so players can switch team
const SOLO_COUNTDOWN_SECS  = 3; // solo:   countdown in game screen while Phaser loads

function buildTeams(room: ReturnType<typeof getRoom>) {
  if (!room) return [];
  return room.answers.map((answer, i) => ({
    index: i,
    answer,
    color: TEAM_COLORS[i] ?? '#FFFFFF',
    count: room.players.filter(p => p.teamIndex === i).length,
  }));
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
  socket.on('create_room', async (data: {
    question: string; answers: string[]; mode?: 'public' | 'solo'; ballsPerTeam?: number
  }, cb) => {
    try {
      if (!data.question?.trim() || !Array.isArray(data.answers) || data.answers.length < 2) {
        return cb?.({ error: 'Necesitas una pregunta y al menos 2 respuestas.' });
      }
      const answers = data.answers.slice(0, 4).map(a => a.trim()).filter(Boolean);
      if (answers.length < 2) return cb?.({ error: 'Mínimo 2 respuestas.' });

      const mode = data.mode === 'solo' ? 'solo' : 'public';
      const ballsPerTeam = typeof data.ballsPerTeam === 'number' ? data.ballsPerTeam : 5;
      // Store ballsPerTeam in room so rematch can reuse it
      const room = createRoom(socket.id, data.question.trim(), answers, mode, ballsPerTeam);
      socket.join(room.code);
      dbCreateRoom(room.code, room.question, room.answers).catch(console.error);

      if (mode === 'solo') {
        const started = startSoloGame(room.code, room.hostToken, ballsPerTeam);
        if (typeof started === 'string') return cb?.({ error: 'Error al iniciar.' });

        updateRoomStatus(room.code, 'playing', { started_at: new Date().toISOString() }).catch(console.error);

        // Emit game_started first so client navigates to game screen, THEN countdown
        io.to(room.code).emit('game_started', {
          teams: buildTeams(room), question: room.question, answers: room.answers,
        });

        let count = SOLO_COUNTDOWN_SECS;
        const interval = setInterval(() => {
          io.to(room.code).emit('countdown', { count });
          count--;
          if (count < 0) { clearInterval(interval); startGameLoop(io, started); }
        }, 1000);

        cb?.({
          roomCode: room.code, hostToken: room.hostToken,
          question: room.question, answers: room.answers,
          teams: buildTeams(room), mode: 'solo', autoStart: true,
        });
      } else {
        cb?.({
          roomCode: room.code, hostToken: room.hostToken,
          question: room.question, answers: room.answers,
          teams: buildTeams(room), mode: 'public', autoStart: false,
        });
      }
    } catch {
      cb?.({ error: 'Error al crear la sala.' });
    }
  });

  // Join an existing room
  socket.on('join_room', (data: { roomCode: string; teamIndex: number }, cb) => {
    const result = joinRoom(data.roomCode?.toUpperCase(), socket.id, data.teamIndex);
    if (!result) return cb?.({ error: 'Sala no encontrada, llena o código inválido.' });

    const { player, room } = result;
    socket.join(room.code);
    io.to(room.code).emit('room_update', { teams: buildTeams(room), status: room.status });

    cb?.({
      ballId: player.ballId, teamIndex: player.teamIndex,
      teamColor: TEAM_COLORS[player.teamIndex] ?? '#FFFFFF',
      question: room.question, answers: room.answers, teams: buildTeams(room),
    });
  });

  // Start the game (host only, public rooms)
  // Countdown runs in LOBBY so players can still change team before balls spawn
  socket.on('start_game', (data: { roomCode: string; hostToken: string }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room) return cb?.({ error: 'Sala no encontrada.' });
    if (room.hostToken !== data.hostToken) return cb?.({ error: 'Token inválido — recarga la página.' });
    if (room.status !== 'waiting') return cb?.({ error: 'La sala ya está en juego o terminada.' });

    const presentTeams = new Set(room.players.map(p => p.teamIndex));
    if (presentTeams.size < 2) return cb?.({ error: 'Necesitas al menos 1 jugador en 2 equipos distintos.' });

    cb?.({ ok: true });

    // Countdown in lobby — status stays 'waiting', change_team still works
    let count = LOBBY_COUNTDOWN_SECS;
    const interval = setInterval(() => {
      io.to(room.code).emit('lobby_countdown', { count });
      count--;
      if (count < 0) {
        clearInterval(interval);
        const result = startGame(data.roomCode!.toUpperCase(), data.hostToken);
        if (typeof result === 'string') return; // edge case: team left during countdown

        updateRoomStatus(result.code, 'playing', { started_at: new Date().toISOString() }).catch(console.error);
        io.to(result.code).emit('game_started', {
          teams: buildTeams(result), question: result.question, answers: result.answers,
        });
        startGameLoop(io, result);
      }
    }, 1000);
  });

  // Change team before game starts (works during lobby countdown too)
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

  // Rematch — host resets and restarts using stored config
  socket.on('rematch', (data: { roomCode: string; hostToken: string }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room || room.hostToken !== data.hostToken) return cb?.({ error: 'No autorizado.' });

    const reset = rematchRoom(room.code);
    if (!reset) return cb?.({ error: 'Sala no encontrada.' });

    if (reset.mode === 'solo') {
      // Use stored ballsPerTeam from original creation
      const started = startSoloGame(reset.code, data.hostToken, reset.ballsPerTeam);
      if (typeof started === 'string') return cb?.({ error: 'Error al reiniciar.' });

      io.to(reset.code).emit('game_started', {
        teams: buildTeams(reset), question: reset.question, answers: reset.answers,
      });

      let count = SOLO_COUNTDOWN_SECS;
      const interval = setInterval(() => {
        io.to(reset.code).emit('countdown', { count });
        count--;
        if (count < 0) { clearInterval(interval); startGameLoop(io, started); }
      }, 1000);

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
