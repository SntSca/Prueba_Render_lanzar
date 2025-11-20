import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppUser, Role, UserDto } from '../auth/models';
import { Registro } from '../registro/registro';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

// =================== Tipos ===================
type EstadoFiltro = '' | 'si' | 'no';
type TipoFiltro = '' | Role;
type VipFiltro = '' | 'si' | 'no';
type ConfirmKind = 'block' | 'unblock' | 'delete';
type Orden = 'fecha'|'nombre'|'rol'|'vip';

// =================== Helpers puros (sin this) ===================
const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  USUARIO: 'Usuario',
  GESTOR_CONTENIDO: 'Gestor de contenido'
};
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const trimSafe   = (s: unknown) => (typeof s === 'string' ? s : '').trim();
const trimLower  = (s: unknown) => trimSafe(s).toLowerCase();
const withinLen  = (v: string, min: number, max: number) => v.length >= min && v.length <= max;
const overMax    = (v: string, max: number) => !!v && v.length > max;
const toDateInput= (iso?: string | null) => !iso ? '' : (iso.length > 10 ? iso.slice(0,10) : iso);
const calcEdad   = (iso: string) => { const f=new Date(iso), h=new Date(); let e=h.getFullYear()-f.getFullYear(); const m=h.getMonth()-f.getMonth(), d=h.getDate()-f.getDate(); if (m<0||(m===0&&d<0)) e--; return {edad:e, futura:f>h}; };
const initials   = (name: string) => { const s=trimSafe(name); return s? s.split(/\s+/).map(p=>p[0]).join('').toUpperCase():'U'; };

const fotoUrlFrom = (u: AppUser) => u.foto ? `${window.location.origin}/${u.foto}` : null;

const sortBy: Record<Orden,(a:AppUser,b:AppUser)=>number> = {
  nombre: (a,b)=> (a.nombre||'').localeCompare(b.nombre||''),
  rol:    (a,b)=> (a.role||'').localeCompare(b.role||''),
  vip:    (a,b)=> Number(!!b.vip) - Number(!!a.vip),
  fecha:  (a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')
};

function matchesFilters(u: AppUser, f: {nombre:string; bloqueado:EstadoFiltro; tipo:TipoFiltro; vip:VipFiltro}): boolean {
  const q = trimLower(f.nombre);
  const okQuery   = !q || [u.alias,u.nombre,u.apellidos,u.email].some(x => trimLower(x).includes(q));
  const okBlocked = f.bloqueado==='' ? true : (!!u.blocked === (f.bloqueado==='si'));
  const okTipo    = !f.tipo || u.role === f.tipo;
  const okVip     = f.vip==='' ? true : (u.role==='USUARIO' && (!!u.vip === (f.vip==='si')));
  return okQuery && okBlocked && okTipo && okVip;
}

function addIfChanged(target: any, key: string, next: any, prev: any) {
  const has = next!==null && next!==undefined && String(next).trim()!=='';
  if (has && next!==prev) target[key]=next;
}

function buildUserDto(u: AppUser, m: any): any {
  const dto:any = {};
  addIfChanged(dto,'alias',     trimSafe(m.alias),     u.alias??'');
  addIfChanged(dto,'nombre',    trimSafe(m.nombre),    u.nombre??'');
  addIfChanged(dto,'apellidos', trimSafe(m.apellidos), u.apellidos??'');
  addIfChanged(dto,'email',     trimSafe(m.email),     u.email??'');
  addIfChanged(dto,'foto',      m.foto??null,          (u as any).fotoUrl??null);

  if (u.role==='GESTOR_CONTENIDO') {
    addIfChanged(dto,'descripcion', trimSafe(m.descripcion), (u as any).descripcion??'');
    addIfChanged(dto,'especialidad',trimSafe(m.especialidad),(u as any).especialidad??'');
  } else if (u.role==='USUARIO') {
    const fn=trimSafe(m.fechaNac); if (fn) dto.fechaNac=fn;
  }
  return dto;
}

function validateUserEdit(u: AppUser, m: any, MAX: any, ALIAS_MIN: number): string | null {
  const alias=trimSafe(m.alias), nombre=trimSafe(m.nombre), apellidos=trimSafe(m.apellidos);
  if (alias && !withinLen(alias,ALIAS_MIN,MAX.alias)) return `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
  if (overMax(nombre,MAX.nombre)) return `El nombre supera ${MAX.nombre} caracteres.`;
  if (overMax(apellidos,MAX.apellidos)) return `Los apellidos superan ${MAX.apellidos} caracteres.`;
  if (u.role==='GESTOR_CONTENIDO') {
    const desc=trimSafe(m.descripcion), esp=trimSafe(m.especialidad);
    if (overMax(desc,MAX.descripcion)) return `La descripción supera ${MAX.descripcion} caracteres.`;
    if (overMax(esp,MAX.especialidad)) return `La especialidad supera ${MAX.especialidad} caracteres.`;
  }
  return null;
}

function validateAdminFormModel(f: any, taken: boolean) {
  const MAX={nombre:100,apellidos:100,alias:12,departamento:120}, MIN=3;
  const data = {
    alias: trimSafe(f.alias), nombre: trimSafe(f.nombre),
    apellidos: trimSafe(f.apellidos), email: trimSafe(f.email),
    departamento: trimSafe(f.departamento)
  };
  const e:Record<string,string> = {};
  if (data.alias) {
    if (!withinLen(data.alias,MIN,MAX.alias)) e['alias']=`El alias debe tener entre ${MIN} y ${MAX.alias} caracteres.`;
    if (!e['alias'] && taken) e['alias']='El alias ya está en uso.';
  }
  if (!data.nombre) e['nombre']='El nombre es obligatorio.'; else if (overMax(data.nombre,MAX.nombre)) e['nombre']=`El nombre supera ${MAX.nombre} caracteres.`;
  if (overMax(data.apellidos,MAX.apellidos)) e['apellidos']=`Los apellidos superan ${MAX.apellidos} caracteres.`;
  if (!data.email) e['email']='El email es obligatorio.'; else if (!EMAIL_RE.test(data.email)) e['email']='Email no válido.';
  if (overMax(data.departamento,MAX.departamento)) e['departamento']=`El departamento supera ${MAX.departamento} caracteres.`;
  return { errors:e, valid:Object.keys(e).length===0 };
}


// =================== Componente ===================
@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Registro],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit, OnDestroy {
  // Header
  public readonly FILES_BASE = window.location.origin;
  private readonly SUPER_ADMIN_EMAIL = 'proyecto.integrado.iso@gmail.com';
  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userAvatarUrl: string | null = null;

  // Filtros / tabla
  filtros = { nombre:'', bloqueado:'' as EstadoFiltro, tipo:'' as TipoFiltro, vip:'' as VipFiltro, ordenar:'fecha' as Orden };
  page = 1;
  pageSize = 10;
  users: AppUser[] = [];
  trackUser = (_: number, u: AppUser) => u.id;

  loading = false;
  errorMsg = '';

  // Crear admin
  crearAdmin = { nombre:'', apellidos:'', email:'', pwd:'', pwd2:'', departamento:'', foto:'', fechaNac:'' };
  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  get pwdMismatchCreate() { const {pwd,pwd2}=this.crearAdmin; return !!pwd && !!pwd2 && pwd!==pwd2; }

  // Editar usuario/creador
  showEditModal = false;
  editingUser: AppUser | null = null;
  editModel = { alias:'', nombre:'', apellidos:'', descripcion:null as string|null, especialidad:'', email:'', fechaNac:'', foto:null as string|null, fotoPreviewUrl:null as string|null };
  aliasError: string | null = null;
  aliasTaken = false;

  // Editar admin
  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;
  adminEditModel = {nombre:'', apellidos:'', email:'', foto:null as string|null, fotoPreviewUrl:null as string|null, departamento:'' };
  adminAliasTaken = false;
  adminFieldErrors: Record<string,string> = {};
  isAdminFormValid = false;

  showConfirmModal = false;
  confirmKind: ConfirmKind | null = null;
  targetUser: AppUser | null = null;

  fechaNacError: string | null = null;
  avatars = ['assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png','assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'];
  showAvatarPicker = false;
  showCreateModal = false;
  pedirPwdAdminForModal = false;
  showCreateAdminModal = false;

  private readonly searchChanged$ = new Subject<void>();
  private readonly aliasCheck$ = new Subject<string>();
  private readonly adminAliasCheck$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  private readonly MAX = { nombre:100, apellidos:100, alias:12, descripcion:90, especialidad:60 };
  private readonly ALIAS_MIN = 3;

  constructor(
    private readonly api: AuthService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => { console.log(`Filtered users count: ${this.filteredUsers.length}`); });

    this.aliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(v => {
        const id = this.editingUser?.id; 
        const exists = !!this.users.find(u => (u.alias || '').toLowerCase() === v.trim().toLowerCase() && u.id !== id);
        this.aliasTaken = exists;
      });

  }


  // ===== Ciclo de vida =====
  ngOnInit(): void {
    const s = (history.state?.user ?? null) as UserDto | null;
    const sess = this.api.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.applyLoggedUser(s ?? sess ?? null);
    this.fetchAll();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ===== Sesión/Header =====
  onAvatarError() { this.userAvatarUrl = null; }
  private applyLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = trimSafe(user.nombre) || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = ROLE_LABELS[user.role] ?? 'Desconocido';
    this.userInitials = initials(nombre);
    const foto = trimSafe((user as any)?.foto);
    this.userAvatarUrl = foto || null;
  }
  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user'); if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch { return null; }
  }

  // ===== Tabla / filtros / paginación =====
  get filteredUsers(): AppUser[] {
    const out = this.users.filter(u => matchesFilters(u, this.filtros));
    if (out.length>1) out.sort(sortBy[this.filtros.ordenar]);
    return out;
  }
  get totalPages() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }
  get pageItems(): AppUser[] { const i=(this.page-1)*this.pageSize; return this.filteredUsers.slice(i,i+this.pageSize); }
  onFiltersChange() { this.page=1; this.searchChanged$.next(); }
  goto(p: number) { if (p>=1 && p<=this.totalPages) this.page=p; }

  // ===== Datos =====
  fetchAll() {
    this.loading = true; this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: list => { this.users = (list??[]).map(u => ({...u, fotoUrl: fotoUrlFrom(u)})); this.loading=false; },
      error: err => { this.loading=false; this.errorMsg = err?.error?.message || 'Error cargando usuarios'; }
    });
  }

  // ===== Edición (usuario / creador) =====
  openEditModal(u: AppUser) {
    const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;
    this.editingUser = u;
    this.editModel = {
      alias:u.alias??'', nombre:u.nombre??'', apellidos:u.apellidos??'',
      descripcion:(u as any).descripcion??null, especialidad:(u as any).especialidad??'',
      email:u.email??'', fechaNac:u.role==='USUARIO'?toDateInput(fn):'',
      foto:u.fotoUrl??null, fotoPreviewUrl:u.fotoUrl??null
    };
    this.showEditModal = true;
    this.aliasCheck$.next(this.editModel.alias);
  }

  onAliasInput(v: string) {
    const a = trimSafe(v);
    if (!withinLen(a,3,12)) { this.aliasError='⚠️ El alias debe tener entre 3 y 12 caracteres.'; this.aliasTaken=false; return; }
    this.aliasError=null; this.aliasChecking=true;
    this.api.checkAlias(a).subscribe({
      next: r => { this.aliasTaken=!r.available; if (this.aliasTaken) this.aliasError='⚠️ Alias en uso'; this.aliasChecking=false; },
      error: () => { this.aliasTaken=false; this.aliasChecking=false; }
    });
  }

  openAvatarModal()  { this.showAvatarPicker = true; }
  closeAvatarModal() { this.showAvatarPicker = false; }
  selectAvatar(path: string) {
    if (this.showEditAdminModal) { this.adminEditModel.foto = path; this.adminEditModel.fotoPreviewUrl = path; }
    else if (this.showEditModal) { this.editModel.foto  = path; this.editModel.fotoPreviewUrl  = path; }
    this.closeAvatarModal();
  }
  cancelEdit() { this.showEditModal=false; this.editingUser=null; this.aliasTaken=false; this.showAvatarPicker=false; }

  saveEdit(form: NgForm) {
    const u = this.editingUser; if (!u || form.invalid || this.aliasTaken) return;
    const msg = validateUserEdit(u, this.editModel, this.MAX, this.ALIAS_MIN);
    if (msg) { this.errorMsg=msg; return; }
    const dto = buildUserDto(u, this.editModel);
    if (!Object.keys(dto).length) { this.cancelEdit(); return; }
    const obs = u.role==='GESTOR_CONTENIDO' ? this.api.updateCreator(u.id,dto) : (u.role==='USUARIO'? this.api.updateUser(u.id,dto) : null);
    if (!obs) return;
    this.loading=true;
    obs.subscribe({
      next: upd => {
        const i=this.users.findIndex(x=>x.id===u.id);
        if (i>=0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading=false; this.cancelEdit();
        Swal.fire({ icon:'success', title:`${u.role} modificado correctamente`, showConfirmButton:false, timer:2000, timerProgressBar:true, position:'center' })
          .then(()=>window.location.reload());
      },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar'; }
    });
  }

  onFechaNacInput(value: string) {
    this.fechaNacError=null; if (!value) return;
    const {edad,futura}=calcEdad(value); if (futura) { this.fechaNacError='⚠️ La fecha no puede ser futura.'; return; }
    if (edad<4) this.fechaNacError='⚠️ El usuario debe tener al menos 4 años.';
  }

  // ===== Edición (admin) =====
  openEditAdminModal(u: AppUser) {
    if (u.role!=='ADMINISTRADOR' || this.isSuperAdmin(u)) return;
    this.editingAdmin=u;
    this.adminEditModel={nombre:u.nombre??'', apellidos:u.apellidos??'', email:u.email??'', foto:u.fotoUrl??null, fotoPreviewUrl:u.fotoUrl??null, departamento:(u as any).departamento??'' };
    const r = validateAdminFormModel(this.adminEditModel, false); this.adminFieldErrors = r.errors; this.isAdminFormValid = r.valid; this.showEditAdminModal = true;
  }
  onAdminApellidosInput(v: string)   { this.adminEditModel.apellidos   = v; }
  onAdminDepartamentoInput(v: string){ this.adminEditModel.departamento = v; }
  onAdminNameInput(v: string)        { this.adminEditModel.nombre      = v; }
  onAdminEmailInput(v: string)       { this.adminEditModel.email       = v; }
  cancelEditAdmin() {
    this.showEditAdminModal = false;
    this.editingAdmin = null;
  }


  saveAdminEdit(form: NgForm) {
    const u=this.editingAdmin; if (!u || u.role!=='ADMINISTRADOR' || this.isSuperAdmin(u) || form.invalid || !this.isAdminFormValid) return;
    const f=this.adminEditModel, dto:any={};
    addIfChanged(dto,'nombre',trimSafe(f.nombre),u.nombre??'');
    addIfChanged(dto,'apellidos',trimSafe(f.apellidos),u.apellidos??'');
    addIfChanged(dto,'email',trimSafe(f.email),u.email??'');
    addIfChanged(dto,'departamento',trimSafe(f.departamento),(u as any).departamento??'');
    addIfChanged(dto,'foto',f.foto??null,(u as any).fotoUrl??null);
    if (!Object.keys(dto).length) { this.cancelEditAdmin(); return; }
    this.loading=true;
    this.api.updateAdmin(u.id,dto).subscribe({
      next: upd => {
        const i=this.users.findIndex(x=>x.id===u.id);
        if (i>=0) this.users[i]={...(this.users[i]), ...(upd as any)};
        this.loading=false; this.cancelEditAdmin();
        Swal.fire({ icon:'success', title:'¡Administrador actualizado!', showConfirmButton:false, timer:2000, timerProgressBar:true, position:'center' })
          .then(()=>window.location.reload());
      },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar administrador'; }
    });
  }

  // ===== Confirmaciones =====
  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (!(this.isCreator(u)||this.isAdmin(u)||this.isUser(u))) return;
    this.confirmKind=kind; this.targetUser=u; this.showConfirmModal=true;
  }
  cancelConfirm() { this.showConfirmModal=false; this.confirmKind=null; this.targetUser=null; }
  confirmAction() {
    const u=this.targetUser, k=this.confirmKind;
    if (!u || !k || this.isSuperAdmin(u)) return this.cancelConfirm();
    const actions:Record<AppUser['role'],Record<ConfirmKind,()=>any>>={
      GESTOR_CONTENIDO:{ block:()=>this.api.blockCreator(u.id),  unblock:()=>this.api.unblockCreator(u.id),  delete:()=>this.api.deleteCreator(u.id) },
      ADMINISTRADOR:   { block:()=>this.api.blockAdmin(u.id),    unblock:()=>this.api.unblockAdmin(u.id),    delete:()=>this.api.deleteAdmin(u.id) },
      USUARIO:         { block:()=>this.api.blockUser(u.id),     unblock:()=>this.api.unblockUser(u.id),     delete:()=>this.api.deleteUser(u.id) }
    };
    const obs = actions[u.role]?.[k]?.(); if (!obs) return;
    this.loading=true;
    obs.subscribe({
      next: (res: Partial<AppUser>|void) => {
        if (k==='delete') this.users=this.users.filter(x=>x.id!==u.id);
        else { const i=this.users.findIndex(x=>x.id===u.id); if (i>=0 && res) this.users[i]={...(this.users[i]), ...(res as any)}; }
        this.loading=false; this.cancelConfirm();
      },
      error: (err: any) => { this.loading=false; this.errorMsg=err?.error?.message||'Operación no realizada'; this.cancelConfirm(); }
    });
  }

  // ===== Navegación =====
  goToUsuarioReadOnly() {
    localStorage.setItem('users_readonly_mode','1');
    localStorage.setItem('users_readonly_from_admin','1');
    this.router.navigate(['/usuarioReadOnly'],{ queryParams:{ modoLectura:1, from:'admin' }, state:{ fromAdmin:true } });
  }
  exitReadOnlyEverywhere() { localStorage.removeItem('users_readonly_mode'); this.router.navigateByUrl('/admin'); }

  editUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (this.isCreator(u)||this.isUser(u)) this.openEditModal(u);
    else if (this.isAdmin(u)) this.openEditAdminModal(u);
  }
  toggleBlockUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm(u.blocked?'unblock':'block',u); }
  deleteUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm('delete',u); }

  // ===== Roles =====
  isCreator = (u: AppUser) => u.role==='GESTOR_CONTENIDO';
  isAdmin   = (u: AppUser) => u.role==='ADMINISTRADOR';
  isUser    = (u: AppUser) => u.role==='USUARIO';
  isSuperAdmin = (u: AppUser) => this.isAdmin(u) && trimLower(u.email)===trimLower(this.SUPER_ADMIN_EMAIL);

  // ===== Crear admin =====
  openCreate() { this.showCreateModal = true; }
  cancelCreate() { this.showCreateModal = false; }
  onCreadorCreado() { this.showCreateModal=false; this.fetchAll(); }

  openCreateAdmin() { this.pedirPwdAdminForModal=true; this.showCreateAdminModal=true; }
  cancelCreateAdmin() { this.showCreateAdminModal=false; this.pedirPwdAdminForModal=false; }
  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable===false) return;
    const b:any = {
      nombre:trimSafe(this.crearAdmin.nombre), apellidos:trimSafe(this.crearAdmin.apellidos),email:trimSafe(this.crearAdmin.email),
      pwd:this.crearAdmin.pwd, pwd2:this.crearAdmin.pwd2,
      foto:trimSafe(this.crearAdmin.foto)||undefined,
      departamento:trimSafe(this.crearAdmin.departamento),
      fechaNac:trimSafe(this.crearAdmin.fechaNac)||undefined
    };
    this.loading=true;
    this.api.createAdminByAdmin(b).subscribe({
      next: () => { this.loading=false; this.showCreateAdminModal=false; this.resetCreateAdmin(); this.fetchAll(); },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'No se pudo crear el administrador'; }
    });
  }
  private resetCreateAdmin() {
    this.crearAdmin={ nombre:'', apellidos:'',email:'', pwd:'', pwd2:'', departamento:'', foto:'', fechaNac:'' };
  }
  onAdminCreado() { this.showCreateAdminModal=false; this.pedirPwdAdminForModal=false; this.fetchAll(); }

  // ===== Logout =====
  cerrarSesion() {
    Swal.fire({ title:'¿Seguro que deseas cerrar sesión?', icon:'warning', showCancelButton:true, confirmButtonText:'Sí, cerrar sesión', cancelButtonText:'Cancelar', reverseButtons:true })
      .then(r => {
        if (!r.isConfirmed) return;
        this.auth.logout?.(); localStorage.removeItem('user');
        Swal.fire({ title:'Sesión cerrada correctamente.', icon:'success', timer:1500, showConfirmButton:false });
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      });
  }
}
