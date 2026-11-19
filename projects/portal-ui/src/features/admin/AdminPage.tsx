/**
 * Administración del portal (/administracion). Solo administradores: si la sesión no es admin
 * no se renderiza nada (el router ya redirige a Inicio).
 *
 * Pestaña activa en la query `?tab=users|grants|messages` (por defecto users).
 *
 * data-testid:
 *  - tab-users, tab-grants, tab-messages: pestañas (Radix Tabs, role=tab).
 *  - messages-badge: no leídos en la pestaña Mensajes (solo si hay).
 *  - admin-stats: resumen (Activos, Administradores, Inactivos, Sin leer).
 *  Usuarios (UsersTab):
 *  - users-table, user-row (data-user-id), user-search, user-count, user-role, user-toggle,
 *    user-grants (abre Permisos), invite-open (abre InviteDialog).
 *  - deactivate-dialog, deactivate-confirm.
 *  Invitación (InviteDialog):
 *  - invite-dialog, invite-form, invite-email, invite-role, invite-pulso, invite-landur,
 *    invite-submit, invite-result, invite-url, invite-copy, invite-expiry.
 *  Permisos (GrantsTab):
 *  - grants-tab, grants-form, grant-user, grant-pulso, grant-landur, grants-note,
 *    grants-save, grants-confirm, grants-confirm-save.
 *  Mensajes (MessagesTab):
 *  - messages-tab, message-compose, message-to, message-body, message-send, unread-count,
 *    mark-all-read, messages-list, message-item (data-message-id, data-read), mark-read.
 */
import { useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/session';
import { GrantsTab } from './GrantsTab';
import { MessagesTab } from './MessagesTab';
import { statsFromUsers, unreadBadgeText } from './helpers';
import { UsersTab } from './UsersTab';
import { useMessages } from './useMessages';
import { useUsers } from './useUsers';

type TabName = 'users' | 'grants' | 'messages';
const TABS: TabName[] = ['users', 'grants', 'messages'];

function parseTab(value: string | null): TabName {
  return TABS.includes(value as TabName) ? (value as TabName) : 'users';
}

export default function AdminPage() {
  const { isAdmin } = useSession();
  if (!isAdmin) return null;
  return <AdminPanel />;
}

function AdminPanel() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));
  const [grantUserId, setGrantUserId] = useState<string | null>(null);

  const usersState = useUsers();
  const messagesState = useMessages(true);

  function setTab(next: TabName) {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        copy.set('tab', next);
        return copy;
      },
      { replace: true },
    );
  }

  function openGrants(id: string) {
    setGrantUserId(id);
    setTab('grants');
  }

  const loaded = usersState.status === 'ready';
  const stats = statsFromUsers(usersState.users);
  const statValue = (n: number) => (loaded ? String(n) : '–');

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-3 animate-panel-in">
        <p className="font-mono text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-[#ff9a63]">
          Solo administradores
        </p>
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-foreground md:text-[28px] md:leading-9">
          Administración del portal
        </h1>
        <p className="max-w-2xl text-sm leading-[22px] text-muted-foreground">
          Usuarios, invitaciones, permisos y mensajes del equipo. Cambiar rol, estado o permisos cierra las sesiones del
          usuario.
        </p>
        <dl data-testid="admin-stats" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat index={0} label="Activos" value={statValue(stats.active)} />
          <Stat index={1} label="Administradores" value={statValue(stats.admins)} />
          <Stat index={2} label="Inactivos" value={statValue(stats.inactive)} />
          <Stat index={3} label="Sin leer" value={messagesState.status === 'ready' ? String(messagesState.unread) : '–'} />
        </dl>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabName)} className="flex flex-col gap-6">
        <TabsList
          aria-label="Secciones de administración"
          className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
        >
          <TabsTrigger value="users" data-testid="tab-users">
            Usuarios
            {loaded ? <span className="ml-2 text-xs tabular-nums text-muted-foreground">{usersState.users.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="grants" data-testid="tab-grants">
            Permisos
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            Mensajes
            {messagesState.unread > 0 ? (
              <span data-testid="messages-badge" className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                {unreadBadgeText(messagesState.unread)}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab
            users={usersState.users}
            status={usersState.status}
            error={usersState.error}
            onRetry={usersState.reload}
            selfId={user?.id}
            onUpdateUser={usersState.updateUser}
            onOpenGrants={openGrants}
          />
        </TabsContent>

        <TabsContent value="grants">
          <GrantsTab
            users={usersState.users}
            status={usersState.status}
            error={usersState.error}
            onRetry={usersState.reload}
            selectedId={grantUserId}
            onSelect={setGrantUserId}
            onUpdateGrants={usersState.updateGrants}
          />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab
            messages={messagesState.messages}
            admins={messagesState.admins}
            unread={messagesState.unread}
            status={messagesState.status}
            error={messagesState.error}
            onRetry={() => void messagesState.reload()}
            onSend={messagesState.send}
            onMarkRead={messagesState.markRead}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ index, label, value }: { index: number; label: string; value: string }) {
  return (
    <div className="card-surface animate-fade-in flex flex-col gap-1 px-4 py-3" style={{ '--d': `${index * 0.06}s` } as CSSProperties}>
      <dt className="text-[13px] leading-5 text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[28px] font-semibold leading-9 tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
