// Tipos del panel de administración (espejo de la API legacy, ver legacy-inventory.md §1).

export type ProjectKey = 'pulso' | 'landur';
export const GRANT_PROJECTS: readonly ProjectKey[] = ['pulso', 'landur'];
export const PROJECT_LABELS: Record<ProjectKey, string> = { pulso: 'Pulso', landur: 'LANDUR' };

/** Grant persistido: null/ausente = sin acceso. */
export type GrantLevel = 'viewer' | 'editor';
export type Grants = Partial<Record<ProjectKey, GrantLevel>>;
/** Valor de un select de permisos: '' = sin acceso. */
export type GrantFormValue = '' | GrantLevel;

export type AccessLevel = 'editor' | 'viewer' | 'none';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  projects: Grants;
  active: boolean;
}

export interface AdminMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  body: string;
  createdAt: number;
  mine: boolean;
  read: boolean;
}

export interface AdminRecipient {
  id: string;
  name: string;
}

export interface MessagesResponse {
  messages: AdminMessage[];
  unread: number;
  admins: AdminRecipient[];
}

export interface InviteResponse {
  url: string;
  /** Llega como número de horas, como «48 horas» o como fecha ISO. */
  expires: number | string;
}
