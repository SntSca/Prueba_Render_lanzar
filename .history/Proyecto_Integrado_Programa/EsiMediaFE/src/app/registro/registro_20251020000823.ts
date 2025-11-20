import { Component, OnDestroy, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

type FixedRole = 'ADMINISTRADOR' | 'GESTOR_CONTENIDO';
type RoleUi = 'usuario' | 'Gestor de Contenido' | 'Administrador';
type PwnedState = 'ok' | 'warn' | 'unknown';
type AV = '' | 'Audio' | 'Video';
type DebounceKey = 'pwned' | 'alias' | 'email';
type UniqueKind = 'alias' | 'email';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro implements OnInit, OnDestroy {
  @Input() rolFijo?: FixedRole;
  @Input() pedirPwdAdmin = false;
  @Input() modoAdminCreador = false;
  @Output() creado = new EventEmitter<void>();

  readonly MAX = { alias: 12, nombre: 100, apellidos: 120, email: 120, especialidad: 60, descripcion: 500, departamento: 120 };
  private readonly ALIAS_MIN = 3;
  private readonly emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // -------- estado del formulario
  nombre = '';
  apellidos = '';
  email = '';
  alias = '';
  fechaNac = '';
  pwd = '';
  pwd2 = '';
  vip = false;
  role: RoleUi = 'usuario';
  departamento = '';
  foto: string | null = null;
  descripcion = '';
  especialidad = '';
  tipoContenido: AV = '';
  tipoContenidoTouched = false;
  aliasTouched = false;
  especialidadTouched = false;

  showPwd = false;
  showPwd2 = false;
  isLoading = false;
  private lastSubmitAt = 0;
  mensajeError = '';
  rolSeleccionado = false;

  pwnedCount: number | null = null;
  pwnedCheckedFor = '';
  isCheckingPwned = false;

  aliasUnique: boolean | null = null;
  aliasCheckedFor = '';
  isCheckingAlias = false;

  emailUnique: boolean | null = null;
  emailCheckedFor = '';
  isCheckingEmail = false;

  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
  ];

  selectedAvatar: string | null = null;
  showAvatarModal = false;

  // -------- utilidades puras reutilizables
  private trim = (s: string) => (s || '').trim();
  private lower = (s: string) => this.trim(s).toLowerCase();
  private isBlank = (s: string) => this.trim(s).length === 0;
  private within = (v: string, min: number, max: number) => v.length >= min && v.length <= max;
  private over = (v: string, max: number) => !!v && v.length > max;
  private oneOf = <T extends string>(v: T, list: readonly T[]) => list.includes(v);
  private bool = (b: any) => !!b;

  // -------- debounces centralizados
  private debounces: Partial<Record<DebounceKey, any>> = {};

  private setDebounce(key: DebounceKey, fn: () => void, ms: number) {
    const t = this.debounces[key];
    if (t) clearTimeout(t);
    this.debounces[key] = setTimeout(fn, ms);
  }

  constructor(private readonly usersService: UsersService, private readonly router: Router) {}

  // -------- getters de negocio
  get esAltaCreador(): boolean { return this.rolFijo === 'GESTOR_CONTENIDO' || this.modoAdminCreador === true; }
  get esAltaAdmin(): boolean { return this.rolFijo === 'ADMINISTRADOR'; }
  get isGestor(): boolean { return this.esAltaCreador || this.role === 'Gestor de Contenido'; }
  get showPasswordFields(): boolean { return this.esAltaAdmin ? this.pedirPwdAdmin : true; }
  get hasPwd(): boolean { return this.trim(this.pwd).length > 0; }
  get roleDisabled(): boolean { return !!this.rolFijo; }

  get ageYears(): number | null {
    if (!this.fechaNac) return null;
    const d = new Date(this.fechaNac), t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
  }
  get isUnder4(): boolean { const a = this.ageYears; return a !== null && a < 4; }
  get fechaInvalida(): boolean { return !(this.esAltaAdmin || this.esAltaCreador) && !!this.fechaNac && new Date(this.fechaNac) > new Date(); }

  // -------- password helpers
  get pwdIssues(): string[] {
    if (!this.showPasswordFields) return [];
    const p = this.pwd;
    return [
      p.length >= 8 ? '' : 'Al menos 8 caracteres',
      /[A-Z]/.test(p) ? '' : 'Una letra mayúscula',
      /[a-z]/.test(p) ? '' : 'Una letra minúscula',
      /\d/.test(p) ? '' : 'Un número',
      /[!@#$%^&*(),.?":{}|<>_-]/.test(p) ? '' : 'Un carácter especial'
    ].filter(Boolean);
  }
  get pwdScore(): number {
    if (!this.showPasswordFields) return 0;
    const p = this.pwd;
    return Math.min(4, [p.length>=8, /[A-Z]/.test(p), /[a-z]/.test(p), /\d/.test(p), /[!@#$%^&*(),.?":{}|<>]/.test(p)].filter(this.bool).length);
  }
  get pwdStrengthLabel(): string { if (!this.showPasswordFields) return ''; return this.pwdScore<=1 ? 'Débil' : this.pwdScore<=3 ? 'Media' : 'Fuerte'; }
  get pwdMismatch(): boolean { return this.showPasswordFields && this.pwd2.length > 0 && this.pwd !== this.pwd2; }

  // -------- mensajes derivados
  get aliasLenError(): string | null {
    const a = this.trim(this.alias);
    if (!a) return null;
    return this.within(a, this.ALIAS_MIN, this.MAX.alias) ? null : `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
  }
  get aliasRequiredError(): string | null { return this.isGestor && this.rolSeleccionado && this.isBlank(this.alias) && this.tipoContenidoTouched ? 'El alias es obligatorio para Gestor de Contenido.' : null; }
  get emailPatternError(): string | null { const v=this.trim(this.email); return v && !this.emailPattern.test(v) ? 'Email no válido' : null; }
  get avatarError(): string | null { return this.selectedAvatar ? null : 'Debes seleccionar un avatar.'; }
  get deptoError(): string | null { return this.esAltaAdmin && this.isBlank(this.departamento) ? 'El departamento es obligatorio.' : null; }
  get especialidadError(): string | null { return this.isGestor && this.rolSeleccionado && this.isBlank(this.especialidad) && this.tipoContenidoTouched ? 'Falta la especialidad.' : null; }
  get tipoContenidoError(): string | null { return this.tipoContenidoTouched && !this.oneOf(this.tipoContenido, ['Audio','Video',''] as const) ? 'Selecciona Audio o Video.' : null; }

  // -------- contadores
  get nombreLenLeft(): number { return this.MAX.nombre - this.nombre.length; }
  get apellidosLenLeft(): number { return this.MAX.apellidos - this.apellidos.length; }
  get emailLenLeft(): number { return this.MAX.email - this.email.length; }
  get aliasLenLeft(): number { return this.MAX.alias - this.alias.length; }
  get deptoLenLeft(): number { return this.MAX.departamento - this.departamento.length; }
  get especialidadLenLeft(): number { return this.MAX.especialidad - this.especialidad.length; }
  get descripcionLenLeft(): number { return this.MAX.descripcion - this.descripcion.length; }

  // -------- resumen validaciones (reutiliza funciones)
  get validationSummary(): string[] {
    const msgs = [
      this.checkLengths(),
      this.avatarError,
      this.validateAge(),
      this.fechaInvalida ? 'La fecha no puede ser futura.' : null,
      this.emailUnique === false ? 'Este email ya está registrado. Elige otro.' : null,
      this.esAltaAdmin ? this.deptoError : null,
      this.isGestor ? (this.aliasRequiredError || this.aliasLenError || (this.aliasUnique === false ? 'El alias ya existe. Elige otro.' : null)) : (this.trim(this.alias) ? this.aliasLenError : null),
      this.isGestor ? (this.especialidadError || this.tipoContenidoError) : null,
      this.showPasswordFields && this.pwdIssues.length > 0 ? 'La contraseña no cumple los requisitos.' : null,
      this.showPasswordFields && this.pwdMismatch ? 'Las contraseñas no coinciden.' : null,
      this.showPasswordFields && (this.pwnedCount ?? 0) > 0 ? `Esta contraseña aparece en filtraciones públicas ${this.pwnedCount} veces.` : null
    ];
    return msgs.filter(this.bool) as string[];
  }

  // -------- validaciones reutilizadas
  private validateAge(): string | null {
    return (!this.esAltaAdmin && !!this.fechaNac && this.isUnder4) ? 'No se permiten registros de menores de 4 años.' : null;
  }

  private checkLengths(): string | null {
    if (this.over(this.nombre, this.MAX.nombre)) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (this.over(this.apellidos, this.MAX.apellidos)) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (this.over(this.email, this.MAX.email)) return `El email supera ${this.MAX.email} caracteres.`;
    if (this.over(this.departamento, this.MAX.departamento)) return `El departamento supera ${this.MAX.departamento} caracteres.`;
    if (this.over(this.especialidad, this.MAX.especialidad)) return `La especialidad supera ${this.MAX.especialidad} caracteres.`;
    if (this.over(this.descripcion, this.MAX.descripcion)) return `La descripción supera ${this.MAX.descripcion} caracteres.`;
    if (!this.esAltaAdmin && this.over(this.alias, this.MAX.alias)) return `El alias supera ${this.MAX.alias} caracteres.`;
    if (this.isGestor && !!this.alias && !this.within(this.alias, this.ALIAS_MIN, this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }

  // -------- ciclo de vida
  ngOnInit(): void {
    if (!this.rolFijo && this.modoAdminCreador) this.rolFijo = 'GESTOR_CONTENIDO';
    if (this.esAltaCreador) { this.role = 'Gestor de Contenido'; this.vip = false; this.fechaNac = ''; }
    else if (this.esAltaAdmin) { this.role = 'Administrador'; this.vip = false; this.fechaNac = ''; if (!this.pedirPwdAdmin) { this.pwd = ''; this.pwd2 = ''; } }
  }

  ngOnDestroy() {
    Object.values(this.debounces).forEach(t => t && clearTimeout(t));
  }

  // -------- UI helpers
  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; setTimeout(() => {}, 0); this.closeAvatarModal(); }

  onRoleChange(val: string) {
    if (this.rolFijo) return;
    this.role = val as RoleUi; this.rolSeleccionado = true;
    if (val !== 'usuario') this.vip = false;
    if (val === 'Administrador' || val === 'Gestor de Contenido') this.fechaNac = '';
  }

  // -------- alertas
  private showAlert(title: string, text: string, icon: 'error'|'info'|'warning'|'success') {
    void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' });
  }
  private handleFormError(message: string) {
    (document.querySelector('.input.input-error') as HTMLElement)?.focus?.();
    this.showAlert('Revisa el formulario', message, 'error');
  }

  // -------- HIBP (reutilizado)
  private async sha1ForHIBP(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  private async checkPasswordPwned(password: string): Promise<number> {
    if (!password) return 0;
    const full = await this.sha1ForHIBP(password), pref = full.slice(0,5), suf = full.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${pref}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    for (const line of (await res.text()).split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if ((hashSuffix||'').toUpperCase() === suf) return parseInt((countStr||'').replace(/\D/g,''),10) || 0;
    }
    return 0;
  }
  private async ensurePwnedChecked(): Promise<void> {
    if (!this.showPasswordFields || !this.pwd || this.pwd === this.pwnedCheckedFor) return;
    this.isCheckingPwned = true;
    try { this.pwnedCount = await this.checkPasswordPwned(this.pwd); this.pwnedCheckedFor = this.pwd; }
    catch { this.pwnedCount = null; this.pwnedCheckedFor = this.pwd; }
    finally { this.isCheckingPwned = false; }
  }
  async onPwdChange() {
    if (!this.showPasswordFields) return;
    this.pwnedCheckedFor = ''; this.pwnedCount = null;
    this.setDebounce('pwned', async () => { this.isCheckingPwned = !!this.pwd; await this.ensurePwnedChecked(); }, 700);
  }

  // -------- chequeo genérico de unicidad (reutiliza para alias/email)
  private async ensureUnique(kind: UniqueKind, raw: string): Promise<boolean | null> {
    const value = kind === 'email' ? this.lower(raw) : this.trim(raw);
    if (kind === 'alias' && this.esAltaAdmin) return null;

    if (this.isBlank(value)) {
      if (kind === 'alias') { this.aliasCheckedFor = ''; this.aliasUnique = null; }
      else { this.emailCheckedFor = ''; this.emailUnique = null; }
      return null;
    }

    if (kind === 'alias' && !this.within(value, this.ALIAS_MIN, this.MAX.alias)) {
      this.aliasUnique = null; this.aliasCheckedFor = '';
      return null;
    }
    if (kind === 'email' && !this.emailPattern.test(value)) {
      this.emailUnique = null; this.emailCheckedFor = '';
      return null;
    }

    const already = kind === 'alias' ? this.aliasCheckedFor : this.emailCheckedFor;
    if (value === already) return kind === 'alias' ? this.aliasUnique : this.emailUnique;

    kind === 'alias' ? this.isCheckingAlias = true : this.isCheckingEmail = true;
    try {
      if (kind === 'alias') {
        const r = await firstValueFrom(this.usersService.checkAlias(value));
        this.aliasUnique = !!r?.available; this.aliasCheckedFor = value; return this.aliasUnique;
      } else {
        const r = await firstValueFrom(this.usersService.checkEmail(value));
        this.emailUnique = !!r?.available; this.emailCheckedFor = value; return this.emailUnique;
      }
    } catch {
      if (kind === 'alias') { this.aliasUnique = null; this.aliasCheckedFor = value; }
      else { this.emailUnique = null; this.emailCheckedFor = value; }
      return null;
    } finally {
      kind === 'alias' ? this.isCheckingAlias = false : this.isCheckingEmail = false;
    }
  }

  onAliasChange() {
    if (this.esAltaAdmin) return;
    this.aliasUnique = null; this.aliasCheckedFor = '';
    const v = this.trim(this.alias);
    if (!v || !this.within(v, this.ALIAS_MIN, this.MAX.alias)) return;
    this.setDebounce('alias', async () => { this.isCheckingAlias = true; await this.ensureUnique('alias', this.alias); }, 600);
  }
  onEmailChange() {
    this.emailUnique = null; this.emailCheckedFor = '';
    const v = this.trim(this.email); if (!v) return;
    this.setDebounce('email', async () => { this.isCheckingEmail = true; await this.ensureUnique('email', this.email); }, 600);
  }

  // -------- submit / validación previa
  async onSubmit(form: NgForm) {
    const now = Date.now();
    const msg = await this.preflightValidate(form, now);
    if (msg) { this.handleFormError(msg); return; }
    const base = this.buildPayload();
    this.isLoading = true; this.lastSubmitAt = now;
    await this.submitByRole(base);
  }

  private async preflightValidate(form: NgForm, now: number): Promise<string | null> {
    if (now - this.lastSubmitAt < 5000) return 'Espera unos segundos antes de volver a intentarlo.';

    const lengthError = this.checkLengths(); if (lengthError) return lengthError;
    if (!this.foto) return 'Debes seleccionar una foto de perfil (obligatoria).';

    const ageMsg = this.validateAge(); if (ageMsg) return ageMsg;
    if (this.fechaInvalida) return 'La fecha no puede ser futura.';

    await this.ensureUnique('email', this.email);
    if (this.emailUnique === false) return 'Este email ya está registrado. Elige otro.';

    const aliasMsg = await this.validateAliasBlock(); if (aliasMsg) return aliasMsg;

    if (this.esAltaAdmin && this.isBlank(this.departamento)) return 'Para Administrador, el departamento es obligatorio.';

    const pwdMsg = await this.validatePasswordsBlock(form); if (pwdMsg) return pwdMsg;

    if (this.isGestor) {
      this.aliasTouched = this.especialidadTouched = this.tipoContenidoTouched = true;
      if (this.isBlank(this.especialidad) || !this.oneOf(this.tipoContenido, ['Audio','Video',''] as const)) {
        return 'Para Gestor de Contenido, especialidad y tipo de contenido (Audio/Video) son obligatorios.';
      }
      this.descripcion = this.trim(this.descripcion);
    }
    return null;
  }

  private async validateAliasBlock(): Promise<string | null> {
    if (this.isGestor) {
      const a = this.trim(this.alias);
      if (!a) return 'Para Gestor de Contenido, el alias es obligatorio.';
      if (!this.within(a, this.ALIAS_MIN, this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
      await this.ensureUnique('alias', a);
      return this.aliasUnique !== true ? 'El alias ya existe o no se ha podido verificar. Elige otro.' : null;
    }
    if (!this.esAltaAdmin && !this.isBlank(this.alias)) {
      const a = this.trim(this.alias);
      if (!this.within(a, this.ALIAS_MIN, this.MAX.alias)) return `El alias (si lo indicas) debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
      await this.ensureUnique('alias', a);
      if (this.aliasUnique === false) return 'El alias ya existe. Elige otro o deja el campo vacío.';
    }
    return null;
  }

  private async validatePasswordsBlock(form: NgForm): Promise<string | null> {
    const basicInvalid = form.invalid || this.fechaInvalida;
    if (!this.showPasswordFields) return basicInvalid ? 'Hay campos con errores. Corrígelos y vuelve a intentarlo.' : null;
    if (basicInvalid || this.pwdIssues.length > 0 || this.pwdMismatch) return 'Hay campos con errores. Corrígelos y vuelve a intentarlo.';
    await this.ensurePwnedChecked();
    return (this.pwnedCount ?? 0) > 0 ? `Esta contraseña aparece en filtraciones públicas ${this.pwnedCount} veces.` : null;
  }

  // -------- payload / envío
  private resolveRole(): string {
    if (this.esAltaAdmin) return 'Administrador';
    if (this.esAltaCreador) return 'Gestor de Contenido';
    return this.role;
  }

  private buildPayload(): any {
    const base: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.lower(this.email),
      vip: this.vip,
      role: this.resolveRole(),
      foto: this.foto
    };
    if (!(this.esAltaCreador || this.esAltaAdmin) && this.fechaNac) base.fechaNac = this.fechaNac;
    if (this.isGestor || (!this.esAltaAdmin && !this.isBlank(this.alias))) base.alias = this.trim(this.alias);
    if (this.isGestor) { base.descripcion = this.trim(this.descripcion) || null; base.especialidad = this.trim(this.especialidad); base.tipoContenido = this.tipoContenido; }
    if (this.esAltaAdmin) { base.departamento = this.trim(this.departamento); base.alias = null; }
    if (this.showPasswordFields) { base.pwd = this.pwd; base.pwd2 = this.pwd2; }
    return base;
  }

  private async submitByRole(base: any): Promise<void> {
    const byRole: Record<'creador'|'admin'|'usuario', () => void> = {
      creador: () => this.usersService.crearCreadorComoAdmin(base).subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Creador dado de alta.', 'success'); this.creado.emit(); },
        error: (e) => this.handleHttpError(e)
      }),
      admin: () => (this.usersService.createAdminByAdmin(base)?.subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Administrador dado de alta.', 'success'); this.creado.emit(); },
        error: (e) => this.handleHttpError(e)
      }) ?? (this.isLoading = false)),
      usuario: () => this.usersService.registrar(base).subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Éxito!', 'Registro correcto.', 'success'); this.router.navigate(['/auth']); },
        error: (e) => this.handleHttpError(e)
      })
    };
    const executeRoleAction = this.esAltaCreador ? byRole.creador : this.esAltaAdmin ? byRole.admin : byRole.usuario;
    executeRoleAction();
  }

  private handleHttpError(error: any) {
    this.isLoading = false;
    const raw = error?.error;
    let msg = 'Hubo un problema en el registro';
    if (raw) {
      if (typeof raw === 'object' && raw.message) msg = raw.message;
      else if (typeof raw === 'string') { try { const o = JSON.parse(raw); msg = o.message ?? raw; } catch { msg = raw; } }
    }
    this.mensajeError = msg;
    this.showAlert('Error', msg, 'error');
  }

  // -------- severidad pwned (para UI)
  get pwnedSeverity(): PwnedState {
    if (!this.showPasswordFields || !this.hasPwd || this.isCheckingPwned || this.pwnedCount === null) return 'unknown';
    return (this.pwnedCount ?? 0) > 0 ? 'warn' : 'ok';
  }
  get pwnedMessage(): string {
    if (!this.showPasswordFields || !this.hasPwd) return '';
    if (this.isCheckingPwned) return 'Comprobando en filtraciones públicas…';
    if (this.pwnedCount === null) return 'No se pudo verificar ahora. Intenta de nuevo más tarde.';
    return (this.pwnedCount ?? 0) > 0 ? `⚠️ Aparece en filtraciones <b>${this.pwnedCount}</b> veces. Elige otra.` : '✅ No aparece en filtraciones conocidas.';
  }
}
