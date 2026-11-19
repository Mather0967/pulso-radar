import { describe, expect, it } from 'vitest';
import {
  accessLevel,
  emptyUsersMessage,
  expiryText,
  filterUsers,
  grantFormValues,
  grantsPayload,
  hueFromName,
  initials,
  isAccessRevocation,
  isValidEmail,
  mergeGrants,
  messageBodyError,
  normalizeText,
  recipientLabel,
  revokedProjectsLabel,
  unreadBadgeText,
  usersCountLabel,
} from './helpers';
import type { AdminMessage, AdminUser } from './types';

const users: AdminUser[] = [
  { id: '1', name: 'Ana Pérez', email: 'ana@example.test', role: 'admin', projects: {}, active: true },
  { id: '2', name: 'Bruno Díaz', email: 'bruno@example.test', role: 'member', projects: { pulso: 'viewer' }, active: true },
  { id: '3', name: 'Carla', email: 'carla@empresa.test', role: 'member', projects: { landur: 'editor', pulso: 'editor' }, active: false },
];

describe('normalizeText', () => {
  it('quita acentos, pasa a minúsculas y recorta espacios', () => {
    expect(normalizeText('  Ánà PÉREZ ')).toBe('ana perez');
  });
});

describe('filterUsers', () => {
  it('devuelve todos con consulta vacía o solo espacios', () => {
    expect(filterUsers(users, '   ')).toHaveLength(3);
  });
  it('busca por nombre sin importar acentos ni mayúsculas', () => {
    expect(filterUsers(users, 'PEREZ').map((u) => u.id)).toEqual(['1']);
  });
  it('busca por correo', () => {
    expect(filterUsers(users, 'empresa').map((u) => u.id)).toEqual(['3']);
  });
});

describe('textos de conteo y vacío', () => {
  it('usa singular y plural', () => {
    expect(usersCountLabel(1, 1)).toBe('1 de 1 usuario');
    expect(usersCountLabel(0, 3)).toBe('0 de 3 usuarios');
  });
  it('distingue no hay usuarios de ninguna coincidencia', () => {
    expect(emptyUsersMessage(0, '')).toBe('Todavía no hay usuarios.');
    expect(emptyUsersMessage(3, ' zz ')).toBe('Ningún usuario coincide con «zz»');
  });
});

describe('accessLevel y permisos', () => {
  it('un admin tiene edición en ambos proyectos', () => {
    expect(accessLevel(users[0], 'landur')).toBe('editor');
  });
  it('un miembro sin grant tiene sin acceso', () => {
    expect(accessLevel(users[1], 'landur')).toBe('none');
    expect(accessLevel(users[1], 'pulso')).toBe('viewer');
  });
  it('los valores del formulario reflejan el usuario y el admin queda en edición', () => {
    expect(grantFormValues(users[1])).toEqual({ pulso: 'viewer', landur: '' });
    expect(grantFormValues(users[0])).toEqual({ pulso: 'editor', landur: 'editor' });
    expect(grantFormValues(undefined)).toEqual({ pulso: '', landur: '' });
  });
  it('el payload manda ambos proyectos y null para sin acceso', () => {
    expect(grantsPayload({ pulso: '', landur: 'editor' })).toEqual({ pulso: null, landur: 'editor' });
  });
  it('mergeGrants quita con null y conserva el otro proyecto', () => {
    expect(mergeGrants({ pulso: 'viewer', landur: 'editor' }, { pulso: null })).toEqual({ landur: 'editor' });
    expect(mergeGrants({}, { landur: 'viewer' })).toEqual({ landur: 'viewer' });
  });
  it('detecta revocaciones (quitar o bajar nivel) pero no subidas', () => {
    expect(isAccessRevocation({ pulso: 'editor' }, { pulso: 'viewer' })).toBe(true);
    expect(isAccessRevocation({ pulso: 'viewer' }, {})).toBe(true);
    expect(isAccessRevocation({ pulso: 'viewer' }, { pulso: 'editor' })).toBe(false);
    expect(isAccessRevocation({}, { landur: 'viewer' })).toBe(false);
    expect(revokedProjectsLabel({ pulso: 'editor', landur: 'viewer' }, { pulso: 'viewer' })).toEqual(['Pulso', 'LANDUR']);
  });
});

describe('expiryText', () => {
  it('interpreta horas numéricas y el texto del servidor', () => {
    expect(expiryText(48)).toBe('Vence en 48 horas');
    expect(expiryText('48')).toBe('Vence en 48 horas');
    expect(expiryText('48 horas')).toBe('Vence en 48 horas');
  });
  it('muestra la fecha cuando llega una fecha válida y el texto crudo si no', () => {
    expect(expiryText('2026-11-20T10:00:00Z')).toMatch(/^Vence el /);
    expect(expiryText('mañana')).toBe('Vence mañana');
  });
});

describe('initials y hueFromName', () => {
  it('toma primera y última inicial', () => {
    expect(initials('ana maría pérez')).toBe('AP');
    expect(initials('Carla')).toBe('C');
    expect(initials('')).toBe('?');
  });
  it('el tono es estable y está entre 0 y 359', () => {
    expect(hueFromName('Ana')).toBe(hueFromName('Ana'));
    const hue = hueFromName('Bruno Díaz');
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe('email y mensajes', () => {
  it('valida correos como el legacy', () => {
    expect(isValidEmail(' ana@example.test ')).toBe(true);
    expect(isValidEmail('ana@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('valida el cuerpo del mensaje', () => {
    expect(messageBodyError('   ')).toBe('Escribí un mensaje.');
    expect(messageBodyError('x'.repeat(2001))).toBe('El mensaje supera los 2000 caracteres.');
    expect(messageBodyError('hola')).toBeNull();
  });
  it('etiquetas de destinatario y contador de no leídos', () => {
    const base: AdminMessage = {
      id: 'm', from: 'a', fromName: 'Ana', to: 'all', toName: 'Todos los administradores',
      body: '', createdAt: 0, mine: false, read: false,
    };
    expect(recipientLabel(base)).toBe('a todos');
    expect(recipientLabel({ ...base, to: 'b', toName: 'Bruno' })).toBe('a vos');
    expect(recipientLabel({ ...base, to: 'b', toName: 'Bruno', mine: true })).toBe('a Bruno');
    expect(unreadBadgeText(100)).toBe('99+');
    expect(unreadBadgeText(7)).toBe('7');
  });
});
