import { scenarioById } from './content/scenarios';
import { useStore } from './runtime/store';
import { VisitPrint } from './ui/Panels';
import { Picker } from './ui/Picker';
import { Studio } from './ui/Studio';

export default function App() {
  const sc = useStore((s) => scenarioById(s.scenarioId));
  return (
    <>
      <div className="screen h-full">{sc ? <Studio key={sc.id} sc={sc} /> : <Picker />}</div>
      {sc && <VisitPrint sc={sc} />}
    </>
  );
}
