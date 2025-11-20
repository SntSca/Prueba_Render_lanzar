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
    const lsReadOnly = localStorage.getItem('users_readonly_mode') === '1';
    const lsFromAdmin = localStorage.getItem('users_readonly_from_admin') === '1';
    const stateFrom = history.state?.fromAdmin === true;

    this.readOnly = ['1', 'true', 'si', 'yes'].includes(qModo) || (lsReadOnly && lsFromAdmin) || location.pathname.includes('/usuarioReadOnly');
    this.fromAdmin = qFrom === 'admin' || stateFrom || lsFromAdmin;

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
    const nombre = (user.nombre || '').trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);
        const avatarRaw = this.resolveAvatarRaw(u);
        const avatar = this.normalizeAvatarUrl(avatarRaw);
        this.userAvatar = avatar || null;
        if (!avatar) this.userInitials = this.initials(u?.alias || u?.nombre || this.userName);
        this.cdr.markForCheck();
      },
      error: (_e: HttpErrorResponse) => {
        this.errorMsg = 'No se pudo cargar tu perfil';
        this.cdr.markForCheck();
      }
    });
  }

  private resolveAvatarRaw(u: any): string {
    return String(
      (u?.fotoUrl && String(u.fotoUrl).trim()) ||
      (u?.foto && String(u.foto).trim()) ||
      (this.model?.foto && String(this.model.foto).trim()) ||
      ''
    );
  }

  private normalizeAvatarUrl(raw: unknown): string {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
    const API_BASE: string | null = null;
    return API_BASE ? s.replace(/^\/+/g, '') : s;
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.email && parsed?.role ? (parsed as UserDto) : null;
    } catch { return null; }
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
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.auth.logout?.();
      localStorage.removeItem('user');
      Swal.fire({
        title: 'Sesión cerrada correctamente.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        willClose: () => this.router.navigateByUrl('/auth/login', { replaceUrl: true })
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
      error: (err: any) => {
        const errorMsg = err?.error || err?.message || 'Error al eliminar usuario';
        alert(errorMsg);
      }
    });
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(avatar: string) { this.selectedAvatar = avatar; this.foto = avatar; this.closeAvatarModal(); }

  toggleEditar() {
    if (this.readOnly) return;
    requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); });
  }
  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }

  handleKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape') this.closeAvatarModal(); }

  async guardarCambios() {
    if (this.readOnly) return;
    const vmsg = this.validateProfileFields();
    if (vmsg) return this.handleGuardarError(vmsg);

    this.okMsg = null;
    this.errorMsg = '';
    this.saving = true;

    try {
      const aliasAEnviar = await this.getAliasAEnviar();
      const fotoSeleccionada = this.getFotoSeleccionada();

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
        next: (perfil: any) => this.handleGuardarSuccess(perfil),
        error: (err: any) => this.handleGuardarError(err?.error?.message || err?.message || 'Error al actualizar el perfil')
      });
    } catch (err: any) {
      this.handleGuardarError(err?.message || 'Error al procesar los cambios');
    }
  }

  private handleGuardarError(msg: string) {
    this.saving = false;
    this.errorMsg = msg;
    this.cdr.markForCheck();
  }

  private handleGuardarSuccess(perfil: any) {
    this.paintFromProfile(perfil);
    this.editOpen = false;
    this.okMsg = 'Se ha editado correctamente';
    this.errorMsg = '';
    this.saving = false;
    if (this.selectedAvatar) this.userAvatar = this.selectedAvatar;
    void Swal.fire({ icon: 'success', title: 'Se ha editado correctamente', timer: 1500, showConfirmButton: false });
    this.cdr.markForCheck();
  }

  private async getAliasAEnviar(): Promise<string | undefined> {
    const nuevo = (this.model?.alias ?? '').trim();
    const igual = this.userAliasActual && nuevo && nuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0;
    const enviar = igual ? undefined : nuevo || undefined;
    if (!enviar) return enviar;
    const ok = await this.ensureAliasDisponible(enviar);
    if (!ok) throw new Error('El alias ya existe. Elige otro.');
    return enviar;
  }

  private getFotoSeleccionada(): string | undefined {
    return (this.selectedAvatar || this.foto || this.model?.foto || '').trim() || undefined;
  }

  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12 };
  private readonly ALIAS_MIN = 3;

  private validateProfileFields(): string | null {
    const n = (this.model?.nombre ?? '').trim();
    const a = (this.model?.apellidos ?? '').trim();
    const al = (this.model?.alias ?? '').trim();
    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (a && a.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (al && (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }

  private async ensureAliasDisponible(alias: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.auth.checkAlias(alias));
      return !!res?.available;
    } catch { return false; }
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
    this.userAliasActual = (u?.alias ?? '').trim();
    this.userName = this.getDisplayName(u);
    this.userInitials = this.computeInitials(this.getInitialsBase(u));
    const fechaNac = this.formatFechaNac(u?.fechaNac);
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

  private getDisplayName(u: any): string {
    const nombre = (u?.nombre ?? '').trim();
    const apellidos = (u?.apellidos ?? '').trim();
    const fullName = `${nombre} ${apellidos}`.trim();
    return (u?.alias ?? '').trim() || fullName || u?.email || this.userName;
  }

  private getInitialsBase(u: any): string {
    const nombre = (u?.nombre ?? '').trim();
    const apellidos = (u?.apellidos ?? '').trim();
    const fullName = `${nombre} ${apellidos}`.trim();
    return (u?.alias ?? '').trim() || fullName || (u?.email ?? '');
  }

  private formatFechaNac(raw?: string | null): string {
    if (!raw) return '';
    const str = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str.slice(0, 10);
  }

  private computeInitials(text: string): string {
    if (!text) return 'U';
    return text.split(/\s+/, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }

  private initials(text: string): string {
    const t = (text || '').trim();
    if (!t) return 'U';
    return t.split(/\s+/).map(p => p[0]).join('').toUpperCase();
  }
}
