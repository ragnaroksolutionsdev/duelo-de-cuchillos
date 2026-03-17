import { Screen } from '../App';

interface Props {
  navigate: (s: Screen) => void;
}

export default function HomeScreen({ navigate }: Props) {
  return (
    <div className="screen center">
      <h1 className="title">
        🗡️<br />Duelo de<br />Cuchillos
      </h1>
      <p className="subtitle">La sala decide. La arena juzga.</p>
      <div className="btn-group">
        <button className="btn btn-primary" onClick={() => navigate('host')}>
          Crear Sala
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('join')}>
          Unirse
        </button>
      </div>
    </div>
  );
}
