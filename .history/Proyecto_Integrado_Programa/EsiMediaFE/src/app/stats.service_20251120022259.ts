import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StatsResponse } from './stats';
import { environment } from './environments/environment';  // 👈 OJO a la ruta

@Injectable({ providedIn: 'root' })
export class StatsService {
  // Usamos API_BASE (8082 en local, Render en prod)
  private baseUrl = `${environment.API_BASE}/Contenidos`;

  constructor(private http: HttpClient) {}

  getTops(roleHeader: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({ 'X-User-Role': roleHeader });
    return this.http.get<StatsResponse>(`${this.baseUrl}/Estadisticas/Tops`, { headers });
  }
}
