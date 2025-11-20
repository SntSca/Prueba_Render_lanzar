import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';

import {
  BackendLoginResponse,
  LoginRequest,
  UserDto,
  MfaVerifyRequest,
  CaptchaVerifyRequest,
  AppUser,
  CreatorDto,
  CreateCreatorRequest,
} from './models';

export interface FriendlyError {
  message: string;
  remainingAttempts?: number | null;
  retryAfterSeconds?: number | null;
}

/* =================== Helpers puros =================== */
const e = encodeURIComponent;
const u = (...parts: string[]) => parts.join('/'); // join seguro para rutas ya formadas
const qp = (o?: Record<string, string | number | boolean | undefined | null>) =>
  o
    ? new HttpParams({
        fromObject: Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        ),
      })
    : undefined;

type Id = string;
type Filters = { search?: string; blocked?: boolean | null | undefined };
/* ===================================================== */

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${API_BASE_URL}/auth`;
  private readonly usersBase = `${API_BASE_URL}/users`;
  private readonly USER_KEY = 'user';

  // subrutas reutilizadas
  private readonly creatorsBase = u(this.usersBase, 'admin/creators');
  private readonly adminsBase   = u(this.usersBase, 'admin/admins');
  private readonly usersAdminBase = u(this.usersBase, 'admin/users');

  constructor(private http: HttpClient) {}

  /* ========== Auth ========== */
  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(u(this.base, 'login'), body);
  }
  verifyMfa(body: MfaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(u(this.base, 'mfa/verify'), body);
  }
  verifyCaptcha(body: CaptchaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(u(this.base, 'mfa3/verify'), body);
  }

  /* ========== Session ========== */
  saveSession(user: UserDto): void {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
  getCurrentUser(): UserDto | null {
    try { const raw = sessionStorage.getItem(this.USER_KEY); return raw ? (JSON.parse(raw) as UserDto) : null; }
    catch { return null; }
  }
  isAuthenticated(): boolean { return !!this.getCurrentUser(); }
  logout(): void { sessionStorage.removeItem(this.USER_KEY); }

  /* ========== Checks ========== */
  checkAlias(alias: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(u(this.usersBase, 'check-alias', e(alias)));
  }

  /* ========== Listados base ========== */
  listAllUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(u(this.usersBase, 'listarUsuarios'));
  }

  private listWithFilters<T>(baseUrl: string, f?: Filters): Observable<T[]> {
    return this.http.get<T[]>(baseUrl, { params: qp({ search: f?.search?.trim(), blocked: f?.blocked ?? undefined }) });
  }

  /* ========== CREATOR admin ========== */
  listCreators(search?: string, blocked?: boolean): Observable<CreatorDto[]> {
    return this.listWithFilters<CreatorDto>(this.creatorsBase, { search, blocked });
  }
  updateCreator(id: Id, dto: Partial<CreatorDto>): Observable<CreatorDto> {
    return this.http.patch<CreatorDto>(u(this.creatorsBase, e(id)), dto);
  }
  blockCreator(id: Id): Observable<CreatorDto> {
    return this.http.post<CreatorDto>(u(this.creatorsBase, e(id), 'block'), {});
  }
  unblockCreator(id: Id): Observable<CreatorDto> {
    return this.http.post<CreatorDto>(u(this.creatorsBase, e(id), 'unblock'), {});
  }
  deleteCreator(id: Id): Observable<void> {
    return this.http.delete<void>(u(this.creatorsBase, e(id)));
  }
  createCreator(body: CreateCreatorRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.creatorsBase, body);
  }

  /* ========== ADMIN admin ========== */
  listAdmins(search?: string, blocked?: boolean): Observable<AppUser[]> {
    return this.listWithFilters<AppUser>(this.adminsBase, { search, blocked });
  }
  updateAdmin(id: Id, dto: Partial<AppUser>): Observable<AppUser> {
    return this.http.patch<AppUser>(u(this.adminsBase, e(id)), dto);
  }
  blockAdmin(id: Id): Observable<AppUser> {
    return this.http.post<AppUser>(u(this.adminsBase, e(id), 'block'), {});
  }
  unblockAdmin(id: Id): Observable<AppUser> {
    return this.http.post<AppUser>(u(this.adminsBase, e(id), 'unblock'), {});
  }
  deleteAdmin(id: Id): Observable<void> {
    return this.http.delete<void>(u(this.adminsBase, e(id)));
  }
  createAdminByAdmin(body: Partial<AppUser>): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.adminsBase, body);
  }

  /* ========== USER admin ========== */
  updateUser(id: Id, dto: any): Observable<AppUser> {
    return this.http.patch<AppUser>(u(this.usersAdminBase, e(id)), dto);
  }
  blockUser(id: Id): Observable<AppUser> {
    return this.http.post<AppUser>(u(this.usersAdminBase, e(id), 'block'), {});
  }
  unblockUser(id: Id): Observable<AppUser> {
    return this.http.post<AppUser>(u(this.usersAdminBase, e(id), 'unblock'), {});
  }
  deleteUser(id: Id): Observable<void> {
    return this.http.delete<void>(u(this.usersAdminBase, e(id)));
  }

  /* ========== Perfil ========== */
  getPerfil(email: string): Observable<any> {
    return this.http.get<any>(u(this.usersBase, 'obtenerPerfilUsuario'), { params: qp({ email }) });
  }
  putPerfil(payload: any): Observable<any> {
    return this.http.put<any>(u(this.usersBase, 'modificarPerfilUsuario'), payload);
  }
  putPerfilCreadorContenido(payload: any): Observable<any> {
    return this.http.put<any>(u(this.usersBase, 'modificarPerfilCreadorContenido'), payload);
  }
  darseBaja(email: string): Observable<string> {
    return this.http.delete<string>(u(this.usersBase, 'darDeBajaUsuario'), {
      params: qp({ email }),
      responseType: 'text' as 'json',
    });
  }
}
