import { RoomInfo } from '../App';
import { GameOverPayload, TEAM_COLORS } from 'shared/types';
import AdBanner from './AdBanner';

interface Props {
  gameOver: GameOverPayload;
  room: RoomInfo;
  onRematch: () => void;
  onLeave: () => void;
}

export default function ResultsScreen({ gameOver, room, onRematch, onLeave }: Props) {
  const isDraw = gameOver.winnerTeamIndex === -1;
  const winnerColor = isDraw ? '#FFD700' : TEAM_COLORS[gameOver.winnerTeamIndex] ?? '#fff';

  return (
    <div className="screen center results-screen">
      <div className="result-glow" style={{ '--glow-color': winnerColor } as React.CSSProperties}>
        {isDraw ? (
          <>
            <div className="result-emoji">🤝</div>
            <h2 className="result-title">¡Empate!</h2>
          </>
        ) : (
          <>
            <div className="result-emoji">🏆</div>
            <h2 className="result-title" style={{ color: winnerColor }}>¡GANA!</h2>
            <div className="winner-ball-big" style={{ background: winnerColor }} />
            <p className="winner-answer">{gameOver.winnerAnswer}</p>
          </>
        )}
      </div>

      <div className="stats-box">
        <p className="stats-title">Participantes por bando:</p>
        {room.answers.map((answer, i) => (
          <div key={i} className="stat-row">
            <span className="stat-dot" style={{ background: TEAM_COLORS[i] }} />
            <span className="stat-answer">{answer}</span>
            <span className="stat-count">{gameOver.teamCounts[i] ?? 0}</span>
          </div>
        ))}
      </div>

      <p className="anon-note">🔒 Todas las respuestas son anónimas.</p>

      <AdBanner slot="results-mid" />

      {room.isHost && (
        <button className="btn btn-primary btn-big" onClick={onRematch}>
          ⚔️ Volver a Pelear
        </button>
      )}
      <button className="btn btn-ghost" onClick={onLeave}>
        ← Salir al inicio
      </button>
    </div>
  );
}
