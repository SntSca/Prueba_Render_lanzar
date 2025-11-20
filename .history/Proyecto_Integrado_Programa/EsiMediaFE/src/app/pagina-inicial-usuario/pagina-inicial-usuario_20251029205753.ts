import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto, Contenido } from '../auth/models';
import { HttpClient, HttpErrorResponse, HttpClientModule } from '@angular/common/http';
import { ContenidosService, ResolveResult } from '../contenidos.service';

import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {
  readOnly = false;
  fromAdmin = false;

  contenidos: Contenido[] = [];
  contenidosLoading = false;
  contenidosError: string | null = null;
  private readonly CONTENIDOS_BASE = 'http://localhost:8082/Contenidos';
  playerOpen = false;
  playerSrc: string | null = null;
  playerKind: 'AUDIO' | 'VIDEO' = 'VIDEO';
  playingId: string | null = null;
  playingTitle: string | null = null;



  avatars: string[] = [
    'assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'
  ];
  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;

  userName = '';
  userEmail = '';
  userInitials = '';
  userAvatar: string | null = null;

  private loggedUser: UserDto | null = null;
  private userAliasActual = '';

  loading = false;
  errorMsg = '';
  okMsg: string | null = null;
  saving = false;
  editOpen = false;

  model: Partial<{
    nombre: string;
    apellidos: string;
    alias: string;
    fechaNac: string;
    foto: string;
    vip: boolean;
  }> = {};

  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12 };
  private readonly ALIAS_MIN = 3;

  private t = (s: unknown) => (typeof s === 'string' ? s : '').trim();
  private normUrl(raw: unknown): string {
    const s = this.t(raw);
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
    const API_BASE: string | null = null;
    return API_BASE ? s.replace(/^\/+/g, '') : s;
  }
  private cleanPayload<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      out[k] = v;
    }
    return out as T;
  }
  private initialsFrom(text: string): string {
    const s = this.t(text);
    if (!s) return 'U';
    return s.split(/\s+/, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }
  private formatISODate(raw?: string | null): string {
    const s = this.t(raw);
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s.slice(0, 10);
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly http: HttpClient,
    private contenidosSvc: ContenidosService
  ) {}

  ngOnInit(): void {
    this.computeReadOnlyFlags();
    this.bootstrapUser();
    this.cargarContenidos();
  }

  private computeReadOnlyFlags(): void {
    const qp = this.route.snapshot.queryParamMap;
    const qModo = (qp.get('modoLectura') || '').toLowerCase();
    const qFrom = (qp.get('from') || '').toLowerCase();
    const stateFrom = history.state?.fromAdmin === true;
    const lsReadOnly = localStorage.getItem('users_readonly_mode') === '1';
    const lsFromAdmin = localStorage.getItem('users_readonly_from_admin') === '1';

    this.readOnly =
      ['1', 'true', 'si', 'yes'].includes(qModo) ||
      (lsReadOnly && lsFromAdmin) ||
      location.pathname.includes('/usuarioReadOnly');

    this.fromAdmin = qFrom === 'admin' || stateFrom || lsFromAdmin;

    if (this.readOnly && this.fromAdmin) {
      localStorage.setItem('users_readonly_mode', '1');
      localStorage.setItem('users_readonly_from_admin', '1');
    }
  }

  private bootstrapUser(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return parsed?.email && parsed?.role ? (parsed as UserDto) : null;
    } catch {
      return null;
    }
  }

  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;

    this.userName = this.t(user.nombre) || user.email.split('@')[0];
    this.userEmail = user.email;

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => this.onPerfilLoaded(u),
      error: (_e: HttpErrorResponse) => {
        this.errorMsg = 'No se pudo cargar tu perfil';
        this.cdr.markForCheck();
      }
    });
  }

  private onPerfilLoaded(u: any) {
    this.paintFromProfile(u);
    const avatar = this.normUrl(this.resolveAvatarRaw(u));
    this.userAvatar = avatar || null;
    if (!avatar) this.userInitials = this.initialsFrom(u?.alias || u?.nombre || this.userName);
    this.cdr.markForCheck();
  }

  private resolveAvatarRaw(u: any): string {
    return this.t(u?.fotoUrl) || this.t(u?.foto) || this.t(this.model?.foto);
  }

  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;
    this.userAliasActual = this.t(u?.alias);

    const nombre = this.t(u?.nombre);
    const apellidos = this.t(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();
    this.userName = this.t(u?.alias) || fullName || u?.email || this.userName;

    this.userInitials = this.initialsFrom(this.t(u?.alias) || fullName || u?.email || '');

    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      fechaNac: this.formatISODate(u?.fechaNac),
      foto: u?.foto ?? u?.fotoUrl ?? '',
      vip: !!u?.vip
    };
  }
  salirModoLectura(): void {
    localStorage.removeItem('users_readonly_mode');
    localStorage.removeItem('users_readonly_from_admin');
    this.router.navigateByUrl('/admin');
  }

  CerrarSesion(): void {
    Swal.fire({
      title: '¿Seguro que deseas cerrar sesión?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(r => {
      if (!r.isConfirmed) return;
      this.auth.logout?.();
      localStorage.removeItem('user');
      Swal.fire({
        title: 'Sesión cerrada correctamente.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        willClose: () => { void this.router.navigateByUrl('/auth/login', { replaceUrl: true }); }
      });
    });
  }

  DarDeBaja(): void {
    if (!confirm('¿Seguro que deseas darte de baja de la plataforma? Esta acción no se puede deshacer.')) return;
    this.auth.darseBaja(this.userEmail).subscribe({
      next: (msg: string) => {
        alert(msg || 'Usuario eliminado correctamente');
        this.auth.logout?.();
        localStorage.removeItem('user');
        sessionStorage.clear();
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      },
      error: (err: any) => alert(err?.error || err?.message || 'Error al eliminar usuario')
    });
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; this.closeAvatarModal(); }

  toggleEditar() {
    if (this.readOnly) return;
    requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); });
  }
  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }
  handleKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') this.closeAvatarModal(); }

  async guardarCambios() {
    if (this.readOnly) return;

    const msg = this.validateProfileFields();
    if (msg) return this.failSave(msg);

    this.okMsg = null; this.errorMsg = ''; this.saving = true;

    try {
      const aliasAEnviar = await this.computeAliasToSend();
      const fotoSeleccionada = this.computeFotoToSend();

      const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
        email: this.userEmail,
        alias: aliasAEnviar,
        nombre: this.t(this.model?.nombre) || undefined,
        apellidos: this.t(this.model?.apellidos) || undefined,
        fechaNac: this.model?.fechaNac ? String(this.model.fechaNac).slice(0, 10) : undefined,
        vip: typeof this.model?.vip === 'boolean' ? this.model.vip : undefined,
        fotoUrl: fotoSeleccionada,
        foto: fotoSeleccionada
      };

      const payload = this.cleanPayload(raw);
      this.auth.putPerfil(payload).subscribe({
        next: (perfil: any) => this.successSave(perfil),
        error: (err: any) => this.failSave(err?.error?.message || err?.message || 'Error al actualizar el perfil')
      });
    } catch (e: any) {
      this.failSave(e?.message || 'Error al procesar los cambios');
    }
  }

  private successSave(perfil: any) {
    this.paintFromProfile(perfil);
    this.editOpen = false;
    this.okMsg = 'Se ha editado correctamente';
    this.errorMsg = '';
    this.saving = false;

    if (this.selectedAvatar) this.userAvatar = this.selectedAvatar;

    void Swal.fire({ icon: 'success', title: 'Se ha editado correctamente', timer: 1500, showConfirmButton: false });
    this.cdr.markForCheck();
  }

  private failSave(msg: string) {
    this.saving = false;
    this.errorMsg = msg;
    this.cdr.markForCheck();
  }

  private computeFotoToSend(): string | undefined {
    return this.t(this.selectedAvatar || this.foto || this.model?.foto) || undefined;
  }

  private async computeAliasToSend(): Promise<string | undefined> {
    const aliasNuevo = this.t(this.model?.alias);
    if (!aliasNuevo) return undefined;

    const noCambio =
      this.userAliasActual &&
      aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0;

    const aliasAEnviar = noCambio ? undefined : aliasNuevo;
    if (!aliasAEnviar) return undefined;

    const ok = await this.ensureAliasDisponible(aliasAEnviar);
    if (!ok) throw new Error('El alias ya existe. Elige otro.');
    return aliasAEnviar;
    }

  private async ensureAliasDisponible(alias: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.auth.checkAlias(alias));
      return !!res?.available;
    } catch {
      return false;
    }
  }

  private validateProfileFields(): string | null {
    const n = this.t(this.model?.nombre);
    const a = this.t(this.model?.apellidos);
    const al = this.t(this.model?.alias);

    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (a && a.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (al && (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)) {
      return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    }
    return null;
  }

  getInitials(nombre: string): string {
    const safe = this.t(nombre);
    return safe ? safe.split(/\s+/).map(p => p[0]).join('').toUpperCase() : 'U';
  }

public cargarContenidos(): void {
  this.contenidosLoading = true;
  this.contenidosError = null;

  this.http.get<any[]>(`${this.CONTENIDOS_BASE}/ListarContenidos`).subscribe({
    next: (raw) => {
      const items: Contenido[] = (raw || [])
        .map((c: any) => ({
          id: c.id ?? c._id ?? '',
          userEmail: c.userEmail,
          titulo: c.titulo,
          descripcion: c.descripcion,
          ficheroAudio: c.ficheroAudio,
          urlVideo: c.urlVideo,
          tags: c.tags ?? [],
          duracionMinutos: c.duracionMinutos,
          resolucion: c.resolucion,
          vip: !!c.vip,
          visible: !!c.visible,
          disponibleHasta: c.disponibleHasta,
          restringidoEdad: Number(c.restringidoEdad ?? 0),
          tipo: c.tipo,
          imagen: c.imagen,
          reproducciones: c.reproducciones ?? 0,
          fechaEstado: c.fechaEstado,
        }))
        // FILTRO: solo contenidos visibles
        .filter(item => item.visible)
        // FILTRO: según si el usuario es VIP o no
        .filter(item => this.model.vip ? item.vip : !item.vip)
        .sort((a, b) => {
          const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
          const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
          return tb - ta;
        });

      this.contenidos = items;
      this.contenidosLoading = false;
      this.cdr.markForCheck();
    },
    error: (err: HttpErrorResponse) => {
      console.error(err);
      this.contenidosError = 'No se pudieron cargar los contenidos.';
      this.contenidosLoading = false;
      this.cdr.markForCheck();
    },
  });
}



  private isHttpUrl(u: unknown): u is string {
    if (typeof u !== 'string') return false;
    const s = u.trim().toLowerCase();
    return s.startsWith('http://') || s.startsWith('https://');
  }
  private toNum(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  private calcAgeFromISO(iso?: string | null): number | null {
    if (!iso) return null;
    const d = new Date(iso); if (isNaN(+d)) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }

  private playingBusy = false;
  private openedExternally = false;
  private openedInternally = false;

  private showError(msg: string) {
    
    if (this.openedExternally || this.openedInternally) return;
    Swal.fire({ icon: 'error', title: 'Reproducción no disponible', text: msg });
    this.closePlayer();
  }

  async play(c: any) {
    if (this.playingBusy) return;     
    this.playingBusy = true;
    this.openedExternally = false;
    this.openedInternally = false;

    try {
      const role  = this.loggedUser?.role ?? 'USUARIO';
      const email = this.userEmail;
      const vip   = !!this.model?.vip;
      const fecha = this.model?.fechaNac || undefined;
      const age   = this.calcAgeFromISO(fecha) ?? undefined;

      
      await this.contenidosSvc.canStream({ id: c.id, role, email, vip, fechaNacISO: fecha, ageYears: age });

      let result: ResolveResult | null = null;
      try {
        result = await this.contenidosSvc.resolveAndCount({ id: c.id, role, email, vip, fechaNacISO: fecha, ageYears: age });
      } catch (e: any) {
      
        if (e?.message === 'HTTP0_OPAQUE' && this.isHttpUrl(c?.urlVideo)) {
          this.openExternalStrict(c.urlVideo);
          this.openedExternally = true;

          if (String(role).toUpperCase() === 'USUARIO') c.reproducciones = this.toNum(c.reproducciones) + 1;
          this.cdr.markForCheck();
          return;
        }
        throw e;
      }
      if (!result) throw new Error('No se obtuvo resultado de reproducción.');

      if (result.kind === 'external') {
        this.openExternalStrict(result.url);
        this.openedExternally = true;

        if (String(role).toUpperCase() === 'USUARIO') {
          c.reproducciones = this.toNum(c.reproducciones) + 1;
          this.cdr.markForCheck();
        }
        return; 
      }

      
      this.playerKind   = (String(c.tipo).toUpperCase() === 'AUDIO') ? 'AUDIO' : 'VIDEO';
      this.playerSrc    = result.blobUrl;
      this.playingId    = c.id;
      this.playingTitle = c.titulo || null;
      this.playerOpen   = true;
      this.openedInternally = true;

      if (String(role).toUpperCase() === 'USUARIO') {
        c.reproducciones = this.toNum(c.reproducciones) + 1;
      }
      this.cdr.markForCheck();

    } catch (e: any) {
      const msg = (e && e.message) ? e.message : 'No se pudo reproducir este contenido.';
      this.showError(msg);
    } finally {
      this.playingBusy = false;
    }
  }

  private openExternalStrict(url: string): boolean {
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) return true;
    } catch {  }

    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true; 
    } catch {  }

    return false; 
  }

  closePlayer() {
    try { if (this.playerSrc && this.playerSrc.startsWith('blob:')) URL.revokeObjectURL(this.playerSrc); } catch {}
    this.playerOpen = false; this.playerSrc = null; this.playingId = null; this.playingTitle = null;
  }

}
