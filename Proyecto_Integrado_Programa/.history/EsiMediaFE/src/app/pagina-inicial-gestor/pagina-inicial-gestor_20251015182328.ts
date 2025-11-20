import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';
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

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css']
})
export class PaginaInicialGestor implements OnInit {

  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);

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
    this.userInitials = this.getInitials(this.userName);
    const foto = (user as any)?.foto?.toString()?.trim() || '';
    this.userAvatarUrl = foto || null;
    if (user.tipoContenido === 'AUDIO' || user.tipoContenido === 'VIDEO') {
      this.nuevo.tipo = user.tipoContenido;
    } else {
      this.nuevo.tipo = 'VIDEO';
    }
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
      tipo: this.nuevo.tipo as TipoContenido,
      ficheroAudio: this.nuevo.tipo === 'AUDIO' ? (this.nuevo.ficheroAudio ?? '').trim() : null,
      urlVideo: this.nuevo.tipo === 'VIDEO' ? (this.nuevo.urlVideo ?? '').trim() : null,
      resolucion: this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion ? this.nuevo.resolucion : null,
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
    void Swal.fire({
      title: '¡Éxito!',
      text: 'Contenido subido correctamente.',
      icon: 'success',
      confirmButtonText: 'Cerrar'
    }).then(() => {
      this.resetForm();
      this.crearAbierto = false;
    });
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
}
