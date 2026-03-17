import { v4 as uuidv4 } from 'uuid';
import { Ball, createBall } from './PhysicsEngine';

export interface Player {
  socketId: string;
  ballId: string;
  teamIndex: number;
}

export interface RoomState {
  code: string;
  question: string;
  answers: string[];
  hostSocketId: string;
  hostToken: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  balls: Ball[];
  tick: number;
}

const rooms = new Map<string, RoomState>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateCode() : code;
}

export function createRoom(hostSocketId: string, question: string, answers: string[]): RoomState {
  const code = generateCode();
  const hostToken = uuidv4();
  const room: RoomState = {
    code,
    question,
    answers,
    hostSocketId,
    hostToken,
    status: 'waiting',
    players: [],
    balls: [],
    tick: 0,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RoomState | undefined {
  return rooms.get(code);
}

export function joinRoom(code: string, socketId: string, teamIndex: number): { player: Player; room: RoomState } | null {
  const room = rooms.get(code);
  if (!room || room.status !== 'waiting') return null;
  if (teamIndex < 0 || teamIndex >= room.answers.length) return null;

  const ballId = uuidv4();
  const player: Player = { socketId, ballId, teamIndex };
  room.players.push(player);
  return { player, room };
}

export function removePlayer(socketId: string): { room: RoomState; player: Player } | null {
  for (const room of rooms.values()) {
    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) continue;
    const player = room.players[idx];
    if (room.status === 'waiting') {
      room.players.splice(idx, 1);
    }
    return { room, player };
  }
  return null;
}

export type StartGameError = 'not_found' | 'bad_token' | 'wrong_status' | 'not_enough_teams';

export function startGame(code: string, hostToken: string): RoomState | StartGameError {
  const room = rooms.get(code);
  if (!room) return 'not_found';
  if (room.hostToken !== hostToken) return 'bad_token';
  if (room.status !== 'waiting') return 'wrong_status';

  // Need at least 2 teams represented
  const teams = new Set(room.players.map(p => p.teamIndex));
  if (teams.size < 2) return 'not_enough_teams';

  // Spawn balls
  const teamCount = room.answers.length;
  room.balls = room.players.map((player, i) => {
    const teamOffset = (player.teamIndex / teamCount) * Math.PI * 2;
    const withinTeam = room.players
      .filter(p => p.teamIndex === player.teamIndex)
      .findIndex(p => p.socketId === player.socketId);
    const spread = (withinTeam * 0.4) - 0.2;
    return createBall(player.ballId, player.teamIndex, teamOffset + spread);
  });

  room.status = 'playing';
  room.tick = 0;
  return room;
}

export function deleteRoom(code: string) {
  rooms.delete(code);
}
