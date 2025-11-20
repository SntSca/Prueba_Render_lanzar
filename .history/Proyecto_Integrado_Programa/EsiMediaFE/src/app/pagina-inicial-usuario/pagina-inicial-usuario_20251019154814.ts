import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto } from '../auth/models';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {
  readOnly = false;
  fromAdmin = false;

  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
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

  model: {
    nombre?: string;
    apellidos?: string;
    alias?: string;
    fechaNac?: string;
    foto?: string;
    vip?: boolean;
  } = {};

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    const qModo = (this.route.snapshot.queryParamMap.get('modoLectura') || '').toLowerCase();
    const qFrom = (this.route.snapshot.queryParamMap.get('from') || '').toLowerCase();

    const stateFrom = (history.state?.fromAdmin === true);
    const lsReadOnly = localStorage.getItem('users_readonly_mode') === '1';
    const lsFromAdmin = localStorage.getItem('users_readonly_from_admin') === '1';

    this.readOnly =
      ['1', 'true', 'si', 'yes'].includes(qModo) ||
      lsReadOnly && lsFromAdmin ||
      location.pathname.includes('/usuarioReadOnly');

    this.fromAdmin =
      qFrom === 'admin' ||
      stateFrom ||
      lsFromAdmin;

    if (this.readOnly && this.fromAdmin) {
      localStorage.setItem('users_readonly_mode', '1');
      localStorage.setItem('users_readonly_from_admin', '1');
    }

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

  this.auth.getPerfil(this.userEmail).subscribe({
    next: (u: any) => {
      this.paintFromProfile(u);

      const avatarRaw = this.resolveAvatarRaw(u);
      const avatar = this.normalizeAvatarUrl(avatarRaw);

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

private resolveAvatarRaw(u: any): string {
  let candidate = '';
  if (u && typeof u.fotoUrl === 'string' && u.fotoUrl.trim()) {
    candidate = u.fotoUrl;
  } else if (u && typeof u.foto === 'string' && u.foto.trim()) {
    candidate = u.foto;
  } else if (this.model && typeof this.model.foto === 'string' && this.model.foto.trim()) {
    candidate = this.model.foto;
  }
  return String(candidate);
}


  private normalizeAvatarUrl(raw: unknown): string {
    const s: string = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) {
      return s;
    }
    const API_BASE: string | null = null;
    return API_BASE ? s.replace(/^\/+/g, '') : s;
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.email && parsed?.role) return parsed as UserDto;
      return null;
    } catch {
      return null;
    }
  }

  private getLoggedUserId(): string | null {
    const u: any = this.loggedUser;
    return (u?.id ?? u?._id ?? null) as string | null;
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
    }).then((result) => {
      if (result.isConfirmed) {
        this.auth.logout?.();
        localStorage.removeItem('user');
        Swal.fire({
          title: 'Sesión cerrada correctamente.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          willClose: () => {
            this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          }
        });
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
          const errorMsg = err?.error || err?.message || 'Error al eliminar usuario';
          alert(errorMsg);
        }
      });
    }
  }

  openAvatarModal() {
    this.showAvatarModal = true;
  }
  closeAvatarModal() {
    this.showAvatarModal = false;
  }
  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.foto = avatar;
    this.closeAvatarModal();
  }

  toggleEditar() {
    if (!this.readOnly) return;
    requestAnimationFrame(() => {
      this.editOpen = !this.editOpen;
      this.cdr.markForCheck();
    });
  }

  cancelarEditar() {
    this.editOpen = false;
    this.cdr.markForCheck();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeAvatarModal();
    }
  }

  async guardarCambios() {
    const vmsg = this.validateProfileFields();
    if (vmsg) {
      this.saving = false;
      this.errorMsg = vmsg;
      this.cdr.markForCheck();
      return;
    }
    if (this.readOnly) return;

    this.okMsg = null;
    this.errorMsg = '';
    this.saving = true;

    const aliasNuevo = (this.model?.alias ?? '').trim();
    const aliasAEnviar =
      this.userAliasActual &&
      aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0
        ? undefined
        : (aliasNuevo || undefined);

    if (aliasAEnviar) {
      const disponible = await this.ensureAliasDisponible(aliasAEnviar);
      if (!disponible) {
        this.saving = false;
        this.errorMsg = 'El alias ya existe. Elige otro.';
        this.cdr.markForCheck();
        return;
      }
    }

    const fotoSeleccionada = (this.selectedAvatar || this.foto || this.model?.foto || '').trim() || undefined;

    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: (this.model?.nombre ?? '').trim() || undefined,
      apellidos: (this.model?.apellidos ?? '').trim() || undefined,
      fechaNac: this.model?.fechaNac ? String(this.model.fechaNac).slice(0, 10) : undefined,
      vip: typeof this.model?.vip === 'boolean' ? this.model.vip : undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };

    const payload = this.cleanPayload(raw);

    this.auth.putPerfil(payload).subscribe({
      next: (perfil: any) => {
        this.paintFromProfile(perfil);
        this.editOpen = false;
        this.errorMsg = '';
        this.saving = false;
        this.okMsg = 'Se ha editado correctamente';
        void Swal.fire({
          icon: 'success',
          title: 'Se ha editado correctamente',
          timer: 1500,
          showConfirmButton: false
        });

        if (this.selectedAvatar) {
          this.userAvatar = this.selectedAvatar;
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12 };
  private readonly ALIAS_MIN = 3;

  private validateProfileFields(): string | null {
    const n = (this.model?.nombre ?? '').trim();
    const a = (this.model?.apellidos ?? '').trim();
    const al = (this.model?.alias ?? '').trim();

    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (a && a.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (al) {
      if (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)
        return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    }
    return null;
  }


  private async ensureAliasDisponible(alias: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.auth.checkAlias(alias));
      return !!res?.available;
    } catch {
      return false;
    }
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

    const base = u?.alias?.trim() || fullName || u?.email || '';
    this.userInitials = this.computeInitials(base);

    this.userAliasActual = (u?.alias ?? '').trim();

    let fechaNac = '';
    if (u?.fechaNac) {
      const raw = String(u.fechaNac);
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        fechaNac = raw;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('/');
        fechaNac = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        fechaNac = raw.slice(0, 10);
      }
    }
    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      fechaNac,
      foto: u?.foto ?? u?.fotoUrl ?? '',
      vip: u?.vip ?? false
    };

    this.cdr.markForCheck();
  }

  private computeInitials(text: string): string {
    if (!text) return 'U';
    return text.split(/\s+/, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }
}
