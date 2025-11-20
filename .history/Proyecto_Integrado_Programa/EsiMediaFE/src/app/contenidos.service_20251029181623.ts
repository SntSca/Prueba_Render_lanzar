import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from './environments/environment';

export type ResolveResult =
  | { kind: 'external'; url: string }
  | { kind: 'local';   blobUrl: string; mime: string };

type HeaderOpts = {
  id: string;
  role: string;          // 'USUARIO' incrementa reproducciones en backend
  email: string;
  vip: boolean;
  fechaNacISO?: string;  // YYYY-MM-DD
  ageYears?: number;     // si se pasa, tiene prioridad sobre la fecha
};

@Injectable({ providedIn: 'root' })
export class ContenidosService {
  // De momento no usamos http aquí, pero lo dejamos inyectado por si en el futuro hace falta
  private http = inject(HttpClient);
  private readonly BASE = `${environment.API_BASE}/Contenidos`;

  /** Cabeceras que espera tu backend de streaming */
  private buildHeaders(opts: HeaderOpts): Record<string, string> {
    const h: Record<string, string> = {
      'X-User-Role': opts.role ?? '',
      'X-User-Email': opts.email ?? '',
      'X-User-Vip': String(!!opts.vip),
    };
    if (opts.ageYears && opts.ageYears > 0) h['X-User-Age'] = String(opts.ageYears);
    if (opts.fechaNacISO && /^\d{4}-\d{2}-\d{2}$/.test(opts.fechaNacISO)) h['X-User-Birthdate'] = opts.fechaNacISO;
    return h;
  }

  /** Mensaje legible desde Response */
  private async extractMessage(res: Response, fallback: string): Promise<string> {
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        if (j?.message) return String(j.message);
        if (j?.error)   return String(j.error);
      }
      const t = await res.text();
      if (t) {
        const plain = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return plain.length > 200 ? plain.slice(0, 200) + '…' : plain;
      }
    } catch { /* ignore */ }
    return fallback;
  }

  /** Normaliza Location absoluta/relativa */
  private normalizeLocation(loc: string): string {
    try {
      return new URL(loc).href;
    } catch {
      try {
        const base = new URL(environment.API_BASE);
        return new URL(loc, base.origin).href;
      } catch {
        return loc;
      }
    }
  }

  /** HEAD/GET parcial para comprobar disponibilidad de streaming */
  async canStream(opts: HeaderOpts): Promise<void> {
    const headers = this.buildHeaders(opts);
    const url = `${this.BASE}/ReproducirContenido/${encodeURIComponent(opts.id)}`;

    try {
      const head = await fetch(url, { method: 'HEAD', headers });
      if (head.ok) return;
      if (head.status >= 400 && head.status < 600) {
        throw new Error(await this.extractMessage(head, `No disponible (HTTP ${head.status})`));
      }
    } catch {
      // algunos servidores no permiten HEAD; probamos GET parcial
    }

    const tiny = await fetch(url, {
      method: 'GET',
      headers: { ...headers, Range: 'bytes=0-0' },
      redirect: 'manual',
    });

    if (tiny.status === 0) return; // opaque
    if ([301, 302, 303, 307, 308].includes(tiny.status)) return; 
    if (!tiny.ok) {
      throw new Error(await this.extractMessage(tiny, `No disponible (HTTP ${tiny.status})`));
    }
  }

  async resolveAndCount(opts: HeaderOpts): Promise<ResolveResult> {
    const headers = this.buildHeaders(opts);
    const url = `${this.BASE}/ReproducirContenido/${encodeURIComponent(opts.id)}`;
    const resManual = await fetch(url, {
      method: 'GET',
      headers: { ...headers, Range: 'bytes=0-0' },
      redirect: 'manual',
    });

    if (resManual.status === 0) {
      throw new Error('HTTP0_OPAQUE');
    }

    if ([301, 302, 303, 307, 308].includes(resManual.status)) {
      const loc = resManual.headers.get('Location') || resManual.headers.get('location');
      if (!loc) throw new Error('El backend redirigió pero no envió Location.');
      return { kind: 'external', url: this.normalizeLocation(loc) };
    }

    if (!resManual.ok) {
      throw new Error(await this.extractMessage(resManual, `No se pudo reproducir (HTTP ${resManual.status})`));
    }

    const res = await fetch(url, { method: 'GET', headers, redirect: 'follow' });
    if (!res.ok) {
      throw new Error(await this.extractMessage(res, `No se pudo reproducir (HTTP ${res.status})`));
    }

    const ct = res.headers.get('content-type') || '';
    if (!/(audio|video)\//i.test(ct)) {
      const text = await res.clone().text().catch(() => '');
      const plain = text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
      throw new Error(plain || 'El origen no devolvió un flujo multimedia reproducible.');
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { kind: 'local', blobUrl, mime: ct || 'application/octet-stream' };
  }
}
