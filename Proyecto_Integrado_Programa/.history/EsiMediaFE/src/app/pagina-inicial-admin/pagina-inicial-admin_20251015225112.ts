// pagina-inicial-admin.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppUser, Role, UserDto } from '../auth/models';
import { Registro } from '../registro/registro';

type EstadoFiltro = '' | 'si' | 'no';
type TipoFiltro = '' | Role;
type VipFiltro = '' | 'si' | 'no';
type ConfirmKind = 'block' | 'unblock' | 'delete';

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Registro],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit, OnDestroy {
  public readonly FILES_BASE = window.location.origin;
  private readonly SUPER_ADMIN_EMAIL = 'proyecto.integrado.iso@gmail.com';

  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userFotoUrl: string | null = null;
  userAvatarUrl: string | null = null;

  filtros = {
    nombre: '',
    bloqueado: '' as EstadoFiltro,
    tipo: '' as TipoFiltro,
    vip: '' as VipFiltro,
    ordenar: 'fecha' as 'fecha' | 'nombre' | 'rol' | 'vip'
  };

  loading = false;
  errorMsg = '';
  users: AppUser[] = [];

  page = 1;
  pageSize = 10;

  private readonly searchChanged$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly api: AuthService) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.recompute());
  }

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.api.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.fetchAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onAvatarError(): void {
    this.userAvatarUrl = null;
  }

  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = this.mapRoleToLabel(user.role);
    this.userInitials = this.getInitials(this.userName);
    const foto = (user as any)?.foto?.toString()?.trim() || '';
    this.userAvatarUrl = foto || null;
  }

  private mapRoleToLabel(role?: Role | null): string {
    const labels: Record<Role, string> = {
      ADMINISTRADOR: 'Administrador',
      USUARIO: 'Usuario',
      GESTOR_CONTENIDO: 'Gestor de contenido'
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

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get pageItems(): AppUser[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get filteredUsers(): AppUser[] {
    let data = [...this.users];

    const q = this.filtros.nombre?.trim().toLowerCase();
    if (q) {
      data = data.filter(u =>
        (u.alias || '').toLowerCase().includes(q) ||
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.apellidos || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }

    if (this.filtros.bloqueado !== '') {
      const wantBlocked = this.filtros.bloqueado === 'si';
      data = data.filter(u => !!u.blocked === wantBlocked);
    }

    if (this.filtros.tipo) {
      data = data.filter(u => u.role === this.filtros.tipo);
    }

    if (this.filtros.vip !== '') {
      const wantVip = this.filtros.vip === 'si';
      data = data.filter(u => !!u.vip === wantVip);
    }

    switch (this.filtros.ordenar) {
      case 'nombre':
        data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        break;
      case 'rol':
        data.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
        break;
      case 'vip':
        data.sort((a, b) => Number(!!b.vip) - Number(!!a.vip));
        break;
      case 'fecha':
      default:
        if (data[0]?.createdAt) {
          data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        }
        break;
    }

    return data;
  }

  onSearchChange() { this.page = 1; this.searchChanged$.next(); }
  onStateChange()  { this.page = 1; this.searchChanged$.next(); }
  onTipoChange()   { this.page = 1; this.searchChanged$.next(); }
  onVipChange()    { this.page = 1; this.searchChanged$.next(); }
  onOrderChange()  { this.page = 1; this.searchChanged$.next(); }

  recompute() {}

  goto(p: number) { if (p >= 1 && p <= this.totalPages) this.page = p; }
fetchAll() {
  this.loading = true;
  this.errorMsg = '';

  this.api.listAllUsers().pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (list) => {
        this.users = (list ?? []).map(u => ({
          ...u,
          // Usa la foto existente o construye la URL desde assets/avatars/
          fotoUrl: u.fotoUrl
            ? u.fotoUrl
            : u.fotoUrl
              ? `${window.location.origin}/assets/avatars/${u.foto}`
              : null
        }));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Error cargando usuarios';
      }
    });
}



  showEditModal = false;
  editingUser: AppUser | null = null;

  editModel = {
    alias: '',
    nombre: '',
    apellidos: '',
    descripcion: '',
    especialidad: '',
    email: '',
    foto: null as string | null,
    fotoPreviewUrl: null as string | null
  };

  aliasCheck$ = new Subject<string>();
  aliasTaken = false;

  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
  ];
  showAvatarPicker = false;

  openEditModal(u: AppUser) {
    if (u.role !== 'GESTOR_CONTENIDO') return;
    this.editingUser = u;
    this.editModel = {
      alias: u.alias ?? '',
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      descripcion: (u as any).descripcion ?? '',
      especialidad: (u as any).especialidad ?? '',
      email: u.email ?? '',
      foto: u.fotoUrl ?? null,
      fotoPreviewUrl: u.fotoUrl ?? null
    };
    this.showEditModal = true;

    this.aliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(value => {
      const alias = (value || '').trim().toLowerCase();
      const currentId = this.editingUser?.id;
      this.aliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
    });
    this.aliasCheck$.next(this.editModel.alias);
  }

  onAliasInput(v: string) {
    this.aliasCheck$.next(v);
  }

  openAvatarModal()  { this.showAvatarPicker = true; }
  closeAvatarModal() { this.showAvatarPicker = false; }
  selectAvatar(path: string) {
    this.editModel.foto = path;
    this.editModel.fotoPreviewUrl = path;
    this.closeAvatarModal();
  }

  cancelEdit() {
    this.showEditModal = false;
    this.editingUser = null;
    this.aliasTaken = false;
    this.showAvatarPicker = false;
  }

  saveEdit(form: NgForm) {
    if (!this.editingUser || this.editingUser.role !== 'GESTOR_CONTENIDO') return;
    if (form.invalid || this.aliasTaken) return;

    const u = this.editingUser;
    const dto: any = {};

    const alias        = this.editModel.alias.trim();
    const nombre       = this.editModel.nombre.trim();
    const apellidos    = this.editModel.apellidos.trim();
    const descripcion  = this.editModel.descripcion.trim();
    const especialidad = this.editModel.especialidad.trim();
    const email        = this.editModel.email.trim();
    const foto         = this.editModel.foto;

    if (alias && alias !== u.alias) dto.alias = alias;
    if (nombre && nombre !== u.nombre) dto.nombre = nombre;
    if (apellidos !== (u.apellidos ?? '')) dto.apellidos = apellidos;
    if (descripcion !== (u as any).descripcion) dto.descripcion = descripcion;
    if (especialidad !== (u as any).especialidad) dto.especialidad = especialidad;
    if (email && email !== u.email) dto.email = email;
    if (foto && foto !== u.fotoUrl) dto.foto = foto;

    if (Object.keys(dto).length === 0) { this.cancelEdit(); return; }

    this.loading = true;
    this.api.updateCreator(u.id, dto).subscribe({
      next: (upd) => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false;
        this.cancelEdit();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Error al actualizar';
      }
    });
  }

  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;

  adminEditModel = {
    alias: '',
    nombre: '',
    apellidos: '',
    email: '',
    foto: null as string | null,
    fotoPreviewUrl: null as string | null
  };

  adminAliasCheck$ = new Subject<string>();
  adminAliasTaken = false;

  openEditAdminModal(u: AppUser) {
    if (u.role !== 'ADMINISTRADOR') return;
    if (this.isSuperAdmin(u)) return;
    this.editingAdmin = u;
    this.adminEditModel = {
      alias: u.alias ?? '',
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      email: u.email ?? '',
      foto: u.fotoUrl ?? null,
      fotoPreviewUrl: u.fotoUrl ?? null
    };
    this.showEditAdminModal = true;

    this.adminAliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(value => {
      const alias = (value || '').trim().toLowerCase();
      const currentId = this.editingAdmin?.id;
      this.adminAliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
    });
    this.adminAliasCheck$.next(this.adminEditModel.alias);
  }

  onAdminAliasInput(v: string) {
    this.adminAliasCheck$.next(v);
  }

  cancelEditAdmin() {
    this.showEditAdminModal = false;
    this.editingAdmin = null;
    this.adminAliasTaken = false;
  }

  saveAdminEdit(form: NgForm) {
    if (!this.editingAdmin || this.editingAdmin.role !== 'ADMINISTRADOR') return;
    if (this.isSuperAdmin(this.editingAdmin)) return;
    if (form.invalid || this.adminAliasTaken) return;

    const u = this.editingAdmin;
    const dto: any = {};

    const alias   = this.adminEditModel.alias.trim();
    const nombre  = this.adminEditModel.nombre.trim();
    const apellidos = this.adminEditModel.apellidos.trim();
    const email   = this.adminEditModel.email.trim();
    const foto    = this.adminEditModel.foto;

    if (alias && alias !== u.alias) dto.alias = alias;
    if (nombre && nombre !== u.nombre) dto.nombre = nombre;
    if (apellidos !== (u.apellidos ?? '')) dto.apellidos = apellidos;
    if (email && email !== u.email) dto.email = email;
    if (foto && foto !== u.fotoUrl) dto.foto = foto;

    if (Object.keys(dto).length === 0) { this.cancelEditAdmin(); return; }

    this.loading = true;
    this.api.updateAdmin(u.id, dto).subscribe({
      next: (upd) => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false;
        this.cancelEditAdmin();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Error al actualizar administrador';
      }
    });
  }

  showConfirmModal = false;
  confirmKind: ConfirmKind | null = null;
  targetUser: AppUser | null = null;

  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (!(this.isCreator(u) || this.isAdmin(u))) return;
    if (this.isSuperAdmin(u)) return;
    this.confirmKind = kind;
    this.targetUser = u;
    this.showConfirmModal = true;
  }
  cancelConfirm() { this.showConfirmModal = false; this.confirmKind = null; this.targetUser = null; }

  confirmAction() {
    if (!this.targetUser || !this.confirmKind) return;
    const u = this.targetUser;
    if (this.isSuperAdmin(u)) { this.cancelConfirm(); return; }

    this.loading = true;

    let obs: any;
    if (this.isCreator(u)) {
      if (this.confirmKind === 'block')        obs = this.api.blockCreator(u.id);
      else if (this.confirmKind === 'unblock') obs = this.api.unblockCreator(u.id);
      else                                     obs = this.api.deleteCreator(u.id);
    } else if (this.isAdmin(u)) {
      if (this.confirmKind === 'block')        obs = this.api.blockAdmin(u.id);
      else if (this.confirmKind === 'unblock') obs = this.api.unblockAdmin(u.id);
      else                                     obs = this.api.deleteAdmin(u.id);
    } else {
      this.loading = false;
      return;
    }

    obs.subscribe({
      next: (res: Partial<AppUser> | void) => {
        if (this.confirmKind === 'delete') {
          this.users = this.users.filter(x => x.id !== u.id);
        } else {
          const i = this.users.findIndex(x => x.id === u.id);
          if (i >= 0 && res) this.users[i] = { ...(this.users[i]), ...(res as any) };
        }
        this.loading = false;
        this.cancelConfirm();
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Operación no realizada';
        this.cancelConfirm();
      }
    });
  }

  editUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (this.isCreator(u)) this.openEditModal(u);
    else if (this.isAdmin(u)) this.openEditAdminModal(u);
  }
  toggleBlockUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    this.openConfirm(u.blocked ? 'unblock' : 'block', u);
  }
  deleteUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    this.openConfirm('delete', u);
  }

  editar(u: AppUser)      { this.openEditModal(u); }
  toggleBlock(u: AppUser) { this.openConfirm(u.blocked ? 'unblock' : 'block', u); }
  eliminar(u: AppUser)    { this.openConfirm('delete', u); }

  isCreator(u: AppUser) { return u.role === 'GESTOR_CONTENIDO'; }
  isAdmin(u: AppUser)   { return u.role === 'ADMINISTRADOR'; }
  isUser(u: AppUser)    { return u.role === 'USUARIO'; }
  isSuperAdmin(u: AppUser) {
    return this.isAdmin(u) && (u.email || '').toLowerCase() === this.SUPER_ADMIN_EMAIL.toLowerCase();
  }

  showCreateModal = false;
  openCreate() { this.showCreateModal = true; }
  cancelCreate() { this.showCreateModal = false; }
  onCreadorCreado() {
    this.showCreateModal = false;
    this.fetchAll();
  }

  pedirPwdAdminForModal = false;

  showCreateAdminModal = false;
  openCreateAdmin() {
    this.pedirPwdAdminForModal = true;
    this.showCreateAdminModal = true;
  }
  cancelCreateAdmin() {
    this.showCreateAdminModal = false;
    this.pedirPwdAdminForModal = false;
  }
  onAdminCreado() {
    this.showCreateAdminModal = false;
    this.pedirPwdAdminForModal = false;
    this.fetchAll();
  }

  trackUser = (_: number, u: AppUser) => u.id;
}
