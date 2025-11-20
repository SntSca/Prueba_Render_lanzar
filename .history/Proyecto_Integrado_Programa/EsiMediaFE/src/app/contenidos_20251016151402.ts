import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Contenidos {

  constructor(private http: HttpClient) { }
      
  listarContenidos(filtros?: any): Observable<any> {
    return this.http.get('http://localhost:8082/Contenidos/listarContenidos', { params: filtros });
  }
  subirContenido(contenido: any): Observable<any> {
    return this.http.post('http://localhost:8082/Contenidos/AnadirContenido', contenido);
  }
}