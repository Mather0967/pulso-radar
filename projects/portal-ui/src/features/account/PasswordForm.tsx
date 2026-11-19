import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordChangedMessage,
  passwordErrorMessage,
  validatePassword,
  type PasswordErrors,
  type PasswordField,
  type PasswordInput,
} from './helpers';

const EMPTY: PasswordInput = { current: '', next: '', confirm: '' };
const FIELD_ORDER: PasswordField[] = ['current', 'next', 'confirm'];

type Props = {
  /** Se llama tras un cambio exitoso (el servidor cierra otras sesiones). */
  onChanged?: (revoked: number) => void;
};

export function PasswordForm({ onChanged }: Props) {
  const [values, setValues] = useState<PasswordInput>(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (field: PasswordField) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (serverError) setServerError(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    if (values.next.length > PASSWORD_MAX) {
      setErrors((prev) => ({ ...prev, next: undefined }));
      setServerError(`La contraseña no puede superar los ${PASSWORD_MAX} caracteres.`);
      document.getElementById('account-next')?.focus();
      return;
    }
    const found = validatePassword(values);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((f) => found[f]);
    if (firstInvalid) {
      document.getElementById(`account-${firstInvalid}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ changed: true; revoked: number }>('/auth/password', {
        method: 'POST',
        body: { current: values.current, next: values.next },
      });
      toast.success(passwordChangedMessage(res.revoked));
      setValues(EMPTY);
      setErrors({});
      onChanged?.(res.revoked);
    } catch (err) {
      setServerError(passwordErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const meterRatio = Math.min(values.next.length / PASSWORD_MIN, 1);
  const describe = (field: PasswordField) => (errors[field] ? `account-${field}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Cambiar contraseña">
      <div className="space-y-2">
        <Label htmlFor="account-current">Contraseña actual</Label>
        <Input
          id="account-current"
          data-testid="account-current"
          name="current"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          value={values.current}
          onChange={update('current')}
          aria-invalid={!!errors.current}
          aria-describedby={describe('current')}
        />
        {errors.current && (
          <p id="account-current-error" className="animate-msg-in text-sm text-destructive">
            {errors.current}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-next">Nueva contraseña</Label>
        <Input
          id="account-next"
          data-testid="account-next"
          name="next"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={values.next}
          onChange={update('next')}
          aria-invalid={!!errors.next}
          aria-describedby={errors.next ? 'account-next-error account-next-meter' : 'account-next-meter'}
        />
        <div id="account-next-meter" className="space-y-1">
          <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-250 ease-out motion-reduce:transition-none"
              style={{ width: `${meterRatio * 100}%` }}
            />
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground tabular-nums">
            {values.next.length} de {PASSWORD_MIN} caracteres mínimos
          </p>
        </div>
        {errors.next && (
          <p id="account-next-error" className="animate-msg-in text-sm text-destructive">
            {errors.next}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-confirm">Repetí la nueva contraseña</Label>
        <Input
          id="account-confirm"
          data-testid="account-confirm"
          name="confirm"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          aria-invalid={!!errors.confirm}
          aria-describedby={describe('confirm')}
        />
        {errors.confirm && (
          <p id="account-confirm-error" className="animate-msg-in text-sm text-destructive">
            {errors.confirm}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          aria-pressed={visible}
          className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {visible ? 'Ocultar' : 'Mostrar'} contraseñas
        </button>
        <Button type="submit" data-testid="account-save" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Cambiar contraseña
        </Button>
      </div>

      {serverError && (
        <div
          id="account-error"
          data-testid="account-error"
          role="alert"
          className="animate-msg-in rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}
    </form>
  );
}
