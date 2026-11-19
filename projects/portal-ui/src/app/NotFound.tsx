import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="font-mono text-xs font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em]">No encontramos esta página.</h1>
      <p className="text-sm leading-[22px] text-muted-foreground">Revisá la dirección o volvé a Inicio.</p>
      <Button onClick={() => navigate('/')}>Volver a Inicio</Button>
    </section>
  );
}
