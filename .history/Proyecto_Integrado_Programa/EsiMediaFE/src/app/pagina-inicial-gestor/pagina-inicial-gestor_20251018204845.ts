import { Component, OnInit, inject,ChangeDetectorRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser,UserDto } from '../auth/models';
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

  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);
  userTipoContenido = '';

  userAvatarUrl: string | null = null;
  

  private loggedUser: UserDto | null = null;

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

  loading = false;
  errorMsg = '';
  successMsg = '';
  crearAbierto = false;
  lastSubmitAt = 0;
  imgError = false;

  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = this.mapRoleToLabel(user.role);
    this.userTipoContenido = user.tipoContenido ?? '';


    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);

      const foto = (user as any)?.foto?.toString()?.trim() || '';
      this.userAvatarUrl = foto || null;


      const avatar = this.normalizeAvatarUrl(this.userAvatarUrl);
      if (avatar) {
        this.userAvatar = avatar;
      } else {
        this.userAvatar = null;
        this.userInitials = this.getInitials(u?.alias || u?.nombre || this.userName);
      }

      this.cdr.markForCheck();
    },
      error: (_e: HttpErrorResponse) => {
        this.errorMsg = 'No se pudo cargar tu perfil';
        this.cdr.markForCheck();
      }
    });
  }

  private normalizeAvatarUrl(raw: unknown): string {
    const s: string = String(raw ?? '').trim();
    if (!s) return '';

    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) {
      return s;
    }

    const API_BASE: string | null = null;
    return API_BASE
      ? s.replace(/^\/+/g, '')
      : s;
  }

  private mapRoleToLabel(role?: Role | null): string {
    const labels: Record<Role, string> = {
      ADMINISTRADOR: 'Administrador',
      USUARIO: 'Usuario',
      GESTOR_CONTENIDO: 'Gestor de contenido',
    };
    return role && role in labels ? labels[role] : 'Desconocido';
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch {
      return null;
    }
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }
  onAvatarError(): void {
    this.userAvatarUrl = null;
  }

  get tagsArray(): string[] {
    return (this.nuevo.tagsStr ?? '').split(',').map(t => t.trim()).filter(Boolean);
  }

  get tagsInvalid(): boolean {
    return this.tagsArray.length === 0;
  }

  get vipNoAnd4k(): boolean {
    return this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion === '4K' && this.nuevo.vip === 'no';
  }

  abrirCrear(): void {
    this.errorMsg = '';
    this.successMsg = '';
    this.crearAbierto = true;
  }

  cerrarCrear(): void {
    if (this.loading) return;
    this.crearAbierto = false;
  }

  get audioHasVideoFields(): boolean {
    return this.nuevo?.tipo === 'AUDIO' && (!!this.nuevo?.urlVideo || !!this.nuevo?.resolucion);
  }
  get videoHasAudioField(): boolean {
    return this.nuevo?.tipo === 'VIDEO' && !!this.nuevo?.ficheroAudio;
  }
  get crossErrorsPresent(): boolean {
    return this.audioHasVideoFields || this.videoHasAudioField || this.vipNoAnd4k;
  }

  private markAllTouched(form: NgForm) {
    Object.values(form.controls).forEach(c => c.markAsTouched());
  }

  private showAlert(title: string, text: string, icon: 'error' | 'warning' | 'success'): void {
    void Swal.fire({ title, text, icon, confirmButtonText: 'Cerrar' });
  }

  private focusFirstInvalid(): void {
    const firstInvalid = document.querySelector<HTMLElement>('.input-error');
    firstInvalid?.focus();
  }

  private handleFormError(form: NgForm, text: string): void {
    this.markAllTouched(form);
    this.focusFirstInvalid();
    this.showAlert('Revisa el formulario', text, 'error');
  }

  onSubmit(form: NgForm): void {
    const now = Date.now();

    if (now - this.lastSubmitAt < 5000) {
      this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning');
      return;
    }

    if (this.crossErrorsPresent || this.tagsInvalid) {
      const msg = this.vipNoAnd4k ? 'No puedes seleccionar 4K si no es VIP.' : 'Debes indicar al menos un tag.';
      this.handleFormError(form, msg);
      return;
    }

    if (form.invalid) {
      this.handleFormError(form, 'Hay campos con errores. Corrígelos y vuelve a intentarlo.');
      return;
    }

    const payload: ContenidoCreate = {
      titulo: (this.nuevo.titulo ?? '').trim(),
      descripcion: (this.nuevo.descripcion ?? '').trim() || undefined,
    tipo: this.model.tipoContenido as TipoContenido,
    ficheroAudio: this.model.tipoContenido === 'AUDIO' ? (this.nuevo.ficheroAudio ?? '').trim() : null,
    urlVideo: this.model.tipoContenido === 'VIDEO' ? (this.nuevo.urlVideo ?? '').trim() : null,
    resolucion: this.model.tipoContenido === 'VIDEO' && this.nuevo.resolucion ? this.nuevo.resolucion : null,
      tags: this.tagsArray,
      duracionMinutos: Number(this.nuevo.duracionMinutos),
      vip: this.nuevo.vip === 'si',
      visible: this.nuevo.visible === 'si',
      restringidoEdad: this.nuevo.restringidoEdad === 'si',
      imagen: this.nuevo.imagen?.trim() ? this.nuevo.imagen.trim() : null
    };

    this.loading = true;
    this.lastSubmitAt = now;

    this.contenidosService.subirContenido(payload).subscribe({
      next: () => this.handleSuccess(),
      error: (error) => this.handleError(error)
    });
  }

  private handleSuccess(): void {
    this.loading = false;
    this.crearAbierto = false;
    this.resetForm();
    setTimeout(() => {
      void Swal.fire({
        title: '¡Éxito!',
        text: 'Contenido subido correctamente.',
        icon: 'success',
        confirmButtonText: 'Cerrar'
      });
    }, 0);
  }

  private handleError(error: any): void {
    this.loading = false;
    let mensajeError = 'No se pudo subir el contenido.';
    const raw = error?.error;
    if (raw) {
      if (typeof raw === 'object' && raw.message) {
        mensajeError = raw.message;
      } else if (typeof raw === 'string') {
        try {
          const obj = JSON.parse(raw);
          if (obj.message) mensajeError = obj.message;
        } catch {
          mensajeError = raw;
        }
      }
    }
    this.showAlert('Error', mensajeError, 'error');
  }

  resetForm(): void {
    Object.assign(this.nuevo, {
      titulo: '',
      descripcion: '',
      tipo: '',
      ficheroAudio: '',
      urlVideo: '',
      resolucion: '',
      tagsStr: '',
      duracionMinutos: null,
      vip: 'no',
      visible: 'no',
      restringidoEdad: 'no',
      imagen: ''
    });
    this.imgError = false;
  }

  clearImage(): void {
    this.nuevo.imagen = '';
    this.imgError = false;
  }

  cerrarSesion(): void {
    const confirmacion = confirm('¿Seguro que deseas cerrar sesión?');
    if (confirmacion) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      alert('Sesión cerrada correctamente.');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  private userAliasActual = '';
  
  model: {
    nombre?: string;
    apellidos?: string;
    alias?: string;
    foto?: string;
    descripcion?: string;
    tipoContenido?: string;
    especialidad?:string;

  } = {};

  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;

  okMsg: string | null = null;
  saving = false;
  editOpen = false;
  userAvatar: string | null = null;
  readOnly=false;

  toggleEditar() {
    console.log('Toggle editar called, readOnly:', this.readOnly);
    if (this.readOnly) return;
    requestAnimationFrame(() => {
      this.editOpen = !this.editOpen;
      this.cdr.markForCheck();
    });
  }

  cancelarEditar() {
    console.log('Cancelar editar called');
    this.editOpen = false;
    this.cdr.markForCheck();
  }

  guardarCambios() {
    this.errorMsg = '';

    const norm = (s?: string | null): string | null => {
      const v = (s ?? '').trim();
      if (!v) return null;
      if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
      if (v.startsWith('assets/')) return `/${v}`;
      return v.startsWith('/') ? v : `/${v}`;
    };
    const bust = (u: string | null): string | null => {
      if (!u) return null;
      const sep = u.includes('?') ? '&' : '?';
      return `${u}${sep}v=${Date.now()}`;
    };

    const aliasNuevo = (this.model?.alias ?? '').trim();
    const aliasAEnviar =
      this.userAliasActual &&
      aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0
        ? undefined
        : (aliasNuevo || undefined);

    const fotoSeleccionada = (this.selectedAvatar || this.foto || this.model?.foto || '').trim() || undefined;

    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: (this.model?.nombre ?? '').trim() || undefined,
      apellidos: (this.model?.apellidos ?? '').trim() || undefined,
      descripcion: (this.model?.descripcion ?? '').trim() || undefined,
      tipoContenido: (this.model?.tipoContenido ?? '').trim() || undefined,
      especialidad: (this.model?.especialidad ?? '').trim() || undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };

    const payload = this.cleanPayload(raw);
    console.log('Payload to send:', payload);

    this.auth.putPerfilCreadorContenido(payload).subscribe({
      next: (perfil: any) => {
        console.log('Profile updated successfully:', perfil);

        
        this.paintFromProfile(perfil);

  
        const apiAvatar = norm(perfil?.fotoUrl ?? perfil?.foto);
        const localAvatar = norm(fotoSeleccionada ?? this.foto ?? this.model?.foto ?? null);
        const finalAvatar = bust(apiAvatar || localAvatar);

      
        this.userAvatarUrl = finalAvatar;

        
        this.selectedAvatar = null;
        this.foto = apiAvatar || localAvatar || null;

        this.editOpen = false;
        this.errorMsg = '';
        this.saving = false;
        this.cdr.markForCheck();
        void Swal.fire({
        title: '¡Éxito!',
        text: 'Perfil actualizado correctamente.',
        icon: 'success',
        confirmButtonText: 'Cerrar'
      });
    },
      error: (err: any) => {
        console.error('Error updating profile:', err);
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }


    DarDeBaja(): void {
      if (confirm('¿Seguro que deseas darte de baja de la plataforma? Esta acción no se puede deshacer.')) {
        this.auth.darseBaja(this.userEmail).subscribe({
          next: (msg: string) => {
            alert(msg || 'Usuario eliminado correctamente');
            
            this.auth.logout?.();
            localStorage.removeItem('user');
            sessionStorage.clear();
            this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          },
          error: (err: any) => {
            console.error('Error al dar de baja:', err);
            const errorMsg = err?.error || err?.message || 'Error al eliminar usuario';
            alert(errorMsg);
          }
        });
      }
    }

    selectAvatar(avatar: string) {
      console.log('Avatar selected:', avatar);
      this.selectedAvatar = avatar;
      this.foto = avatar;
      this.closeAvatarModal();
    }

    avatars: string[] = [
      'assets/avatars/avatar1.png',
      'assets/avatars/avatar2.png',
      'assets/avatars/avatar3.png',
      'assets/avatars/avatar4.png',
      'assets/avatars/avatar5.png',
      'assets/avatars/avatar6.png'
    ];

    closeAvatarModal() { 
      console.log('Closing avatar modal');
      this.showAvatarModal = false; 
    }

    openAvatarModal() { 
      console.log('Opening avatar modal');
      this.showAvatarModal = true; 
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
  
    private paintFromProfile(u: any) {
      this.userEmail = u?.email ?? this.userEmail;
  
      const nombre = (u?.nombre ?? '').trim();
      const apellidos = (u?.apellidos ?? '').trim();
      const fullName = `${nombre} ${apellidos}`.trim();
  
      this.userName = u?.alias?.trim()
        ? u.alias.trim()
        : (fullName || u?.email || this.userName);
  
      const base = (u?.alias ? u.alias.trim() : (fullName || u?.email || '');
      this.userInitials = this.computeInitials(base);
  
      this.userAliasActual = (u?.alias ?? '').trim();
      
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
      if (!text) return 'U';
      return text.split(/\s+/).slice(0, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
    }

}
