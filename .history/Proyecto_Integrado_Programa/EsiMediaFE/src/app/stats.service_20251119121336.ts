import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StatsResponse } from './stats';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private baseUrl = 'http://localhost:8082/Contenidos';

  constructor(private http: HttpClient) {}

  getTops(roleHeader: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({ 'X-User-Role': roleHeader });
    return this.http.get<StatsResponse>(`${this.baseUrl}/Estadisticas/Tops`, { headers });
  }
}