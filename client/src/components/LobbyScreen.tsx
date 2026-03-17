import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Screen, RoomInfo } from '../App';
import { TeamConfig, TEAM_COLORS, RoomUpdatePayload } from 'shared/types';

interface Props {
  room: RoomInfo;
  navigate: (s: Screen) => void;
  onGameStarted: (teams: TeamConfig[]) => void;
}

export default function LobbyScreen({ room, navigate, onGameStarted }: Props) {
  const [teams, setTeams] = useState<TeamConfig[]>(room.teams);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    function onRoomUpdate(data: RoomUpdatePayload) {
      setTeams(data.teams);
    }
    function handleGameStarted(data: { teams: TeamConfig[] }) {
      onGameStarted(data.teams);
    }
    socket.on('room_update', onRoomUpdate);
    socket.on('game_started', handleGameStarted);
    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_started', handleGameStarted);
    };
  }, []);

  function startGame() {
    const teamsWithPlayers = teams.filter(t => t.count > 0);
    if (teamsWithPlayers.length < 2) {
      return setError('Necesitas al menos 1 jugador en 2 equipos diferentes.');
    }
    setStarting(true);
    socket.emit('start_game', { roomCode: room.roomCode, hostToken: room.hostToken }, (res: any) => {
      setStarting(false);
      if (res?.error) setError(res.error);
    });
  }

  const totalPlayers = teams.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="screen">
      <div className="lobby-header">
        <h2 className="section-title">Sala</h2>
        <div className="room-code-badge">{room.roomCode}</div>
      </div>

      <div className="question-box">
        <p className="question-label">La pregunta:</p>
        <p className="question-text">{room.question}</p>
      </div>

      <div className="teams-list">
        {room.answers.map((answer, i) => {
          const team = teams.find(t => t.index === i);
          const count = team?.count ?? 0;
          return (
            <div key={i} className="team-row" style={{ '--team-color': TEAM_COLORS[i] } as React.CSSProperties}>
              <span className="team-dot" style={{ background: TEAM_COLORS[i] }} />
              <span className="team-answer">{answer}</span>
              <span className="team-count">{count} 🗡️</span>
              {room.teamIndex === i && <span className="you-badge">TÚ</span>}
            </div>
          );
        })}
      </div>

      <p className="player-count">{totalPlayers} jugador{totalPlayers !== 1 ? 'es' : ''} conectado{totalPlayers !== 1 ? 's' : ''}</p>

      {room.isHost ? (
        <>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-big" onClick={startGame} disabled={starting}>
            {starting ? 'Iniciando...' : '⚔️ ¡Iniciar Pelea!'}
          </button>
          <p className="hint">Comparte el código <strong>{room.roomCode}</strong> con los jugadores.</p>
        </>
      ) : (
        <p className="waiting-msg">Esperando que el host inicie la pelea...</p>
      )}
    </div>
  );
}
