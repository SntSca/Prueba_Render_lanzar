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

/* ========= Helpers puros ========= */
const e = encodeURIComponent;
const url = (...parts: string[]) => parts.join('/');
const paramsFrom = (o?: Record<string, any>) =>
  o
    ? new HttpParams({
        fromObject: Object.fromEntries(
          Object.entries(o).filter(
            ([, v]) => v !== undefined && v !== null && String(v).trim() !== ''
          )
        ),
      })
    : undefined;
/* ================================= */

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${API_BASE_URL}/auth`;
  private readonly usersBase = `${API_BASE_URL}/users`;
  private readonly USER_KEY = 'user';

  private readonly creatorsBase = url(this.usersBase, 'admin/creators');
  private readonly adminsBase   = url(this.usersBase, 'admin/admins');
  private readonly usersAdminBase = url(this.usersBase, 'admin/users');

  constructor(private http: HttpClient) {}

  /* ======= Auth ======= */
  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(url(this.base, 'login'), body);
  }
  verifyMfa(body: MfaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(url(this.base, 'mfa/verify'), body);
  }
  verifyCaptcha(body: CaptchaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(url(this.base, 'mfa3/verify'), body);
  }

  /* ======= Session ======= */
  saveSession(user: UserDto): void {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
  getCurrentUser(): UserDto | null {
    try {
      const raw = sessionStorage.getItem(this.USER_KEY);
      return raw ? (JSON.parse(raw) as UserDto) : null;
    } catch {
      return null;
    }
  }
  isAuthenticated(): boolean { return !!this.getCurrentUser(); }
  logout(): void { sessionStorage.removeItem(this.USER_KEY); }

  /* ======= Checks ======= */
  checkAlias(alias: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(
      url(this.usersBase, 'check-alias', e(alias))
    );
  }

  /* ======= Listado completo ======= */
  listAllUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(url(this.usersBase, 'listarUsuarios'));
  }

  /* ======= Helpers CRUD por tipo ======= */
  private listWithFilters<T>(baseUrl: string, search?: string, blocked?: boolean): Observable<T[]> {
    return this.http.get<T[]>(baseUrl, {
      params: paramsFrom({ search: search?.trim(), blocked }),
    });
  }
  private patchById<T>(baseUrl: string, id: string, dto: any): Observable<T> {
    return this.http.patch<T>(url(baseUrl, e(id)), dto);
  }
  private postActionById<T>(baseUrl: string, id: string, action: 'block'|'unblock'): Observable<T> {
    return this.http.post<T>(url(baseUrl, e(id), action), {});
  }
  private deleteById(baseUrl: string, id: string): Observable<void> {
    return this.http.delete<void>(url(baseUrl, e(id)));
  }

  /* ======= Creators (admin) ======= */
  listCreators(search?: string, blocked?: boolean): Observable<CreatorDto[]> {
    return this.listWithFilters<CreatorDto>(this.creatorsBase, search, blocked);
  }
  updateCreator(id: string, dto: Partial<CreatorDto>): Observable<CreatorDto> {
    return this.patchById<CreatorDto>(this.creatorsBase, id, dto);
  }
  blockCreator(id: string): Observable<CreatorDto> {
    return this.postActionById<CreatorDto>(this.creatorsBase, id, 'block');
  }
  unblockCreator(id: string): Observable<CreatorDto> {
    return this.postActionById<CreatorDto>(this.creatorsBase, id, 'unblock');
  }
  deleteCreator(id: string): Observable<void> {
    return this.deleteById(this.creatorsBase, id);
  }
  createCreator(body: CreateCreatorRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.creatorsBase, body);
  }

  /* ======= Admins (admin) ======= */
  listAdmins(search?: string, blocked?: boolean): Observable<AppUser[]> {
    return this.listWithFilters<AppUser>(this.adminsBase, search, blocked);
  }
  updateAdmin(id: string, dto: Partial<AppUser>): Observable<AppUser> {
    return this.patchById<AppUser>(this.adminsBase, id, dto);
  }
  blockAdmin(id: string): Observable<AppUser> {
    return this.postActionById<AppUser>(this.adminsBase, id, 'block');
  }
  unblockAdmin(id: string): Observable<AppUser> {
    return this.postActionById<AppUser>(this.adminsBase, id, 'unblock');
  }
  deleteAdmin(id: string): Observable<void> {
    return this.deleteById(this.adminsBase, id);
  }
  createAdminByAdmin(body: Partial<AppUser>): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.adminsBase, body);
  }

  /* ======= Users (admin) ======= */
  updateUser(id: string, dto: any): Observable<AppUser> {
    return this.patchById<AppUser>(this.usersAdminBase, id, dto);
  }
  blockUser(id: string): Observable<AppUser> {
    return this.postActionById<AppUser>(this.usersAdminBase, id, 'block');
  }
  unblockUser(id: string): Observable<AppUser> {
    return this.postActionById<AppUser>(this.usersAdminBase, id, 'unblock');
  }
  deleteUser(id: string): Observable<void> {
    return this.deleteById(this.usersAdminBase, id);
  }

  /* ======= Perfil ======= */
  getPerfil(email: string): Observable<any> {
    return this.http.get<any>(url(this.usersBase, 'obtenerPerfilUsuario'), {
      params: paramsFrom({ email }),
    });
  }
  putPerfil(payload: any): Observable<any> {
    return this.http.put<any>(url(this.usersBase, 'modificarPerfilUsuario'), payload);
  }
  putPerfilCreadorContenido(payload: any): Observable<any> {
    return this.http.put<any>(url(this.usersBase, 'modificarPerfilCreadorContenido'), payload);
  }
  darseBaja(email: string): Observable<string> {
    return this.http.delete<string>(url(this.usersBase, 'darDeBajaUsuario'), {
      params: paramsFrom({ email }),
      responseType: 'text' as 'json',
    });
  }
}
