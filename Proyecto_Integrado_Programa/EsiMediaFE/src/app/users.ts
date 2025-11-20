import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export type RoleUI = 'usuario' | 'Gestor de Contenido' | 'Administrador';
export type TipoContenido = 'Audio' | 'Video';
export type MfaPreferred = 'NONE' | 'EMAIL_OTP' | 'TOTP';

export interface RegistroDatos {
  nombre: string;
  apellidos: string;
  email: string;
  alias: string;
  fechaNac: string;
  pwd: string;
  pwd2: string;
  vip?: boolean;
  foto: string;
  role: RoleUI;
  descripcion?: string;
  especialidad?: string;
  tipoContenido?: TipoContenido;
  mfaPreferred?: MfaPreferred
}

const trim = (s?: string) => (s ?? '').trim();
const e = encodeURIComponent;

const ROLE_TO_API: Record<RoleUI, 'USUARIO' | 'GESTOR_CONTENIDO' | 'ADMINISTRADOR'> = {
  usuario: 'USUARIO',
  'Gestor de Contenido': 'GESTOR_CONTENIDO',
  Administrador: 'ADMINISTRADOR',
};
const tipoToApi = (v?: TipoContenido): 'AUDIO' | 'VIDEO' | undefined =>
  !v ? undefined : v.toUpperCase() === 'VIDEO' ? 'VIDEO' : 'AUDIO';

const basePayload = (
  d: Pick<RegistroDatos, 'nombre'|'apellidos'|'email'|'alias'|'fechaNac'|'pwd'|'pwd2'|'vip'|'foto'|'role'>
) => ({
  nombre: d.nombre,
  apellidos: d.apellidos,
  email: d.email,
  alias: d.alias,
  fechaNac: d.fechaNac,
  pwd: d.pwd,
  pwd2: d.pwd2,
  vip: !!d.vip,
  foto: d.foto,
  role: ROLE_TO_API[d.role],
});

@Injectable({ providedIn: 'root' })
export class UsersService {
  // 👇 AHORA LA BASE URL VIENE DEL ENVIRONMENT
  private readonly baseUrl       = `${environment.API_USERS_BASE}/users`;
  private readonly registrarUrl  = `${this.baseUrl}/Registrar`;
  private readonly forgotUrl     = `${this.baseUrl}/forgot-password`;
  private readonly checkAliasUrl = `${this.baseUrl}/check-alias`;
  private readonly crearCreadorUrl = `${this.baseUrl}/admin/creators`;
  private readonly adminsBaseUrl   = `${this.baseUrl}/admin/admins`;

  constructor(private http: HttpClient) {}

  listAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  checkEmail(email: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${this.baseUrl}/check-email/${e(email)}`);
  }

  checkAlias(alias: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${this.checkAliasUrl}/${e(alias)}`);
  }

  forgotPassword(data: { email: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.forgotUrl, data);
  }

  registrar(datos: RegistroDatos): Observable<string> {
    const payload: any = basePayload(datos);

    if (datos.role === 'usuario') {
      payload.mfaPreferred = (datos.mfaPreferred ?? 'NONE').toUpperCase();
    }

    if (datos.role === 'Gestor de Contenido') {
      payload.descripcion  = trim(datos.descripcion);
      payload.especialidad = trim(datos.especialidad);
      const tc = tipoToApi(datos.tipoContenido ?? 'Audio');
      if (tc) payload.tipoContenido = tc;
    }

    return this.http.post(this.registrarUrl, payload, { responseType: 'text' });
  }

  crearCreadorComoAdmin(dto: Partial<RegistroDatos>): Observable<any> {
    const payload: any = {
      nombre: dto.nombre,
      apellidos: dto.apellidos,
      email: dto.email,
      alias: dto.alias,
      fechaNac: dto.fechaNac,
      pwd: dto.pwd,
      pwd2: dto.pwd2 ?? dto.pwd,
      foto: dto.foto,
      descripcion: trim(dto.descripcion),
      especialidad: trim(dto.especialidad),
    };
    const tc = tipoToApi(dto.tipoContenido ?? 'Audio');
    if (tc) payload.tipoContenido = tc;

    return this.http.post(this.crearCreadorUrl, payload);
  }

  updateAdmin(id: string, dto: any): Observable<any> {
    return this.http.patch<any>(`${this.adminsBaseUrl}/${e(id)}`, dto);
  }

  blockAdmin(id: string): Observable<any> {
    return this.http.post<any>(`${this.adminsBaseUrl}/${e(id)}/block`, {});
  }

  unblockAdmin(id: string): Observable<any> {
    return this.http.post<any>(`${this.adminsBaseUrl}/${e(id)}/unblock`, {});
  }

  deleteAdmin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminsBaseUrl}/${e(id)}`);
  }

  createAdminByAdmin(body: {
    nombre: string; apellidos: string; alias: string; email: string;
    pwd: string; pwd2: string; foto?: string; departamento?: string; fechaNac?: string;
  }): Observable<{ status: string; userId: string; message: string }> {
    return this.http.post<{ status: string; userId: string; message: string }>(this.adminsBaseUrl, body);
  }
}
