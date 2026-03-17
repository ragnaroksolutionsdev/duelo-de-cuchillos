import { Server, Socket } from 'socket.io';
import { createRoom, joinRoom, removePlayer, startGame, getRoom, StartGameError } from '../game/RoomManager';
import { startGameLoop } from '../game/GameLoop';
import { createRoom as dbCreateRoom, updateRoomStatus } from '../db/roomRepository';
import { TEAM_COLORS } from '../../../shared/types';

const COUNTDOWN_SECS = 3;

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
  // Peek at room info without joining (for JoinScreen)
  socket.on('get_room', (data: { roomCode: string }, cb) => {
    const room = getRoom(data.roomCode?.toUpperCase());
    if (!room || room.status !== 'waiting') {
      return cb?.({ error: 'Sala no encontrada o ya en juego.' });
    }
    cb?.({ question: room.question, answers: room.answers, teams: buildTeams(room) });
  });

  // Create a new room
  socket.on('create_room', async (data: { question: string; answers: string[] }, cb) => {
    try {
      if (!data.question?.trim() || !Array.isArray(data.answers) || data.answers.length < 2) {
        return cb?.({ error: 'Necesitas una pregunta y al menos 2 respuestas.' });
      }
      const answers = data.answers.slice(0, 4).map(a => a.trim()).filter(Boolean);
      if (answers.length < 2) return cb?.({ error: 'Mínimo 2 respuestas.' });

      const room = createRoom(socket.id, data.question.trim(), answers);
      socket.join(room.code);
      dbCreateRoom(room.code, room.question, room.answers).catch(console.error);

      cb?.({
        roomCode: room.code,
        hostToken: room.hostToken,
        question: room.question,
        answers: room.answers,
        teams: buildTeams(room),
      });
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

    io.to(room.code).emit('room_update', {
      teams: buildTeams(room),
      status: room.status,
    });

    cb?.({
      ballId: player.ballId,
      teamIndex: player.teamIndex,
      teamColor: TEAM_COLORS[player.teamIndex] ?? '#FFFFFF',
      question: room.question,
      answers: room.answers,
      teams: buildTeams(room),
    });
  });

  // Start the game (host only) — countdown then loop
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

    // Countdown before physics loop starts — gives clients time to init Phaser
    let count = COUNTDOWN_SECS;
    const tick = setInterval(() => {
      io.to(result.code).emit('countdown', { count });
      count--;
      if (count < 0) {
        clearInterval(tick);
        startGameLoop(io, result);
      }
    }, 1000);

    cb?.({ ok: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const result = removePlayer(socket.id);
    if (result) {
      const { room } = result;
      if (room.status === 'waiting') {
        io.to(room.code).emit('room_update', {
          teams: buildTeams(room),
          status: room.status,
        });
      }
    }
  });
}
