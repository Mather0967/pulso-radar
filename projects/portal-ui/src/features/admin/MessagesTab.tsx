import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  MESSAGE_MAX_LENGTH,
  messageBodyError,
  messageCounterText,
  hueFromName,
  initials,
  recipientLabel,
  relativeTime,
  senderLabel,
} from './helpers';
import { messageOf, type LoadStatus } from './useUsers';
import type { AdminMessage, AdminRecipient } from './types';

interface MessagesTabProps {
  messages: AdminMessage[];
  admins: AdminRecipient[];
  unread: number;
  status: LoadStatus;
  error: string;
  onRetry: () => void;
  onSend: (to: string, body: string) => Promise<AdminMessage>;
  onMarkRead: (ids: string[] | null) => Promise<void>;
}

const ALL = 'all';

/** Mensajes entre administradores: redactar, bandeja y marcar como leído. */
export function MessagesTab({ messages, admins, unread, status, error, onRetry, onSend, onMarkRead }: MessagesTabProps) {
  const [to, setTo] = useState(ALL);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [bodyError, setBodyError] = useState('');

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const problem = messageBodyError(body);
    if (problem) {
      setBodyError(problem);
      return;
    }
    setBodyError('');
    setSending(true);
    try {
      const message = await onSend(to, body.trim());
      setBody('');
      toast.success(message.to === 'all' ? 'Mensaje enviado a todos los administradores.' : `Mensaje enviado a ${message.toName}.`);
    } catch (e) {
      toast.error(messageOf(e), { duration: Infinity });
    } finally {
      setSending(false);
    }
  }

  // Ctrl/Cmd + Enter envía desde el cuadro de texto.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  async function markAll() {
    try {
      await onMarkRead(null);
    } catch (e) {
      toast.error(messageOf(e), { duration: Infinity });
    }
  }

  async function markOne(id: string) {
    try {
      await onMarkRead([id]);
    } catch (e) {
      toast.error(messageOf(e), { duration: Infinity });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" data-testid="messages-tab">
      <form
        data-testid="message-compose"
        className="flex flex-col gap-4 self-start"
        onSubmit={submit}
        noValidate
      >
        <h2 className="text-base font-semibold text-foreground">Nuevo mensaje</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="message-to">Para</Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger id="message-to" data-testid="message-to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los administradores</SelectItem>
              {admins.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {admins.length === 0 ? (
            <p className="text-[13px] text-muted-foreground" data-testid="no-other-admins">
              No hay otros administradores activos. El mensaje va a todos.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="message-body">Mensaje</Label>
          <Textarea
            id="message-body"
            data-testid="message-body"
            rows={5}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder="Escribí para el equipo de administración"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            aria-invalid={bodyError ? true : undefined}
            aria-describedby="message-counter message-body-error"
          />
          <div className="flex items-center justify-between gap-3">
            <span id="message-counter" className="text-[13px] text-muted-foreground tabular-nums">
              {messageCounterText(body.length)}
            </span>
            <Button type="submit" disabled={sending} data-testid="message-send">
              {sending ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
          {bodyError ? (
            <p id="message-body-error" role="alert" className="text-[13px] text-destructive">
              {bodyError}
            </p>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="inbox-title" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="inbox-title" className="text-base font-semibold text-foreground">
              Bandeja
            </h2>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              <span data-testid="unread-count">{unread}</span> sin leer
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={markAll} disabled={!unread} data-testid="mark-all-read">
            Marcar todo como leído
          </Button>
        </div>

        {status === 'loading' ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando mensajes">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : status === 'error' && messages.length === 0 ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-foreground">No se pudieron cargar los mensajes. {error}</p>
            <Button variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title="Todavía no hay mensajes." description="Escribí el primero." />
        ) : (
          <ol data-testid="messages-list" className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} onMarkRead={markOne} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function MessageItem({ message, onMarkRead }: { message: AdminMessage; onMarkRead: (id: string) => void }) {
  const sender = senderLabel(message);
  const hue = hueFromName(sender);
  return (
    <li
      data-testid="message-item"
      data-message-id={message.id}
      data-read={message.read ? 'true' : 'false'}
      className="flex gap-3 p-4"
    >
      <Avatar className="size-8 shrink-0" aria-hidden="true">
        <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `hsl(${hue} 40% 22%)`, color: `hsl(${hue} 80% 85%)` }}>
          {initials(sender)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <strong className="font-semibold text-foreground">{sender}</strong>
          <span>{recipientLabel(message)}</span>
          <time dateTime={new Date(message.createdAt).toISOString()} title={new Date(message.createdAt).toLocaleString('es')} className="font-mono text-xs">
            {relativeTime(message.createdAt)}
          </time>
          {!message.read ? <Badge variant="outline">Sin leer</Badge> : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-[22px] text-foreground">{message.body}</p>
        {!message.read ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => onMarkRead(message.id)} data-testid="mark-read">
              Marcar leído
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
