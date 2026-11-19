import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
const PROJECTS: ProjectKey[] = ['pulso', 'landur'];

/**
 * Usuarios: búsqueda, rol, estado, acceso por proyecto y acciones.
 * - Menos de 768 px: una Card por usuario, acciones en el menú ⋯.
 * - 768 a 1023 px: tabla sin las columnas de proyecto.
 * - 1024 px o más: tabla completa.
 * Cambiar rol o estado cierra las sesiones del usuario en el servidor; se avisa antes.
 * Nota: cada fila existe dos veces en el DOM (card y tabla), una oculta según el ancho;
 * ambas llevan data-testid="user-row".
 */
export function UsersTab({ users, status, error, onRetry, selfId, onUpdateUser, onOpenGrants }: UsersTabProps) {
  const [search, setSearch] = useState('');
  const [pendingRole, setPendingRole] = useState<{ id: string; role: AdminUser['role'] } | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const shown = useMemo(() => filterUsers(users, search), [users, search]);
  const activeAdmins = users.filter((u) => u.role === 'admin' && u.active).length;

  /** Motivo por el que no se puede cambiar el rol (lo cubre el servidor; se explica en pantalla). */
  function roleLockReason(user: AdminUser): string | null {
    if (user.id === selfId) return 'No podés cambiar tu propio rol desde acá.';
    if (user.role === 'admin' && user.active && activeAdmins <= 1) return 'Es el único administrador activo: tiene que quedar al menos uno.';
    return null;
  }

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
    if (role === user.role) setPendingRole(null);
    else setPendingRole({ id: user.id, role });
  }

  function confirmRole(user: AdminUser, role: AdminUser['role']) {
    void save(user, { role }, `Rol de ${user.name} actualizado.`);
  }

  function toggleActive(user: AdminUser) {
    if (!user.active) void save(user, { active: true }, `${user.name} activado.`);
    else setDeactivating(user);
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

  const rowProps = (user: AdminUser) => ({
    user,
    busy: busyId === user.id,
    isSelf: user.id === selfId,
    lockReason: roleLockReason(user),
    pendingRole: pendingRole?.id === user.id ? pendingRole.role : null,
    onChangeRole: (role: AdminUser['role']) => changeRole(user, role),
    onConfirmRole: (role: AdminUser['role']) => confirmRole(user, role),
    onCancelRole: () => setPendingRole(null),
    onToggle: () => toggleActive(user),
    onGrants: () => onOpenGrants(user.id),
  });

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
          icon={<Users />}
          title={emptyUsersMessage(users.length, search)}
          description={users.length === 0 ? 'Invitá a la primera persona del equipo.' : undefined}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden" data-testid="users-cards">
            {shown.map((user) => (
              <li key={user.id}>
                <UserCard {...rowProps(user)} />
              </li>
            ))}
          </ul>

          <div className="hidden md:block" data-testid="users-table">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Pulso</TableHead>
                  <TableHead className="hidden lg:table-cell">LANDUR</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((user) => (
                  <UserTableRow key={user.id} {...rowProps(user)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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

interface RowProps {
  user: AdminUser;
  busy: boolean;
  isSelf: boolean;
  lockReason: string | null;
  pendingRole: AdminUser['role'] | null;
  onChangeRole: (role: AdminUser['role']) => void;
  onConfirmRole: (role: AdminUser['role']) => void;
  onCancelRole: () => void;
  onToggle: () => void;
  onGrants: () => void;
}

function Identity({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const hue = hueFromName(user.name);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8 shrink-0" aria-hidden="true">
        <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `hsl(${hue} 40% 22%)`, color: `hsl(${hue} 80% 85%)` }}>
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="truncate">{user.name}</span>
          {isSelf ? <Badge variant="outline">Vos</Badge> : null}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">{user.email}</span>
      </div>
    </div>
  );
}

function RoleControl({ user, busy, lockReason, pendingRole, onChangeRole, onConfirmRole, onCancelRole, fullWidth }: RowProps & { fullWidth?: boolean }) {
  const select = (
    <Select value={pendingRole ?? user.role} onValueChange={(v) => onChangeRole(v as AdminUser['role'])} disabled={busy || !!lockReason}>
      <SelectTrigger aria-label={`Rol de ${user.name}`} className={fullWidth ? 'h-11 w-full' : 'h-11 w-44 md:h-9'} data-testid="user-role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
      </SelectContent>
    </Select>
  );
  return (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      {lockReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex ${fullWidth ? 'w-full' : ''}`} tabIndex={0} data-testid="role-locked">
              {select}
            </span>
          </TooltipTrigger>
          <TooltipContent>{lockReason}</TooltipContent>
        </Tooltip>
      ) : (
        select
      )}
      {pendingRole ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted-foreground">Cambiar el rol cierra sus sesiones.</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onConfirmRole(pendingRole)}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancelRole}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'secondary' : 'outline'}>{active ? 'Activo' : 'Inactivo'}</Badge>;
}

/** Desactivar es destructivo (outline en rojo); activar es neutro. */
function ToggleButton({ user, busy, onToggle, className }: { user: AdminUser; busy: boolean; onToggle: () => void; className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      data-testid="user-toggle"
      onClick={onToggle}
      className={`${user.active ? 'border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive' : ''} ${className ?? ''}`}
    >
      {user.active ? 'Desactivar' : 'Activar'}
    </Button>
  );
}

function UserCard(props: RowProps) {
  const { user, busy, isSelf, onToggle, onGrants } = props;
  return (
    <Card data-testid="user-row" data-user-id={user.id} aria-busy={busy || undefined} className={`flex flex-col gap-4 p-4 ${user.active ? '' : 'opacity-80'}`}>
      <div className="flex items-start justify-between gap-3">
        <Identity user={user} isSelf={isSelf} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Acciones de ${user.name}`} disabled={busy} data-testid="user-menu">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onToggle} className={user.active ? 'text-destructive focus:text-destructive' : ''}>
              {user.active ? 'Desactivar' : 'Activar'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onGrants}>Permisos</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge active={user.active} />
        {PROJECTS.map((project) => (
          <Badge key={project} variant="outline">
            {PROJECT_LABELS[project]}: {ACCESS_LABELS[accessLevel(user, project)]}
          </Badge>
        ))}
      </div>
      <RoleControl {...props} fullWidth />
    </Card>
  );
}

function UserTableRow(props: RowProps) {
  const { user, busy, isSelf, onGrants } = props;
  return (
    <TableRow
      data-testid="user-row"
      data-user-id={user.id}
      aria-busy={busy || undefined}
      className={`h-16 ${user.active ? '' : 'opacity-80'} ${busy ? 'opacity-60' : ''}`}
    >
      <TableCell>
        <Identity user={user} isSelf={isSelf} />
      </TableCell>
      <TableCell>
        <RoleControl {...props} />
      </TableCell>
      <TableCell>
        <StatusBadge active={user.active} />
      </TableCell>
      {PROJECTS.map((project) => (
        <TableCell key={project} className="hidden lg:table-cell">
          <Badge variant="outline">{ACCESS_LABELS[accessLevel(user, project)]}</Badge>
        </TableCell>
      ))}
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <ToggleButton user={user} busy={busy} onToggle={props.onToggle} />
          <Button variant="ghost" size="sm" disabled={busy} data-testid="user-grants" onClick={onGrants}>
            Permisos
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
