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
  // ----------------------------
  // Constantes / utilidades puras
  // ----------------------------
  public readonly FILES_BASE = window.location.origin;
  private readonly SUPER_ADMIN_EMAIL = 'proyecto.integrado.iso@gmail.com';
  private static readonly ROLE_LABELS: Record<Role, string> = {
    ADMINISTRADOR: 'Administrador',
    USUARIO: 'Usuario',
    GESTOR_CONTENIDO: 'Gestor de contenido'
  };
  private static readonly EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  private static trimLower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  private static trimSafe = (s: string | null | undefined) => (s ?? '').trim();

  private static withinLen(v: string, min: number, max: number) {
    return v.length >= min && v.length <= max;
  }
  private static overMax(v: string, max: number) {
    return !!v && v.length > max;
  }
  private static toDateInput(iso?: string | null) {
    if (!iso) return '';
    return iso.length > 10 ? iso.slice(0, 10) : iso;
  }
  private static calcEdad(fechaISO: string) {
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const m = hoy.getMonth() - fecha.getMonth();
    const d = hoy.getDate() - fecha.getDate();
    if (m < 0 || (m === 0 && d < 0)) edad--;
    return { edad, futura: fecha > hoy };
  }

  // ----------------------------
  // Estado de usuario logado / UI
  // ----------------------------
  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userFotoUrl: string | null = null;
  userAvatarUrl: string | null = null;

  // Filtros / paginación
  filtros = {
    nombre: '',
    bloqueado: '' as EstadoFiltro,
    tipo: '' as TipoFiltro,
    vip: '' as VipFiltro,
    ordenar: 'fecha' as 'fecha' | 'nombre' | 'rol' | 'vip'
  };
  page = 1;
  pageSize = 10;

  // Datos
  loading = false;
  errorMsg = '';
  users: AppUser[] = [];

  // Crear admin
  crearAdmin = { nombre: '', apellidos: '', alias: '', email: '', pwd: '', pwd2: '', departamento: '', foto: '', fechaNac: '' };
  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  get pwdMismatchCreate(): boolean { return !!this.crearAdmin.pwd && !!this.crearAdmin.pwd2 && this.crearAdmin.pwd !== this.crearAdmin.pwd2; }

  // Editar usuario/gestor
  showEditModal = false;
  editingUser: AppUser | null = null;
  editModel = { alias: '', nombre: '', apellidos: '', descripcion: null as string | null, especialidad: '', email: '', fechaNac: '', foto: null as string | null, fotoPreviewUrl: null as string | null };
  aliasError: string | null = null;
  aliasCheck$ = new Subject<string>();
  aliasTaken = false;

  // Editar admin
  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;
  adminEditModel = { alias: '', nombre: '', apellidos: '', email: '', foto: null as string | null, fotoPreviewUrl: null as string | null, departamento: '' };
  adminAliasCheck$ = new Subject<string>();
  adminAliasTaken = false;
  adminFieldErrors: Record<string, string> = {};
  isAdminFormValid = false;

  // Confirmaciones
  showConfirmModal = false;
  confirmKind: ConfirmKind | null = null;
  targetUser: AppUser | null = null;

  // Otros
  fechaNacError: string | null = null;
  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
  ];
  showAvatarPicker = false;
  showCreateModal = false;
  pedirPwdAdminForModal = false;
  showCreateAdminModal = false;

  // Streams
  private readonly searchChanged$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly api: AuthService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.recompute());

    // Debounce alias checks (edición usuario/gestor)
    this.aliasCheck$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(value => {
        const alias = PaginaInicialAdmin.trimLower(value);
        const currentId = this.editingUser?.id;
        this.aliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
      });

    // Debounce alias checks (edición admin)
    this.adminAliasCheck$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(value => {
        const alias = PaginaInicialAdmin.trimLower(value);
        const currentId = this.editingAdmin?.id;
        this.adminAliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
        this.validateAdminForm();
      });
  }

  // ----------------------------
  // Ciclo de vida
  // ----------------------------
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

  // ----------------------------
  // User logado
  // ----------------------------
  onAvatarError(): void { this.userAvatarUrl = null; }

  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = PaginaInicialAdmin.ROLE_LABELS[user.role] ?? 'Desconocido';
    this.userInitials = this.getInitials(this.userName);
    const foto = (user as any)?.foto?.toString()?.trim() || '';
    this.userAvatarUrl = foto || null;
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch { return null; }
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  // ----------------------------
  // Lista / filtros / orden / paginación
  // ----------------------------
  get totalPages() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }
  get pageItems(): AppUser[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  private filterByQuery(data: AppUser[], q: string) {
    if (!q) return data;
    const tq = q.toLowerCase();
    return data.filter(u =>
      (u.alias || '').toLowerCase().includes(tq) ||
      (u.nombre || '').toLowerCase().includes(tq) ||
      (u.apellidos || '').toLowerCase().includes(tq) ||
      (u.email || '').toLowerCase().includes(tq)
    );
  }
  private filterByBlocked(data: AppUser[], bloqueado: EstadoFiltro) {
    if (bloqueado === '') return data;
    const want = bloqueado === 'si';
    return data.filter(u => !!u.blocked === want);
  }
  private filterByTipo(data: AppUser[], tipo: TipoFiltro) {
    return tipo ? data.filter(u => u.role === tipo) : data;
  }
  private filterByVip(data: AppUser[], vip: VipFiltro) {
    if (vip === '') return data;
    const want = vip === 'si';
    return data.filter(u => u.role === 'USUARIO' && (!!u.vip === want));
  }
  private getSortComparator(key: 'fecha' | 'nombre' | 'rol' | 'vip') {
    const byNombre = (a: AppUser, b: AppUser) => (a.nombre || '').localeCompare(b.nombre || '');
    const byRol    = (a: AppUser, b: AppUser) => (a.role || '').localeCompare(b.role || '');
    const byVip    = (a: AppUser, b: AppUser) => Number(!!b.vip) - Number(!!a.vip);
    const byFecha  = (a: AppUser, b: AppUser) => (b.createdAt || '').localeCompare(a.createdAt || '');
    const map = { nombre: byNombre, rol: byRol, vip: byVip, fecha: byFecha };
    return map[key] ?? byFecha;
  }

  get filteredUsers(): AppUser[] {
    let data = [...this.users];
    const { nombre, bloqueado, tipo, vip, ordenar } = this.filtros;

    data = this.filterByQuery(data, PaginaInicialAdmin.trimSafe(nombre));
    data = this.filterByBlocked(data, bloqueado);
    data = this.filterByTipo(data, tipo);
    data = this.filterByVip(data, vip);

    // Orden
    const cmp = this.getSortComparator(ordenar);
    if (data.length > 1) data.sort(cmp);
    return data;
  }

  onSearchChange() { this.page = 1; this.searchChanged$.next(); }
  onStateChange()  { this.page = 1; this.searchChanged$.next(); }
  onTipoChange()   { this.page = 1; this.searchChanged$.next(); }
  onVipChange()    { this.page = 1; this.searchChanged$.next(); }
  onOrderChange()  { this.page = 1; this.searchChanged$.next(); }
  recompute() { /* fuerza reevaluación vía getters */ const _ = this.filteredUsers; }
  goto(p: number) { if (p >= 1 && p <= this.totalPages) this.page = p; }

  fetchAll() {
    this.loading = true;
    this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
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

  // ----------------------------
  // Edición usuario/gestor
  // ----------------------------
  openEditModal(u: AppUser) {
    this.editingUser = u;
    const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;

    this.editModel = {
      alias: u.alias ?? '',
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      descripcion: (u as any).descripcion ?? null,
      especialidad: (u as any).especialidad ?? '',
      email: u.email ?? '',
      fechaNac: u.role === 'USUARIO' ? PaginaInicialAdmin.toDateInput(fn) : '',
      foto: u.fotoUrl ?? null,
      fotoPreviewUrl: u.fotoUrl ?? null
    };
    this.showEditModal = true;
    this.aliasCheck$.next(this.editModel.alias);
  }

  onAliasInput(v: string) {
    const alias = PaginaInicialAdmin.trimSafe(v);
    if (!PaginaInicialAdmin.withinLen(alias, 3, 12)) {
      this.aliasError = '⚠️ El alias debe tener entre 3 y 12 caracteres.';
      this.aliasTaken = false;
      return;
    }
    this.aliasError = null;
    this.aliasChecking = true;
    this.api.checkAlias(alias).subscribe({
      next: res => {
        this.aliasTaken = !res.available;
        if (this.aliasTaken) this.aliasError = '⚠️ Alias en uso';
        this.aliasChecking = false;
      },
      error: () => {
        this.aliasTaken = false;
        this.aliasChecking = false;
      }
    });
  }

  openAvatarModal()  { this.showAvatarPicker = true; }
  closeAvatarModal() { this.showAvatarPicker = false; }
  selectAvatar(path: string) {
    if (this.showEditAdminModal) {
      this.adminEditModel.foto = path;
      this.adminEditModel.fotoPreviewUrl = path;
    } else if (this.showEditModal) {
      this.editModel.foto = path;
      this.editModel.fotoPreviewUrl = path;
    }
    this.closeAvatarModal();
  }

  cancelEdit() {
    this.showEditModal = false;
    this.editingUser = null;
    this.aliasTaken = false;
    this.showAvatarPicker = false;
  }

  private addIfChanged(target: any, key: string, next: any, prev: any) {
    const hasValue = next !== null && next !== undefined && String(next).trim() !== '';
    if (hasValue && next !== prev) target[key] = next;
  }

  private applyRoleSpecific(u: AppUser, dto: any) {
    if (u.role === 'GESTOR_CONTENIDO') {
      const desc = PaginaInicialAdmin.trimSafe(this.editModel.descripcion);
      const esp  = PaginaInicialAdmin.trimSafe(this.editModel.especialidad);
      this.addIfChanged(dto, 'descripcion', desc, (u as any).descripcion ?? '');
      this.addIfChanged(dto, 'especialidad', esp, (u as any).especialidad ?? '');
    } else if (u.role === 'USUARIO') {
      const fn = PaginaInicialAdmin.trimSafe(this.editModel.fechaNac);
      if (fn) dto.fechaNac = fn;
    }
  }

  private buildEditDto(u: AppUser) {
    const m = this.editModel;
    const dto: any = {};
    this.addIfChanged(dto, 'alias', PaginaInicialAdmin.trimSafe(m.alias), u.alias ?? '');
    this.addIfChanged(dto, 'nombre', PaginaInicialAdmin.trimSafe(m.nombre), u.nombre ?? '');
    this.addIfChanged(dto, 'apellidos', PaginaInicialAdmin.trimSafe(m.apellidos), u.apellidos ?? '');
    this.addIfChanged(dto, 'email', PaginaInicialAdmin.trimSafe(m.email), u.email ?? '');
    this.addIfChanged(dto, 'foto', m.foto ?? null, (u as any).fotoUrl ?? null);
    this.applyRoleSpecific(u, dto);
    return dto;
  }

  private getEditObservable(u: AppUser, dto: any) {
    if (u.role === 'GESTOR_CONTENIDO') return this.api.updateCreator(u.id, dto);
    if (u.role === 'USUARIO')          return this.api.updateUser(u.id, dto);
    return null;
  }

  saveEdit(form: NgForm) {
    if (!this.editingUser || form.invalid || this.aliasTaken) return;
    const v = this.validateEditModel(this.editingUser);
    if (v) { this.errorMsg = v; return; }

    const u = this.editingUser;
    const dto = this.buildEditDto(u);
    if (!dto || Object.keys(dto).length === 0) { this.cancelEdit(); return; }

    this.loading = true;
    const obs = this.getEditObservable(u, dto);
    if (!obs) { this.loading = false; return; }

    obs.subscribe({
      next: (upd: unknown) => this.onEditSuccessWithSwal(u, upd),
      error: (err: any) => this.onEditError(err),
    });
  }

  private onEditSuccessWithSwal(u: AppUser, upd: unknown) {
    this.onEditSuccess(u, upd);
    this.loading = false;
    this.showEditModal = false;
    Swal.fire({
      icon: 'success',
      title: `${u.role} modificado correctamente`,
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
      position: 'center'
    }).then(() => { window.location.reload(); });
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

  onFechaNacInput(value: string) {
    this.fechaNacError = null;
    if (!value) return;
    const { edad, futura } = PaginaInicialAdmin.calcEdad(value);
    if (futura) { this.fechaNacError = '⚠️ La fecha no puede ser futura.'; return; }
    if (edad < 4) this.fechaNacError = '⚠️ El usuario debe tener al menos 4 años.';
  }

  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12, descripcion: 90, especialidad: 60 };
  private readonly ALIAS_MIN = 3;

  private validateEditModel(u: AppUser): string | null {
    const fields: Record<string, { value: string; max: number; msg: string; min?: number }> = {
      alias:      { value: PaginaInicialAdmin.trimSafe(this.editModel.alias),      max: this.MAX.alias,      msg: `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`, min: this.ALIAS_MIN },
      nombre:     { value: PaginaInicialAdmin.trimSafe(this.editModel.nombre),     max: this.MAX.nombre,     msg: `El nombre supera ${this.MAX.nombre} caracteres.` },
      apellidos:  { value: PaginaInicialAdmin.trimSafe(this.editModel.apellidos),  max: this.MAX.apellidos,  msg: `Los apellidos superan ${this.MAX.apellidos} caracteres.` },
    };

    // Alias con min/max
    const alias = fields['alias'];
    if (alias.value && !PaginaInicialAdmin.withinLen(alias.value, alias.min!, alias.max)) return alias.msg;

    // Nombre/apellidos solo max
    if (PaginaInicialAdmin.overMax(fields['nombre'].value, fields['nombre'].max)) return fields['nombre'].msg;
    if (PaginaInicialAdmin.overMax(fields['apellidos'].value, fields['apellidos'].max)) return fields['apellidos'].msg;

    if (u.role === 'GESTOR_CONTENIDO') {
      const extra = {
        descripcion: { value: PaginaInicialAdmin.trimSafe(this.editModel.descripcion), max: this.MAX.descripcion, msg: `La descripción supera ${this.MAX.descripcion} caracteres.` },
        especialidad:{ value: PaginaInicialAdmin.trimSafe(this.editModel.especialidad), max: this.MAX.especialidad, msg: `La especialidad supera ${this.MAX.especialidad} caracteres.` }
      };
      if (PaginaInicialAdmin.overMax(extra.descripcion.value, extra.descripcion.max)) return extra.descripcion.msg;
      if (PaginaInicialAdmin.overMax(extra.especialidad.value, extra.especialidad.max)) return extra.especialidad.msg;
    }
    return null;
  }

  // ----------------------------
  // Edición admin
  // ----------------------------
  openEditAdminModal(u: AppUser) {
    if (u.role !== 'ADMINISTRADOR' || this.isSuperAdmin(u)) return;
    this.editingAdmin = u;
    this.adminEditModel = {
      alias: u.alias ?? '',
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      email: u.email ?? '',
      foto: u.fotoUrl ?? null,
      fotoPreviewUrl: u.fotoUrl ?? null,
      departamento: (u as any).departamento ?? '',
    };
    this.showEditAdminModal = true;
    this.adminAliasCheck$.next(this.adminEditModel.alias);
  }

  onAdminAliasInput(v: string) { this.adminAliasCheck$.next(v); }
  onAdminApellidosInput(v: string)   { this.updateAdminFieldAndValidate('apellidos', v); }
  onAdminDepartamentoInput(v: string){ this.updateAdminFieldAndValidate('departamento', v); }
  onAdminNameInput(v: string)        { this.updateAdminFieldAndValidate('nombre', v); }
  onAdminEmailInput(v: string)       { this.updateAdminFieldAndValidate('email', v); }

  private updateAdminFieldAndValidate<K extends keyof typeof this.adminEditModel>(k: K, v: string) {
    (this.adminEditModel[k] as any) = v;
    this.validateAdminForm();
  }

  cancelEditAdmin() {
    this.showEditAdminModal = false;
    this.editingAdmin = null;
    this.adminAliasTaken = false;
  }

  validateAdminForm() {
    const MAX = { nombre: 100, apellidos: 100, alias: 12, departamento: 120 };
    const ALIAS_MIN = 3;
    const f = {
      alias: PaginaInicialAdmin.trimSafe(this.adminEditModel.alias),
      nombre: PaginaInicialAdmin.trimSafe(this.adminEditModel.nombre),
      apellidos: PaginaInicialAdmin.trimSafe(this.adminEditModel.apellidos),
      email: PaginaInicialAdmin.trimSafe(this.adminEditModel.email),
      departamento: PaginaInicialAdmin.trimSafe(this.adminEditModel.departamento)
    };
    const errs: Record<string, string> = {};

    if (f.alias) {
      if (!PaginaInicialAdmin.withinLen(f.alias, ALIAS_MIN, MAX.alias)) errs['alias'] = `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
      if (!errs['alias'] && this.adminAliasTaken) errs['alias'] = 'El alias ya está en uso.';
    }
    if (!f.nombre) errs['nombre'] = 'El nombre es obligatorio.';
    else if (PaginaInicialAdmin.overMax(f.nombre, MAX.nombre)) errs['nombre'] = `El nombre supera ${MAX.nombre} caracteres.`;

    if (PaginaInicialAdmin.overMax(f.apellidos, MAX.apellidos)) errs['apellidos'] = `Los apellidos superan ${MAX.apellidos} caracteres.`;

    if (!f.email) errs.email = 'El email es obligatorio.';
    else if (!PaginaInicialAdmin.EMAIL_RE.test(f.email)) errs['email'] = 'Email no válido.';

    if (PaginaInicialAdmin.overMax(f.departamento, MAX.departamento)) errs.departamento = `El departamento supera ${MAX.departamento} caracteres.`;

    this.adminFieldErrors = errs;
    this.isAdminFormValid = Object.keys(errs).length === 0;
  }

  saveAdminEdit(form: NgForm) {
    const u = this.editingAdmin;
    if (!u || u.role !== 'ADMINISTRADOR' || this.isSuperAdmin(u) || form.invalid || !this.isAdminFormValid) return;

    const nombre = PaginaInicialAdmin.trimSafe(this.adminEditModel.nombre);
    const apellidos = PaginaInicialAdmin.trimSafe(this.adminEditModel.apellidos);
    const email = PaginaInicialAdmin.trimSafe(this.adminEditModel.email);
    const foto = this.adminEditModel.foto ?? null;
    const departamento = PaginaInicialAdmin.trimSafe(this.adminEditModel.departamento);

    const dto: any = {};
    if (nombre && nombre !== u.nombre) dto.nombre = nombre;
    if (apellidos !== (u.apellidos ?? '')) dto.apellidos = apellidos;
    if (email && email !== u.email) dto.email = email;
    dto.foto = foto;
    if (departamento && departamento !== ((u as any).departamento ?? '')) dto.departamento = departamento;

    if (Object.keys(dto).length === 0) { this.cancelEditAdmin(); return; }

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
          customClass: { confirmButton: 'btn btn-primary' },
          buttonsStyling: false
        }).then(() => { window.location.reload(); });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Error al actualizar administrador';
      }
    });
  }

  // ----------------------------
  // Confirmaciones / acciones
  // ----------------------------
  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (!(this.isCreator(u) || this.isAdmin(u) || this.isUser(u))) return;
    if (this.isSuperAdmin(u)) return;
    this.confirmKind = kind;
    this.targetUser = u;
    this.showConfirmModal = true;
  }
  cancelConfirm() { this.showConfirmModal = false; this.confirmKind = null; this.targetUser = null; }

  private resolveAction(u: AppUser, kind: ConfirmKind) {
    const actions: Record<AppUser['role'], Record<ConfirmKind, () => any>> = {
      GESTOR_CONTENIDO: { block: () => this.api.blockCreator(u.id),   unblock: () => this.api.unblockCreator(u.id), delete: () => this.api.deleteCreator(u.id) },
      ADMINISTRADOR:    { block: () => this.api.blockAdmin(u.id),     unblock: () => this.api.unblockAdmin(u.id),   delete: () => this.api.deleteAdmin(u.id) },
      USUARIO:          { block: () => this.api.blockUser(u.id),      unblock: () => this.api.unblockUser(u.id),    delete: () => this.api.deleteUser(u.id) },
    };
    return actions[u.role]?.[kind]?.();
  }

  confirmAction() {
    if (!this.targetUser || !this.confirmKind || this.isSuperAdmin(this.targetUser)) { this.cancelConfirm(); return; }
    this.loading = true;
    const obs = this.resolveAction(this.targetUser, this.confirmKind);
    if (!obs) { this.loading = false; return; }

    obs.subscribe({
      next: (res: Partial<AppUser> | void) => this.onConfirmSuccess(this.targetUser!, this.confirmKind!, res),
      error: (err: any) => this.onConfirmError(err),
    });
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

  // ----------------------------
  // Navegación / otros
  // ----------------------------
  goToUsuarioReadOnly(): void {
    localStorage.setItem('users_readonly_mode', '1');
    localStorage.setItem('users_readonly_from_admin', '1');
    this.router.navigate(['/usuarioReadOnly'], { queryParams: { modoLectura: 1, from: 'admin' }, state: { fromAdmin: true } });
  }
  exitReadOnlyEverywhere(): void {
    localStorage.removeItem('users_readonly_mode');
    this.router.navigateByUrl('/admin');
  }

  editUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (this.isCreator(u) || this.isUser(u)) this.openEditModal(u);
    else if (this.isAdmin(u)) this.openEditAdminModal(u);
  }
  toggleBlockUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm(u.blocked ? 'unblock' : 'block', u); }
  deleteUser(u: AppUser)      { if (!this.isSuperAdmin(u)) this.openConfirm('delete', u); }

  editar(u: AppUser)      { this.openEditModal(u); }
  toggleBlock(u: AppUser) { this.openConfirm(u.blocked ? 'unblock' : 'block', u); }
  eliminar(u: AppUser)    { this.openConfirm('delete', u); }

  isCreator(u: AppUser) { return u.role === 'GESTOR_CONTENIDO'; }
  isAdmin(u: AppUser)   { return u.role === 'ADMINISTRADOR'; }
  isUser(u: AppUser)    { return u.role === 'USUARIO'; }
  isSuperAdmin(u: AppUser) {
    return this.isAdmin(u) && (u.email || '').toLowerCase() === this.SUPER_ADMIN_EMAIL.toLowerCase();
  }

  openCreate() { this.showCreateModal = true; }
  cancelCreate() { this.showCreateModal = false; }
  onCreadorCreado() { this.showCreateModal = false; this.fetchAll(); }

  openCreateAdmin() { this.pedirPwdAdminForModal = true; this.showCreateAdminModal = true; }
  cancelCreateAdmin() { this.showCreateAdminModal = false; this.pedirPwdAdminForModal = false; }

  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable === false) return;
    const body = {
      nombre: PaginaInicialAdmin.trimSafe(this.crearAdmin.nombre),
      apellidos: PaginaInicialAdmin.trimSafe(this.crearAdmin.apellidos),
      alias: PaginaInicialAdmin.trimSafe(this.crearAdmin.alias),
      email: PaginaInicialAdmin.trimSafe(this.crearAdmin.email),
      pwd: this.crearAdmin.pwd,
      pwd2: this.crearAdmin.pwd2,
      foto: PaginaInicialAdmin.trimSafe(this.crearAdmin.foto) || undefined,
      departamento: PaginaInicialAdmin.trimSafe(this.crearAdmin.departamento),
      fechaNac: PaginaInicialAdmin.trimSafe(this.crearAdmin.fechaNac) || undefined
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

  onAdminCreado() { this.showCreateAdminModal = false; this.pedirPwdAdminForModal = false; this.fetchAll(); }

  trackUser = (_: number, u: AppUser) => u.id;

  cerrarSesion(): void {
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
        Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false });
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      }
    });
  }
}
