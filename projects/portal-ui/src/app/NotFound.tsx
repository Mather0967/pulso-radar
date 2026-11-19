import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em]">No encontramos esa página</h1>
      <p className="text-sm leading-[22px] text-muted-foreground">Puede que el enlace esté viejo o que la dirección tenga un error.</p>
      <Button onClick={() => navigate('/')}>Volver al inicio</Button>
    </section>
  );
}
