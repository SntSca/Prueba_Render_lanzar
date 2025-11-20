import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type RoleUI = 'usuario' | 'Gestor de Contenido' | 'Administrador';
export type TipoContenido = 'Audio' | 'Video';

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
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private readonly baseUrl = 'http://localhost:8081/users';
  private readonly registrarUrl  = `${this.baseUrl}/Registrar`;
  private readonly forgotUrl     = `${this.baseUrl}/forgot-password`;
  private readonly checkAliasUrl = `${this.baseUrl}/check-alias`;
  private readonly crearCreadorUrl = `${this.baseUrl}/admin/creators`;
  private readonly adminsBaseUrl = `${this.baseUrl}/admin/admins`;

  constructor(private http: HttpClient) {}
  private mapRoleToApi(role: RoleUI): 'USUARIO' | 'GESTOR_CONTENIDO' | 'ADMINISTRADOR' {
    switch (role) {
      case 'usuario':             return 'USUARIO';
      case 'Gestor de Contenido': return 'GESTOR_CONTENIDO';
      case 'Administrador':       return 'ADMINISTRADOR';
      default:                    return 'USUARIO';
    }
  }
  private mapTipoContenido(v?: TipoContenido): 'AUDIO' | 'VIDEO' | undefined {
    if (!v) return undefined;
    const up = v.toUpperCase();
    return up === 'VIDEO' ? 'VIDEO' : 'AUDIO';
  }
  listAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  registrar(datos: RegistroDatos): Observable<string> {
    const payload: any = {
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      email: datos.email,
      alias: datos.alias,
      fechaNac: datos.fechaNac,
      pwd: datos.pwd,
      pwd2: datos.pwd2,
      vip: !!datos.vip,
      foto: datos.foto,
      role: this.mapRoleToApi(datos.role)
    };

    if (datos.role === 'Gestor de Contenido') {
      payload.descripcion  = (datos.descripcion  ?? '').trim();
      payload.especialidad = (datos.especialidad ?? '').trim();
      const tc = this.mapTipoContenido(datos.tipoContenido ?? 'Audio');
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
      descripcion: (dto.descripcion ?? '').trim(),
      especialidad: (dto.especialidad ?? '').trim()
    };
    const tc = this.mapTipoContenido(dto.tipoContenido ?? 'Audio');
    if (tc) payload.tipoContenido = tc;

    return this.http.post(this.crearCreadorUrl, payload);
  }

  forgotPassword(data: { email: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.forgotUrl, data);
  }

  checkAlias(alias: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(
      `${this.checkAliasUrl}/${encodeURIComponent(alias)}`
    );
  }

  updateAdmin(id: string, dto: any): Observable<any> {
    return this.http.patch<any>(`${this.adminsBaseUrl}/${encodeURIComponent(id)}`, dto);
  }

  blockAdmin(id: string): Observable<any> {
    return this.http.post<any>(`${this.adminsBaseUrl}/${encodeURIComponent(id)}/block`, {});
  }
  unblockAdmin(id: string): Observable<any> {
    return this.http.post<any>(`${this.adminsBaseUrl}/${encodeURIComponent(id)}/unblock`, {});
  }
  deleteAdmin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminsBaseUrl}/${encodeURIComponent(id)}`);
  }
 
  createAdminByAdmin(body: {
    nombre: string;
    apellidos: string;
    alias: string;
    email: string;
    pwd: string;
    pwd2: string;
    foto?: string;
    departamento?: string;
    fechaNac?: string;
  }): Observable<{ status: string; userId: string; message: string }> {
    return this.http.post<{ status: string; userId: string; message: string }>(
      this.adminsBaseUrl,
      body
    );
  }

  
}
