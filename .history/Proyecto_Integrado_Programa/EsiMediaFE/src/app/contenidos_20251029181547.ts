import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from './environments/environment';

export type TipoContenido = 'AUDIO' | 'VIDEO';

export interface Contenido {
  id: string;
  userEmail: string;
  titulo: string;
  descripcion?: string;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  tags: string[];
  duracionMinutos: number;
  resolucion?: string | null;
  vip: boolean;
  visible: boolean;
  fechaEstado?: string | null;
  disponibleHasta?: string | null;
  restringidoEdad: number;
  tipo: TipoContenido;
  imagen?: string | null;
  numReproducciones?: number; // si viene como "reproducciones" lo normalizamos aquí
}

export interface ModificarContenidoRequest {
  titulo?: string;
  descripcion?: string;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags?: string[];
  duracionMinutos?: number;
  vip?: boolean;
  visible?: boolean;
  disponibleHasta?: string | null;
  restringidoEdad?: number;
  imagen?: string | null;
}

@Injectable({ providedIn: 'root' })
export class Contenidos {
  private http = inject(HttpClient);
  private readonly BASE = `${environment.API_BASE}/Contenidos`;

  /** GET /Contenidos/ListarContenidos  (normaliza propiedades numéricas/booleanas) */
  listar(): Observable<Contenido[]> {
    return this.http.get<any[]>(`${this.BASE}/ListarContenidos`).pipe(
      map(arr => (arr ?? []).map((c: any) => ({
        id: c.id ?? c._id ?? '',
        userEmail: c.userEmail,
        titulo: c.titulo,
        descripcion: c.descripcion,
        ficheroAudio: c.ficheroAudio ?? null,
        urlVideo: c.urlVideo ?? null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        duracionMinutos: Number(c.duracionMinutos ?? 0),
        resolucion: c.resolucion ?? null,
        vip: !!c.vip,
        visible: !!c.visible,
        fechaEstado: c.fechaEstado ?? null,
        disponibleHasta: c.disponibleHasta ?? null,
        restringidoEdad: Number(c.restringidoEdad ?? 0),
        tipo: (c.tipo as TipoContenido),
        imagen: c.imagen ?? null,
        numReproducciones: Number(c.numReproducciones ?? c.reproducciones ?? 0),
      }) as Contenido))
    );
  }
 
  subirContenido(payload: Partial<Contenido>): Observable<Contenido> {
    return this.http.post<Contenido>(`${this.BASE}/AnadirContenido`, payload);
  }
 
  modificar(id: string, cambios: ModificarContenidoRequest, creatorTipo: TipoContenido): Observable<Contenido> {
    const headers = new HttpHeaders({ 'X-Creator-Tipo': creatorTipo });
    return this.http.put<Contenido>(`${this.BASE}/ModificarContenido/${encodeURIComponent(id)}`, cambios, { headers });
  }
  eliminar(id: string, creatorTipo: TipoContenido): Observable<void> {
    const headers = new HttpHeaders({ 'X-Creator-Tipo': creatorTipo });
    return this.http.delete<void>(`${this.BASE}/EliminarContenido/${encodeURIComponent(id)}`, { headers });
  }
}
