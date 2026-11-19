import { addDays, todayMontevideo } from '@/lib/format';

// Funciones puras de la cuenta: validación de la contraseña y textos de sesiones.

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 200;

export type PasswordInput = { current: string; next: string; confirm: string };
export type PasswordField = 'current' | 'next' | 'confirm';
export type PasswordErrors = Partial<Record<PasswordField, string>>;

/** Validación del lado del cliente. El servidor vuelve a validar (política y contraseña actual). */
export function validatePassword(input: PasswordInput): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!input.current) errors.current = 'Escribí tu contraseña actual.';
  const length = input.next.length;
  if (length < PASSWORD_MIN) {
    errors.next = `La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  } else if (length > PASSWORD_MAX) {
    errors.next = `La contraseña no puede superar los ${PASSWORD_MAX} caracteres.`;
  } else if (input.next === input.current) {
    errors.next = 'La nueva contraseña debe ser distinta.';
  }
  if (input.confirm !== input.next) errors.confirm = 'Las contraseñas no coinciden.';
  return errors;
}

/** Texto de error para un fallo de POST /auth/password. `err` puede ser un ApiError (tiene `status`). */
export function passwordErrorMessage(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 403) return 'La contraseña actual no es correcta.';
  if (status === 429) return 'Hubo demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.';
  if (status === 400) {
    const message = (err as { message?: string } | null)?.message;
    if (message) return message;
  }
  return 'No pudimos cambiar la contraseña. Probá de nuevo.';
}

/** Toast de éxito; el servidor informa cuántas otras sesiones cerró. */
export function passwordChangedMessage(revoked: number): string {
  if (revoked === 1) return 'Contraseña cambiada. Se cerró 1 sesión más.';
  return `Contraseña cambiada. Se cerraron ${revoked} sesiones más.`;
}

const dateFormatter = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'America/Montevideo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Fecha completa en Montevideo, p. ej. «19/11/2026, 14:05»; null si no se sabe. */
export function sessionFullDate(createdAt: number | null | undefined): string | null {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return dateFormatter.format(new Date(createdAt));
}

/**
 * Tiempo relativo de una sesión: «Iniciada hace un momento», «Iniciada hace 3 min», «Iniciada hace 2 h»,
 * «Iniciada ayer», «Iniciada hace 4 días» o la fecha corta; «fecha desconocida» si no hay dato.
 */
export function sessionRelativeLabel(createdAt: number | null | undefined, now: number = Date.now()): string {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return 'fecha desconocida';
  const diff = Math.max(0, now - createdAt);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (minutes < 1) return 'Iniciada hace un momento';
  if (minutes < 60) return `Iniciada hace ${minutes} min`;
  const today = todayMontevideo(new Date(now));
  const sessionDay = todayMontevideo(new Date(createdAt));
  if (sessionDay === addDays(today, -1)) return 'Iniciada ayer';
  if (hours < 24) return `Iniciada hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Iniciada hace ${days} días`;
  return `Iniciada el ${dateFormatter.format(new Date(createdAt)).split(',')[0]}`;
}

/** Nombre visible de una sesión: el resumen del navegador o «Sesión anterior». */
export function sessionTitle(browser: string | null | undefined): string {
  const trimmed = browser?.trim();
  return trimmed ? trimmed : 'Sesión anterior';
}

/** Iniciales para el Avatar: primera letra de las dos primeras palabras. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0);
  const second = words.length > 1 ? words[1].charAt(0) : '';
  return (first + second).toUpperCase();
}
