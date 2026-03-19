import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Screen, RoomInfo } from '../App';
import { TeamConfig, TEAM_COLORS, RoomUpdatePayload } from 'shared/types';
import ShareModal from './ShareModal';

interface Props {
  room: RoomInfo;
  navigate: (s: Screen) => void;
  onGameStarted: (teams: TeamConfig[]) => void;
}

export default function LobbyScreen({ room, navigate, onGameStarted }: Props) {
  const [teams, setTeams] = useState<TeamConfig[]>(room.teams);
  const [myTeamIndex, setMyTeamIndex] = useState<number | undefined>(room.teamIndex);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [changingTeam, setChangingTeam] = useState(false);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    function onRoomUpdate(data: RoomUpdatePayload) { setTeams(data.teams); }
    function handleGameStarted(data: { teams: TeamConfig[] }) { onGameStarted(data.teams); }
    function handleLobbyCountdown(data: { count: number }) {
      setLobbyCountdown(data.count);
      setStarting(true);
    }
    function handleLobbyReset() {
      setLobbyCountdown(null);
      setStarting(false);
      setError('Un jugador se fue. Vuelve a iniciar la pelea.');
    }
    socket.on('room_update', onRoomUpdate);
    socket.on('game_started', handleGameStarted);
    socket.on('lobby_countdown', handleLobbyCountdown);
    socket.on('lobby_reset', handleLobbyReset);
    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_started', handleGameStarted);
      socket.off('lobby_countdown', handleLobbyCountdown);
      socket.off('lobby_reset', handleLobbyReset);
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

  function switchTeam(newTeamIndex: number) {
    socket.emit('change_team', { roomCode: room.roomCode, newTeamIndex }, (res: any) => {
      if (res?.error) return setError(res.error);
      setMyTeamIndex(res.teamIndex);
      setChangingTeam(false);
    });
  }

  const totalPlayers = teams.reduce((sum, t) => sum + t.count, 0);
  const myColor = myTeamIndex !== undefined ? TEAM_COLORS[myTeamIndex] : undefined;

  // Show team picker overlay
  if (changingTeam) {
    return (
      <div className="screen">
        <button className="btn-back" onClick={() => setChangingTeam(false)}>← Volver</button>
        <h2 className="section-title">Cambiar respuesta</h2>
        <div className="question-box">
          <p className="question-label">La pregunta:</p>
          <p className="question-text">{room.question}</p>
        </div>
        <div className="team-grid">
          {room.answers.map((answer, i) => (
            <button
              key={i}
              className={`btn btn-team${myTeamIndex === i ? ' selected' : ''}`}
              style={{ '--team-color': TEAM_COLORS[i] } as React.CSSProperties}
              onClick={() => switchTeam(i)}
            >
              <span className="team-ball" style={{ background: TEAM_COLORS[i] }} />
              {answer}
              {myTeamIndex === i && <span style={{ fontSize: 7, opacity: 0.8 }}>✓ actual</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ position: 'relative' }}>
      {/* Countdown overlay while host has started but balls not yet spawned */}
      {lobbyCountdown !== null && (
        <div className="lobby-countdown-overlay">
          <div className="lobby-countdown-box">
            <p className="lobby-countdown-label">
              {lobbyCountdown > 0 ? `Empezando en...` : '¡PELEA!'}
            </p>
            <span className="lobby-countdown-number">
              {lobbyCountdown > 0 ? lobbyCountdown : '⚔️'}
            </span>
            {lobbyCountdown > 0 && myTeamIndex !== undefined && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12, fontSize: 7 }}
                onClick={() => setChangingTeam(true)}
              >
                <span style={{ color: TEAM_COLORS[myTeamIndex] }}>●</span> Cambiar ahora
              </button>
            )}
          </div>
        </div>
      )}

      {showShare && <ShareModal roomCode={room.roomCode} onClose={() => setShowShare(false)} />}

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
              {myTeamIndex === i && <span className="you-badge">TÚ</span>}
            </div>
          );
        })}
      </div>

      <p className="player-count">{totalPlayers} jugador{totalPlayers !== 1 ? 'es' : ''} conectado{totalPlayers !== 1 ? 's' : ''}</p>

      {/* Change team button (non-hosts and non-solo) */}
      {myTeamIndex !== undefined && (
        <button className="btn btn-ghost" onClick={() => setChangingTeam(true)}>
          <span style={{ color: myColor }}>●</span> Cambiar respuesta
        </button>
      )}

      <button className="btn btn-ghost" onClick={() => setShowShare(true)}>
        🔗 Compartir sala
      </button>

      {room.isHost ? (
        <>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-big" onClick={startGame} disabled={starting}>
            {starting ? 'Iniciando...' : '⚔️ ¡Iniciar Pelea!'}
          </button>
        </>
      ) : (
        <p className="waiting-msg">Esperando que el host inicie la pelea...</p>
      )}
    </div>
  );
}
