import { Component, OnDestroy, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro implements OnInit, OnDestroy {
  @Input() rolFijo?: 'ADMINISTRADOR' | 'GESTOR_CONTENIDO';
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
  role: 'usuario' | 'Gestor de Contenido' | 'Administrador' = 'usuario';
  departamento = '';
  foto: string | null = null;
  descripcion = '';
  especialidad = '';
  tipoContenido: '' | 'Audio' | 'Video' = '';

  showPwd = false;
  showPwd2 = false;
  isLoading = false;
  private lastSubmitAt = 0;
  mensajeError = '';

  pwnedCount: number | null = null;
  pwnedCheckedFor: string = '';
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
    const dob = new Date(this.fechaNac);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }
  get isUnder4(): boolean { const a = this.ageYears; return a !== null && a < 4; }
  get fechaInvalida(): boolean { 
    if (this.esAltaAdmin) { 
      return false; 
    } 
    if (!this.fechaNac) { 
      return false; 
    } 
    return new Date(this.fechaNac) > new Date(); 
  }

  get pwdIssues(): string[] {
    if (!this.showPasswordFields) return [];
    const issues: string[] = [];
    if (this.pwd.length < 8) issues.push('Al menos 8 caracteres');
    if (!/[A-Z]/.test(this.pwd)) issues.push('Una letra mayúscula');
    if (!/[a-z]/.test(this.pwd)) issues.push('Una letra minúscula');
    if (!/\d/.test(this.pwd)) issues.push('Un número');
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(this.pwd)) issues.push('Un carácter especial');
    return issues;
  }
  get pwdScore(): number {
    if (!this.showPasswordFields) return 0;
    let score = 0;
    if (this.pwd.length >= 8) score++;
    if (/[A-Z]/.test(this.pwd)) score++;
    if (/[a-z]/.test(this.pwd)) score++;
    if (/\d/.test(this.pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(this.pwd)) score++;
    return Math.min(4, score);
  }
  get pwdStrengthLabel(): string {
    if (!this.showPasswordFields) {
      return '';
    } else if (this.pwdScore <= 1) {
      return 'Débil';
    } else if (this.pwdScore <= 3) {
      return 'Media';
    } else {
      return 'Fuerte';
    }
  }
  get pwdMismatch(): boolean { 
    if (!this.showPasswordFields) {
      return false; 
    } 
    return this.pwd2.length > 0 && this.pwd !== this.pwd2; 
  }

  get pwnedSeverity(): 'ok' | 'warn' | 'unknown' {
    if (!this.showPasswordFields) return 'unknown';
    if (!this.hasPwd) return 'unknown';
    if (this.isCheckingPwned) return 'unknown';
    if (this.pwnedCount === null) return 'unknown';
    return (this.pwnedCount ?? 0) > 0 ? 'warn' : 'ok';
  }
  get pwnedMessage(): string {
    if (!this.showPasswordFields) return '';
    if (!this.hasPwd) return '';
    if (this.isCheckingPwned) return 'Comprobando en filtraciones públicas…';
    if (this.pwnedCount === null) return 'No se pudo verificar ahora. Intenta de nuevo más tarde.';
    if ((this.pwnedCount ?? 0) > 0) return `⚠️ Aparece en filtraciones <b>${this.pwnedCount}</b> veces. Elige otra.`;
    return '✅ No aparece en filtraciones conocidas.';
  }

  get aliasLenError(): string | null {
    const a = (this.alias || '').trim();
    if (!a) return null;
    if (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }
  get aliasRequiredError(): string | null {
    if (!this.isGestor) return null;
    if (!(this.alias || '').trim()) return 'El alias es obligatorio para Gestor de Contenido.';
    return null;
  }
  get emailPatternError(): string | null {
    const v = (this.email || '').trim();
    if (!v) return null;
    if (!this.emailPattern.test(v)) return 'Email no válido';
    return null;
  }
  get avatarError(): string | null { return this.selectedAvatar ? null : 'Debes seleccionar un avatar.'; }
  get deptoError(): string | null { 
    if (!this.esAltaAdmin) { 
      return null; 
    } 
    if (!(this.departamento || '').trim()) { 
      return 'El departamento es obligatorio.'; 
    } 
    return null; 
  }
  get especialidadError(): string | null { 
    if (!this.isGestor) { 
      return null; 
    } 
    if (!(this.especialidad || '').trim()) { 
      return 'Falta la especialidad.'; 
    } 
    return null; 
  }
  get tipoContenidoError(): string | null { 
    if (!this.isGestor) {
      return null; 
    }
    if (!(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video')) {
      return 'Selecciona Audio o Video.';
    }
    return null; 
  }

  get nombreLenLeft(): number { return this.MAX.nombre - (this.nombre || '').length; }
  get apellidosLenLeft(): number { return this.MAX.apellidos - (this.apellidos || '').length; }
  get emailLenLeft(): number { return this.MAX.email - (this.email || '').length; }
  get aliasLenLeft(): number { return this.MAX.alias - (this.alias || '').length; }
  get deptoLenLeft(): number { return this.MAX.departamento - (this.departamento || '').length; }
  get especialidadLenLeft(): number { return this.MAX.especialidad - (this.especialidad || '').length; }
  get descripcionLenLeft(): number { return this.MAX.descripcion - (this.descripcion || '').length; }

  get validationSummary(): string[] {
    const msgs: string[] = [];
    const lengthsMsg = this.checkLengths();
    if (lengthsMsg) msgs.push(lengthsMsg);
    if (this.avatarError) msgs.push(this.avatarError);
    if (!this.esAltaAdmin && this.fechaNac && this.isUnder4) msgs.push('No se permiten registros de menores de 4 años.');
    if (this.fechaInvalida) msgs.push('La fecha no puede ser futura.');
    if (this.emailUnique === false) msgs.push('Este email ya está registrado. Elige otro.');
    if (this.isGestor) {
      if (this.aliasRequiredError) msgs.push(this.aliasRequiredError);
      if (this.aliasLenError) msgs.push(this.aliasLenError);
      if (this.aliasUnique === false) msgs.push('El alias ya existe. Elige otro.');
      if (this.especialidadError) msgs.push(this.especialidadError);
      if (this.tipoContenidoError) msgs.push(this.tipoContenidoError);
    } else if (!this.esAltaAdmin && !!(this.alias || '').trim() && this.aliasLenError) {
      msgs.push(this.aliasLenError);
    }
    if (this.esAltaAdmin && this.deptoError) msgs.push(this.deptoError);
    if (this.showPasswordFields) {
      if (this.pwdIssues.length > 0) msgs.push('La contraseña no cumple los requisitos.');
      if (this.pwdMismatch) msgs.push('Las contraseñas no coinciden.');
      if ((this.pwnedCount ?? 0) > 0) msgs.push(`Esta contraseña aparece en filtraciones públicas ${this.pwnedCount} veces.`);
    }
    return msgs;
  }

  ngOnInit(): void {
    if (!this.rolFijo && this.modoAdminCreador) this.rolFijo = 'GESTOR_CONTENIDO';
    if (this.esAltaCreador) { this.role = 'Gestor de Contenido'; this.vip = false; this.fechaNac = ''; }
    else if (this.esAltaAdmin) { this.role = 'Administrador'; this.vip = false; this.fechaNac = ''; if (!this.pedirPwdAdmin) { this.pwd = ''; this.pwd2 = ''; } }
  }

  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }

  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') { void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' }); }
  private handleFormError(message: string) {
    const firstInvalid = document.querySelector('.input.input-error');
    (firstInvalid as HTMLElement)?.focus();
    this.showAlert('Revisa el formulario', message, 'error');
  }

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

  private async sha1Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  private async checkPasswordPwned(password: string): Promise<number> {
    if (!password) return 0;
    const fullHash = await this.sha1Hex(password);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    const lines = (await res.text()).split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix?.toUpperCase() === suffix) return parseInt(countStr.replace(/\D/g, ''), 10) || 0;
    }
    return 0;
  }
  private async ensurePwnedChecked(): Promise<void> {
    if (!this.showPasswordFields) return;
    if (!this.pwd || this.pwd === this.pwnedCheckedFor) return;
    this.isCheckingPwned = true;
    try {
      this.pwnedCount = await this.checkPasswordPwned(this.pwd);
      this.pwnedCheckedFor = this.pwd;
    } catch {
      this.pwnedCount = null;
      this.pwnedCheckedFor = this.pwd;
    } finally {
      this.isCheckingPwned = false;
    }
  }
  async onPwdChange() {
    if (!this.showPasswordFields) return;
    this.pwnedCheckedFor = '';
    this.pwnedCount = null;
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    this.isCheckingPwned = !!this.pwd;
    this.pwnedDebounce = setTimeout(async () => { await this.ensurePwnedChecked(); }, 700);
  }

  private async ensureAliasChecked(): Promise<void> {
    if (this.esAltaAdmin) return;
    const value = this.alias.trim();
    if (!value || value.length < this.ALIAS_MIN || value.length > this.MAX.alias) {
      this.aliasUnique = null;
      this.aliasCheckedFor = '';
      return;
    }
    if (value === this.aliasCheckedFor) return;
    this.isCheckingAlias = true;
    try {
      const result = await firstValueFrom(this.usersService.checkAlias(value));
      this.aliasUnique = !!result?.available;
      this.aliasCheckedFor = value;
    } catch {
      this.aliasUnique = null;
      this.aliasCheckedFor = value;
    } finally {
      this.isCheckingAlias = false;
    }
  }
  onAliasChange() {
    if (this.esAltaAdmin) return;
    this.aliasUnique = null;
    this.aliasCheckedFor = '';
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    const value = this.alias.trim();
    if (!value || value.length < this.ALIAS_MIN || value.length > this.MAX.alias) return;
    this.isCheckingAlias = true;
    this.aliasDebounce = setTimeout(async () => { await this.ensureAliasChecked(); }, 600);
  }

  private async ensureEmailChecked(): Promise<void> {
    const value = this.email.trim().toLowerCase();
    if (!value || value === this.emailCheckedFor) return;
    if (!this.emailPattern.test(value)) { this.emailUnique = null; this.emailCheckedFor = ''; return; }
    this.isCheckingEmail = true;
    try {
      const result = await firstValueFrom(this.usersService.checkEmail(value));
      this.emailUnique = !!result?.available;
      this.emailCheckedFor = value;
    } catch {
      this.emailUnique = null;
      this.emailCheckedFor = value;
    } finally {
      this.isCheckingEmail = false;
    }
  }
  onEmailChange() {
    this.emailUnique = null;
    this.emailCheckedFor = '';
    if (this.emailDebounce) clearTimeout(this.emailDebounce);
    const value = this.email.trim();
    if (!value) return;
    this.isCheckingEmail = true;
    this.emailDebounce = setTimeout(async () => { await this.ensureEmailChecked(); }, 600);
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(avatar: string) { this.selectedAvatar = avatar; this.foto = avatar; self.setTimeout(() => {}, 0); this.closeAvatarModal(); }

  onRoleChange(val: string) {
    if (this.rolFijo) return;
    this.role = val as any;
    if (val !== 'usuario') {
      this.vip = false;
    }
  }

  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (!this.checkRateLimit(now)) return;
    if (!this.checkLengthsFront()) return;
    if (!this.checkAvatarSelected()) return;
    if (!this.checkMinAge()) return;
    if (!(await this.checkEmailAvailability())) return;
    if (!(await this.checkAliasRules())) return;
    if (!this.checkAdminFields()) return;
    if (!(await this.checkPasswordsBlock(form))) return;
    if (!this.checkGestorRequiredFields()) return;
    const base = this.buildPayload();
    this.isLoading = true;
    this.lastSubmitAt = now;
    await this.submitByRole(base);
  }

  private checkRateLimit(now: number): boolean {
    if (now - this.lastSubmitAt < 5000) { this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning'); return false; }
    return true;
  }
  private checkLengthsFront(): boolean { const msg = this.checkLengths(); if (msg) { this.handleFormError(msg); return false; } return true; }
  private checkAvatarSelected(): boolean { if (!this.foto) { this.showAlert('Falta avatar', 'Debes seleccionar una foto de perfil (obligatoria).', 'info'); return false; } return true; }
  private checkMinAge(): boolean { if (this.fechaNac && this.isUnder4) { this.handleFormError('No se permiten registros de menores de 4 años.'); return false; } return true; }
  private async checkEmailAvailability(): Promise<boolean> { await this.ensureEmailChecked(); if (this.emailUnique === false) { this.showAlert('Email en uso', 'Este email ya está registrado. Elige otro.', 'error'); return false; } return true; }

  private async checkAliasRules(): Promise<boolean> {
    if (this.isGestor) {
      const a = this.alias.trim();
      if (!a) { this.handleFormError('Para Gestor de Contenido, el alias es obligatorio.'); return false; }
      if (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) { this.handleFormError(`El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`); return false; }
      await this.ensureAliasChecked();
      if (this.aliasUnique !== true) { this.showAlert('Alias no disponible', 'El alias ya existe o no se ha podido verificar. Elige otro.', 'error'); return false; }
      return true;
    }
    if (!this.esAltaAdmin && !!this.alias.trim()) {
      const a = this.alias.trim();
      if (a.length < this.ALIAS_MIN || a.length > this.MAX.alias) { this.handleFormError(`El alias (si lo indicas) debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`); return false; }
      await this.ensureAliasChecked();
      if (this.aliasUnique === false) { this.showAlert('Alias no disponible', 'El alias ya existe. Elige otro o deja el campo vacío.', 'error'); return false; }
    }
    return true;
  }

  private checkAdminFields(): boolean { if (this.esAltaAdmin && !this.departamento.trim()) { this.handleFormError('Para Administrador, el departamento es obligatorio.'); return false; } return true; }

  private async checkPasswordsBlock(form: NgForm): Promise<boolean> {
    let formHasErrors = form.invalid || this.fechaInvalida;
    if (this.showPasswordFields) {
      const passwordErrors = this.pwdIssues.length > 0 || this.pwdMismatch;
      formHasErrors = formHasErrors || passwordErrors;
      if (formHasErrors) { this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.'); return false; }
      await this.ensurePwnedChecked();
      if ((this.pwnedCount ?? 0) > 0) { this.showAlert('Contraseña insegura', `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`, 'error'); return false; }
      return true;
    }
    if (formHasErrors) { this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.'); return false; }
    return true;
  }

  private checkGestorRequiredFields(): boolean {
    if (!this.isGestor) return true;
    const tipoOk = this.tipoContenido === 'Audio' || this.tipoContenido === 'Video';
    if (!this.especialidad.trim() || !tipoOk) { this.handleFormError('Para Gestor de Contenido, especialidad y tipo de contenido (Audio/Video) son obligatorios.'); return false; }
    if (this.descripcion != null) this.descripcion = this.descripcion.trim();
    return true;
  }

  private buildPayload(): any {
    const base: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email?.trim()?.toLowerCase(),
      vip: this.vip,
      role: this.esAltaAdmin ? 'Administrador' : this.esAltaCreador ? 'Gestor de Contenido' : this.role,
      foto: this.foto
    };
    if (!this.esAltaCreador && !this.esAltaAdmin && this.fechaNac) base.fechaNac = this.fechaNac;
    if (this.isGestor || (!this.esAltaAdmin && this.alias.trim())) base.alias = this.alias.trim();
    if (this.isGestor) { base.descripcion = (this.descripcion ?? '').trim() || null; base.especialidad = this.especialidad.trim(); base.tipoContenido = this.tipoContenido; }
    if (this.esAltaAdmin) base.departamento = this.departamento.trim();
    if (this.showPasswordFields) { base.pwd = this.pwd; base.pwd2 = this.pwd2; }
    return base;
  }

  private async submitByRole(base: any): Promise<void> {
    if (this.esAltaCreador) {
      this.usersService.crearCreadorComoAdmin(base).subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Creador dado de alta.', 'success'); this.creado.emit(); },
        error: (error) => this.handleHttpError(error)
      });
      return;
    }
    if (this.esAltaAdmin) {
      this.usersService.createAdminByAdmin(base)?.subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Administrador dado de alta.', 'success'); this.creado.emit(); },
        error: (error: any) => this.handleHttpError(error)
      }) ?? (() => { this.isLoading = false; })();
      return;
    }
    this.usersService.registrar(base).subscribe({
      next: () => { this.isLoading = false; this.showAlert('¡Éxito!', 'Registro correcto.', 'success'); this.router.navigate(['/auth']); },
      error: (error) => this.handleHttpError(error)
    });
  }

  private handleHttpError(error: any) {
    this.isLoading = false;
    this.mensajeError = 'Hubo un problema en el registro';
    if (error?.error) {
      if (typeof error.error === 'object' && error.error.message) this.mensajeError = error.error.message;
      else if (typeof error.error === 'string') {
        try { const obj = JSON.parse(error.error); if (obj.message) this.mensajeError = obj.message; }
        catch { this.mensajeError = error.error; }
      }
    }
    this.showAlert('Error', this.mensajeError, 'error');
  }

  ngOnDestroy() {
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    if (this.emailDebounce) clearTimeout(this.emailDebounce);
  }
}
