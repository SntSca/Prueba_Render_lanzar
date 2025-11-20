import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject, Observable, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppUser, Role, UserDto } from '../auth/models';
import { Registro } from '../registro/registro';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

/**
 * \n========================================
 *  PAGINA-INICIAL-ADMIN (Refactor, menor complejidad)
 * ========================================
 * Cambios clave:
 * 1) Extract helpers puros fuera de la clase (filtros, ordenación, validaciones, mapeos, storage, etc.).
 * 2) Consolidación de handlers repetidos (onSearch/State/Tipo/Vip/Order => onFiltroChange).
 * 3) Mapas en lugar de switch/if anidados (acciones por rol, ordenaciones, labels por role).
 * 4) Reutilización de utilidades addIfChanged(), isEmpty() y wrappers de API.
 * 5) Suscripciones debounced centralizadas con takeUntil.
 * 6) Validadores puros (admin y edición) para testear fácilmente y reducir ramas.
 */

// ------------------------- CONSTANTES & TIPOS -------------------------

type EstadoFiltro = '' | 'si' | 'no';
type TipoFiltro = '' | Role;
type VipFiltro = '' | 'si' | 'no';
type ConfirmKind = 'block' | 'unblock' | 'delete';

type Filtros = {
  nombre: string;
  bloqueado: EstadoFiltro;
  tipo: TipoFiltro;
  vip: VipFiltro;
  ordenar: 'fecha' | 'nombre' | 'rol' | 'vip';
};

// ------------------------- HELPERS PUROS -------------------------

const SUPER_ADMIN_EMAIL = 'proyecto.integrado.iso@gmail.com';

const LABELS_BY_ROLE: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  USUARIO: 'Usuario',
  GESTOR_CONTENIDO: 'Gestor de contenido',
};

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function safeGetUserFromLocalStorage(): UserDto | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserDto>;
    return parsed?.email && parsed?.role ? (parsed as UserDto) : null;
  } catch {
    return null;
  }
}

function getInitials(nombre: string): string {
  const safe = (nombre || '').trim();
  return safe ? safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase() : 'U';
}

function mapRoleToLabel(role?: Role | null): string {
  return role && role in LABELS_BY_ROLE ? LABELS_BY_ROLE[role as Role] : 'Desconocido';
}

function filterUsers(users: AppUser[], filtros: Filtros): AppUser[] {
  let data = [...users];

  const q = filtros.nombre?.trim().toLowerCase();
  if (q) {
    const match = (v?: string | null) => (v || '').toLowerCase().includes(q);
    data = data.filter(u => match(u.alias) || match(u.nombre) || match(u.apellidos) || match(u.email));
  }

  if (filtros.bloqueado !== '') {
    const wantBlocked = filtros.bloqueado === 'si';
    data = data.filter(u => !!u.blocked === wantBlocked);
  }

  if (filtros.tipo) {
    data = data.filter(u => u.role === filtros.tipo);
  }

  if (filtros.vip !== '') {
    const wantVip = filtros.vip === 'si';
    data = data.filter(u => u.role === 'USUARIO' && (!!u.vip === wantVip));
  }

  const sorters: Record<Filtros['ordenar'], (a: AppUser, b: AppUser) => number> = {
    nombre: (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
    rol:    (a, b) => (a.role || '').localeCompare(b.role || ''),
    vip:    (a, b) => Number(!!b.vip) - Number(!!a.vip),
    fecha:  (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
  };

  // Si no hay createdAt no pasa nada: el comparador devolverá 0 en muchos casos
  data.sort(sorters[filtros.ordenar] || sorters.fecha);

  return data;
}

function addIfChanged(target: any, key: string, next: any, prev: any) {
  const hasValue = next !== null && next !== undefined && String(next).trim() !== '';
  if (hasValue && next !== prev) target[key] = next;
}

function isEmpty(obj: Record<string, any>): boolean {
  return !obj || Object.keys(obj).length === 0;
}

function isSuperAdmin(u: AppUser): boolean {
  return u.role === 'ADMINISTRADOR' && (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

function validarFechaNacMinima(value: string): string | null {
  if (!value) return null;
  const fecha = new Date(value);
  const hoy = new Date();
  if (fecha > hoy) return '⚠️ La fecha no puede ser futura.';
  const edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  const diaDiff = hoy.getDate() - fecha.getDate();
  const edadReal = mesDiff < 0 || (mesDiff === 0 && diaDiff < 0) ? edad - 1 : edad;
  return edadReal < 4 ? '⚠️ El usuario debe tener al menos 4 años.' : null;
}

// --- Validadores puros (para edición de usuario/gestor) ---
const LIM = { nombre: 100, apellidos: 100, alias: 12, descripcion: 90, especialidad: 60 };
const ALIAS_MIN = 3;

function validateEditModelPure(role: AppUser['role'], m: {
  alias?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  descripcion?: string | null;
  especialidad?: string | null;
}): string | null {
  const alias = (m.alias ?? '').trim();
  const nombre = (m.nombre ?? '').trim();
  const apellidos = (m.apellidos ?? '').trim();
  if (alias && (alias.length < ALIAS_MIN || alias.length > LIM.alias)) return `El alias debe tener entre ${ALIAS_MIN} y ${LIM.alias} caracteres.`;
  if (nombre && nombre.length > LIM.nombre) return `El nombre supera ${LIM.nombre} caracteres.`;
  if (apellidos && apellidos.length > LIM.apellidos) return `Los apellidos superan ${LIM.apellidos} caracteres.`;
  if (role === 'GESTOR_CONTENIDO') {
    const descripcion = (m.descripcion ?? '').trim();
    const especialidad = (m.especialidad ?? '').trim();
    if (descripcion && descripcion.length > LIM.descripcion) return `La descripción supera ${LIM.descripcion} caracteres.`;
    if (especialidad && especialidad.length > LIM.especialidad) return `La especialidad supera ${LIM.especialidad} caracteres.`;
  }
  return null;
}

// --- Validador puro para Admin ---
function validateAdminFormPure(m: {
  alias?: string;
  nombre?: string;
  apellidos?: string;
  email?: string;
  departamento?: string;
}, aliasTomado: boolean): { ok: boolean; errors: Record<string,string> } {
  const MAX = { nombre: 100, apellidos: 100, alias: 12, departamento: 120 };
  const fields = {
    alias: (m.alias ?? '').trim(),
    nombre: (m.nombre ?? '').trim(),
    apellidos: (m.apellidos ?? '').trim(),
    email: (m.email ?? '').trim(),
    departamento: (m.departamento ?? '').trim(),
  };
  const errors: Record<string,string> = {};

  if (fields.alias) {
    if (fields.alias.length < ALIAS_MIN || fields.alias.length > MAX.alias) errors.alias = `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
    if (!errors.alias && aliasTomado) errors.alias = 'El alias ya está en uso.';
  }
  if (!fields.nombre) errors.nombre = 'El nombre es obligatorio.';
  else if (fields.nombre.length > MAX.nombre) errors.nombre = `El nombre supera ${MAX.nombre} caracteres.`;

  if (fields.apellidos.length > MAX.apellidos) errors.apellidos = `Los apellidos superan ${MAX.apellidos} caracteres.`;

  if (!fields.email) errors.email = 'El email es obligatorio.';
  else if (!EMAIL_RE.test(fields.email)) errors.email = 'Email no válido.';

  if (fields.departamento.length > MAX.departamento) errors.departamento = `El departamento supera ${MAX.departamento} caracteres.`;

  return { ok: Object.keys(errors).length === 0, errors };
}

// --- Acciones por rol centralizadas (block/unblock/delete/update) ---
function actionObservable(api: AuthService, u: AppUser, kind: ConfirmKind): Observable<any> | null {
  const actions: Record<AppUser['role'], Record<ConfirmKind, () => Observable<any>>> = {
    GESTOR_CONTENIDO: {
      block:   () => api.blockCreator(u.id),
      unblock: () => api.unblockCreator(u.id),
      delete:  () => api.deleteCreator(u.id),
    },
    ADMINISTRADOR: {
      block:   () => api.blockAdmin(u.id),
      unblock: () => api.unblockAdmin(u.id),
      delete:  () => api.deleteAdmin(u.id),
    },
    USUARIO: {
      block:   () => api.blockUser(u.id),
      unblock: () => api.unblockUser(u.id),
      delete:  () => api.deleteUser(u.id),
    },
  };
  return actions[u.role]?.[kind]?.() ?? null;
}

// ------------------------- COMPONENTE -------------------------

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Registro],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit, OnDestroy {
  public readonly FILES_BASE = window.location.origin;

  // Header (se rellena desde el usuario conectado)
  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userAvatarUrl: string | null = null;

  // Estado UI general
  loading = false;
  errorMsg = '';

  // Datos
  users: AppUser[] = [];

  // Filtros & Paginación
  filtros: Filtros = { nombre: '', bloqueado: '', tipo: '', vip: '', ordenar: 'fecha' };
  page = 1;
  pageSize = 10;

  // Streams
  private readonly searchChanged$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  // --- Modales/edición usuario/gestor ---
  showEditModal = false;
  editingUser: AppUser | null = null;
  editModel = {
    alias: '', nombre: '', apellidos: '', descripcion: null as string | null,
    especialidad: '', email: '', fechaNac: '', foto: null as string | null, fotoPreviewUrl: null as string | null
  };
  aliasTaken = false;
  aliasChecking = false;
  aliasError: string | null = null;
  fechaNacError: string | null = null;
  aliasCheck$ = new Subject<string>();

  // --- Avatares ---
  avatars: string[] = [
    'assets/avatars/avatar1.png', 'assets/avatars/avatar2.png', 'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png', 'assets/avatars/avatar5.png', 'assets/avatars/avatar6.png'
  ];
  showAvatarPicker = false;

  // --- Admin edición ---
  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;
  adminEditModel = { alias: '', nombre: '', apellidos: '', email: '', foto: null as string | null, fotoPreviewUrl: null as string | null, departamento: '' };
  adminAliasTaken = false;
  adminAliasCheck$ = new Subject<string>();
  adminFieldErrors: Record<string, string> = {};
  isAdminFormValid = false;

  // --- Crear Admin ---
  showCreateAdminModal = false;
  pedirPwdAdminForModal = false;
  crearAdmin = { nombre: '', apellidos: '', alias: '', email: '', pwd: '', pwd2: '', departamento: '', foto: '', fechaNac: '' };
  aliasAvailable: boolean | null = null;

  // --- Confirm genérico ---
  showConfirmModal = false;
  confirmKind: ConfirmKind | null = null;
  targetUser: AppUser | null = null;

  constructor(
    private readonly api: AuthService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.recompute());
  }

  // ------------------------- Ciclo de vida -------------------------
  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.api.getCurrentUser?.() ?? safeGetUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.fetchAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ------------------------- Header/usuario logueado -------------------------
  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = mapRoleToLabel(user.role);
    this.userInitials = getInitials(this.userName);
    const foto = (user as any)?.foto?.toString()?.trim() || '';
    this.userAvatarUrl = foto || null;
  }

  onAvatarError(): void { this.userAvatarUrl = null; }

  // ------------------------- Navegación -------------------------
  goToUsuarioReadOnly(): void {
    localStorage.setItem('users_readonly_mode', '1');
    localStorage.setItem('users_readonly_from_admin', '1');
    this.router.navigate(['/usuarioReadOnly'], { queryParams: { modoLectura: 1, from: 'admin' }, state: { fromAdmin: true } });
  }
  exitReadOnlyEverywhere(): void { localStorage.removeItem('users_readonly_mode'); this.router.navigateByUrl('/admin'); }

  // ------------------------- Filtros & Paginación -------------------------
  get filteredUsers(): AppUser[] { return filterUsers(this.users, this.filtros); }
  get totalPages() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }
  get pageItems(): AppUser[] { const start = (this.page - 1) * this.pageSize; return this.filteredUsers.slice(start, start + this.pageSize); }

  onFiltroChange() { this.page = 1; this.searchChanged$.next(); }
  onOrderChange() { this.onFiltroChange(); }
  recompute() { /* forzar getters */ void this.filteredUsers; }
  goto(p: number) { if (p >= 1 && p <= this.totalPages) this.page = p; }

  // ------------------------- Carga de datos -------------------------
  fetchAll() {
    this.loading = true; this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.users = (list ?? []).map(u => ({ ...u, fotoUrl: u.foto ? `${window.location.origin}/${u.foto}` : null }));
        this.loading = false;
      },
      error: (err) => { this.loading = false; this.errorMsg = err?.error?.message || 'Error cargando usuarios'; }
    });
  }

  // ------------------------- Edición usuario/gestor -------------------------
  openEditModal(u: AppUser) {
    this.editingUser = u;
    const toDateInput = (iso?: string | null) => !iso ? '' : (iso.length > 10 ? iso.slice(0,10) : iso);
    const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;
    this.editModel = {
      alias: u.alias ?? '', nombre: u.nombre ?? '', apellidos: u.apellidos ?? '',
      descripcion: (u as any).descripcion ?? null, especialidad: (u as any).especialidad ?? '',
      email: u.email ?? '', fechaNac: u.role === 'USUARIO' ? toDateInput(fn) : '',
      foto: u.fotoUrl ?? null, fotoPreviewUrl: u.fotoUrl ?? null,
    };
    this.showEditModal = true;

    // Debounce alias tomado sólo en este modal
    this.aliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(value => {
      const alias = (value || '').trim().toLowerCase();
      const currentId = this.editingUser?.id;
      this.aliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
    });
    this.aliasCheck$.next(this.editModel.alias);
  }

  cancelEdit() { this.showEditModal = false; this.editingUser = null; this.aliasTaken = false; this.showAvatarPicker = false; }

  onAliasInput(v: string) {
    const alias = (v || '').trim();
    if (alias.length < 3 || alias.length > 12) { this.aliasError = `⚠️ El alias debe tener entre ${ALIAS_MIN} y ${LIM.alias} caracteres.`; this.aliasTaken = false; return; }
    this.aliasError = null; this.aliasChecking = true;
    this.api.checkAlias(alias).subscribe({
      next: res => { this.aliasTaken = !res.available; if (this.aliasTaken) this.aliasError = '⚠️ Alias en uso'; this.aliasChecking = false; },
      error: () => { this.aliasTaken = false; this.aliasChecking = false; }
    });
  }

  onFechaNacInput(value: string) { this.fechaNacError = validarFechaNacMinima(value); }

  openAvatarModal()  { this.showAvatarPicker = true; }
  closeAvatarModal() { this.showAvatarPicker = false; }
  selectAvatar(path: string) {
    if (this.showEditAdminModal) { this.adminEditModel.foto = path; this.adminEditModel.fotoPreviewUrl = path; }
    else if (this.showEditModal) { this.editModel.foto = path; this.editModel.fotoPreviewUrl = path; }
    this.closeAvatarModal();
  }

  private buildEditDto(u: AppUser) {
    const m = this.editModel; const dto: any = {};
    addIfChanged(dto, 'alias', (m.alias ?? '').trim(), u.alias ?? '');
    addIfChanged(dto, 'nombre', (m.nombre ?? '').trim(), u.nombre ?? '');
    addIfChanged(dto, 'apellidos', (m.apellidos ?? '').trim(), u.apellidos ?? '');
    addIfChanged(dto, 'email', (m.email ?? '').trim(), u.email ?? '');
    addIfChanged(dto, 'foto', m.foto ?? null, (u as any).fotoUrl ?? null);
    if (u.role === 'GESTOR_CONTENIDO') {
      addIfChanged(dto, 'descripcion', (m.descripcion ?? '').trim(), (u as any).descripcion ?? '');
      addIfChanged(dto, 'especialidad', (m.especialidad ?? '').trim(), (u as any).especialidad ?? '');
    } else if (u.role === 'USUARIO') {
      const fn = (m.fechaNac ?? '').trim(); if (fn) dto.fechaNac = fn;
    }
    return dto;
  }

  private getEditObservable(u: AppUser, dto: any): Observable<any> | null {
    if (u.role === 'GESTOR_CONTENIDO') return this.api.updateCreator(u.id, dto);
    if (u.role === 'USUARIO') return this.api.updateUser(u.id, dto);
    return null;
  }

  saveEdit(form: NgForm) {
    if (!this.editingUser || form.invalid || this.aliasTaken) return;
    const u = this.editingUser;
    const vErr = validateEditModelPure(u.role, this.editModel);
    if (vErr) { this.errorMsg = vErr; return; }
    const dto = this.buildEditDto(u);
    if (isEmpty(dto)) { this.cancelEdit(); return; }
    const obs = this.getEditObservable(u, dto);
    if (!obs) return;
    this.loading = true;
    obs.subscribe({
      next: (upd: any) => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false; this.showEditModal = false; this.cancelEdit();
        Swal.fire({ icon: 'success', title: `${u.role} modificado correctamente`, showConfirmButton: false, timer: 2000, timerProgressBar: true, position: 'center' }).then(() => window.location.reload());
      },
      error: (err: any) => { this.loading = false; this.errorMsg = err?.error?.message || 'Error al actualizar'; }
    });
  }

  // ------------------------- Edición Admin -------------------------
  openEditAdminModal(u: AppUser) {
    if (u.role !== 'ADMINISTRADOR' || isSuperAdmin(u)) return;
    this.editingAdmin = u;
    this.adminEditModel = { alias: u.alias ?? '', nombre: u.nombre ?? '', apellidos: u.apellidos ?? '', email: u.email ?? '', foto: u.fotoUrl ?? null, fotoPreviewUrl: u.fotoUrl ?? null, departamento: (u as any).departamento ?? '' };
    this.showEditAdminModal = true;

    this.adminAliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(value => {
      const alias = (value || '').trim().toLowerCase();
      const currentId = this.editingAdmin?.id;
      this.adminAliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === alias && u2.id !== currentId);
      this.validateAdminForm();
    });
    this.adminAliasCheck$.next(this.adminEditModel.alias);
  }

  onAdminAliasInput(v: string) { this.adminAliasCheck$.next(v); }
  onAdminApellidosInput(v: string) { this.adminEditModel.apellidos = v; this.validateAdminForm(); }
  onAdminDepartamentoInput(v: string) { this.adminEditModel.departamento = v; this.validateAdminForm(); }
  onAdminNameInput(v: string) { this.adminEditModel.nombre = v; this.validateAdminForm(); }
  onAdminEmailInput(v: string) { this.adminEditModel.email = v; this.validateAdminForm(); }

  validateAdminForm() {
    const res = validateAdminFormPure(this.adminEditModel, this.adminAliasTaken);
    this.adminFieldErrors = res.errors; this.isAdminFormValid = res.ok;
  }

  cancelEditAdmin() { this.showEditAdminModal = false; this.editingAdmin = null; this.adminAliasTaken = false; }

  saveAdminEdit(form: NgForm) {
    if (!this.editingAdmin || this.editingAdmin.role !== 'ADMINISTRADOR' || isSuperAdmin(this.editingAdmin)) return;
    if (form.invalid || !this.isAdminFormValid) return;
    const u = this.editingAdmin; const dto: any = {};
    const m = this.adminEditModel;
    addIfChanged(dto, 'nombre', m.nombre.trim(), u.nombre ?? '');
    addIfChanged(dto, 'apellidos', m.apellidos.trim(), u.apellidos ?? '');
    addIfChanged(dto, 'email', m.email.trim(), u.email ?? '');
    dto.foto = m.foto ?? null; // permitir borrar/actualizar
    addIfChanged(dto, 'departamento', (m.departamento ?? '').trim(), (u as any).departamento ?? '');

    if (isEmpty(dto)) { this.cancelEditAdmin(); return; }
    this.loading = true;
    this.api.updateAdmin(u.id, dto).subscribe({
      next: (upd) => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false; this.cancelEditAdmin();
        Swal.fire({ icon: 'success', title: '¡Administrador actualizado!', text: 'Los cambios se han guardado correctamente.', confirmButtonText: 'Aceptar', customClass: { confirmButton: 'btn btn-primary' }, buttonsStyling: false }).then(() => window.location.reload());
      },
      error: (err) => { this.loading = false; this.errorMsg = err?.error?.message || 'Error al actualizar administrador'; }
    });
  }

  // ------------------------- Confirmaciones (block/unblock/delete) -------------------------
  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (!(u.role === 'GESTOR_CONTENIDO' || u.role === 'ADMINISTRADOR' || u.role === 'USUARIO')) return;
    if (isSuperAdmin(u)) return;
    this.confirmKind = kind; this.targetUser = u; this.showConfirmModal = true;
  }
  cancelConfirm() { this.showConfirmModal = false; this.confirmKind = null; this.targetUser = null; }

  confirmAction() {
    if (!this.targetUser || !this.confirmKind) return;
    const u = this.targetUser; if (isSuperAdmin(u)) { this.cancelConfirm(); return; }
    const obs = actionObservable(this.api, u, this.confirmKind);
    if (!obs) return;
    this.loading = true;
    obs.subscribe({
      next: (res: Partial<AppUser> | void) => {
        if (this.confirmKind === 'delete') this.users = this.users.filter(x => x.id !== u.id);
        else { const i = this.users.findIndex(x => x.id === u.id); if (i >= 0 && res) this.users[i] = { ...(this.users[i]), ...(res as any) }; }
        this.loading = false; this.cancelConfirm();
      },
      error: (err: any) => { this.loading = false; this.errorMsg = err?.error?.message || 'Operación no realizada'; this.cancelConfirm(); }
    });
  }

  // ------------------------- Acciones rápidas desde lista -------------------------
  editUser(u: AppUser) { if (isSuperAdmin(u)) return; if (u.role === 'GESTOR_CONTENIDO' || u.role === 'USUARIO') this.openEditModal(u); else if (u.role === 'ADMINISTRADOR') this.openEditAdminModal(u); }
  toggleBlockUser(u: AppUser) { if (isSuperAdmin(u)) return; this.openConfirm(u.blocked ? 'unblock' : 'block', u); }
  deleteUser(u: AppUser) { if (isSuperAdmin(u)) return; this.openConfirm('delete', u); }

  // Atajos legacy para plantillas ya existentes
  editar(u: AppUser)      { this.editUser(u); }
  toggleBlock(u: AppUser) { this.toggleBlockUser(u); }
  eliminar(u: AppUser)    { this.deleteUser(u); }

  // ------------------------- Crear Admin -------------------------
  openCreateAdmin() { this.pedirPwdAdminForModal = true; this.showCreateAdminModal = true; }
  cancelCreateAdmin() { this.showCreateAdminModal = false; this.pedirPwdAdminForModal = false; }
  get pwdMismatchCreate(): boolean { return !!this.crearAdmin.pwd && !!this.crearAdmin.pwd2 && this.crearAdmin.pwd !== this.crearAdmin.pwd2; }

  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable === false) return;
    const body = {
      nombre: this.crearAdmin.nombre.trim(), apellidos: this.crearAdmin.apellidos.trim(), alias: this.crearAdmin.alias.trim(),
      email: this.crearAdmin.email.trim(), pwd: this.crearAdmin.pwd, pwd2: this.crearAdmin.pwd2,
      foto: this.crearAdmin.foto?.trim() || undefined, departamento: this.crearAdmin.departamento.trim(),
      fechaNac: this.crearAdmin.fechaNac?.trim() || undefined
    };
    this.loading = true;
    this.api.createAdminByAdmin(body).subscribe({
      next: () => { this.loading = false; this.showCreateAdminModal = false; this.resetCreateAdmin(); this.fetchAll(); },
      error: err => { this.loading = false; this.errorMsg = err?.error?.message || 'No se pudo crear el administrador'; }
    });
  }
  private resetCreateAdmin() { this.crearAdmin = { nombre: '', apellidos: '', alias: '', email: '', pwd: '', pwd2: '', departamento: '', foto: '', fechaNac: '' }; this.aliasAvailable = null; this.aliasChecking = false; }
  onAdminCreado() { this.showCreateAdminModal = false; this.pedirPwdAdminForModal = false; this.fetchAll(); }

  // ------------------------- Utilidades de plantilla -------------------------
  trackUser = (_: number, u: AppUser) => u.id;

  // ------------------------- Sesión -------------------------
  cerrarSesion(): void {
    Swal.fire({ title: '¿Seguro que deseas cerrar sesión?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar', reverseButtons: true })
      .then((result) => {
        if (result.isConfirmed) {
          this.auth.logout?.();
          localStorage.removeItem('user');
          Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false });
          this.router.navigateByUrl('/auth/login', { replaceUrl: true });
        }
      });
  }
}
