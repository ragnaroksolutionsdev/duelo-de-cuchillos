import { useState } from 'react';
import { getSocket } from '../lib/socket';
import { Screen, RoomInfo } from '../App';
import { TeamConfig, TEAM_COLORS } from 'shared/types';

interface Props {
  navigate: (s: Screen) => void;
  onRoomCreated: (info: RoomInfo) => void;
}

export default function HostScreen({ navigate, onRoomCreated }: Props) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // After room creation, step 2: pick team
  const [pendingRoom, setPendingRoom] = useState<{
    roomCode: string; hostToken: string; question: string; answers: string[]; teams: TeamConfig[];
  } | null>(null);

  function addAnswer() {
    if (answers.length < 4) setAnswers([...answers, '']);
  }

  function removeAnswer(i: number) {
    if (answers.length <= 2) return;
    setAnswers(answers.filter((_, idx) => idx !== i));
  }

  function createRoom() {
    const trimmedQ = question.trim();
    const trimmedA = answers.map(a => a.trim()).filter(Boolean);
    if (!trimmedQ) return setError('Escribe la pregunta.');
    if (trimmedA.length < 2) return setError('Necesitas al menos 2 respuestas.');
    setError('');
    setLoading(true);

    const socket = getSocket();
    socket.emit('create_room', { question: trimmedQ, answers: trimmedA }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      setPendingRoom({
        roomCode: res.roomCode,
        hostToken: res.hostToken,
        question: res.question,
        answers: res.answers,
        teams: res.teams as TeamConfig[],
      });
    });
  }

  function joinAsTeam(teamIndex: number) {
    if (!pendingRoom) return;
    setLoading(true);
    const socket = getSocket();
    socket.emit('join_room', { roomCode: pendingRoom.roomCode, teamIndex }, (res: any) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      onRoomCreated({
        roomCode: pendingRoom.roomCode,
        hostToken: pendingRoom.hostToken,
        isHost: true,
        question: res.question,
        answers: res.answers,
        teams: res.teams as TeamConfig[],
        ballId: res.ballId,
        teamIndex: res.teamIndex,
        teamColor: res.teamColor,
      });
    });
  }

  // Step 2: pick team
  if (pendingRoom) {
    return (
      <div className="screen">
        <div className="lobby-header">
          <h2 className="section-title">Tu bando</h2>
          <div className="room-code-badge">{pendingRoom.roomCode}</div>
        </div>
        <div className="question-box">
          <p className="question-label">La pregunta:</p>
          <p className="question-text">{pendingRoom.question}</p>
        </div>
        <p className="team-select-label">¿Qué eliges tú?</p>
        <div className="team-grid">
          {pendingRoom.answers.map((answer, i) => (
            <button
              key={i}
              className="btn btn-team"
              style={{ '--team-color': TEAM_COLORS[i] } as React.CSSProperties}
              onClick={() => joinAsTeam(i)}
              disabled={loading}
            >
              <span className="team-ball" style={{ background: TEAM_COLORS[i] }} />
              {answer}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <p className="hint">Comparte el código <strong>{pendingRoom.roomCode}</strong> con los demás.</p>
      </div>
    );
  }

  // Step 1: create room
  return (
    <div className="screen">
      <button className="btn-back" onClick={() => navigate('home')}>← Volver</button>
      <h2 className="section-title">Nueva Sala</h2>

      <div className="form-group">
        <label>Pregunta</label>
        <input
          className="input"
          placeholder="¿A dónde va el proyecto?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={120}
        />
      </div>

      <div className="form-group">
        <label>Respuestas</label>
        {answers.map((a, i) => (
          <div key={i} className="answer-row">
            <span className="color-dot" style={{ background: TEAM_COLORS[i] }} />
            <input
              className="input"
              placeholder={`Respuesta ${i + 1}`}
              value={a}
              onChange={e => {
                const copy = [...answers];
                copy[i] = e.target.value;
                setAnswers(copy);
              }}
              maxLength={50}
            />
            {answers.length > 2 && (
              <button className="btn-remove" onClick={() => removeAnswer(i)}>✕</button>
            )}
          </div>
        ))}
        {answers.length < 4 && (
          <button className="btn btn-ghost" onClick={addAnswer}>+ Agregar respuesta</button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-primary" onClick={createRoom} disabled={loading}>
        {loading ? 'Creando...' : 'Crear Sala →'}
      </button>
    </div>
  );
}
