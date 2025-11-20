import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';
import { HttpClientModule } from '@angular/common/http';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${API_BASE_URL}/auth`;
  private readonly usersBase = `${API_BASE_URL}/users`;
  private readonly USER_KEY = 'user';
  private readonly checkAliasUrl = `${this.usersBase}/check-alias`;

  constructor(private http: HttpClient) {}

  
  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body);
  }

  verifyMfa(body: MfaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa/verify`, body);
  }

  verifyCaptcha(body: CaptchaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa3/verify`, body);
  }


  checkAlias(alias: string): Observable<{ available: boolean }> {
  return this.http.get<{ available: boolean }>(
    `${this.checkAliasUrl}/${encodeURIComponent(alias)}`
  );
  }
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

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  logout(): void {
    sessionStorage.removeItem(this.USER_KEY);
  }

  
  listAllUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersBase}/listarUsuarios`);
  }

  
  listCreators(search?: string, blocked?: boolean): Observable<CreatorDto[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    if (blocked != null) params = params.set('blocked', String(blocked));
    return this.http.get<CreatorDto[]>(`${this.usersBase}/admin/creators`, { params });
  }

  updateCreator(id: string, dto: Partial<CreatorDto>): Observable<CreatorDto> {
    return this.http.patch<CreatorDto>(`${this.usersBase}/admin/creators/${id}`, dto);
  }

  blockCreator(id: string): Observable<CreatorDto> {
    return this.http.post<CreatorDto>(`${this.usersBase}/admin/creators/${id}/block`, {});
  }

  unblockCreator(id: string): Observable<CreatorDto> {
    return this.http.post<CreatorDto>(`${this.usersBase}/admin/creators/${id}/unblock`, {});
  }

  deleteCreator(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersBase}/admin/creators/${id}`);
  }

  createCreator(body: CreateCreatorRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.usersBase}/admin/creators`, body);
  }

  
  listAdmins(search?: string, blocked?: boolean): Observable<AppUser[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    if (blocked != null) params = params.set('blocked', String(blocked));
    return this.http.get<AppUser[]>(`${this.usersBase}/admin/admins`, { params });
  }

  updateAdmin(id: string, dto: Partial<AppUser>): Observable<AppUser> {
    return this.http.patch<AppUser>(`${this.usersBase}/admin/admins/${id}`, dto);
  }

  blockAdmin(id: string): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.usersBase}/admin/admins/${id}/block`, {});
  }

  unblockAdmin(id: string): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.usersBase}/admin/admins/${id}/unblock`, {});
  }

  deleteAdmin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersBase}/admin/admins/${id}`);
  }

  createAdminByAdmin(body: Partial<AppUser>): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.usersBase}/admin/admins`, body);
  }

  
  updateUser(id: string, dto: any): Observable<AppUser> {
    return this.http.patch<AppUser>(`${this.usersBase}/admin/users/${id}`, dto);
  }
  
  blockUser(id: string): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.usersBase}/admin/users/${id}/block`, {});
  }
  
  unblockUser(id: string): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.usersBase}/admin/users/${id}/unblock`, {});
  }
  
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersBase}/admin/users/${id}`);
  }

  
  getPerfil(email: string): Observable<any> {
    return this.http.get<any>(`${this.usersBase}/obtenerPerfilUsuario`, {
      params: { email }
    });
  }

  putPerfil(payload: any): Observable<any> {
    return this.http.put<any>(`${this.usersBase}/modificarPerfilUsuario`, payload);
  }

  putPerfilCreadorContenido(payload:any): Observable<any>{
    return this.http.put<any>(`${this.usersBase}/modificarPerfilCreadorContenido`, payload);
  }

  darseBaja(email: string): Observable<string> {
    return this.http.delete<string>(`${this.usersBase}/darDeBajaUsuario`, {
      params: { email },
      responseType: 'text' as 'json'
    });
  }
}
