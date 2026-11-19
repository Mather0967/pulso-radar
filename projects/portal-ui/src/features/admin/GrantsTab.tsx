import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GrantSelect } from './GrantSelect';
import {
  grantFormValues,
  grantsPayload,
  isAccessRevocation,
  isAdminUser,
  mergeGrants,
  revokedProjectsLabel,
} from './helpers';
import { messageOf, type LoadStatus } from './useUsers';
import type { AdminUser, GrantFormValue, Grants, ProjectKey } from './types';
import { GRANT_PROJECTS, PROJECT_LABELS } from './types';

interface GrantsTabProps {
  users: AdminUser[];
  status: LoadStatus;
  error: string;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdateGrants: (user: AdminUser, projects: Record<ProjectKey, 'viewer' | 'editor' | null>) => Promise<Grants>;
}

/** Matriz de permisos por usuario. Guardar cierra las sesiones del usuario en el servidor. */
export function GrantsTab({ users, status, error, onRetry, selectedId, onSelect, onUpdateGrants }: GrantsTabProps) {
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-foreground">No se pudieron cargar los permisos. {error}</p>
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando permisos">
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-11 w-full max-w-xl" />
      </div>
    );
  }

  const selected = users.find((u) => u.id === selectedId);
  return (
    <div className="max-w-xl" data-testid="grants-tab">
      <GrantsEditor
        // Al cambiar de usuario o de permisos guardados, el formulario arranca de cero.
        key={selected ? `${selected.id}:${selected.role}:${JSON.stringify(selected.projects)}:${selected.active}` : 'none'}
        users={users}
        selected={selected}
        onSelect={onSelect}
        onUpdateGrants={onUpdateGrants}
      />
    </div>
  );
}

interface GrantsEditorProps {
  users: AdminUser[];
  selected: AdminUser | undefined;
  onSelect: (id: string) => void;
  onUpdateGrants: GrantsTabProps['onUpdateGrants'];
}

function GrantsEditor({ users, selected, onSelect, onUpdateGrants }: GrantsEditorProps) {
  const [values, setValues] = useState<Record<ProjectKey, GrantFormValue>>(() => grantFormValues(selected));
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'ok'; text: string }>({ tone: 'info', text: '' });
  const admin = isAdminUser(selected);
  const editable = !!selected && !admin;
  const dirty = !!selected && GRANT_PROJECTS.some((p) => values[p] !== grantFormValues(selected)[p]);
  const revoked = selected ? revokedProjectsLabel(selected.projects, mergeGrants(selected.projects, grantsPayload(values))) : [];

  let note = '';
  if (admin && selected) note = 'Los administradores tienen edición en ambos proyectos. Para cambiar su rol, usá Administración.';
  else if (selected && !selected.active) note = 'El usuario está inactivo. Asignar permisos no lo reactiva.';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editable || !dirty || saving) return;
    if (isAccessRevocation(selected.projects, mergeGrants(selected.projects, grantsPayload(values)))) {
      setNotice({ tone: 'info', text: 'Confirmá el cambio: quitar o bajar acceso cierra las sesiones del usuario.' });
      setConfirming(true);
      return;
    }
    void save();
  }

  async function save() {
    if (!selected) return;
    setConfirming(false);
    setSaving(true);
    setNotice({ tone: 'info', text: 'Guardando permisos…' });
    try {
      await onUpdateGrants(selected, grantsPayload(values));
      const text = 'Permisos guardados. El usuario deberá volver a iniciar sesión.';
      setNotice({ tone: 'ok', text });
      toast.success(text);
    } catch (e) {
      const text = messageOf(e);
      setNotice({ tone: 'error', text });
      toast.error(text, { duration: Infinity });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form data-testid="grants-form" className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="grant-user">Usuario</Label>
        <Select value={selected?.id ?? ''} onValueChange={onSelect}>
          <SelectTrigger id="grant-user" data-testid="grant-user">
            <SelectValue placeholder="Seleccionar usuario" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {`${u.name} · ${u.email}${u.active ? '' : ' (inactivo)'}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {GRANT_PROJECTS.map((project) => (
          <div key={project} className="flex flex-col gap-2">
            <Label htmlFor={`grant-${project}`}>{PROJECT_LABELS[project]}</Label>
            <GrantSelect
              id={`grant-${project}`}
              label={`Acceso a ${PROJECT_LABELS[project]}`}
              value={values[project]}
              disabled={!editable}
              onChange={(v) => setValues((current) => ({ ...current, [project]: v }))}
            />
          </div>
        ))}
      </div>

      {note ? (
        <p role="status" className="text-[13px] leading-5 text-muted-foreground" data-testid="grants-note">
          {note}
        </p>
      ) : null}
      {notice.text ? (
        <p
          role="status"
          data-testid="grants-status"
          data-tone={notice.tone}
          className={`text-[13px] leading-5 ${notice.tone === 'error' ? 'text-destructive' : notice.tone === 'ok' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {notice.text}
        </p>
      ) : null}
      {editable ? (
        <p className="text-[13px] leading-5 text-muted-foreground">
          Guardar cierra todas las sesiones de {selected.name}. Tendrá que volver a iniciar sesión.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={!editable || !dirty || saving} data-testid="grants-save">
          {saving ? 'Guardando…' : 'Guardar permisos'}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <DialogContent data-testid="grants-confirm">
          <DialogHeader>
            <DialogTitle>¿Quitar acceso a {selected?.name}?</DialogTitle>
            <DialogDescription>
              Vas a quitar o bajar el acceso a {revoked.join(' y ')}. Al guardar se cierran todas sus sesiones y tendrá que
              volver a iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void save()} data-testid="grants-confirm-save">
              Quitar acceso y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
