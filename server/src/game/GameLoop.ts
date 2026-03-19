import { Server } from 'socket.io';
import { tick, checkWinner } from './PhysicsEngine';
import { getRoom, deleteRoom, RoomState } from './RoomManager';
import { TICK_MS } from '../config';
import { saveResult, updateRoomStatus } from '../db/roomRepository';

const SUDDEN_DEATH_TICKS = Math.floor(30_000 / TICK_MS); // ~30 seconds

const activeLoops = new Map<string, NodeJS.Timeout>();

export function startGameLoop(io: Server, room: RoomState) {
  if (activeLoops.has(room.code)) return;

  let suddenDeathEmitted = false;

  const interval = setInterval(() => {
    const r = getRoom(room.code);
    if (!r || r.status !== 'playing') {
      clearInterval(interval);
      activeLoops.delete(room.code);
      return;
    }

    const suddenDeath = r.tick >= SUDDEN_DEATH_TICKS;

    if (suddenDeath && !suddenDeathEmitted) {
      suddenDeathEmitted = true;
      io.to(room.code).emit('sudden_death');
    }

    const { balls, hits } = tick(r.balls, suddenDeath);
    r.tick++;

    const ballRadius = r.tick === 1
      ? Math.max(9, 18 - Math.floor(r.balls.length / 4))
      : undefined;

    io.to(room.code).emit('game_state', {
      tick: r.tick,
      balls: balls.map(b => ({
        id: b.id,
        teamIndex: b.teamIndex,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        heading: Math.round(b.heading * 100) / 100,
        alive: b.alive,
        hp: b.hp,
      })),
      hits,
      ballRadius,
    });

    const winner = checkWinner(r.balls);
    if (winner !== null) {
      clearInterval(interval);
      activeLoops.delete(room.code);
      r.status = 'finished';

      const teamCounts: Record<number, number> = {};
      r.players.forEach(p => {
        teamCounts[p.teamIndex] = (teamCounts[p.teamIndex] ?? 0) + 1;
      });

      const winnerAnswer = winner >= 0 ? r.answers[winner] : 'Empate';

      io.to(room.code).emit('game_over', {
        winnerTeamIndex: winner,
        winnerAnswer,
        teamCounts,
      });

      updateRoomStatus(r.code, 'finished', { finished_at: new Date().toISOString() }).catch(console.error);
      if (winner >= 0) {
        saveResult({
          roomCode: r.code,
          winnerTeamIndex: winner,
          winnerAnswer,
          teamPlayerCounts: teamCounts,
          totalTicks: r.tick,
        }).catch(console.error);
      }

      setTimeout(() => deleteRoom(r.code), 30_000);
    }
  }, TICK_MS);

  activeLoops.set(room.code, interval);
}

export function stopGameLoop(code: string) {
  const interval = activeLoops.get(code);
  if (interval) { clearInterval(interval); activeLoops.delete(code); }
}
