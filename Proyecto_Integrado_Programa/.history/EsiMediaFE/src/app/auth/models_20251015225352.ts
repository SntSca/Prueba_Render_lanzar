export type Role = 'USUARIO' | 'GESTOR_CONTENIDO' | 'ADMINISTRADOR';

export interface UserDto {
  id: string;
  email: string;
  nombre?: string;
  role: Role;
  tipoContenido?: 'VIDEO' | 'AUDIO';
}

export type MfaMethod = 'TOTP' | 'EMAIL_OTP' | 'NONE' | null;

export interface BackendLoginResponse {
  needMfa3: boolean;
  mfaMethod: MfaMethod;
  mfaToken: string | null;
  captchaToken: string | null;
  captchaImage: string | null;
  user: UserDto | null;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  code: string;
}

export interface CaptchaVerifyRequest {
  captchaToken: string;
  answer: string;
}

export interface SimpleStatus {
  status: string;
}

export interface AppUser {
  id: string;
  alias: string;
  nombre: string;
  apellidos?: string;
  email: string;
  role: Role;
  blocked: boolean;
  vip?: boolean;
  createdAt?: string;
  descripcion?: string;
  especialidad?: string;
  fotoUrl?: string | null;
    foto?: string | null;      // 👈 Añade esto
  fotoUrl?: string | null;   // 👈 Este ya lo usas en el front
}

export interface CreatorDto extends AppUser {}

export interface CreateCreatorRequest {
  nombre: string;
  apellidos: string;
  alias: string;
  email: string;
  pwd: string;
  pwd2: string;
  foto?: string | null;
  fechaNac?: string;
}