import { ChangeDetectorRef, Component, OnInit, ElementRef, ViewChild } from '@angular/core'; // ✅ ElementRef, ViewChild
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto, Contenido } from '../auth/models';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ContenidosService, ResolveResult } from '../contenidos.service';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { firstValueFrom, Observable } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { FavoritesService } from '../favorites.service';

type RolContenidoFiltro = '' | 'VIP' | 'STANDARD';
type OrdenContenido = 'fecha' | 'titulo' | 'reproducciones';
type Direccion = 'asc' | 'desc';
type AgeMode = '' | 'mayores' | 'menores';

function ytIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/').filter(Boolean)[1];
      return id || null;
    }
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    return null;
  } catch { return null; }
}
function toYouTubeEmbed(url: string): string | null {
  const id = ytIdFrom(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}
function vimeoIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const ix = parts.indexOf('video');
      const id = ix >= 0 ? parts[ix + 1] : parts[0];
      return id && /^\d+$/.test(id) ? id : null;
    }
    return null;
  } catch { return null; }
}
function toVimeoEmbed(url: string): string | null {
  const id = vimeoIdFrom(url);
  if (!id) return null;
  return `https://player.vimeo.com/video/${id}?autoplay=1`;
}
function isDirectMedia(url: string): boolean {
  const l = url.toLowerCase();
  return l.endsWith('.mp4') || l.endsWith('.webm') || l.endsWith('.ogg') || l.endsWith('.m3u8');
}


@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {
  readOnly = false;
  fromAdmin = false;

  contenidos: Contenido[] = [];
  filteredCon: Contenido[] = [];

  
  pageSize = 12;
  page = 1;
  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredCon.length / this.pageSize)); }
  get pagedCon(): Contenido[] { const start = (this.page - 1) * this.pageSize; return this.filteredCon.slice(start, start + this.pageSize); }
  goPage(p: number) { this.page = Math.min(this.totalPages, Math.max(1, p)); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { } }
  nextPage() { this.goPage(this.page + 1); }
  prevPage() { this.goPage(this.page - 1); }

  private catalogBackup: Contenido[] | null = null;
  contenidosLoading = false;
  contenidosError: string | null = null;


  filtrosContenido = {
    q: '',
    tipo: '',
    categoria: '',
    role: '' as '' | 'VIP' | 'STANDARD',
    ageMode: '' as '' | 'mayores' | 'menores',
    ageValue: null as number | null,
    resolucion: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'reproducciones',
    dir: 'desc' as 'asc' | 'desc',
  };
  tiposDisponibles: string[] = [];
  categoriasDisponibles: string[] = [];
  resolucionesDisponibles: string[] = [];
  onFiltrosChange(): void { this.applyFilter(); this.cdr.markForCheck(); }
  resetFiltros(): void {
    this.filtrosContenido = { q: '', tipo: '', categoria: '', role: '', ageMode: '', ageValue: null, resolucion: '', ordenar: 'fecha', dir: 'desc' };
    this.applyFilter();
  }

  private readonly CONTENIDOS_BASE = 'http://localhost:8082/Contenidos';

  private favIds = new Set<string>();
  favsLoaded = false;
  pendingToggle: Record<string, boolean> = {};
  private onlyFavsView = false;

  playerOpen = false;
  playerSrc: string | null = null;
  playerKind: 'AUDIO' | 'VIDEO' | 'EMBED' = 'VIDEO';
  embedUrl: SafeResourceUrl | null = null;

  @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>; // ✅
  @ViewChild('audioEl') audioRef?: ElementRef<HTMLAudioElement>; // ✅
  iframeKey = 0;

  playingId: string | null = null;
  playingTitle: string | null = null;

  avatars: string[] = [
    'assets/avatars/avatar1.png', 'assets/avatars/avatar2.png', 'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png', 'assets/avatars/avatar5.png', 'assets/avatars/avatar6.png'
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

  model: Partial<{ nombre: string; apellidos: string; alias: string; fechaNac: string; foto: string; vip: boolean; }> = {};
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
  launchingId: string | null = null;

  private startLaunch(id: string) {
    this.launchingId = id;
    setTimeout(() => { if (this.launchingId === id) this.launchingId = null; }, 1200);
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
    private readonly s: DomSanitizer,
    private contenidosSvc: ContenidosService,
    private favs: FavoritesService
  ) { }

  private readonly DEFAULT_TIPOS = ['AUDIO', 'VIDEO'];
  private readonly DEFAULT_CATEGORIAS = ['Acción', 'Comedia', 'Drama', 'Suspenso', 'Animación', 'Ciencia Ficción', 'Terror', 'Documental', 'Romance', 'Aventura'];
  private readonly DEFAULT_RESOLUCIONES = ['480p', '720p', '1080p', '4K'];

  get isUsuario(): boolean {
    const role = (this.loggedUser?.role ?? '').toString().toUpperCase();
    if (!role) return true;
    return role === 'USUARIO';
  }

  ngOnInit(): void {
    this.computeReadOnlyFlags();
    this.bootstrapUser();
    this.cargarContenidos();
  }

  
  private apiListFavIds(): Observable<string[]> { return this.favs.loadFavoritosIds(); }
  private apiAddFav(id: string): Observable<any> { return this.favs.addFavorito(id); }
  private apiRemoveFav(id: string): Observable<any> { return this.favs.removeFavorito(id); }
  private setFavIds(ids: string[] | null | undefined) {
    this.favIds = new Set((ids ?? []).filter(Boolean));
    this.favsLoaded = true;
    if (this.filterMode === 'favoritos') this.applyFilter();
    this.cdr.markForCheck();
  }
  loadFavoritos(): void {
    this.apiListFavIds().subscribe({
      next: (ids) => this.setFavIds(ids),
      error: () => { this.setFavIds([]); }
    });
  }
  isFav(id: string | null | undefined): boolean { return !!id && this.favIds.has(id); }
  async onToggleFav(id: string | null | undefined) {
    if (!id || this.readOnly) return;
    if (this.pendingToggle[id]) return;
    this.pendingToggle[id] = true;
    const currentlyFav = this.isFav(id);
    if (currentlyFav) this.favIds.delete(id); else this.favIds.add(id);
    this.cdr.markForCheck();
    try { currentlyFav ? await firstValueFrom(this.apiRemoveFav(id)) : await firstValueFrom(this.apiAddFav(id)); }
    catch (e: any) {
      if (currentlyFav) this.favIds.add(id); else this.favIds.delete(id);
      const msg = e?.error?.message || e?.message || 'No se pudo actualizar favoritos';
      Swal.fire({ icon: 'error', title: 'Favoritos', text: msg });
    } finally {
      this.pendingToggle[id] = false;
      this.cdr.markForCheck();
    }
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
    } catch { return null; }
  }
  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    this.userName = this.t(user.nombre) || user.email.split('@')[0];
    this.userEmail = user.email;
    if (!this.favsLoaded) this.loadFavoritos();
    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => this.onPerfilLoaded(u),
      error: (_e: HttpErrorResponse) => { this.errorMsg = 'No se pudo cargar tu perfil'; this.cdr.markForCheck(); }
    });
  }
  private onPerfilLoaded(u: any) {
    this.paintFromProfile(u);
    const avatar = this.normUrl(this.resolveAvatarRaw(u));
    this.userAvatar = avatar || null;
    if (!avatar) this.userInitials = this.initialsFrom(u?.alias || u?.nombre || this.userName);
    this.applyFilter();
    this.cdr.markForCheck();
  }
  private resolveAvatarRaw(u: any): string { return this.t(u?.fotoUrl) || this.t(u?.foto) || this.t(this.model?.foto); }
  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;
    this.userAliasActual = this.t(u?.alias);
    const nombre = this.t(u?.nombre);
    const apellidos = this.t(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();
    this.userName = this.t(u?.alias) || fullName || u?.email || this.userName;
    this.userInitials = this.initialsFrom(this.t(u?.alias) || fullName || u?.email || '');
    this.model = { nombre: u?.nombre ?? '', apellidos: u?.apellidos ?? '', alias: u?.alias ?? '', fechaNac: this.formatISODate(u?.fechaNac), foto: u?.foto ?? u?.fotoUrl ?? '', vip: !!u?.vip };
  }
  salirModoLectura(): void { localStorage.removeItem('users_readonly_mode'); localStorage.removeItem('users_readonly_from_admin'); this.router.navigateByUrl('/admin'); }
  CerrarSesion(): void {
    Swal.fire({ title: '¿Seguro que deseas cerrar sesión?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar', reverseButtons: true })
      .then(r => {
        if (!r.isConfirmed) return;
        this.auth.logout?.(); localStorage.removeItem('user');
        Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false, willClose: () => { void this.router.navigateByUrl('/auth/login', { replaceUrl: true }); } });
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
  toggleEditar() { if (this.readOnly) return; requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); }); }
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
        email: this.userEmail, alias: aliasAEnviar, nombre: this.t(this.model?.nombre) || undefined, apellidos: this.t(this.model?.apellidos) || undefined,
        fechaNac: this.model?.fechaNac ? String(this.model.fechaNac).slice(0, 10) : undefined,
        vip: typeof this.model?.vip === 'boolean' ? this.model.vip : undefined,
        fotoUrl: fotoSeleccionada, foto: fotoSeleccionada
      };
      const payload = this.cleanPayload(raw);
      this.auth.putPerfil(payload).subscribe({
        next: (perfil: any) => this.successSave(perfil),
        error: (err: any) => this.failSave(err?.error?.message || err?.message || 'Error al actualizar el perfil')
      });
    } catch (e: any) { this.failSave(e?.message || 'Error al procesar los cambios'); }
  }
  private successSave(perfil: any) {
    this.paintFromProfile(perfil);
    this.editOpen = false; this.okMsg = 'Se ha editado correctamente'; this.errorMsg = ''; this.saving = false;
    if (this.selectedAvatar) this.userAvatar = this.selectedAvatar;
    this.cargarContenidos();
    void Swal.fire({ icon: 'success', title: 'Se ha editado correctamente', timer: 1500, showConfirmButton: false });
    this.cdr.markForCheck();
  }
  private failSave(msg: string) { this.saving = false; this.errorMsg = msg; this.cdr.markForCheck(); }
  private computeFotoToSend(): string | undefined { return this.t(this.selectedAvatar || this.foto || this.model?.foto) || undefined; }
  private async computeAliasToSend(): Promise<string | undefined> {
    const aliasNuevo = this.t(this.model?.alias);
    if (!aliasNuevo) return undefined;
    const noCambio = this.userAliasActual && aliasNuevo && aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0;
    const aliasAEnviar = noCambio ? undefined : aliasNuevo;
    if (!aliasAEnviar) return undefined;
    const ok = await this.ensureAliasDisponible(aliasAEnviar);
    if (!ok) throw new Error('El alias ya existe. Elige otro.');
    return aliasAEnviar;
  }
  private async ensureAliasDisponible(alias: string): Promise<boolean> {
    try { const res = await firstValueFrom(this.auth.checkAlias(alias)); return !!res?.available; }
    catch { return false; }
  }
  private validateProfileFields(): string | null {
    const n = this.t(this.model?.nombre);
    const a = this.t(this.model?.apellidos);
    const al = this.t(this.model?.alias);
    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (a && a.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (al && (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }
  getInitials(nombre: string): string { const safe = this.t(nombre); return safe ? safe.split(/\s+/).map(p => p[0]).join('').toUpperCase() : 'U'; }
  private isAdmin(): boolean { return (this.loggedUser?.role ?? '').toString().toUpperCase() === 'ADMINISTRADOR'; }
  private canSeeVip(): boolean { return !!this.model.vip || (this.readOnly && this.fromAdmin && this.isAdmin()); }




  public cargarContenidos(): void {
    this.contenidosLoading = true; this.contenidosError = null;
    this.http.get<any[]>(`${this.CONTENIDOS_BASE}/ListarContenidos`).subscribe({
      next: (raw) => {
        const items: Contenido[] = (raw || []).map((c: any) => ({
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
          .filter(item => item.visible)
          .filter(item => this.canSeeVip() ? true : !item.vip)
          .filter(item => this.canSeeByAge(item))
          .sort((a, b) => {
            const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
            const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
            return tb - ta;
          });
        this.catalogBackup = items.slice(0);
        this.contenidos = items;
        this.tiposDisponibles = this.DEFAULT_TIPOS.slice();
        this.categoriasDisponibles = this.DEFAULT_CATEGORIAS.slice();
        this.resolucionesDisponibles = this.DEFAULT_RESOLUCIONES.slice();
        this.contenidosLoading = false;
        //this.applyFilter();
        if (this.filterMode === 'favoritos' && !this.favsLoaded) this.loadFavoritos();
        this.applyFilter();
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
  private toNum(v: unknown): number { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; }
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
    this.launchingId = null;
  }

  async play(c: any) {
    if (this.playingBusy) return;
    if (!this.canPlay()) {
      this.showError('Estás en modo lectura (Administrador). La reproducción está deshabilitada.');
      return;
    }
    this.startLaunch(c.id);
    this.playingBusy = true;
    this.openedExternally = false;
    this.openedInternally = false;

    const role = this.loggedUser?.role ?? 'USUARIO';
    const email = this.userEmail;
    const vip = !!this.model?.vip;
    const fechaNacISO = this.model?.fechaNac || undefined;
    const ageYears = this.calcAgeFromISO(fechaNacISO) ?? undefined;
    const isUsuario = String(role).toUpperCase() === 'USUARIO';
    const streamParams = { id: c.id, role, email, vip, fechaNacISO, ageYears };

    try {
      await this.contenidosSvc.canStream(streamParams);
      const result = await this.tryResolveContent(c, streamParams);
      if (!result) throw new Error('No se obtuvo resultado de reproducción.');
      if (result.kind === 'external') { this.handleExternalPlay(result.url, c, isUsuario); return; }
      this.handleInternalPlay(result.blobUrl, c, isUsuario);
    } catch (e: any) {
      const msg = e?.message ?? 'No se pudo reproducir este contenido.';
      this.showError(msg);
    } finally {
      this.playingBusy = false;
      this.launchingId = null;
    }
  }

  private async tryResolveContent(c: any, params: any): Promise<ResolveResult | null> {
    try { return await this.contenidosSvc.resolveAndCount(params); }
    catch (e: any) {
      if (e?.message === 'HTTP0_OPAQUE' && this.isHttpUrl(c?.urlVideo)) {
        this.handleExternalPlay(c.urlVideo, c, String(params.role).toUpperCase() === 'USUARIO');
        throw new Error('Reproducción externa forzada');
      }
      throw e;
    }
  }

  
  private handleExternalPlay(url: string, content: any, isUsuario: boolean): void {
    const ytembed = toYouTubeEmbed(url);
    const vimbed = toVimeoEmbed(url);
    if (ytembed || vimbed) {
      this.playerKind = 'EMBED';
      const finalUrl = ytembed || vimbed!;
      this.embedUrl = this.s.bypassSecurityTrustResourceUrl(finalUrl);
      this.playerSrc = null;
      this.iframeKey++;
    } else if (isDirectMedia(url)) {
      this.playerKind = 'VIDEO';
      this.playerSrc = url;
      this.embedUrl = null;
    } else {
      this.playerKind = 'EMBED';
      const html = `
        <html><body style="background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100%;">
          <div style="text-align:center;max-width:560px;padding:16px;">
            <p>Este proveedor no permite incrustar el reproductor.</p>
            <p><a href="${url}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-block;padding:10px 16px;background:#fff;color:#111;border-radius:8px;text-decoration:none;">
                  Abrir en una nueva pestaña</a></p>
          </div>
        </body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const localUrl = URL.createObjectURL(blob);
      this.embedUrl = this.s.bypassSecurityTrustResourceUrl(localUrl);
      this.playerSrc = null;
      this.iframeKey++; // ✅
    }
    this.playingId = content.id;
    this.playingTitle = content.titulo || null;
    this.playerOpen = true;
    this.openedInternally = true;
    this.openedExternally = false;
    if (isUsuario) this.incrementViews(content);
    this.cdr.markForCheck();
  }

  
  private handleInternalPlay(blobUrl: string, content: any, isUsuario: boolean): void {
    this.playerKind = String(content.tipo).toUpperCase() === 'AUDIO' ? 'AUDIO' : 'VIDEO';
    this.playerSrc = blobUrl;
    this.embedUrl = null; 
    this.playingId = content.id;
    this.playingTitle = content.titulo || null;
    this.playerOpen = true;
    this.openedInternally = true;
    if (isUsuario) this.incrementViews(content);
    this.cdr.markForCheck();
  }


  private incrementViews(content: any): void { content.reproducciones = this.toNum(content.reproducciones) + 1; }

  closePlayer() {
    
    const v = this.videoRef?.nativeElement;
    if (v) {
      try { v.pause(); } catch { }
      try { v.removeAttribute('src'); v.load(); } catch { }
    }

    const a = this.audioRef?.nativeElement;
    if (a) {
      try { a.pause(); } catch { }
      try { a.removeAttribute('src'); a.load(); } catch { }
    }
    this.embedUrl = null;
    this.iframeKey++; 

    try { if (this.playerSrc?.startsWith('blob:')) URL.revokeObjectURL(this.playerSrc); } catch { }

    this.playerOpen = false;
    this.playerSrc = null;
    this.playingId = null;
    this.playingTitle = null;

    this.cdr.markForCheck();
  }

  private ratingOpen = new Set<string>();
  isRatingOpen(c: { id: string }): boolean { return !!c?.id && this.ratingOpen.has(c.id); }
  toggleRating(c: { id: string }): void { if (!c?.id) return; this.ratingOpen.has(c.id) ? this.ratingOpen.delete(c.id) : this.ratingOpen.add(c.id); }
  closeRating(c: { id: string }): void { if (!c?.id) return; this.ratingOpen.delete(c.id); }
  onRated(id: string, _resumen: any) { this.ratingOpen.delete(id); this.cargarContenidos(); }
  onVipChanged(v: boolean): void { this.model.vip = !!v; this.cargarContenidos(); this.cdr.markForCheck(); }

  private detailsOpen = new Set<string>();
  isDetailsOpen(c: { id?: string }): boolean { return !!c?.id && this.detailsOpen.has(c.id); }
  openDetails(c: { id?: string }): void { if (!c?.id) return; this.detailsOpen.add(c.id); this.cdr.markForCheck(); }
  closeDetails(c: { id?: string }): void { if (!c?.id) return; this.detailsOpen.delete(c.id); this.cdr.markForCheck(); }

  filterMode: 'todos' | 'favoritos' | 'historial' = 'todos';
  onFilterChange(): void { if (this.filterMode === 'favoritos' && !this.favsLoaded) this.loadFavoritos(); this.applyFilter(); }

  private applyFilter(): void {
    
    const base0: Contenido[] = this.catalogBackup ?? this.contenidos.slice(0);

    const base = base0
      .filter(item => this.canSeeVip() ? true : !item.vip)
      .filter(item => this.canSeeByAge(item));

    let working = base;

    if (this.filterMode === 'favoritos') {
      if (!this.favsLoaded) {
      
        this.filteredCon = base.slice(0);
        this.page = 1;
        return;
      }
      const set = this.favIds;
      working = base.filter(c => set.has(c.id));
    } else if (this.filterMode === 'historial') {
      working = base.filter(c => (c.reproducciones ?? 0) > 0);
    }

    const f = this.filtrosContenido;
    const q = String(f.q ?? '').trim().toLowerCase();
    const wantTipo = String(f.tipo ?? '').trim().toUpperCase();
    const wantCat = this.normalizeTag(f.categoria);
    const wantRole = (f.role || '').toUpperCase();
    const wantRes = String(f.resolucion ?? '').trim();
    const ageMode = f.ageMode;
    const ageVal = f.ageValue;

    const out = working.filter(c => this.matchesFilter(c, {
      q, wantTipo, wantCat, wantRole, wantRes, ageMode, ageVal
    }));

    const dir = f.dir === 'asc' ? 1 : -1;
    const ordenar = f.ordenar;
    out.sort((a, b) => {
      let score = 0;
      if (ordenar === 'fecha') {
        const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
        const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
        score = (tb - ta);
      } else if (ordenar === 'titulo') {
        score = String(a.titulo || '').localeCompare(String(b.titulo || ''));
      } else if (ordenar === 'reproducciones') {
        score = (b.reproducciones || 0) - (a.reproducciones || 0);
      }
      return score * dir;
    });

    this.filteredCon = out;
    this.page = 1;
  }
  private matchesFilter(
    c: Contenido,
    opts: { q: string; wantTipo: string; wantCat: string; wantRole: string; wantRes: string; ageMode: AgeMode; ageVal: number | null }
  ): boolean {
    const { q, wantTipo, wantCat, wantRole, wantRes, ageMode, ageVal } = opts;

    const qLower = String(q ?? '').trim().toLowerCase();
    const titleOk = !qLower || (String(c.titulo || '').toLowerCase().includes(qLower));

    const tipoOk = !wantTipo || String(c.tipo || '').toUpperCase() === wantTipo;

    const roleOk = !wantRole || (wantRole === 'VIP' ? !!c.vip : wantRole === 'STANDARD' ? !c.vip : true);

    const wantCatNorm = String(wantCat ?? '').trim().toLowerCase();
    const tagsNorm = (c.tags ?? []).map(this.normalizeTag.bind(this));
    const catOk = !wantCatNorm || tagsNorm.includes(wantCatNorm);

    const resOk = !wantRes || String(c.resolucion ?? '').trim() === wantRes;

    const ageOk = (() => {
      if (!ageMode || ageVal === null) return true;
      const minAge = Number(c.restringidoEdad ?? 0);
      return ageMode === 'mayores' ? minAge >= ageVal : minAge <= ageVal;
    })();

    return titleOk && tipoOk && roleOk && catOk && resOk && ageOk;
  }

  private normalizeTag(t: unknown): string { return String(t ?? '').trim().toLowerCase(); }
  private applyFrontFilters(): void {
    const base = this.catalogBackup ?? [];
    const f = this.filtrosContenido;
    const q = String(f.q ?? '').trim().toLowerCase();
    const wantTipo = String(f.tipo ?? '').trim().toUpperCase();
    const wantCat = this.normalizeTag(f.categoria);
    const wantRole = (f.role || '').toUpperCase();
    const wantRes = String(f.resolucion ?? '').trim();
    const matchesText = (c: Contenido) => !q || [c.titulo, c.descripcion].some(v => String(v ?? '').toLowerCase().includes(q));
    const matchesTipo = (c: Contenido) => !wantTipo || String(c.tipo ?? '').toUpperCase() === wantTipo;
    const matchesCategoria = (c: Contenido) => { if (!wantCat) return true; const tags = (c.tags ?? []).map(this.normalizeTag.bind(this)); return tags.includes(wantCat); };
    const matchesRole = (c: Contenido) => !wantRole ? true : (wantRole === 'VIP' ? !!c.vip : !c.vip);
    const matchesEdad = (c: Contenido) => {
      const minAge = Number(c.restringidoEdad ?? 0); const v = f.ageValue ?? null;
      if (!f.ageMode || v === null) return true;
      return f.ageMode === 'mayores' ? minAge >= v : minAge <= v;
    };
    const matchesResolucion = (c: Contenido) => !wantRes || String(c.resolucion ?? '').trim() === wantRes;
    let out = base.filter(matchesText).filter(matchesTipo).filter(matchesCategoria).filter(matchesRole).filter(matchesEdad).filter(matchesResolucion);
    const cmp = this.cmpOrden(f.ordenar);
    out.sort((a, b) => { const s = cmp(a, b); return f.dir === 'asc' ? s : -s; });
    this.contenidos = out;
    this.cdr.markForCheck();
  }
  private cmpOrden(kind: OrdenContenido): (a: Contenido, b: Contenido) => number {
    switch (kind) {
      case 'titulo': return (a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''));
      case 'reproducciones': return (a, b) => (a.reproducciones ?? 0) - (b.reproducciones ?? 0);
      case 'fecha':
      default:
        return (a, b) => {
          const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
          const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
          return ta - tb;
        };
    }
  }
  private matchesAgeRule(mode: AgeMode, minAge: number, x: number | null): boolean { if (!mode || x === null) return true; return mode === 'mayores' ? minAge >= x : minAge <= x; }
  private get isAdminReadOnly(): boolean {
    return this.readOnly && this.fromAdmin && this.isAdmin();
  }

  public canPlay(): boolean {
    return !this.isAdminReadOnly;
  }

  private getCurrentAge(): number | null {
    return this.calcAgeFromISO(this.model?.fechaNac || null);
  }
  private canSeeByAge(item: { restringidoEdad?: number | null }): boolean {
    if (this.readOnly && this.fromAdmin && this.isAdmin()) return true;
    const min = this.toNum(item?.restringidoEdad ?? 0);
    if (min <= 0) return true;
    const age = this.getCurrentAge();
    if (age === null) return false;
    return age >= min;
  }
}
