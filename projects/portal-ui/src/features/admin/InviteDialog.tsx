import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createInvite } from './adminApi';
import { EMAIL_MAX_LENGTH, expiryText, grantsPayload, isValidEmail } from './helpers';
import { GrantSelect } from './GrantSelect';
import { messageOf } from './useUsers';
import type { GrantFormValue, InviteResponse, ProjectKey } from './types';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_GRANTS: Record<ProjectKey, GrantFormValue> = { pulso: '', landur: '' };

/**
 * Crea una invitación. El enlace se muestra una sola vez: al cerrar el diálogo se pierde
 * (el servidor solo guarda el hash del token).
 */
export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [grants, setGrants] = useState<Record<ProjectKey, GrantFormValue>>(EMPTY_GRANTS);
  const [pending, setPending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Al cerrar se borra todo: el enlace no debe quedar en memoria del diálogo.
  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('member');
      setGrants(EMPTY_GRANTS);
      setEmailError('');
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError('Escribí un correo válido.');
      emailRef.current?.focus();
      return;
    }
    setEmailError('');
    setPending(true);
    try {
      const data = await createInvite({
        email: email.trim(),
        role,
        projects: grantsPayload(grants),
      });
      setResult(data);
      setEmail('');
      setGrants(EMPTY_GRANTS);
      setRole('member');
      toast.success('Invitación creada. Compartí el enlace por un canal seguro.');
    } catch (e) {
      toast.error(messageOf(e), { duration: Infinity });
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(result.url);
      ok = true;
    } catch {
      // Sin permiso de portapapeles: se selecciona el campo y se intenta execCommand.
      const input = urlRef.current;
      if (input) {
        input.focus();
        input.select();
        input.setSelectionRange(0, result.url.length);
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
      }
    }
    if (ok) setCopied(true);
    else toast.error('No se pudo copiar. Seleccioná el enlace y copialo manualmente.', { duration: Infinity });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="invite-dialog" className="glass-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            El enlace de activación vence en 48 horas y solo se muestra una vez.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4" data-testid="invite-result">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-url">Enlace de activación</Label>
              <Input id="invite-url" ref={urlRef} readOnly value={result.url} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={copyLink} data-testid="invite-copy">
                {copied ? 'Copiado' : 'Copiar enlace'}
              </Button>
              <p className="text-[13px] leading-5 text-muted-foreground" data-testid="invite-expiry">
                {expiryText(result.expires)}
              </p>
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">
              Compartí el enlace por un canal seguro. Si cerrás este diálogo, no se vuelve a mostrar.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResult(null)}>
                Nueva invitación
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form id="invite-form" data-testid="invite-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Correo</Label>
              <Input
                id="invite-email"
                ref={emailRef}
                name="email"
                type="email"
                required
                maxLength={EMAIL_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
                placeholder="nombre@empresa.com"
                value={email}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? 'invite-email-error' : undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
              {emailError ? (
                <p id="invite-email-error" role="alert" className="text-[13px] text-destructive">
                  {emailError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'admin')}>
                <SelectTrigger id="invite-role" data-testid="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Miembro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-pulso">Pulso</Label>
                <GrantSelect
                  id="invite-pulso"
                  label="Acceso a Pulso"
                  value={grants.pulso}
                  onChange={(v) => setGrants((g) => ({ ...g, pulso: v }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-landur">LANDUR</Label>
                <GrantSelect
                  id="invite-landur"
                  label="Acceso a LANDUR"
                  value={grants.landur}
                  onChange={(v) => setGrants((g) => ({ ...g, landur: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending} data-testid="invite-submit">
                {pending ? 'Creando…' : 'Crear invitación'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
