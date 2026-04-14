import HUD from './components/HUD';
import Scene from './components/Scene';

export default function App() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-dark-bg cursor-crosshair grid-bg">
      <Scene />
      <HUD />
    </main>
  );
}
