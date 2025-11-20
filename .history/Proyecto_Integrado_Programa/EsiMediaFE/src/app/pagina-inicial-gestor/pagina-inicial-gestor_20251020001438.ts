import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto } from '../auth/models';
import { Contenidos } from '../contenidos';
import Swal from 'sweetalert2';
import { HttpErrorResponse } from '@angular/common/http';

type TipoContenido = 'AUDIO' | 'VIDEO';
type Role = UserDto['role'];

interface ContenidoCreate {
  titulo: string;
  descripcion?: string;
  tipo: TipoContenido;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags: string[];
  duracionMinutos: number;
  vip: boolean;
  visible: boolean;
  restringidoEdad: boolean;
  imagen?: string | null;
}

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css'],
})
export class PaginaInicialGestor implements OnInit {
  constructor(private readonly cdr: ChangeDetectorRef) {}

  // ====== Estado UI / usuario ======
  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);
  userTipoContenido = '';
  userAvatarUrl: string | null = null;
  userAvatar: string | null = null;
  readOnly = false;

  private loggedUser: UserDto | null = null;

  // ====== Form de nuevo contenido ======
  nuevo = {
    titulo: '',
    descripcion: '',
    tipo: '' as TipoContenido | '',
    ficheroAudio: '',
    urlVideo: '',
    resolucion: '' as '720p' | '1080p' | '4K' | '',
    tagsStr: '',
    duracionMinutos: null as number | null,
    vip: 'no' as 'si' | 'no',
    visible: 'no' as 'si' | 'no',
    restringidoEdad: 'no' as 'si' | 'no',
    imagen: ''
  };

  // ====== Estado general ======
  loading = false;
  errorMsg = '';
  successMsg = '';
  crearAbierto = false;
  lastSubmitAt = 0;
  imgError = false;

  // ====== Alias (perfil) ======
  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  private aliasDebounce: any = null;
  aliasMinLength = 3;
  aliasMaxLength = 20;
  private userAliasActual = '';

  // ====== Perfil (edición) ======
  model: { nombre?: string; apellidos?: string; alias?: string; foto?: string; descripcion?: string; tipoContenido?: string; especialidad?: string; } = {};
  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;
  okMsg: string | null = null;
  saving = false;
  editOpen = false;
  especialidadInvalid = false;
  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private trim = (s: unknown) => (typeof s === 'string' ? s : '').trim();
  private bool = (v: any) => !!v;
  private isAudio = () => this.nuevo.tipo === 'AUDIO';
  private isVideo = () => this.nuevo.tipo === 'VIDEO';
  private yes = (v: 'si' | 'no') => v === 'si';

  private static readonly ROLE_LABELS: Record<Role, string> = {
    ADMINISTRADOR: 'Administrador',
    USUARIO: 'Usuario',
    GESTOR_CONTENIDO: 'Gestor de contenido',
  };

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  // ====== Usuario / sesión ======
  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;

    const nombre = this.trim(user.nombre) || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = PaginaInicialGestor.ROLE_LABELS[user.role] ?? 'Desconocido';
    this.userTipoContenido = user.tipoContenido ?? '';

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);
        const foto = this.trim((user as any)?.foto);
        this.userAvatarUrl = foto || null;
        const avatar = this.normalizeAvatarUrl(this.userAvatarUrl);
        this.userAvatar = avatar || null;
        if (!avatar) this.userInitials = this.getInitials(u?.alias || u?.nombre || this.userName);
        this.cdr.markForCheck();
      },
      error: (_e: HttpErrorResponse) => {
        this.errorMsg = 'No se pudo cargar tu perfil';
        this.cdr.markForCheck();
      }
    });
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch { return null; }
  }

  private normalizeAvatarUrl(raw: unknown): string {
    const s = this.trim(raw);
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
    const API_BASE: string | null = null;
    return API_BASE ? s.replace(/^\/+/g, '') : s;
  }

  getInitials(nombre: string): string {
    const safe = this.trim(nombre);
    return safe ? safe.split(/\s+/).map(p => p[0]).join('').toUpperCase() : 'U';
  }
  onAvatarError(): void { this.userAvatarUrl = null; }

  // ====== Tags / validaciones simples ======
  get tagsArray(): string[] { return (this.nuevo.tagsStr ?? '').split(',').map(t => this.trim(t)).filter(Boolean); }
  get tagsInvalid(): boolean { return this.tagsArray.length === 0; }
  get vipNoAnd4k(): boolean { return this.isVideo() && this.nuevo.resolucion === '4K' && this.nuevo.vip === 'no'; }
  get audioHasVideoFields(): boolean { return this.isAudio() && (!!this.trim(this.nuevo.urlVideo) || !!this.trim(this.nuevo.resolucion)); }
  get videoHasAudioField(): boolean { return this.isVideo() && !!this.trim(this.nuevo.ficheroAudio); }
  get crossErrorsPresent(): boolean { return this.audioHasVideoFields || this.videoHasAudioField || this.vipNoAnd4k; }

  // ====== UI abrir/cerrar ======
  abrirCrear(): void { this.errorMsg = ''; this.successMsg = ''; this.crearAbierto = true; }
  cerrarCrear(): void { if (!this.loading) this.crearAbierto = false; }

  // ====== Helpers UI ======
  private markAllTouched(form: NgForm) { Object.values(form.controls).forEach(c => c.markAsTouched()); }
  private focusFirstInvalid() { document.querySelector<HTMLElement>('.input-error')?.focus(); }
  private alert(title: string, text: string, icon: 'error' | 'warning' | 'success') { void Swal.fire({ title, text, icon, confirmButtonText: 'Cerrar' }); }
  private formError(form: NgForm, msg: string) { this.markAllTouched(form); this.focusFirstInvalid(); this.alert('Revisa el formulario', msg, 'error'); }

  // ====== Validación previa compacta ======
  private preSubmitChecks(form: NgForm, now: number): string | null {
    if (now - this.lastSubmitAt < 5000) return 'Espera unos segundos antes de volver a intentarlo.';
    if (this.crossErrorsPresent) return this.vipNoAnd4k ? 'No puedes seleccionar 4K si no es VIP.' : 'Campos cruzados incorrectos (Audio/Video).';
    if (this.tagsInvalid) return 'Debes indicar al menos un tag.';
    if (form.invalid) return 'Hay campos con errores. Corrígelos y vuelve a intentarlo.';
    return null;
  }

  // ====== Payload contenido ======
  private buildContenidoPayload(): ContenidoCreate {
    const tipo = (this.nuevo.tipo || '').toString() as TipoContenido;
    const isA = tipo === 'AUDIO';
    const isV = tipo === 'VIDEO';
    return {
      titulo: this.trim(this.nuevo.titulo),
      descripcion: this.trim(this.nuevo.descripcion) || undefined,
      tipo,
      ficheroAudio: isA ? this.trim(this.nuevo.ficheroAudio) : null,
      urlVideo: isV ? this.trim(this.nuevo.urlVideo) : null,
      resolucion: isV && this.nuevo.resolucion ? this.nuevo.resolucion : null,
      tags: this.tagsArray,
      duracionMinutos: Number(this.nuevo.duracionMinutos),
      vip: this.yes(this.nuevo.vip),
      visible: this.yes(this.nuevo.visible),
      restringidoEdad: this.yes(this.nuevo.restringidoEdad),
      imagen: this.trim(this.nuevo.imagen) ? this.trim(this.nuevo.imagen) : null
    };
  }

  // ====== Submit ======
  onSubmit(form: NgForm): void {
    const now = Date.now();
    const msg = this.preSubmitChecks(form, now);
    if (msg) { this.formError(form, msg); return; }

    this.loading = true;
    this.lastSubmitAt = now;

    const payload = this.buildContenidoPayload();
    this.contenidosService.subirContenido(payload).subscribe({
      next: () => this.handleSuccess(),
      error: (error) => this.handleError(error)
    });
  }

  private handleSuccess(): void {
    this.loading = false;
    this.crearAbierto = false;
    this.resetForm();
    setTimeout(() => this.alert('¡Éxito!', 'Contenido subido correctamente.', 'success'), 0);
  }

  private handleError(error: any): void {
    this.loading = false;
    let mensaje = 'No se pudo subir el contenido.';
    const raw = error?.error;
    if (raw) {
      if (typeof raw === 'object' && raw.message) mensaje = raw.message;
      else if (typeof raw === 'string') { try { const o = JSON.parse(raw); mensaje = o.message ?? raw; } catch { mensaje = raw; } }
    }
    this.alert('Error', mensaje, 'error');
  }

  // ====== Alias (perfil) con debounce ======
  checkAlias() {
    const alias = this.trim(this.model.alias);
    this.aliasAvailable = null;
    this.aliasChecking = false;

    if (alias.length < this.aliasMinLength || alias.length > this.aliasMaxLength) {
      this.aliasAvailable = false; this.cdr.markForCheck(); return;
    }

    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    this.aliasChecking = true;

    this.aliasDebounce = setTimeout(() => {
      this.auth.checkAlias(alias).subscribe({
        next: (res: { available: boolean }) => { this.aliasAvailable = res.available; this.aliasChecking = false; this.cdr.markForCheck(); },
        error: () => { this.aliasAvailable = null; this.aliasChecking = false; this.cdr.markForCheck(); }
      });
    }, 500);
  }

  // ====== Reset ======
  resetForm(): void {
    Object.assign(this.nuevo, {
      titulo: '', descripcion: '', tipo: '', ficheroAudio: '', urlVideo: '',
      resolucion: '', tagsStr: '', duracionMinutos: null, vip: 'no', visible: 'no', restringidoEdad: 'no', imagen: ''
    });
    this.imgError = false;
  }

  clearImage(): void { this.nuevo.imagen = ''; this.imgError = false; }

  // ====== Logout ======
  cerrarSesion(): void {
    Swal.fire({
      title: '¿Seguro que deseas cerrar sesión?', icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar', reverseButtons: true
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.auth.logout?.();
      localStorage.removeItem('user');
      Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false, willClose: () => {
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      }});
    });
  }

  // ====== Perfil (edición) ======
  toggleEditar() {
    if (this.readOnly) return;
    requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); });
  }
  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }

  checkEspecialidad() { this.especialidadInvalid = !this.trim(this.model?.especialidad); }

  guardarCambios() {
    this.errorMsg = '';
    if (!this.trim(this.model?.especialidad)) { this.errorMsg = 'La especialidad no puede estar vacía.'; this.cdr.markForCheck(); return; }

    const norm = (s?: string | null): string | null => {
      const v = this.trim(s);
      if (!v) return null;
      if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
      if (v.startsWith('assets/')) return `/${v}`;
      return v.startsWith('/') ? v : `/${v}`;
    };
    const bust = (u: string | null): string | null => {
      if (!u) return null;
      const separator = u.includes('?') ? '&' : '?';
      return `${u}${separator}v=${Date.now()}`;
    };

    const aliasNuevo = this.trim(this.model?.alias);
    const aliasAEnviar = (this.userAliasActual && aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0)
      ? undefined : (aliasNuevo || undefined);

    const fotoSeleccionada = this.trim(this.selectedAvatar || this.foto || this.model?.foto) || undefined;

    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: this.trim(this.model?.nombre) || undefined,
      apellidos: this.trim(this.model?.apellidos) || undefined,
      descripcion: this.trim(this.model?.descripcion),
      tipoContenido: this.trim(this.model?.tipoContenido) || undefined,
      especialidad: this.trim(this.model?.especialidad) || undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };

    const payload = this.cleanPayload(raw);
    this.auth.putPerfilCreadorContenido(payload).subscribe({
      next: (perfil: any) => {
        this.paintFromProfile(perfil);

        const apiAvatar = norm(perfil?.fotoUrl ?? perfil?.foto);
        const localAvatar = norm(fotoSeleccionada ?? this.foto ?? this.model?.foto ?? null);
        this.userAvatarUrl = bust(apiAvatar || localAvatar);
        this.selectedAvatar = null;
        this.foto = apiAvatar || localAvatar || null;

        this.editOpen = false;
        this.errorMsg = '';
        this.saving = false;
        this.cdr.markForCheck();
        this.alert('¡Éxito!', 'Perfil actualizado correctamente.', 'success');
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
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
      error: (err: any) => {
        const errorMsg = err?.error || err?.message || 'Error al eliminar usuario';
        alert(errorMsg);
      }
    });
  }

  selectAvatar(avatar: string) { this.selectedAvatar = avatar; this.foto = avatar; this.closeAvatarModal(); }
  avatars: string[] = ['assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png','assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'];
  closeAvatarModal() { this.showAvatarModal = false; }
  openAvatarModal() { this.showAvatarModal = true; }

  private cleanPayload<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const k of Object.keys(obj)) { const v = (obj as any)[k]; if (v !== undefined) out[k] = v; }
    return out as T;
  }

  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;

    const nombre = this.trim(u?.nombre);
    const apellidos = this.trim(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();

    this.userName = this.trim(u?.alias) || fullName || u?.email || this.userName;
    const base = this.trim(u?.alias) || fullName || this.trim(u?.email);
    this.userInitials = this.computeInitials(base);
    this.userAliasActual = this.trim(u?.alias);

    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      foto: u?.foto ?? u?.fotoUrl ?? '',
      descripcion: u?.descripcion ?? '',
      tipoContenido: u?.tipoContenido ?? '',
      especialidad: u?.especialidad ?? '',
    };
    this.cdr.markForCheck();
  }

  private computeInitials(text: string): string {
    const t = this.trim(text);
    if (!t) return 'U';
    return t.split(/\s+/).slice(0, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }

  handleKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape') this.closeAvatarModal(); }
}
