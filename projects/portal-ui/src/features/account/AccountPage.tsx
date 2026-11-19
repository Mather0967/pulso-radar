import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Project } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PasswordForm } from './PasswordForm';
import { SessionsCard } from './SessionsCard';
import { initials } from './helpers';

/** «Mi cuenta»: perfil (solo lectura), cambio de contraseña y sesiones activas. Ancho máximo 720. */
export default function AccountPage() {
  const { user, isAdmin } = useSession();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsError, setProjectsError] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ projects: Project[] }>('/api/projects')
      .then((res) => {
        if (!cancelled) setProjects(res.projects);
      })
      .catch(() => {
        if (!cancelled) setProjectsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[720px] space-y-8 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold leading-9 tracking-tight md:text-[28px] md:leading-9">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Tus datos, tu contraseña y los dispositivos donde iniciaste sesión.</p>
      </header>

      <Card className="glass-panel animate-panel-in space-y-5 p-5" style={{ '--d': '0s' } as CSSProperties} aria-labelledby="profile-title">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-to-br from-primary to-[#8aa2b0] text-base font-bold text-[#0a151c]">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h2 id="profile-title" className="truncate text-base font-semibold leading-6">
              {user.name}
            </h2>
            <p className="truncate font-mono text-[13px] leading-5 text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Separator />

        <dl className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <dt className="text-sm text-muted-foreground">Rol</dt>
          <dd>
            <Badge variant="outline">{isAdmin ? 'Administrador' : 'Miembro'}</Badge>
          </dd>
          <dt className="text-sm text-muted-foreground">Proyectos</dt>
          <dd>
            {projects === null && !projectsError && <Skeleton className="h-6 w-48" />}
            {projectsError && <p className="text-sm text-muted-foreground">No pudimos cargar tus proyectos.</p>}
            {projects !== null && projects.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no tenés proyectos asignados.</p>
            )}
            {projects !== null && projects.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Badge variant="outline">{p.name}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      </Card>

      <Card className="glass-panel animate-panel-in p-5" style={{ '--d': '0.08s' } as CSSProperties} aria-labelledby="password-title">
        <h2 id="password-title" className="mb-1 text-base font-semibold leading-6">
          Cambiar contraseña
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Usá al menos 12 caracteres. Al cambiarla se cierran tus otras sesiones.
        </p>
        <PasswordForm onChanged={() => setSessionsVersion((v) => v + 1)} />
      </Card>

      <Card className="glass-panel animate-panel-in p-5" style={{ '--d': '0.16s' } as CSSProperties}>
        <SessionsCard refreshKey={sessionsVersion} />
      </Card>
    </main>
  );
}
