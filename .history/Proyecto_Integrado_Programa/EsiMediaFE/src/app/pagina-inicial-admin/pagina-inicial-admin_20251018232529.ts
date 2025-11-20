import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppUser, Role, UserDto } from '../auth/models';
import { Registro } from '../registro/registro';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

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
  adminFieldErrors: Record<string, string> = {};
  isAdminFormValid = false;


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
   crearAdmin = {
    nombre: '',
    apellidos: '',
    alias: '',
    email: '',
    pwd: '',
    pwd2: '',
    departamento: '',
    foto: '',
    fechaNac: ''
  };
  aliasChecking = false;
  aliasAvailable: boolean | null = null;

  private readonly searchChanged$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly api: AuthService,private readonly auth: AuthService, private readonly router: Router) {
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
  goToUsuarioReadOnly(): void {
    localStorage.setItem('users_readonly_mode', '1');
    localStorage.setItem('users_readonly_from_admin', '1');
    this.router.navigate(['/usuarioReadOnly'], {
      queryParams: { modoLectura: 1, from: 'admin' },
      state: { fromAdmin: true }
    });
  }

  exitReadOnlyEverywhere(): void {
    localStorage.removeItem('users_readonly_mode');
    this.router.navigateByUrl('/admin');
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
    data = data.filter(u => u.role === 'USUARIO' && (!!u.vip === wantVip));
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

  recompute() {
    const _ = this.filteredUsers;
  }

  goto(p: number) { if (p >= 1 && p <= this.totalPages) this.page = p; }

  fetchAll() {
    this.loading = true;
    this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.users = (list ?? []).map(u => ({
            ...u,
            fotoUrl: u.foto ? `${window.location.origin}/${u.foto}` : null
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
    descripcion: null as string | null,
    especialidad: '',
    email: '',
    fechaNac: '',                     
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
    this.editingUser = u;
    const toDateInput = (iso?: string | null): string => {
      if (!iso) return '';
      return iso.length > 10 ? iso.slice(0, 10) : iso;
    };

    const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;

    this.editModel = {
      alias: u.alias ?? '',
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      descripcion: (u as any).descripcion ?? null,
      especialidad: (u as any).especialidad ?? '',
      email: u.email ?? '',
      fechaNac: u.role === 'USUARIO' ? toDateInput(fn) : '',
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
    if (!this.editingUser || form.invalid || this.aliasTaken) return;
    const v = this.validateEditModel(this.editingUser);
    if (v) { this.errorMsg = v; return; }

    if (!this.editingUser || form.invalid || this.aliasTaken) return;

    const u = this.editingUser;
    const dto = this.buildEditDto(u);

    if (this.isEmpty(dto)) {
      this.cancelEdit();
      return;
    }

    this.loading = true;
    const obs = this.getEditObservable(u, dto);
    if (!obs) {
      this.loading = false;
      return;
    }

    obs.subscribe({
      next: (upd: unknown) => this.onEditSuccess(u, upd),
      error: (err: any) => this.onEditError(err),
    });
    }

    private buildEditDto(u: AppUser) {
      const m = this.editModel;
      const dto: any = {};

      this.addIfChanged(dto, 'alias', (m.alias ?? '').trim(), u.alias ?? '');
      this.addIfChanged(dto, 'nombre', (m.nombre ?? '').trim(), u.nombre ?? '');
      this.addIfChanged(dto, 'apellidos', (m.apellidos ?? '').trim(), u.apellidos ?? '');
      this.addIfChanged(dto, 'email', (m.email ?? '').trim(), u.email ?? '');
      this.addIfChanged(dto, 'foto', m.foto ?? null, (u as any).fotoUrl ?? null);

      this.applyRoleSpecific(u, dto);

      return dto;
    }

private applyRoleSpecific(u: AppUser, dto: any) {
  switch (u.role) {
    case 'GESTOR_CONTENIDO': {
      const desc = (this.editModel.descripcion ?? '').trim();
      const esp  = (this.editModel.especialidad ?? '').trim();
      this.addIfChanged(dto, 'descripcion', desc, (u as any).descripcion ?? '');
      this.addIfChanged(dto, 'especialidad', esp, (u as any).especialidad ?? '');
      break;
    }
    case 'USUARIO': {
      const fn = (this.editModel.fechaNac ?? '').trim();
      if (fn) dto.fechaNac = fn;
      break;
    }
    default:
      break;
  }
}

private addIfChanged(target: any, key: string, next: any, prev: any) {
  const hasValue = next !== null && next !== undefined && String(next).trim() !== '';
  if (hasValue && next !== prev) target[key] = next;
}

  private getEditObservable(u: AppUser, dto: any) {
    if (u.role === 'GESTOR_CONTENIDO') return this.api.updateCreator(u.id, dto);
    if (u.role === 'USUARIO') return this.api.updateUser(u.id, dto);
    return null;
  }

  private onEditSuccess(u: AppUser, upd: unknown) {
    const i = this.users.findIndex(x => x.id === u.id);
    if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
    this.loading = false;
    this.cancelEdit();
  }

  private onEditError(err: any) {
    this.loading = false;
    this.errorMsg = err?.error?.message || 'Error al actualizar';
  }

  private isEmpty(obj: Record<string, any>) {
    return !obj || Object.keys(obj).length === 0;
  }


validateAdminForm() {
  const errors: Record<string, string> = {};

  if (!this.adminEditModel.alias || this.adminEditModel.alias.trim().length < 2) {
    errors['alias'] = 'El alias debe tener al menos 2 caracteres.';
  } else if (this.adminAliasTaken) {
    errors['alias'] = 'El alias ya está en uso.';
  }

  if (!this.adminEditModel.nombre || this.adminEditModel.nombre.trim().length < 2) {
    errors['nombre'] = 'El nombre debe tener al menos 2 caracteres.';
  }
  this.adminFieldErrors = errors;
  this.isAdminFormValid = Object.keys(errors).length === 0;
}
onAdminApellidosInput(v: string) {
  this.adminEditModel.apellidos = v;
  this.validateAdminForm();
}

onAdminDepartamentoInput(v: string) {
  this.adminEditModel.departamento = v;
  this.validateAdminForm();
}


  onAdminNameInput(v: string) {
    this.adminEditModel.nombre = v;
    this.validateAdminForm();
  }

  onAdminEmailInput(v: string) {
    this.adminEditModel.email = v;
    this.validateAdminForm();
  }



  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;

  adminEditModel = {
    alias: '',
    nombre: '',
    apellidos: '',
    email: '',
    foto: null as string | null,
    fotoPreviewUrl: null as string | null,
    departamento: '',
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
      fotoPreviewUrl: u.fotoUrl ?? null,
      departamento: u.departamento ?? '',
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
    if (form.invalid) return;

    const u = this.editingAdmin;
    const dto: any = {};

    const nombre   = this.adminEditModel.nombre.trim();
    const apellidos = this.adminEditModel.apellidos.trim();
    const email    = this.adminEditModel.email.trim();
    const foto     = this.adminEditModel.foto;
    const departamento = this.adminEditModel.departamento?.trim();

    if (nombre && nombre !== u.nombre) dto.nombre = nombre;
    if (apellidos !== (u.apellidos ?? '')) dto.apellidos = apellidos;
    if (email && email !== u.email) dto.email = email;
    if (foto && foto !== u.fotoUrl) dto.foto = foto;
    if (departamento && departamento !== ((u as any).departamento ?? '')) dto.departamento = departamento;

    if (Object.keys(dto).length === 0) { 
      this.cancelEditAdmin(); 
      return; 
    }

    this.loading = true;
    this.api.updateAdmin(u.id, dto).subscribe({
      next: (upd) => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false;
        this.cancelEditAdmin();
        Swal.fire({
          icon: 'success',
          title: '¡Administrador actualizado!',
          text: 'Los cambios se han guardado correctamente.',
          confirmButtonText: 'Aceptar',
          customClass: {
            confirmButton: 'btn btn-primary'
          },
          buttonsStyling: false
        });
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
    if (!(this.isCreator(u) || this.isAdmin(u) || this.isUser(u))) return;
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

    const obs = this.resolveAction(u, this.confirmKind);
    if (!obs) { this.loading = false; return; }

    obs.subscribe({
      next: (res: Partial<AppUser> | void) => this.onConfirmSuccess(u, this.confirmKind!, res),
      error: (err: any) => this.onConfirmError(err),
    });
  }
  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12, descripcion: 90, especialidad: 60 };
  private readonly ALIAS_MIN = 3;

  private validateEditModel(u: AppUser): string | null {
    const al = (this.editModel.alias ?? '').trim();
    const n  = (this.editModel.nombre ?? '').trim();
    const ap = (this.editModel.apellidos ?? '').trim();
    const de = (this.editModel.descripcion ?? '').trim();
    const es = (this.editModel.especialidad ?? '').trim();

    if (al) {
      if (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)
        return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    }
    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (ap && ap.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;

    if (u.role === 'GESTOR_CONTENIDO') {
      if (de && de.length > this.MAX.descripcion) return `La descripción supera ${this.MAX.descripcion} caracteres.`;
      if (es && es.length > this.MAX.especialidad) return `La especialidad supera ${this.MAX.especialidad} caracteres.`;
    }
    return null;
  }


  private resolveAction(u: AppUser, kind: ConfirmKind) {
    const actions: Record<AppUser['role'], Record<ConfirmKind, () => any>> = {
      GESTOR_CONTENIDO: {
        block:   () => this.api.blockCreator(u.id),
        unblock: () => this.api.unblockCreator(u.id),
        delete:  () => this.api.deleteCreator(u.id),
      },
      ADMINISTRADOR: {
        block:   () => this.api.blockAdmin(u.id),
        unblock: () => this.api.unblockAdmin(u.id),
        delete:  () => this.api.deleteAdmin(u.id),
      },
      USUARIO: {
        block:   () => this.api.blockUser(u.id),
        unblock: () => this.api.unblockUser(u.id),
        delete:  () => this.api.deleteUser(u.id),
      },
    };

    return actions[u.role]?.[kind]?.();
  }

  private onConfirmSuccess(u: AppUser, kind: ConfirmKind, res: Partial<AppUser> | void) {
    if (kind === 'delete') {
      this.users = this.users.filter(x => x.id !== u.id);
    } else {
      const i = this.users.findIndex(x => x.id === u.id);
      if (i >= 0 && res) this.users[i] = { ...(this.users[i]), ...(res as any) };
    }
    this.loading = false;
    this.cancelConfirm();
  }

  private onConfirmError(err: any) {
    this.loading = false;
    this.errorMsg = err?.error?.message || 'Operación no realizada';
    this.cancelConfirm();
  }


  editUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (this.isCreator(u) || this.isUser(u)) this.openEditModal(u);
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
  get pwdMismatchCreate(): boolean {
    return !!this.crearAdmin.pwd && !!this.crearAdmin.pwd2 && this.crearAdmin.pwd !== this.crearAdmin.pwd2;
  }
  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable === false) return;
    const body = {
      nombre: this.crearAdmin.nombre.trim(),
      apellidos: this.crearAdmin.apellidos.trim(),
      alias: this.crearAdmin.alias.trim(),
      email: this.crearAdmin.email.trim(),
      pwd: this.crearAdmin.pwd,
      pwd2: this.crearAdmin.pwd2,
      foto: this.crearAdmin.foto?.trim() || undefined,
      departamento: this.crearAdmin.departamento.trim(),
      fechaNac: this.crearAdmin.fechaNac?.trim() || undefined
    };
    this.loading = true;
    this.api.createAdminByAdmin(body).subscribe({
      next: () => {
        this.loading = false;
        this.showCreateAdminModal = false;
        this.resetCreateAdmin();
        this.fetchAll();
      },
      error: err => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'No se pudo crear el administrador';
      }
    });
  }
  private resetCreateAdmin() {
    this.crearAdmin = { nombre: '', apellidos: '', alias: '', email: '', pwd: '', pwd2: '', departamento: '', foto: '', fechaNac: '' };
    this.aliasAvailable = null;
    this.aliasChecking = false;
  }

  onAdminCreado() {
    this.showCreateAdminModal = false;
    this.pedirPwdAdminForModal = false;
    this.fetchAll();
  }

  trackUser = (_: number, u: AppUser) => u.id;

  cerrarSesion(): void {
  const confirmacion = confirm('¿Seguro que deseas cerrar sesión?');
  if (confirmacion) {
    this.auth.logout?.()
    localStorage.removeItem('user');
    alert('Sesión cerrada correctamente.');
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}

}
