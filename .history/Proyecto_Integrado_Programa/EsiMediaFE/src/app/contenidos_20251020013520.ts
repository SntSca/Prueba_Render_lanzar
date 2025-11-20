import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/* Helpers */
const url = (...p: string[]) => p.join('/');
const paramsFrom = (o?: Record<string, any>) =>
  o
    ? new HttpParams({
        fromObject: Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
        ),
      })
    : undefined;

/* Tipos opcionales (ajusta a tu backend si quieres) */
export interface ContenidoFiltro {
  search?: string;
  tipo?: 'AUDIO' | 'VIDEO';
  vip?: boolean;
  visible?: boolean;
  page?: number;
  size?: number;
}
export interface ContenidoCreate {
  titulo: string;
  descripcion?: string;
  tipo: 'AUDIO' | 'VIDEO';
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags?: string[];
  duracionMinutos?: number;
  vip?: boolean;
  visible?: boolean;
  restringidoEdad?: boolean;
  imagen?: string | null;
}

@Injectable({ providedIn: 'root' })
export class Contenidos {
  private readonly base = 'http://localhost:8082/Contenidos';

  constructor(private http: HttpClient) {}

  listarContenidos(filtros?: ContenidoFiltro): Observable<any> {
    return this.http.get(url(this.base, 'listarContenidos'), {
      params: paramsFrom(filtros),
    });
  }

  subirContenido(contenido: ContenidoCreate): Observable<any> {
    return this.http.post(url(this.base, 'AnadirContenido'), contenido);
  }
}
