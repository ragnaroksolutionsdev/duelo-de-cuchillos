import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { RoomInfo } from '../App';
import { GameOverPayload, TEAM_COLORS } from 'shared/types';
import PhaserGame from './PhaserGame';
import { playBeep } from '../game/SoundEngine';

interface Props {
  room: RoomInfo;
  onGameOver: (payload: GameOverPayload) => void;
}

export default function GameScreen({ room, onGameOver }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [suddenDeathLevel, setSuddenDeathLevel] = useState(0);
  const socket = getSocket();

  useEffect(() => {
    function handleCountdown(data: { count: number }) {
      setCountdown(data.count);
      playBeep(data.count === 0 ? 880 : 440);
      if (data.count === 0) {
        setTimeout(() => setCountdown(null), 600);
      }
    }
    function handleGameOver(payload: GameOverPayload) {
      // Wait 4s so users can see the winning animation in the arena
      setTimeout(() => onGameOver(payload), 4000);
    }
    function handleSuddenDeath(data: { level: number }) {
      setSuddenDeathLevel(data.level);
      playBeep(220, 0.4);
      setTimeout(() => playBeep(220, 0.4), 200);
      setTimeout(() => playBeep(160, 0.5), 400);
    }
    socket.on('countdown', handleCountdown);
    socket.on('game_over', handleGameOver);
    socket.on('sudden_death', handleSuddenDeath);
    return () => {
      socket.off('countdown', handleCountdown);
      socket.off('game_over', handleGameOver);
      socket.off('sudden_death', handleSuddenDeath);
    };
  }, []);

  return (
    <div className="screen game-screen">
      <div className="arena-header">
        <span className="room-code-small">{room.roomCode}</span>
        <span className="arena-title">⚔️ ARENA ⚔️</span>
        {room.teamColor && (
          <span className="your-team-dot" style={{ background: room.teamColor }} title="Tu equipo" />
        )}
      </div>

      <div className="arena-wrapper">
        <PhaserGame room={room} socket={socket} />

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div className="countdown-overlay">
            <span className="countdown-number">{countdown}</span>
          </div>
        )}
        {countdown === 0 && (
          <div className="countdown-overlay fight-text">
            <span className="countdown-number">¡PELEA!</span>
          </div>
        )}
      </div>

      {/* Sudden death banner — shows level */}
      {suddenDeathLevel > 0 && (
        <div className="sudden-death-banner">
          ⚡ MUERTE SÚBITA — NIVEL {suddenDeathLevel} ⚡
        </div>
      )}

      {/* Instructions */}
      <div className="game-instructions">
        <p>Las bolitas se pelean solas.</p>
        <p>
          {room.answers?.map((answer, i) => (
            <span key={i} style={{ color: TEAM_COLORS[i], marginRight: 12 }}>
              ● {answer}
            </span>
          ))}
        </p>
        <p>Gana el bando que sobreviva en el ring.</p>
      </div>
    </div>
  );
}
