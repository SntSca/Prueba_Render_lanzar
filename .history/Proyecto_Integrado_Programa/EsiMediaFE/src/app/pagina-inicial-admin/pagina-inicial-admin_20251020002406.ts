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
  private static readonly ROLE_LABELS: Record<Role, string> = { ADMINISTRADOR: 'Administrador', USUARIO: 'Usuario', GESTOR_CONTENIDO: 'Gestor de contenido' };
  private static readonly EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private static trimLower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  private static trimSafe = (s: string | null | undefined) => (s ?? '').trim();
  private static withinLen(v: string, min: number, max: number) { return v.length >= min && v.length <= max; }
  private static overMax(v: string, max: number) { return !!v && v.length > max; }
  private static toDateInput(iso?: string | null) { return !iso ? '' : (iso.length > 10 ? iso.slice(0, 10) : iso); }
  private static calcEdad(fechaISO: string) { const f = new Date(fechaISO), h = new Date(); let e = h.getFullYear() - f.getFullYear(); const m = h.getMonth() - f.getMonth(), d = h.getDate() - f.getDate(); if (m < 0 || (m === 0 && d < 0)) e--; return { edad: e, futura: f > h }; }

  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userFotoUrl: string | null = null;
  userAvatarUrl: string | null = null;

  filtros = { nombre: '', bloqueado: '' as EstadoFiltro, tipo: '' as TipoFiltro, vip: '' as VipFiltro, ordenar: 'fecha' as 'fecha'|'nombre'|'rol'|'vip' };
  page = 1;
  pageSize = 10;
  loading = false;
  errorMsg = '';
  users: AppUser[] = [];

  crearAdmin = { nombre: '', apellidos: '', alias: '', email: '', pwd: '', pwd2: '', departamento: '', foto: '', fechaNac: '' };
  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  get pwdMismatchCreate(): boolean { return !!this.crearAdmin.pwd && !!this.crearAdmin.pwd2 && this.crearAdmin.pwd !== this.crearAdmin.pwd2; }

  showEditModal = false;
  editingUser: AppUser | null = null;
  editModel = { alias: '', nombre: '', apellidos: '', descripcion: null as string | null, especialidad: '', email: '', fechaNac: '', foto: null as string | null, fotoPreviewUrl: null as string | null };
  aliasError: string | null = null;
  aliasCheck$ = new Subject<string>();
  aliasTaken = false;

  showEditAdminModal = false;
  editingAdmin: AppUser | null = null;
  adminEditModel = { alias: '', nombre: '', apellidos: '', email: '', foto: null as string | null, fotoPreviewUrl: null as string | null, departamento: '' };
  adminAliasCheck$ = new Subject<string>();
  adminAliasTaken = false;
  adminFieldErrors: Record<string, string> = {};
  isAdminFormValid = false;

  showConfirmModal = false;
  confirmKind: ConfirmKind | null = null;
  targetUser: AppUser | null = null;

  fechaNacError: string | null = null;
  avatars: string[] = ['assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png','assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'];
  showAvatarPicker = false;
  showCreateModal = false;
  pedirPwdAdminForModal = false;
  showCreateAdminModal = false;

  private readonly searchChanged$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly api: AuthService, private readonly auth: AuthService, private readonly router: Router) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => { const _ = this.filteredUsers; });
    this.aliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(v => {
      const a = PaginaInicialAdmin.trimLower(v), id = this.editingUser?.id;
      this.aliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === a && u2.id !== id);
    });
    this.adminAliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(v => {
      const a = PaginaInicialAdmin.trimLower(v), id = this.editingAdmin?.id;
      this.adminAliasTaken = !!this.users.find(u2 => u2.alias?.toLowerCase() === a && u2.id !== id);
      this.validateAdminForm();
    });
  }

  ngOnInit(): void {
    const s = (history.state?.user ?? null) as UserDto | null;
    const sess = this.api.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(s ?? sess ?? null);
    this.fetchAll();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  onAvatarError(): void { this.userAvatarUrl = null; }
  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre; this.userEmail = user.email; this.userRole = PaginaInicialAdmin.ROLE_LABELS[user.role] ?? 'Desconocido';
    this.userInitials = this.getInitials(this.userName);
    const foto = (user as any)?.foto?.toString()?.trim() || ''; this.userAvatarUrl = foto || null;
  }
  private getUserFromLocalStorage(): UserDto | null {
    try { const raw = localStorage.getItem('user'); if (!raw) return null; const parsed = JSON.parse(raw) as Partial<UserDto>; return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null; }
    catch { return null; }
  }
  getInitials(nombre: string): string { const s=(nombre||'').trim(); return s? s.split(/\s+/).map(p=>p[0]).join('').toUpperCase() : 'U'; }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }
  get pageItems(): AppUser[] { const start = (this.page - 1) * this.pageSize; return this.filteredUsers.slice(start, start + this.pageSize); }

  private pipe<T>(x: T, ...fns: Array<(v: T) => T>): T { return fns.reduce((v, f) => f(v), x); }
  private filterByQuery = (d: AppUser[]) => {
    const q = PaginaInicialAdmin.trimSafe(this.filtros.nombre).toLowerCase();
    return !q ? d : d.filter(u => [u.alias,u.nombre,u.apellidos,u.email].some(x => (x||'').toLowerCase().includes(q)));
  };
  private filterByBlocked = (d: AppUser[]) => this.filtros.bloqueado === '' ? d : d.filter(u => !!u.blocked === (this.filtros.bloqueado === 'si'));
  private filterByTipo = (d: AppUser[]) => this.filtros.tipo ? d.filter(u => u.role === this.filtros.tipo) : d;
  private filterByVip = (d: AppUser[]) => this.filtros.vip === '' ? d : d.filter(u => u.role === 'USUARIO' && (!!u.vip === (this.filtros.vip === 'si')));
  private sortData = (d: AppUser[]) => {
    if (d.length < 2) return d;
    const m = {
      nombre: (a:AppUser,b:AppUser)=> (a.nombre||'').localeCompare(b.nombre||''),
      rol:    (a:AppUser,b:AppUser)=> (a.role||'').localeCompare(b.role||''),
      vip:    (a:AppUser,b:AppUser)=> Number(!!b.vip)-Number(!!a.vip),
      fecha:  (a:AppUser,b:AppUser)=> (b.createdAt||'').localeCompare(a.createdAt||'')
    } as const;
    return [...d].sort(m[this.filtros.ordenar] ?? m.fecha);
  };

  get filteredUsers(): AppUser[] {
    return this.pipe([...this.users], this.filterByQuery, this.filterByBlocked, this.filterByTipo, this.filterByVip, this.sortData);
  }

  private resetToFirstPage() { this.page = 1; this.searchChanged$.next(); }
  onSearchChange() { this.resetToFirstPage(); }
  onStateChange()  { this.resetToFirstPage(); }
  onTipoChange()   { this.resetToFirstPage(); }
  onVipChange()    { this.resetToFirstPage(); }
  onOrderChange()  { this.resetToFirstPage(); }
  goto(p: number) { if (p>=1 && p<=this.totalPages) this.page=p; }

  fetchAll() {
    this.loading = true; this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: list => { this.users = (list??[]).map(u => ({...u, fotoUrl: u.foto ? `${window.location.origin}/${u.foto}` : null})); this.loading=false; },
      error: err => { this.loading=false; this.errorMsg = err?.error?.message || 'Error cargando usuarios'; }
    });
  }

  openEditModal(u: AppUser) {
    this.editingUser = u; const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;
    this.editModel = { alias:u.alias??'', nombre:u.nombre??'', apellidos:u.apellidos??'', descripcion:(u as any).descripcion??null, especialidad:(u as any).especialidad??'', email:u.email??'', fechaNac:u.role==='USUARIO'?PaginaInicialAdmin.toDateInput(fn):'', foto:u.fotoUrl??null, fotoPreviewUrl:u.fotoUrl??null };
    this.showEditModal = true; this.aliasCheck$.next(this.editModel.alias);
  }

  onAliasInput(v: string) {
    const a = PaginaInicialAdmin.trimSafe(v);
    if (!PaginaInicialAdmin.withinLen(a,3,12)) { this.aliasError='⚠️ El alias debe tener entre 3 y 12 caracteres.'; this.aliasTaken=false; return; }
    this.aliasError=null; this.aliasChecking=true;
    this.api.checkAlias(a).subscribe({
      next: r => { this.aliasTaken = !r.available; if (this.aliasTaken) this.aliasError = '⚠️ Alias en uso'; this.aliasChecking = false; },
      error: () => { this.aliasTaken=false; this.aliasChecking=false; }
    });
  }

  openAvatarModal()  { this.showAvatarPicker = true; }
  closeAvatarModal() { this.showAvatarPicker = false; }
  selectAvatar(path: string) {
    if (this.showEditAdminModal) { this.adminEditModel.foto = path; this.adminEditModel.fotoPreviewUrl = path; }
    else if (this.showEditModal) { this.editModel.foto = path; this.editModel.fotoPreviewUrl = path; }
    this.closeAvatarModal();
  }

  cancelEdit() { this.showEditModal=false; this.editingUser=null; this.aliasTaken=false; this.showAvatarPicker=false; }

  private addIfChanged(target: any, key: string, next: any, prev: any) { const has = next!==null && next!==undefined && String(next).trim()!==''; if (has && next!==prev) target[key]=next; }
  private applyRoleSpecific(u: AppUser, dto: any) {
    if (u.role==='GESTOR_CONTENIDO') {
      const d=PaginaInicialAdmin.trimSafe(this.editModel.descripcion), e=PaginaInicialAdmin.trimSafe(this.editModel.especialidad);
      this.addIfChanged(dto,'descripcion',d,(u as any).descripcion??''); this.addIfChanged(dto,'especialidad',e,(u as any).especialidad??'');
      return;
    }
    if (u.role==='USUARIO') { const fn=PaginaInicialAdmin.trimSafe(this.editModel.fechaNac); if (fn) dto.fechaNac=fn; }
  }
  private buildEditDto(u: AppUser) {
    const m=this.editModel, dto:any={};
    this.addIfChanged(dto,'alias',PaginaInicialAdmin.trimSafe(m.alias),u.alias??'');
    this.addIfChanged(dto,'nombre',PaginaInicialAdmin.trimSafe(m.nombre),u.nombre??'');
    this.addIfChanged(dto,'apellidos',PaginaInicialAdmin.trimSafe(m.apellidos),u.apellidos??'');
    this.addIfChanged(dto,'email',PaginaInicialAdmin.trimSafe(m.email),u.email??'');
    this.addIfChanged(dto,'foto',m.foto??null,(u as any).fotoUrl??null);
    this.applyRoleSpecific(u,dto); return dto;
  }
  private getEditObservable(u: AppUser, dto: any) {
    return u.role === 'GESTOR_CONTENIDO' ? this.api.updateCreator(u.id, dto)
         : u.role === 'USUARIO' ? this.api.updateUser(u.id, dto)
         : null;
  }

  saveEdit(form: NgForm) {
    if (!this.editingUser || form.invalid || this.aliasTaken) return;
    const msg = this.validateEditModel(this.editingUser); if (msg) { this.errorMsg=msg; return; }
    const u=this.editingUser, dto=this.buildEditDto(u); if (!dto || !Object.keys(dto).length) { this.cancelEdit(); return; }
    this.loading=true; const obs=this.getEditObservable(u,dto); if (!obs) { this.loading=false; return; }
    obs.subscribe({ next: upd => this.onEditSuccessWithSwal(u,upd), error: err => this.onEditError(err) });
  }

  private onEditSuccessWithSwal(u: AppUser, upd: unknown) {
    this.onEditSuccess(u, upd); this.loading=false; this.showEditModal=false;
    Swal.fire({ icon:'success', title:`${u.role} modificado correctamente`, showConfirmButton:false, timer:2000, timerProgressBar:true, position:'center' }).then(()=>{ window.location.reload(); });
  }
  private onEditSuccess(u: AppUser, upd: unknown) {
    const i = this.users.findIndex(x => x.id === u.id);
    if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
    this.loading = false;
    this.cancelEdit();
  }
  private onEditError(err: any) { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar'; }

  onFechaNacInput(value: string) {
    this.fechaNacError=null; if (!value) return;
    const {edad,futura}=PaginaInicialAdmin.calcEdad(value); if (futura) { this.fechaNacError='⚠️ La fecha no puede ser futura.'; return; }
    if (edad<4) this.fechaNacError='⚠️ El usuario debe tener al menos 4 años.';
  }

  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12, descripcion: 90, especialidad: 60 };
  private readonly ALIAS_MIN = 3;

  private validateEditModel(u: AppUser): string | null {
    const alias=PaginaInicialAdmin.trimSafe(this.editModel.alias), nombre=PaginaInicialAdmin.trimSafe(this.editModel.nombre), apellidos=PaginaInicialAdmin.trimSafe(this.editModel.apellidos);
    if (alias && !PaginaInicialAdmin.withinLen(alias,this.ALIAS_MIN,this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    if (PaginaInicialAdmin.overMax(nombre,this.MAX.nombre)) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (PaginaInicialAdmin.overMax(apellidos,this.MAX.apellidos)) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (u.role!=='GESTOR_CONTENIDO') return null;
    const desc=PaginaInicialAdmin.trimSafe(this.editModel.descripcion), esp=PaginaInicialAdmin.trimSafe(this.editModel.especialidad);
    if (PaginaInicialAdmin.overMax(desc,this.MAX.descripcion)) return `La descripción supera ${this.MAX.descripcion} caracteres.`;
    if (PaginaInicialAdmin.overMax(esp,this.MAX.especialidad)) return `La especialidad supera ${this.MAX.especialidad} caracteres.`;
    return null;
  }

  openEditAdminModal(u: AppUser) {
    if (u.role!=='ADMINISTRADOR' || this.isSuperAdmin(u)) return;
    this.editingAdmin=u;
    this.adminEditModel={ alias:u.alias??'', nombre:u.nombre??'', apellidos:u.apellidos??'', email:u.email??'', foto:u.fotoUrl??null, fotoPreviewUrl:u.fotoUrl??null, departamento:(u as any).departamento??'' };
    this.showEditAdminModal=true; this.adminAliasCheck$.next(this.adminEditModel.alias);
  }
  onAdminAliasInput(v: string) { this.adminAliasCheck$.next(v); }
  onAdminApellidosInput(v: string){ this.updateAdminFieldAndValidate('apellidos',v); }
  onAdminDepartamentoInput(v: string){ this.updateAdminFieldAndValidate('departamento',v); }
  onAdminNameInput(v: string){ this.updateAdminFieldAndValidate('nombre',v); }
  onAdminEmailInput(v: string){ this.updateAdminFieldAndValidate('email',v); }
  private updateAdminFieldAndValidate<K extends keyof typeof this.adminEditModel>(k: K, v: string) { (this.adminEditModel[k] as any)=v; this.validateAdminForm(); }
  cancelEditAdmin() { this.showEditAdminModal=false; this.editingAdmin=null; this.adminAliasTaken=false; }

  validateAdminForm() {
    const MAX={nombre:100,apellidos:100,alias:12,departamento:120}, MIN=3;
    const f={ alias:PaginaInicialAdmin.trimSafe(this.adminEditModel.alias), nombre:PaginaInicialAdmin.trimSafe(this.adminEditModel.nombre), apellidos:PaginaInicialAdmin.trimSafe(this.adminEditModel.apellidos), email:PaginaInicialAdmin.trimSafe(this.adminEditModel.email), departamento:PaginaInicialAdmin.trimSafe(this.adminEditModel.departamento) };
    const e:Record<string,string> = {};
    if (f.alias) {
      if (!PaginaInicialAdmin.withinLen(f['alias'], MIN, MAX['alias'])) e['alias'] = `El alias debe tener entre ${MIN} y ${MAX['alias']} caracteres.`;
      if (!e['alias'] && this.adminAliasTaken) e['alias'] = 'El alias ya está en uso.';
    }
    if (!f['nombre']) e['nombre'] = 'El nombre es obligatorio.'; else if (PaginaInicialAdmin.overMax(f['nombre'], MAX['nombre'])) e['nombre'] = `El nombre supera ${MAX['nombre']} caracteres.`;
    if (PaginaInicialAdmin.overMax(f['apellidos'], MAX.apellidos)) e['apellidos'] = `Los apellidos superan ${MAX.apellidos} caracteres.`;
    if (!f['email']) e['email'] = 'El email es obligatorio.'; else if (!PaginaInicialAdmin.EMAIL_RE.test(f['email'])) e['email'] = 'Email no válido.';
    if (PaginaInicialAdmin.overMax(f.departamento,MAX.departamento)) e.departamento = `El departamento supera ${MAX.departamento} caracteres.`;
    this.adminFieldErrors=e; this.isAdminFormValid=!Object.keys(e).length;
  }

  saveAdminEdit(form: NgForm) {
    const u=this.editingAdmin;
    if (!u || u.role!=='ADMINISTRADOR' || this.isSuperAdmin(u) || form.invalid || !this.isAdminFormValid) return;
    const nombre=PaginaInicialAdmin.trimSafe(this.adminEditModel.nombre), apellidos=PaginaInicialAdmin.trimSafe(this.adminEditModel.apellidos), email=PaginaInicialAdmin.trimSafe(this.adminEditModel.email), foto=this.adminEditModel.foto??null, dep=PaginaInicialAdmin.trimSafe(this.adminEditModel.departamento);
    const dto: any = {};
    if (nombre && nombre !== u.nombre) dto.nombre = nombre;
    if (apellidos !== (u.apellidos ?? '')) dto.apellidos = apellidos;
    if (email && email !== u.email) dto.email = email;
    dto.foto = foto;
    if (dep && dep !== ((u as any).departamento ?? '')) dto.departamento = dep;
    if (!Object.keys(dto).length) { this.cancelEditAdmin(); return; }
    this.loading=true;
    this.api.updateAdmin(u.id,dto).subscribe({
      next: upd => {
        const i = this.users.findIndex(x => x.id === u.id);
        if (i >= 0) this.users[i] = { ...(this.users[i]), ...(upd as any) };
        this.loading = false;
        this.cancelEditAdmin();
        Swal.fire({ icon: 'success', title: '¡Administrador actualizado!', text: 'Los cambios se han guardado correctamente.', confirmButtonText: 'Aceptar', customClass: { confirmButton: 'btn btn-primary' }, buttonsStyling: false }).then(() => { window.location.reload(); });
      },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar administrador'; }
    });
  }

  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (!(this.isCreator(u)||this.isAdmin(u)||this.isUser(u))) return;
    this.confirmKind=kind; this.targetUser=u; this.showConfirmModal=true;
  }
  cancelConfirm() { this.showConfirmModal=false; this.confirmKind=null; this.targetUser=null; }

  private resolveAction(u: AppUser, k: ConfirmKind) {
    const m:Record<AppUser['role'],Record<ConfirmKind,()=>any>>={
      GESTOR_CONTENIDO:{ block:()=>this.api.blockCreator(u.id), unblock:()=>this.api.unblockCreator(u.id), delete:()=>this.api.deleteCreator(u.id) },
      ADMINISTRADOR:{ block:()=>this.api.blockAdmin(u.id), unblock:()=>this.api.unblockAdmin(u.id), delete:()=>this.api.deleteAdmin(u.id) },
      USUARIO:{ block:()=>this.api.blockUser(u.id), unblock:()=>this.api.unblockUser(u.id), delete:()=>this.api.deleteUser(u.id) }
    }; return m[u.role]?.[k]?.();
  }
  confirmAction() {
    if (!this.targetUser || !this.confirmKind || this.isSuperAdmin(this.targetUser)) { this.cancelConfirm(); return; }
    this.loading=true; const obs=this.resolveAction(this.targetUser,this.confirmKind); if (!obs) { this.loading=false; return; }
    obs.subscribe({ next: (res: Partial<AppUser> | void) => this.onConfirmSuccess(this.targetUser!,this.confirmKind!,res), error: (err: any) => this.onConfirmError(err) });
  }
  private onConfirmSuccess(u: AppUser, k: ConfirmKind, res: Partial<AppUser>|void) {
    if (k==='delete') this.users=this.users.filter(x=>x.id!==u.id);
    else { const i=this.users.findIndex(x=>x.id===u.id); if (i>=0 && res) this.users[i]={...(this.users[i]), ...(res as any)}; }
    this.loading=false; this.cancelConfirm();
  }
  private onConfirmError(err:any) { this.loading=false; this.errorMsg=err?.error?.message||'Operación no realizada'; this.cancelConfirm(); }

  goToUsuarioReadOnly(): void { localStorage.setItem('users_readonly_mode','1'); localStorage.setItem('users_readonly_from_admin','1'); this.router.navigate(['/usuarioReadOnly'],{ queryParams:{ modoLectura:1, from:'admin' }, state:{ fromAdmin:true } }); }
  exitReadOnlyEverywhere(): void { localStorage.removeItem('users_readonly_mode'); this.router.navigateByUrl('/admin'); }

  editUser(u: AppUser) {
    if (this.isSuperAdmin(u)) return;
    if (this.isCreator(u) || this.isUser(u)) this.openEditModal(u);
    else if (this.isAdmin(u)) this.openEditAdminModal(u);
  }
  toggleBlockUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm(u.blocked?'unblock':'block',u); }
  deleteUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm('delete',u); }

  editar(u: AppUser) { this.openEditModal(u); }
  toggleBlock(u: AppUser) { this.openConfirm(u.blocked?'unblock':'block',u); }
  eliminar(u: AppUser) { this.openConfirm('delete',u); }

  isCreator(u: AppUser) { return u.role==='GESTOR_CONTENIDO'; }
  isAdmin(u: AppUser) { return u.role==='ADMINISTRADOR'; }
  isUser(u: AppUser) { return u.role==='USUARIO'; }
  isSuperAdmin(u: AppUser) { return this.isAdmin(u) && (u.email||'').toLowerCase()===this.SUPER_ADMIN_EMAIL.toLowerCase(); }

  openCreate() { this.showCreateModal = true; }
  cancelCreate() { this.showCreateModal = false; }
  onCreadorCreado() { this.showCreateModal=false; this.fetchAll(); }

  openCreateAdmin() { this.pedirPwdAdminForModal=true; this.showCreateAdminModal=true; }
  cancelCreateAdmin() { this.showCreateAdminModal=false; this.pedirPwdAdminForModal=false; }

  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable===false) return;
    const b={ nombre:PaginaInicialAdmin.trimSafe(this.crearAdmin.nombre), apellidos:PaginaInicialAdmin.trimSafe(this.crearAdmin.apellidos), alias:PaginaInicialAdmin.trimSafe(this.crearAdmin.alias), email:PaginaInicialAdmin.trimSafe(this.crearAdmin.email), pwd:this.crearAdmin.pwd, pwd2:this.crearAdmin.pwd2, foto:PaginaInicialAdmin.trimSafe(this.crearAdmin.foto)||undefined, departamento:PaginaInicialAdmin.trimSafe(this.crearAdmin.departamento), fechaNac:PaginaInicialAdmin.trimSafe(this.crearAdmin.fechaNac)||undefined };
    this.loading=true;
    this.api.createAdminByAdmin(b).subscribe({
      next: () => { this.loading=false; this.showCreateAdminModal=false; this.resetCreateAdmin(); this.fetchAll(); },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'No se pudo crear el administrador'; }
    });
  }
  private resetCreateAdmin() { this.crearAdmin={ nombre:'', apellidos:'', alias:'', email:'', pwd:'', pwd2:'', departamento:'', foto:'', fechaNac:'' }; this.aliasAvailable=null; this.aliasChecking=false; }

  onAdminCreado() { this.showCreateAdminModal=false; this.pedirPwdAdminForModal=false; this.fetchAll(); }

  trackUser = (_: number, u: AppUser) => u.id;

  cerrarSesion(): void {
    Swal.fire({ title:'¿Seguro que deseas cerrar sesión?', icon:'warning', showCancelButton:true, confirmButtonText:'Sí, cerrar sesión', cancelButtonText:'Cancelar', reverseButtons:true })
      .then(r => {
        if (!r.isConfirmed) return;
        this.auth.logout?.(); localStorage.removeItem('user');
        Swal.fire({ title:'Sesión cerrada correctamente.', icon:'success', timer:1500, showConfirmButton:false });
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      });
  }
}
