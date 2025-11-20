import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ListaPublica {
  id?: string;
  nombre: string;
  descripcion: string;
  userEmail: string;
  contenidosIds: string[];
}

@Injectable({ providedIn: 'root' })
export class ListasPublicasService {
  private readonly apiUrl = 'http://localhost:8082/listas';

  constructor(private http: HttpClient) {}

  crearLista(lista: ListaPublica): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(this.apiUrl, lista);
  }

listarListas(): Observable<ListaPublica[]> {
  return this.http.get<ListaPublica[]>('http://localhost:8082/listas/publicas');
}


  eliminarLista(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  añadirContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.post<ListaPublica>(`${this.apiUrl}/${listaId}/add/${contenidoId}`, {});
  }

  eliminarContenido(listaId: string, contenidoId: string): Observable<ListaPublica> {
    return this.http.delete<ListaPublica>(`${this.apiUrl}/${listaId}/remove/${contenidoId}`);
  }
}
