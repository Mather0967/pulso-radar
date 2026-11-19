import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InviteDialog } from './InviteDialog';
import {
  ACCESS_LABELS,
  accessLevel,
  emptyUsersMessage,
  filterUsers,
  hueFromName,
  initials,
  usersCountLabel,
} from './helpers';
import { messageOf, type LoadStatus } from './useUsers';
import type { SaveUserPatch } from './adminApi';
import type { AdminUser } from './types';
import { PROJECT_LABELS, type ProjectKey } from './types';

interface UsersTabProps {
  users: AdminUser[];
  status: LoadStatus;
  error: string;
  onRetry: () => void;
  selfId: string | undefined;
  onUpdateUser: (user: AdminUser, patch: SaveUserPatch) => Promise<{ selfChanged: boolean }>;
  onOpenGrants: (id: string) => void;
}

const ROLE_LABELS: Record<AdminUser['role'], string> = { member: 'Miembro', admin: 'Administrador' };

/**
 * Tabla de usuarios: búsqueda, rol, estado, acceso por proyecto y acciones.
 * Cambiar rol o estado cierra las sesiones del usuario en el servidor; se avisa antes.
 */
export function UsersTab({ users, status, error, onRetry, selfId, onUpdateUser, onOpenGrants }: UsersTabProps) {
  const [search, setSearch] = useState('');
  const [pendingRole, setPendingRole] = useState<{ id: string; role: AdminUser['role'] } | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const shown = useMemo(() => filterUsers(users, search), [users, search]);

  async function save(user: AdminUser, patch: SaveUserPatch, success: string) {
    setBusyId(user.id);
    setPendingRole(null);
    try {
      const result = await onUpdateUser(user, patch);
      if (result.selfChanged) {
        window.location.assign('/login');
        return;
      }
      toast.success(success);
    } catch (e) {
      toast.error(messageOf(e), { duration: Infinity });
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(user: AdminUser, role: AdminUser['role']) {
    if (role === user.role) {
      setPendingRole(null);
      return;
    }
    setPendingRole({ id: user.id, role });
  }

  function confirmDeactivate() {
    const user = deactivating;
    setDeactivating(null);
    if (user) void save(user, { active: false }, `${user.name} desactivado.`);
  }

  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-foreground">No se pudieron cargar los usuarios. {error}</p>
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="users-tab">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            type="search"
            aria-label="Buscar usuarios"
            placeholder="Nombre o correo"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="user-search"
            className="md:max-w-xs"
          />
          <span className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite" data-testid="user-count">
            {status === 'ready' ? usersCountLabel(shown.length, users.length) : ''}
          </span>
        </div>
        <Button onClick={() => setInviteOpen(true)} data-testid="invite-open">
          Invitar usuario
        </Button>
      </div>

      {status === 'loading' ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando usuarios">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : users.length === 0 || shown.length === 0 ? (
        <EmptyState
          title={emptyUsersMessage(users.length, search)}
          description={users.length === 0 ? 'Invitá a la primera persona del equipo.' : undefined}
        />
      ) : (
        <Table data-testid="users-table" className="block md:table">
          <TableHeader className="hidden md:table-header-group">
            <TableRow className="hover:bg-transparent">
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pulso</TableHead>
              <TableHead>LANDUR</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="block md:table-row-group">
            {shown.map((user) => {
              const busy = busyId === user.id;
              const isSelf = user.id === selfId;
              const confirmingRole = pendingRole?.id === user.id ? pendingRole.role : null;
              return (
                <TableRow
                  key={user.id}
                  data-testid="user-row"
                  data-user-id={user.id}
                  aria-busy={busy || undefined}
                  className={`block border-b py-3 md:table-row md:h-12 md:py-0 ${user.active ? '' : 'opacity-70'} ${busy ? 'opacity-60' : ''}`}
                >
                  <TableCell className="block px-0 py-1 md:table-cell md:px-4 md:py-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 shrink-0" aria-hidden="true">
                        <AvatarFallback
                          className="text-xs font-semibold"
                          style={{
                            backgroundColor: `hsl(${hueFromName(user.name)} 40% 22%)`,
                            color: `hsl(${hueFromName(user.name)} 80% 85%)`,
                          }}
                        >
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                          {user.name}
                          {isSelf ? <Badge variant="outline">Vos</Badge> : null}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="block px-0 py-1 md:table-cell md:px-4 md:py-0">
                    <span className="mb-1 block text-xs text-muted-foreground md:hidden">Rol</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={confirmingRole ?? user.role}
                        onValueChange={(v) => changeRole(user, v as AdminUser['role'])}
                        disabled={busy}
                      >
                        <SelectTrigger aria-label={`Rol de ${user.name}`} className="h-11 w-44 md:h-9" data-testid="user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                          <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                        </SelectContent>
                      </Select>
                      {confirmingRole ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => save(user, { role: confirmingRole }, `Rol de ${user.name} actualizado.`)}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingRole(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {confirmingRole ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">Cambiar el rol cierra sus sesiones.</p>
                    ) : null}
                  </TableCell>

                  <TableCell className="flex items-center justify-between px-0 py-1 md:table-cell md:px-4 md:py-0">
                    <span className="text-xs text-muted-foreground md:hidden">Estado</span>
                    <Badge variant={user.active ? 'secondary' : 'outline'}>{user.active ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>

                  {(['pulso', 'landur'] as ProjectKey[]).map((project) => {
                    const level = accessLevel(user, project);
                    return (
                      <TableCell key={project} className="flex items-center justify-between px-0 py-1 md:table-cell md:px-4 md:py-0">
                        <span className="text-xs text-muted-foreground md:hidden">{PROJECT_LABELS[project]}</span>
                        <Badge variant="outline">{ACCESS_LABELS[level]}</Badge>
                      </TableCell>
                    );
                  })}

                  <TableCell className="block px-0 py-2 md:table-cell md:px-4 md:py-0">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        data-testid="user-toggle"
                        onClick={() => {
                          if (!user.active) void save(user, { active: true }, `${user.name} activado.`);
                          else setDeactivating(user);
                        }}
                      >
                        {user.active ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} data-testid="user-grants" onClick={() => onOpenGrants(user.id)}>
                        Permisos
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={deactivating !== null} onOpenChange={(open) => !open && setDeactivating(null)}>
        <DialogContent data-testid="deactivate-dialog">
          <DialogHeader>
            <DialogTitle>¿Desactivar a {deactivating?.name}?</DialogTitle>
            <DialogDescription>
              Pierde el acceso al portal y se cierran todas sus sesiones. Sus invitaciones pendientes se cancelan.
              {deactivating?.id === selfId ? ' Es tu propia cuenta: vas a salir del portal.' : ''} Podés reactivarlo después.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeactivate} data-testid="deactivate-confirm">
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
