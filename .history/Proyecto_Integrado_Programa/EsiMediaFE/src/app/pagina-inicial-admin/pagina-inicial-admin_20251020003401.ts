import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppUser, Role, UserDto } from '../auth/models';
import { Registro } from '../registro/registro';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { Debouncer, FormKit, RoleKit, UniqueKit } from '@/shared/form-kit';

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
  private debouncer = new Debouncer();

  constructor(private readonly api: AuthService, private readonly auth: AuthService, private readonly router: Router) {
    this.searchChanged$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.recompute());
    this.aliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(v => {
      const a = FormKit.lower(v); const id = this.editingUser?.id;
      this.aliasTaken = !!this.users.find(u2 => (u2.alias ?? '').toLowerCase() === a && u2.id !== id);
    });
    this.adminAliasCheck$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(v => {
      const a = FormKit.lower(v); const id = this.editingAdmin?.id;
      this.adminAliasTaken = !!this.users.find(u2 => (u2.alias ?? '').toLowerCase() === a && u2.id !== id);
      this.validateAdminForm();
    });
  }

  ngOnInit(): void {
    const s = (history.state?.user ?? null) as UserDto | null;
    const sess = this.api.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(s ?? sess ?? null);
    this.fetchAll();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); this.debouncer.clearAll(); }

  onAvatarError(): void { this.userAvatarUrl = null; }
  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = RoleKit.label(user.role);
    this.userInitials = FormKit.initials(this.userName);
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

  get totalPages() { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }
  get pageItems(): AppUser[] { const start = (this.page - 1) * this.pageSize; return this.filteredUsers.slice(start, start + this.pageSize); }

  private filterByQuery(data: AppUser[], q: string) { if (!q) return data; const t = q.toLowerCase(); return data.filter(u => [u.alias,u.nombre,u.apellidos,u.email].some(x => (x||'').toLowerCase().includes(t))); }
  private filterByBlocked(data: AppUser[], b: EstadoFiltro) { if (b==='') return data; const w=b==='si'; return data.filter(u => !!u.blocked===w); }
  private filterByTipo(data: AppUser[], t: TipoFiltro) { return t ? data.filter(u => u.role === t) : data; }
  private filterByVip(data: AppUser[], v: VipFiltro) { if (v==='') return data; const w=v==='si'; return data.filter(u => u.role==='USUARIO' && (!!u.vip===w)); }
  private getSortComparator(k: 'fecha'|'nombre'|'rol'|'vip') {
    const m = {
      nombre: (a:AppUser,b:AppUser)=> (a.nombre||'').localeCompare(b.nombre||''),
      rol:    (a:AppUser,b:AppUser)=> (a.role||'').localeCompare(b.role||''),
      vip:    (a:AppUser,b:AppUser)=> Number(!!b.vip)-Number(!!a.vip),
      fecha:  (a:AppUser,b:AppUser)=> (b.createdAt||'').localeCompare(a.createdAt||'')
    }; return m[k] || m.fecha;
  }

  get filteredUsers(): AppUser[] {
    const f=this.filtros; let d=[...this.users];
    d = this.filterByQuery(d, FormKit.trim(f.nombre));
    d = this.filterByBlocked(d, f.bloqueado);
    d = this.filterByTipo(d, f.tipo);
    d = this.filterByVip(d, f.vip);
    if (d.length>1) d.sort(this.getSortComparator(f.ordenar));
    return d;
  }

  onSearchChange() { this.page=1; this.searchChanged$.next(); }
  onStateChange()  { this.page=1; this.searchChanged$.next(); }
  onTipoChange()   { this.page=1; this.searchChanged$.next(); }
  onVipChange()    { this.page=1; this.searchChanged$.next(); }
  onOrderChange()  { this.page=1; this.searchChanged$.next(); }
  recompute() { const _ = this.filteredUsers; }
  goto(p: number) { if (p>=1 && p<=this.totalPages) this.page=p; }

  fetchAll() {
    this.loading = true; this.errorMsg = '';
    this.api.listAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: list => { this.users = (list??[]).map(u => ({...u, fotoUrl: u.foto ? `${window.location.origin}/${u.foto}` : null})); this.loading=false; },
      error: err => { this.loading=false; this.errorMsg = err?.error?.message || 'Error cargando usuarios'; }
    });
  }

  openEditModal(u: AppUser) {
    this.editingUser = u;
    const fn = (u as any).fechaNac || (u as any).fechaNacimiento || null;
    this.editModel = {
      alias:u.alias??'',
      nombre:u.nombre??'',
      apellidos:u.apellidos??'',
      descripcion:(u as any).descripcion??null,
      especialidad:(u as any).especialidad??'',
      email:u.email??'',
      fechaNac:u.role==='USUARIO'?FormKit.toDateInput(fn):'',
      foto:u.fotoUrl??null,
      fotoPreviewUrl:u.fotoUrl??null
    };
    this.showEditModal = true;
    this.aliasCheck$.next(this.editModel.alias);
  }

  onAliasInput(v: string) {
    const a = FormKit.trim(v);
    if (!FormKit.within(a,3,12)) { this.aliasError='⚠️ El alias debe tener entre 3 y 12 caracteres.'; this.aliasTaken=false; return; }
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
    if (RoleKit.isCreator(u.role)) {
      const d=FormKit.trim(this.editModel.descripcion), e=FormKit.trim(this.editModel.especialidad);
      this.addIfChanged(dto,'descripcion',d,(u as any).descripcion??''); this.addIfChanged(dto,'especialidad',e,(u as any).especialidad??'');
    } else if (RoleKit.isUser(u.role)) {
      const fn=FormKit.trim(this.editModel.fechaNac); if (fn) dto.fechaNac=fn;
    }
  }
  private buildEditDto(u: AppUser) {
    const m=this.editModel, dto:any={};
    this.addIfChanged(dto,'alias',FormKit.trim(m.alias),u.alias??'');
    this.addIfChanged(dto,'nombre',FormKit.trim(m.nombre),u.nombre??'');
    this.addIfChanged(dto,'apellidos',FormKit.trim(m.apellidos),u.apellidos??'');
    this.addIfChanged(dto,'email',FormKit.trim(m.email),u.email??'');
    this.addIfChanged(dto,'foto',m.foto??null,(u as any).fotoUrl??null);
    this.applyRoleSpecific(u,dto); return dto;
  }
  private getEditObservable(u: AppUser, dto: any) {
    if (RoleKit.isCreator(u.role)) return this.api.updateCreator(u.id, dto);
    if (RoleKit.isUser(u.role)) return this.api.updateUser(u.id, dto);
    return null;
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
    if (i >= 0) {
      this.users[i] = { ...(this.users[i]), ...(upd as any) };
      this.loading = false;
      this.cancelEdit();
    }
  }
  private onEditError(err: any) { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar'; }

  onFechaNacInput(value: string) {
    this.fechaNacError=null; if (!value) return;
    const {edad,futura}=FormKit.ageInfo(value); if (futura) { this.fechaNacError='⚠️ La fecha no puede ser futura.'; return; }
    if (edad<4) this.fechaNacError='⚠️ El usuario debe tener al menos 4 años.';
  }

  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12, descripcion: 90, especialidad: 60 };
  private readonly ALIAS_MIN = 3;

  private validateEditModel(u: AppUser): string | null {
    const alias=FormKit.trim(this.editModel.alias), nombre=FormKit.trim(this.editModel.nombre), apellidos=FormKit.trim(this.editModel.apellidos);
    if (alias && !FormKit.within(alias,this.ALIAS_MIN,this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    if (FormKit.over(nombre,this.MAX.nombre)) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (FormKit.over(apellidos,this.MAX.apellidos)) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (RoleKit.isCreator(u.role)) {
      const desc=FormKit.trim(this.editModel.descripcion), esp=FormKit.trim(this.editModel.especialidad);
      if (FormKit.over(desc,this.MAX.descripcion)) return `La descripción supera ${this.MAX.descripcion} caracteres.`;
      if (FormKit.over(esp,this.MAX.especialidad)) return `La especialidad supera ${this.MAX.especialidad} caracteres.`;
    }
    return null;
  }

  openEditAdminModal(u: AppUser) {
    if (!RoleKit.isAdmin(u.role) || this.isSuperAdmin(u)) return;
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
    const f={ alias:FormKit.trim(this.adminEditModel.alias), nombre:FormKit.trim(this.adminEditModel.nombre), apellidos:FormKit.trim(this.adminEditModel.apellidos), email:FormKit.trim(this.adminEditModel.email), departamento:FormKit.trim(this.adminEditModel.departamento) };
    const e:Record<string,string> = {};
    if (f.alias) {
      if (!FormKit.within(f.alias, MIN, MAX.alias)) e['alias'] = `El alias debe tener entre ${MIN} y ${MAX.alias} caracteres.`;
      if (!e.alias && this.adminAliasTaken) e.alias = 'El alias ya está en uso.';
    }
    if (!f.nombre) e.nombre='El nombre es obligatorio.'; else if (FormKit.over(f.nombre,MAX.nombre)) e.nombre=`El nombre supera ${MAX.nombre} caracteres.`;
    if (FormKit.over(f.apellidos,MAX.apellidos)) e.apellidos = `Los apellidos superan ${MAX.apellidos} caracteres.`;
    if (!f.email) e.email='El email es obligatorio.'; else if (!FormKit.emailValid(f.email)) e.email='Email no válido.';
    if (FormKit.over(f.departamento,MAX.departamento)) e.departamento = `El departamento supera ${MAX.departamento} caracteres.`;
    this.adminFieldErrors=e; this.isAdminFormValid=Object.keys(e).length===0;
  }

  saveAdminEdit(form: NgForm) {
    const u=this.editingAdmin;
    if (!u || !RoleKit.isAdmin(u.role) || this.isSuperAdmin(u) || form.invalid || !this.isAdminFormValid) return;
    const nombre=FormKit.trim(this.adminEditModel.nombre), apellidos=FormKit.trim(this.adminEditModel.apellidos), email=FormKit.trim(this.adminEditModel.email), foto=this.adminEditModel.foto??null, dep=FormKit.trim(this.adminEditModel.departamento);
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
        if (i >= 0) {
          this.users[i] = { ...(this.users[i]), ...(upd as any) };
          this.loading = false;
          this.cancelEditAdmin();
          Swal.fire({ icon: 'success', title: '¡Administrador actualizado!', text: 'Los cambios se han guardado correctamente.', confirmButtonText: 'Aceptar', customClass: { confirmButton: 'btn btn-primary' }, buttonsStyling: false })
            .then(() => { window.location.reload(); });
        }
      },
      error: err => { this.loading=false; this.errorMsg=err?.error?.message||'Error al actualizar administrador'; }
    });
  }

  openConfirm(kind: ConfirmKind, u: AppUser) {
    if (!(RoleKit.isCreator(u.role)||RoleKit.isAdmin(u.role)||RoleKit.isUser(u.role))) return;
    if (this.isSuperAdmin(u)) return;
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
    if (RoleKit.isCreator(u.role) || RoleKit.isUser(u.role)) this.openEditModal(u);
    else if (RoleKit.isAdmin(u.role)) this.openEditAdminModal(u);
  }
  toggleBlockUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm(u.blocked?'unblock':'block',u); }
  deleteUser(u: AppUser) { if (!this.isSuperAdmin(u)) this.openConfirm('delete',u); }

  editar(u: AppUser) { this.openEditModal(u); }
  toggleBlock(u: AppUser) { this.openConfirm(u.blocked?'unblock':'block',u); }
  eliminar(u: AppUser) { this.openConfirm('delete',u); }

  isCreator(u: AppUser) { return RoleKit.isCreator(u.role); }
  isAdmin(u: AppUser) { return RoleKit.isAdmin(u.role); }
  isUser(u: AppUser) { return RoleKit.isUser(u.role); }
  isSuperAdmin(u: AppUser) { return RoleKit.isAdmin(u.role) && RoleKit.isSuperAdmin(u.email||'', this.SUPER_ADMIN_EMAIL); }

  openCreate() { this.showCreateModal = true; }
  cancelCreate() { this.showCreateModal = false; }
  onCreadorCreado() { this.showCreateModal=false; this.fetchAll(); }

  openCreateAdmin() { this.pedirPwdAdminForModal=true; this.showCreateAdminModal=true; }
  cancelCreateAdmin() { this.showCreateAdminModal=false; this.pedirPwdAdminForModal=false; }

  createAdmin(form: NgForm) {
    if (form.invalid || this.pwdMismatchCreate || this.aliasAvailable===false) return;
    const b={ 
      nombre:FormKit.trim(this.crearAdmin.nombre),
      apellidos:FormKit.trim(this.crearAdmin.apellidos),
      alias:FormKit.trim(this.crearAdmin.alias),
      email:FormKit.trim(this.crearAdmin.email),
      pwd:this.crearAdmin.pwd,
      pwd2:this.crearAdmin.pwd2,
      foto:FormKit.trim(this.crearAdmin.foto)||undefined,
      departamento:FormKit.trim(this.crearAdmin.departamento),
      fechaNac:FormKit.trim(this.crearAdmin.fechaNac)||undefined
    };
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
        if (r.isConfirmed) {
          this.auth.logout?.(); localStorage.removeItem('user');
          Swal.fire({ title:'Sesión cerrada correctamente.', icon:'success', timer:1500, showConfirmButton:false });
          this.router.navigateByUrl('/auth/login', { replaceUrl: true });
        }
      });
  }
}
