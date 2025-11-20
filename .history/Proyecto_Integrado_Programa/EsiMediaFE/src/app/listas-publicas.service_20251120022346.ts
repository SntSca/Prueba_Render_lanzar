import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';  // 👈 ojo a la ruta

export interface ListaPublica {
  id?: string;
  nombre: string;
  descripcion: string;
  userEmail: string;
  contenidosIds: string[];
}

@Injectable({ providedIn: 'root' })
export class ListasPublicasService {
  private readonly baseUrl = `${environment.API_BASE}/listas`;

  constructor(private http: HttpClient) {}

  crearLista(lista: ListaPublica): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(this.baseUrl, lista);
  }

  listarListas(): Observable<ListaPublica[]> {
    return this.http.get<ListaPublica[]>(`${this.baseUrl}/publicas`);
  }

  eliminarLista(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  añadirContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(`${this.baseUrl}/${listaId}/contenidos/${contenidoId}`, {});
  }

  eliminarContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.delete<ListaPublica>(`${this.baseUrl}/${listaId}/contenidos/${contenidoId}`);
  }
}
