import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from './environments/environment';          
import { AuthService } from './auth/auth.service';                 

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService, { optional: true });

  
  private baseUrl = `${environment.API_BASE}/Contenidos`;

  private _favoritosIds$ = new BehaviorSubject<string[] | null>(null);
  favoritosIds$ = this._favoritosIds$.asObservable();


  private getUserBasics() {
    const fromAuth = this.auth?.getCurrentUser?.() || null;
    if (fromAuth) return fromAuth; 
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private buildHeaders(): HttpHeaders {
    const u = this.getUserBasics();
    const email = u?.email || '';
    const role  = (u?.role || '').toString().toUpperCase();
   
    const perfilRaw = localStorage.getItem('perfil') || localStorage.getItem('user_profile');
    let vip = false, fechaNacISO: string | undefined;
    try {
      const p = perfilRaw ? JSON.parse(perfilRaw) : null;
      vip = !!p?.vip;
      if (typeof p?.fechaNac === 'string') fechaNacISO = p.fechaNac.slice(0,10);
    } catch { /* noop */ }

    const h: Record<string, string> = {};
    if (email) h['X-User-Email'] = email;     
    if (role)  h['X-User-Role']  = role;      
    h['X-User-Vip'] = String(!!vip);
    if (fechaNacISO && /^\d{4}-\d{2}-\d{2}$/.test(fechaNacISO)) h['X-User-Birthdate'] = fechaNacISO;

    return new HttpHeaders(h);
  }

  private httpOpts() { return { headers: this.buildHeaders() }; }

  
  loadFavoritosIds(): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.baseUrl}/favoritos`,
      this.httpOpts()
    ).pipe(
      tap(ids => this._favoritosIds$.next(ids ?? [])),
      catchError(err => {
        console.error('Error cargando favoritos', err);
        this._favoritosIds$.next([]);
        return of([]);
      })
    );
  }

  isFavorito(id: string): boolean {
    const ids = this._favoritosIds$.value ?? [];
    return ids.includes(id);
  }

  addFavorito(id: string): Observable<void> {
    this.optimisticAdd(id);
    return this.http.post<void>(
      `${this.baseUrl}/${encodeURIComponent(id)}/favorito`,
      null,
      this.httpOpts()
    ).pipe(
      catchError(err => {
        console.error('Error al añadir favorito', err);
        this.rollbackAdd(id);
        throw err;
      })
    );
  }

  removeFavorito(id: string): Observable<void> {
    this.optimisticRemove(id);
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(id)}/favorito`,
      this.httpOpts()
    ).pipe(
      catchError(err => {
        console.error('Error al quitar favorito', err);
        this.rollbackRemove(id);
        throw err;
      })
    );
  }

  
  private optimisticAdd(id: string) {
    const current = this._favoritosIds$.value ?? [];
    if (!current.includes(id)) this._favoritosIds$.next([...current, id]);
  }
  private rollbackAdd(id: string) {
    const current = this._favoritosIds$.value ?? [];
    this._favoritosIds$.next(current.filter(x => x !== id));
  }
  private optimisticRemove(id: string) {
    const current = this._favoritosIds$.value ?? [];
    this._favoritosIds$.next(current.filter(x => x !== id));
  }
  private rollbackRemove(id: string) {
    const current = this._favoritosIds$.value ?? [];
    if (!current.includes(id)) this._favoritosIds$.next([...current, id]);
  }
}
