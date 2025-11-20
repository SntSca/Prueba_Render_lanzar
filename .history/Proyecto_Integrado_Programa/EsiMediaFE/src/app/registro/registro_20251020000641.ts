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
  private pwnedDebounce: any = null;

  aliasUnique: boolean | null = null;
  aliasCheckedFor = '';
  isCheckingAlias = false;
  private aliasDebounce: any = null;

  emailUnique: boolean | null = null;
  emailCheckedFor = '';
  isCheckingEmail = false;
  private emailDebounce: any = null;

  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

  constructor(private readonly usersService: UsersService, private readonly router: Router) {}

  get esAltaCreador(): boolean { return this.rolFijo === 'GESTOR_CONTENIDO' || this.modoAdminCreador === true; }
  get esAltaAdmin(): boolean { return this.rolFijo === 'ADMINISTRADOR'; }
  get isGestor(): boolean { return this.esAltaCreador || this.role === 'Gestor de Contenido'; }
  get showPasswordFields(): boolean { return this.esAltaAdmin ? this.pedirPwdAdmin : true; }
  get hasPwd(): boolean { return this.pwd.trim().length > 0; }
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

  get pwdIssues(): string[] {
    if (!this.showPasswordFields) return [];
    const p = this.pwd;
    return [
      p.length < 8 ? 'Al menos 8 caracteres' : '',
      /[A-Z]/.test(p) ? '' : 'Una letra mayúscula',
      /[a-z]/.test(p) ? '' : 'Una letra minúscula',
      /\d/.test(p) ? '' : 'Un número',
      /[!@#$%^&*(),.?":{}|<>_-]/.test(p) ? '' : 'Un carácter especial'
    ].filter(Boolean);
  }
  get pwdScore(): number {
    if (!this.showPasswordFields) return 0;
    const p=this.pwd;
    return Math.min(4, [p.length>=8, /[A-Z]/.test(p), /[a-z]/.test(p), /\d/.test(p), /[!@#$%^&*(),.?":{}|<>]/.test(p)].filter(Boolean).length);
  }
  get pwdStrengthLabel(): string {
    if (!this.showPasswordFields) return '';
    if (this.pwdScore <= 1) return 'Débil';
    if (this.pwdScore <= 3) return 'Media';
    return 'Fuerte';
  }
  get pwdMismatch(): boolean { return this.showPasswordFields && this.pwd2.length > 0 && this.pwd !== this.pwd2; }

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

  get aliasLenError(): string | null {
    const a = this.alias.trim();
    if (!a) return null;
    return (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) ? `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.` : null;
  }
  get aliasRequiredError(): string | null { return this.isGestor && this.rolSeleccionado && !this.alias.trim() && this.tipoContenidoTouched ? 'El alias es obligatorio para Gestor de Contenido.' : null; }
  get emailPatternError(): string | null { const v=this.email.trim(); return v && !this.emailPattern.test(v) ? 'Email no válido' : null; }
  get avatarError(): string | null { return this.selectedAvatar ? null : 'Debes seleccionar un avatar.'; }
  get deptoError(): string | null { return this.esAltaAdmin && !this.departamento.trim() ? 'El departamento es obligatorio.' : null; }
  get especialidadError(): string | null { return this.isGestor && this.rolSeleccionado && !this.especialidad.trim() && this.tipoContenidoTouched ? 'Falta la especialidad.' : null; }
  get tipoContenidoError(): string | null { return this.tipoContenidoTouched && !(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video') ? 'Selecciona Audio o Video.' : null; }

  get nombreLenLeft(): number { return this.MAX.nombre - this.nombre.length; }
  get apellidosLenLeft(): number { return this.MAX.apellidos - this.apellidos.length; }
  get emailLenLeft(): number { return this.MAX.email - this.email.length; }
  get aliasLenLeft(): number { return this.MAX.alias - this.alias.length; }
  get deptoLenLeft(): number { return this.MAX.departamento - this.departamento.length; }
  get especialidadLenLeft(): number { return this.MAX.especialidad - this.especialidad.length; }
  get descripcionLenLeft(): number { return this.MAX.descripcion - this.descripcion.length; }

  get validationSummary(): string[] {
    const msgs = [
      this.checkLengths(),
      this.avatarError,
      this.validateAge(),
      this.validateFecha(),
      this.validateEmail(),
      this.validateAdminFields(),
      this.validateAlias(),
      this.validateGestorFields(),
      this.validatePasswords()
    ];
    return msgs.filter(Boolean) as string[];
  }

  private validateAge(): string | null {
    return (!this.esAltaAdmin && !!this.fechaNac && this.isUnder4) ? 'No se permiten registros de menores de 4 años.' : null;
  }

  private validateFecha(): string | null {
    return this.fechaInvalida ? 'La fecha no puede ser futura.' : null;
  }

  private validateEmail(): string | null {
    return this.emailUnique === false ? 'Este email ya está registrado. Elige otro.' : null;
  }

  private validateAlias(): string | null {
    if (this.isGestor) {
      return this.aliasRequiredError || this.aliasLenError || (this.aliasUnique === false ? 'El alias ya existe. Elige otro.' : null);
    }
    return this.alias.trim() ? this.aliasLenError : null;
  }

  private validateGestorFields(): string | null {
    if (this.isGestor) {
      return this.especialidadError || this.tipoContenidoError;
    }
    return null;
  }

  private validatePasswords(): string | null {
    if (this.showPasswordFields) {
      if (this.pwdIssues.length > 0) return 'La contraseña no cumple los requisitos.';
      if (this.pwdMismatch) return 'Las contraseñas no coinciden.';
      if ((this.pwnedCount ?? 0) > 0) return `Esta contraseña aparece en filtraciones públicas ${this.pwnedCount} veces.`;
    }
    return null;
  }

  ngOnInit(): void {
    if (!this.rolFijo && this.modoAdminCreador) this.rolFijo = 'GESTOR_CONTENIDO';
    if (this.esAltaCreador) { this.role = 'Gestor de Contenido'; this.vip = false; this.fechaNac = ''; }
    else if (this.esAltaAdmin) { this.role = 'Administrador'; this.vip = false; this.fechaNac = ''; if (!this.pedirPwdAdmin) { this.pwd = ''; this.pwd2 = ''; } }
  }

  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }

  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') { void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' }); }
  private handleFormError(message: string) { (document.querySelector('.input.input-error') as HTMLElement)?.focus?.(); this.showAlert('Revisa el formulario', message, 'error'); }

  private checkLengths(): string | null {
    if (this.nombre.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (this.apellidos.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (this.email.length > this.MAX.email) return `El email supera ${this.MAX.email} caracteres.`;
    if (this.departamento && this.departamento.length > this.MAX.departamento) return `El departamento supera ${this.MAX.departamento} caracteres.`;
    if (this.especialidad && this.especialidad.length > this.MAX.especialidad) return `La especialidad supera ${this.MAX.especialidad} caracteres.`;
    if (this.descripcion && this.descripcion.length > this.MAX.descripcion) return `La descripción supera ${this.MAX.descripcion} caracteres.`;
    if (!this.esAltaAdmin && this.alias && this.alias.length > this.MAX.alias) return `El alias supera ${this.MAX.alias} caracteres.`;
    if (this.isGestor && this.alias && this.alias.length < this.ALIAS_MIN) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }

  private async sha1ForHIBP(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  private async checkPasswordPwned(password: string): Promise<number> {
    if (!password) return 0;
    const fullHash = await this.sha1ForHIBP(password);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${fullHash.slice(0,5)}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    const suf = fullHash.slice(5);
    for (const line of (await res.text()).split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix?.toUpperCase() === suf) return parseInt((countStr||'').replace(/\D/g,''),10) || 0;
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

  private async ensureAliasChecked(): Promise<void> {
    if (this.esAltaAdmin) return;
    const value = this.alias.trim();
    if (!value || value.length < this.ALIAS_MIN || value.length > this.MAX.alias) { this.aliasUnique = null; this.aliasCheckedFor = ''; return; }
    if (value === this.aliasCheckedFor) return;
    this.isCheckingAlias = true;
    try { const r = await firstValueFrom(this.usersService.checkAlias(value)); this.aliasUnique = !!r?.available; this.aliasCheckedFor = value; }
    catch { this.aliasUnique = null; this.aliasCheckedFor = value; }
    finally { this.isCheckingAlias = false; }
  }
  onAliasChange() {
    if (this.esAltaAdmin) return;
    this.aliasUnique = null; this.aliasCheckedFor = '';
    const value = this.alias.trim();
    if (!value || value.length < this.ALIAS_MIN || value.length > this.MAX.alias) return;
    this.setDebounce('alias', async () => { this.isCheckingAlias = true; await this.ensureAliasChecked(); }, 600);
  }

  private async ensureEmailChecked(): Promise<void> {
    const value = this.email.trim().toLowerCase();
    if (!value || value === this.emailCheckedFor) return;
    if (!this.emailPattern.test(value)) { this.emailUnique = null; this.emailCheckedFor = ''; return; }
    this.isCheckingEmail = true;
    try { const r = await firstValueFrom(this.usersService.checkEmail(value)); this.emailUnique = !!r?.available; this.emailCheckedFor = value; }
    catch { this.emailUnique = null; this.emailCheckedFor = value; }
    finally { this.isCheckingEmail = false; }
  }
  onEmailChange() {
    this.emailUnique = null; this.emailCheckedFor = '';
    const value = this.email.trim(); if (!value) return;
    this.setDebounce('email', async () => { this.isCheckingEmail = true; await this.ensureEmailChecked(); }, 600);
  }

  private setDebounce(kind: 'pwned'|'alias'|'email', fn: () => void, ms: number) {
    const map = { pwned: 'pwnedDebounce', alias: 'aliasDebounce', email: 'emailDebounce' } as const;
    const key = map[kind];
    if (this[key]) clearTimeout(this[key]);
    this[key] = setTimeout(fn, ms);
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; setTimeout(() => {}, 0); this.closeAvatarModal(); }

  onRoleChange(val: string) {
    if (this.rolFijo) return;
    this.role = val as RoleUi; this.rolSeleccionado = true; if (val !== 'usuario') this.vip = false;
    if (val === 'Administrador' || val === 'Gestor de Contenido') this.fechaNac = '';
  }

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

    const lengthError = this.checkLengths();
    if (lengthError) return lengthError;

    const fotoError = this.validateFoto();
    if (fotoError) return fotoError;

    const fechaError = this.validateFecha();
    if (fechaError) return fechaError;

    await this.ensureEmailChecked();
    if (this.emailUnique === false) return 'Este email ya está registrado. Elige otro.';

    const aliasError = await this.validateAliasBlock();
    if (aliasError) return aliasError;

    const adminError = this.validateAdminFields();
    if (adminError) return adminError;

    const pwdError = await this.validatePasswordsBlock(form);
    if (pwdError) return pwdError;

    if (this.isGestor) {
      const gestorError = this.validateGestorFields();
      if (gestorError) return gestorError;
    }

    return null;
  }

  private validateFoto(): string | null {
    return !this.foto ? 'Debes seleccionar una foto de perfil (obligatoria).' : null;
  }

  private validateFecha(): string | null {
    if (!(this.esAltaCreador || this.esAltaAdmin) && this.fechaNac && this.isUnder4) {
      return 'No se permiten registros de menores de 4 años.';
    }
    if (this.fechaInvalida) {
      return 'La fecha no puede ser futura.';
    }
    return null;
  }

  private validateAdminFields(): string | null {
    return this.esAltaAdmin && !this.departamento.trim() ? 'Para Administrador, el departamento es obligatorio.' : null;
  }

  private validateGestorFields(): string | null {
    this.aliasTouched = this.especialidadTouched = this.tipoContenidoTouched = true;
    if (!this.especialidad.trim() || !(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video')) {
      return 'Para Gestor de Contenido, especialidad y tipo de contenido (Audio/Video) son obligatorios.';
    }
    if (this.descripcion != null) this.descripcion = this.descripcion.trim();
    return null;
  }

  private async validateAliasBlock(): Promise<string | null> {
    if (this.isGestor) {
      const a = this.alias.trim();
      if (!a) return 'Para Gestor de Contenido, el alias es obligatorio.';
      if (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
      await this.ensureAliasChecked();
      return this.aliasUnique !== true ? 'El alias ya existe o no se ha podido verificar. Elige otro.' : null;
    }
    if (!this.esAltaAdmin && !!this.alias.trim()) {
      const a = this.alias.trim();
      if (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) return `El alias (si lo indicas) debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
      await this.ensureAliasChecked();
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

  private buildPayload(): any {
    let role: string;
    if (this.esAltaAdmin) {
      role = 'Administrador';
    } else if (this.esAltaCreador) {
      role = 'Gestor de Contenido';
    } else {
      role = this.role;
    }
    const base: any = { nombre: this.nombre, apellidos: this.apellidos, email: this.email.trim().toLowerCase(), vip: this.vip, role, foto: this.foto };
    if (!(this.esAltaCreador || this.esAltaAdmin) && this.fechaNac) base.fechaNac = this.fechaNac;
    if (this.isGestor || (!this.esAltaAdmin && this.alias.trim())) base.alias = this.alias.trim();
    if (this.isGestor) { base.descripcion = (this.descripcion ?? '').trim() || null; base.especialidad = this.especialidad.trim(); base.tipoContenido = this.tipoContenido; }
    if (this.esAltaAdmin) { base.departamento = this.departamento.trim(); base.alias = null; }
    if (this.showPasswordFields) { base.pwd = this.pwd; base.pwd2 = this.pwd2; }
    return base;
  }

  private async submitByRole(base: any): Promise<void> {
    if (this.esAltaCreador) {
      this.usersService.crearCreadorComoAdmin(base).subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Creador dado de alta.', 'success'); this.creado.emit(); },
        error: (e) => this.handleHttpError(e)
      });
      return;
    }
    if (this.esAltaAdmin) {
      this.usersService.createAdminByAdmin(base)?.subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Administrador dado de alta.', 'success'); this.creado.emit(); },
        error: (e) => this.handleHttpError(e)
      }) ?? (this.isLoading = false);
      return;
    }
    this.usersService.registrar(base).subscribe({
      next: () => { this.isLoading = false; this.showAlert('¡Éxito!', 'Registro correcto.', 'success'); this.router.navigate(['/auth']); },
      error: (e) => this.handleHttpError(e)
    });
  }

  private handleHttpError(error: any) {
    this.isLoading = false;
    let msg = 'Hubo un problema en el registro';
    const raw = error?.error;
    if (raw) {
      if (typeof raw === 'object' && raw.message) msg = raw.message;
      else if (typeof raw === 'string') { try { const o = JSON.parse(raw); msg = o.message ?? raw; } catch { msg = raw; } }
    }
    this.mensajeError = msg;
    this.showAlert('Error', msg, 'error');
  }

  ngOnDestroy() {
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    if (this.emailDebounce) clearTimeout(this.emailDebounce);
  }
}
