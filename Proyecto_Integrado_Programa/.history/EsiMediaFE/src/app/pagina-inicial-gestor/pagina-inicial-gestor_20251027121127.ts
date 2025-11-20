import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto } from '../auth/models';
import { Contenidos } from '../contenidos';
import Swal from 'sweetalert2';

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

const trim = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const yes = (v: 'si' | 'no') => v === 'si';
const showAlert = (title: string, text: string, icon: 'error' | 'warning' | 'success') =>
  Swal.fire({ title, text, icon, confirmButtonText: 'Cerrar' });
const showConfirm = (title: string, text?: string) =>
  Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'Cancelar', reverseButtons: true });

const computeInitials = (text: string) =>
  (trim(text) || 'U').split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';

const cleanPayload = <T extends Record<string, any>>(obj: T): T => {
  const out: any = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out as T;
};

const roleLabel = (role?: Role | null): string =>
  ({ ADMINISTRADOR: 'Administrador', USUARIO: 'Usuario', GESTOR_CONTENIDO: 'Gestor de contenido' } as const)[role as Role] ?? 'Desconocido';

const normalizeAvatarUrl = (raw: unknown): string => {
  const s = trim(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
  return s;
};

const normPath = (s?: string | null): string | null => {
  const v = trim(s); if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
  if (v.startsWith('assets/')) return `/${v}`;
  return v.startsWith('/') ? v : `/${v}`;
};
const cacheBust = (u: string | null): string | null => (u ? `${u}${u.includes('?') ? '&' : '?'}v=${Date.now()}` : null);

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css'],
})
export class PaginaInicialGestor implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly contenidos = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = 'U';
  userTipoContenido = '';
  userAvatarUrl: string | null = null;
  readOnly = false;

  loading = false;
  errorMsg = '';
  successMsg = '';
  crearAbierto = false;
  lastSubmitAt = 0;
  imgError = false;

  
  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  private aliasDebounce: any = null;
  aliasMinLength = 3;
  aliasMaxLength = 20;
 
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

  editOpen = false;
  okMsg: string | null = null;
  saving = false;
  especialidadInvalid = false;

  userAliasActual = '';
  model: {
    nombre?: string;
    apellidos?: string;
    alias?: string;
    foto?: string;
    descripcion?: string;
    tipoContenido?: string;
    especialidad?: string;
  } = {};

  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;
  avatars: string[] = [
    'assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'
  ];
  trackAvatar = (_: number, a: string) => a;

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user'); if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch { return null; }
  }

  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = trim(user.nombre) || user.email.split('@')[0];

    this.userEmail = user.email;
    this.userRole = roleLabel(user.role);
    this.userTipoContenido = user.tipoContenido ?? '';
    this.userName = nombre;
    this.userInitials = computeInitials(nombre);

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);
        this.userAvatarUrl = normalizeAvatarUrl((user as any)?.foto) || null;
        if (!this.userAvatarUrl) this.userInitials = computeInitials(u?.alias || u?.nombre || nombre);
        this.cdr.markForCheck();
      },
      error: (_e: HttpErrorResponse) => { this.errorMsg = 'No se pudo cargar tu perfil'; this.cdr.markForCheck(); }
    });
  }

  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;

    const nombre = trim(u?.nombre);
    const apellidos = trim(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();

    this.userName = trim(u?.alias) || fullName || u?.email || this.userName;
    this.userInitials = computeInitials(trim(u?.alias) || fullName || trim(u?.email));
    this.userAliasActual = trim(u?.alias);

    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      foto: u?.foto ?? u?.fotoUrl ?? '',
      descripcion: u?.descripcion ?? '',
      tipoContenido: u?.tipoContenido ?? '',
      especialidad: u?.especialidad ?? '',
    };
  }

  checkAlias() {
    const alias = trim(this.model.alias);
    this.aliasAvailable = null; this.aliasChecking = false;

    if (alias.length < this.aliasMinLength || alias.length > this.aliasMaxLength) {
      this.aliasAvailable = false; this.cdr.markForCheck(); return;
    }

    clearTimeout(this.aliasDebounce);
    this.aliasChecking = true;
    this.aliasDebounce = setTimeout(() => {
      this.auth.checkAlias(alias).subscribe({
        next: (res: { available: boolean }) => { this.aliasAvailable = res.available; this.aliasChecking = false; this.cdr.markForCheck(); },
        error: () => { this.aliasAvailable = null; this.aliasChecking = false; this.cdr.markForCheck(); }
      });
    }, 500);
  }

  get tagsArray(): string[] { return (this.nuevo.tagsStr ?? '').split(',').map(t => trim(t)).filter(Boolean); }
  get tagsInvalid(): boolean { return this.tagsArray.length === 0; }
  get vipNoAnd4k(): boolean { return this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion === '4K' && this.nuevo.vip === 'no'; }
  get audioHasVideoFields(): boolean { return this.nuevo.tipo === 'AUDIO' && (!!trim(this.nuevo.urlVideo) || !!trim(this.nuevo.resolucion)); }
  get videoHasAudioField(): boolean { return this.nuevo.tipo === 'VIDEO' && !!trim(this.nuevo.ficheroAudio); }
  get crossErrorsPresent(): boolean { return this.audioHasVideoFields || this.videoHasAudioField || this.vipNoAnd4k; }

  private validateBeforeSubmit(form: NgForm): string | null {
    if (Date.now() - this.lastSubmitAt < 5000) return 'Espera unos segundos antes de volver a intentarlo.';
    if (this.crossErrorsPresent) return this.vipNoAnd4k ? 'No puedes seleccionar 4K si no es VIP.' : 'Campos cruzados incorrectos (Audio/Video).';
    if (this.tagsInvalid) return 'Debes indicar al menos un tag.';
    if (form.invalid) return 'Hay campos con errores. Corrígelos y vuelve a intentarlo.';
    return null;
  }

  private buildContenidoPayload(): ContenidoCreate {
    const { nuevo } = this;
    const tipo = (this.userTipoContenido || '').toString() as TipoContenido;
    const isA = tipo === 'AUDIO', isV = tipo === 'VIDEO';

    return {
      titulo: trim(nuevo.titulo),
      descripcion: trim(nuevo.descripcion) || undefined,
      tipo,
      ficheroAudio: isA ? trim(nuevo.ficheroAudio) : null,
      urlVideo: isV ? trim(nuevo.urlVideo) : null,
      resolucion: isV && nuevo.resolucion ? nuevo.resolucion : null,
      tags: this.tagsArray,
      duracionMinutos: Number(nuevo.duracionMinutos),
      vip: yes(nuevo.vip),
      visible: yes(nuevo.visible),
      restringidoEdad: yes(nuevo.restringidoEdad),
      imagen: trim(nuevo.imagen) || null
    };
  }

  onFormChange() { this.errorMsg = ''; this.successMsg = ''; }
  abrirCrear()   { this.errorMsg = ''; this.successMsg = ''; this.crearAbierto = true; }
  cerrarCrear()  { if (!this.loading) this.crearAbierto = false; }

  onSubmit(form: NgForm): void {
    const msg = this.validateBeforeSubmit(form);
    if (msg) {
      Object.values(form.controls).forEach(c => c.markAsTouched());
      document.querySelector<HTMLElement>('.input-error')?.focus();
      void showAlert('Revisa el formulario', msg, 'error');
      return;
    }
    this.loading = true; this.lastSubmitAt = Date.now();
    this.contenidos.subirContenido(this.buildContenidoPayload()).subscribe({
      next: () => this.onUploadSuccess(),
      error: (err) => this.onUploadError(err)
    });
  }

  private onUploadSuccess() {
    this.loading = false; this.crearAbierto = false;
    Object.assign(this.nuevo, { titulo:'', descripcion:'', tipo:'', ficheroAudio:'', urlVideo:'', resolucion:'', tagsStr:'', duracionMinutos:null, vip:'no', visible:'no', restringidoEdad:'no', imagen:'' });
    this.imgError = false;
    setTimeout(() => void showAlert('¡Éxito!', 'Contenido subido correctamente.', 'success'), 0);
  }
  private onUploadError(error: any) {
    this.loading = false;
    let msg = 'No se pudo subir el contenido.';
    const raw = error?.error;
    if (raw) {
      if (typeof raw === 'object' && raw.message) msg = raw.message;
      else if (typeof raw === 'string') { try { msg = JSON.parse(raw)?.message ?? raw; } catch { msg = raw; } }
    }
    void showAlert('Error', msg, 'error');
  }

  clearImage() { this.nuevo.imagen = ''; this.imgError = false; }
  
  toggleEditar() { if (!this.readOnly) requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); }); }
  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }
  checkEspecialidad() { this.especialidadInvalid = !trim(this.model?.especialidad); }

  guardarCambios() {
    this.errorMsg = '';
    if (!trim(this.model?.especialidad)) { this.errorMsg = 'La especialidad no puede estar vacía.'; this.cdr.markForCheck(); return; }

    const aliasNuevo = trim(this.model?.alias);
    const igualActual = this.userAliasActual && aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0;
    const aliasAEnviar = igualActual ? undefined : (aliasNuevo || undefined);

    const fotoSeleccionada = trim(this.selectedAvatar || this.foto || this.model?.foto) || undefined;

    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: trim(this.model?.nombre) || undefined,
      apellidos: trim(this.model?.apellidos) || undefined,
      descripcion: trim(this.model?.descripcion),
      tipoContenido: trim(this.model?.tipoContenido) || undefined,
      especialidad: trim(this.model?.especialidad) || undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };

    this.auth.putPerfilCreadorContenido(cleanPayload(raw)).subscribe({
      next: (perfil: any) => {
        this.paintFromProfile(perfil);
        const apiAvatar = normPath(perfil?.fotoUrl ?? perfil?.foto);
        const localAvatar = normPath(fotoSeleccionada ?? this.foto ?? this.model?.foto ?? null);
        this.userAvatarUrl = cacheBust(apiAvatar || localAvatar);
        this.selectedAvatar = null;
        this.foto = apiAvatar || localAvatar || null;
        this.editOpen = false;
        this.errorMsg = '';
        this.saving = false;
        this.cdr.markForCheck();
        void showAlert('¡Éxito!', 'Perfil actualizado correctamente.', 'success');
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; this.closeAvatarModal(); }
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  onAvatarError() { this.userAvatarUrl = null; }
  handleKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') this.closeAvatarModal(); }

  async cerrarSesion() {
    const r = await showConfirm('¿Seguro que deseas cerrar sesión?');
    if (!r.isConfirmed) return;
    this.auth.logout?.();
    localStorage.removeItem('user');
    await Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false });
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async DarDeBaja() {
    const r = await showConfirm('¿Seguro que deseas darte de baja de la plataforma?', 'Esta acción no se puede deshacer.');
    if (!r.isConfirmed) return;
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
  tagsArray: string[] = [];

toggleTag(tag: string, checked: boolean) {
  if (checked) {
    if (!this.tagsArray.includes(tag)) this.tagsArray.push(tag);
  } else {
    const index = this.tagsArray.indexOf(tag);
    if (index >= 0) this.tagsArray.splice(index, 1);
  }
}

}
