import { Component, OnDestroy, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

// ====== Tipos ======
type FixedRole = 'ADMINISTRADOR' | 'GESTOR_CONTENIDO';
type RoleUi = 'usuario' | 'Gestor de Contenido' | 'Administrador';
type PwnedState = 'ok' | 'warn' | 'unknown';
type AV = '' | 'Audio' | 'Video';
type DebounceKey = 'pwned' | 'alias' | 'email';
type UniqueKind = 'alias' | 'email';

// ====== Helpers PUROS (fuera de la clase) ======
const MAX = { alias: 12, nombre: 100, apellidos: 120, email: 120, especialidad: 60, descripcion: 500, departamento: 120 } as const;
const ALIAS_MIN = 3;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const trim = (s: string) => (s || '').trim();
const lower = (s: string) => trim(s).toLowerCase();
const isBlank = (s: string) => trim(s).length === 0;
const within = (v: string, min: number, max: number) => v.length >= min && v.length <= max;
const over = (v: string, max: number) => !!v && v.length > max;
const oneOf = <T extends string>(v: T, list: readonly T[]) => list.includes(v);
const bool = (b: any) => !!b;

const showAlert = (title: string, text: string, icon: 'error'|'info'|'warning'|'success') =>
  Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' });

// pequeño gestor de timeouts por clave
const makeDebouncer = () => {
  const store: Partial<Record<DebounceKey, any>> = {};
  const set = (key: DebounceKey, fn: () => void, ms: number) => {
    const t = store[key]; if (t) clearTimeout(t);
    store[key] = setTimeout(fn, ms);
  };
  const clearAll = () => Object.values(store).forEach(t => t && clearTimeout(t));
  return { set, clearAll };
};

// pwned (HIBP k-Anonymity)
async function sha1ForHIBP(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
async function checkPasswordPwned(password: string): Promise<number> {
  if (!password) return 0;
  const full = await sha1ForHIBP(password), pref = full.slice(0,5), suf = full.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${pref}`, { headers: { 'Add-Padding': 'true' } });
  if (!res.ok) throw new Error('Fallo consultando diccionario online');
  for (const line of (await res.text()).split('\n')) {
    const [hashSuffix, countStr] = line.trim().split(':');
    if ((hashSuffix||'').toUpperCase() === suf) return parseInt((countStr||'').replace(/\D/g,''),10) || 0;
  }
  return 0;
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro implements OnInit, OnDestroy {
  // ====== Entradas / Salidas ======
  @Input() rolFijo?: FixedRole;
  @Input() pedirPwdAdmin = false;
  @Input() modoAdminCreador = false;
  @Output() creado = new EventEmitter<void>();

  // ====== Estado ======
  readonly MAX = MAX;           // expuesto a plantilla si lo necesitas
  readonly emailPattern = EMAIL_RE;

  // Datos principales
  nombre = ''; apellidos = ''; email = ''; alias = ''; fechaNac = '';
  pwd = ''; pwd2 = ''; vip = false; role: RoleUi = 'usuario';
  departamento = ''; foto: string | null = null;
  descripcion = ''; especialidad = ''; tipoContenido: AV = '';
  tipoContenidoTouched = false; aliasTouched = false; especialidadTouched = false;

  // UI
  showPwd = false; showPwd2 = false; isLoading = false;
  private lastSubmitAt = 0; mensajeError = ''; rolSeleccionado = false;

  // Pwned
  pwnedCount: number | null = null; pwnedCheckedFor = ''; isCheckingPwned = false;

  // Unicidad
  aliasUnique: boolean | null = null; aliasCheckedFor = ''; isCheckingAlias = false;
  emailUnique: boolean | null = null; emailCheckedFor = ''; isCheckingEmail = false;

  // Avatares
  avatars: string[] = [
    'assets/avatars/avatar1.png','assets/avatars/avatar2.png','assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png','assets/avatars/avatar5.png','assets/avatars/avatar6.png'
  ];
  selectedAvatar: string | null = null; showAvatarModal = false;
  trackAvatar = (_: number, src: string) => src;

  // Servicios
  constructor(private readonly usersService: UsersService, private readonly router: Router) {}
  private readonly debouncer = makeDebouncer();

  // ====== Derivados ======
  get esAltaCreador()   { return this.rolFijo === 'GESTOR_CONTENIDO' || this.modoAdminCreador === true; }
  get esAltaAdmin()     { return this.rolFijo === 'ADMINISTRADOR'; }
  get isGestor()        { return this.esAltaCreador || this.role === 'Gestor de Contenido'; }
  get showPasswordFields() { return this.esAltaAdmin ? this.pedirPwdAdmin : true; }
  get hasPwd()          { return trim(this.pwd).length > 0; }
  get roleDisabled()    { return !!this.rolFijo; }

  get ageYears(): number | null {
    if (!this.fechaNac) return null;
    const d = new Date(this.fechaNac), t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
  }
  get isUnder4()       { const a = this.ageYears; return a !== null && a < 4; }
  get fechaInvalida()  { return !(this.esAltaAdmin || this.esAltaCreador) && !!this.fechaNac && new Date(this.fechaNac) > new Date(); }

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
  get pwdScore() {
    if (!this.showPasswordFields) return 0;
    const p = this.pwd;
    return Math.min(4, [p.length>=8, /[A-Z]/.test(p), /[a-z]/.test(p), /\d/.test(p), /[!@#$%^&*(),.?":{}|<>]/.test(p)].filter(bool).length);
  }
  get pwdStrengthLabel() {
    if (!this.showPasswordFields) return '';
    return this.pwdScore <= 1 ? 'Débil' : this.pwdScore <= 3 ? 'Media' : 'Fuerte';
  }
  get pwdMismatch() { return this.showPasswordFields && this.pwd2.length > 0 && this.pwd !== this.pwd2; }

  get aliasLenError(): string | null {
    const a = trim(this.alias); if (!a) return null;
    return within(a, ALIAS_MIN, MAX.alias) ? null : `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
  }
  get aliasRequiredError(): string | null {
    return this.isGestor && this.rolSeleccionado && isBlank(this.alias) && this.tipoContenidoTouched ? 'El alias es obligatorio para Gestor de Contenido.' : null;
  }
  get emailPatternError(): string | null {
    const v = trim(this.email); return v && !EMAIL_RE.test(v) ? 'Email no válido' : null;
  }
  get avatarError(): string | null { return this.selectedAvatar ? null : 'Debes seleccionar un avatar.'; }
  get deptoError(): string | null  { return this.esAltaAdmin && isBlank(this.departamento) ? 'El departamento es obligatorio.' : null; }
  get especialidadError(): string | null {
    return this.isGestor && this.rolSeleccionado && isBlank(this.especialidad) && this.tipoContenidoTouched ? 'Falta la especialidad.' : null;
  }
  get tipoContenidoError(): string | null {
    return this.tipoContenidoTouched && !oneOf(this.tipoContenido, ['Audio','Video',''] as const) ? 'Selecciona Audio o Video.' : null;
  }

  get nombreLenLeft()        { return MAX.nombre        - this.nombre.length; }
  get apellidosLenLeft()     { return MAX.apellidos     - this.apellidos.length; }
  get emailLenLeft()         { return MAX.email         - this.email.length; }
  get aliasLenLeft()         { return MAX.alias         - this.alias.length; }
  get deptoLenLeft()         { return MAX.departamento  - this.departamento.length; }
  get especialidadLenLeft()  { return MAX.especialidad  - this.especialidad.length; }
  get descripcionLenLeft()   { return MAX.descripcion   - this.descripcion.length; }
  
  get validationSummary(): string[] {
    const t = this;
    const msgs: string[] = [];
    const add = (cond: any, msg?: string | null) => cond && msg && msgs.push(msg);

    // Básicas
    add(true, t.checkLengths());
    add(t.avatarError, t.avatarError);
    add(true, t.validateAge());
    add(t.fechaInvalida, 'La fecha no puede ser futura.');
    add(t.emailUnique === false, 'Este email ya está registrado. Elige otro.');
    add(t.esAltaAdmin && t.deptoError, t.deptoError);
    
    if (t.isGestor) {
      add(t.aliasRequiredError, t.aliasRequiredError);
      add(t.aliasLenError, t.aliasLenError);
      add(t.aliasUnique === false, 'El alias ya existe. Elige otro.');
      add(t.especialidadError, t.especialidadError);
      add(t.tipoContenidoError, t.tipoContenidoError);
    } else if (t.alias?.trim()) {
      add(t.aliasLenError, t.aliasLenError);
    }

    // Contraseña
    if (t.showPasswordFields) {
      add(t.pwdIssues.length > 0, 'La contraseña no cumple los requisitos.');
      add(t.pwdMismatch, 'Las contraseñas no coinciden.');
      add((t.pwnedCount ?? 0) > 0, `Esta contraseña aparece en filtraciones públicas ${t.pwnedCount} veces.`);
    }

    return msgs;
  }


  // ====== Ciclo de vida ======
  ngOnInit(): void {
    if (!this.rolFijo && this.modoAdminCreador) this.rolFijo = 'GESTOR_CONTENIDO';
    if (this.esAltaCreador) { this.role = 'Gestor de Contenido'; this.vip = false; this.fechaNac = ''; }
    else if (this.esAltaAdmin) { this.role = 'Administrador'; this.vip = false; this.fechaNac = ''; if (!this.pedirPwdAdmin) { this.pwd = ''; this.pwd2 = ''; } }
  }
  ngOnDestroy() { this.debouncer.clearAll(); }

  // ====== UI ======
  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; this.closeAvatarModal(); }

  onRoleChange(val: string) {
    if (this.rolFijo) return;
    this.role = val as RoleUi; this.rolSeleccionado = true;
    if (val !== 'usuario') this.vip = false;
    if (val === 'Administrador' || val === 'Gestor de Contenido') this.fechaNac = '';
  }

  private handleFormError(message: string) {
    (document.querySelector('.input.input-error') as HTMLElement)?.focus?.();
    showAlert('Revisa el formulario', message, 'error');
  }

  // ====== Pwned ======
  async onPwdChange() {
    if (!this.showPasswordFields) return;
    this.pwnedCheckedFor = ''; this.pwnedCount = null;
    this.debouncer.set('pwned', async () => {
      this.isCheckingPwned = !!this.pwd;
      if (!this.pwd || this.pwd === this.pwnedCheckedFor) { this.isCheckingPwned = false; return; }
      try { this.pwnedCount = await checkPasswordPwned(this.pwd); this.pwnedCheckedFor = this.pwd; }
      catch { this.pwnedCount = null; this.pwnedCheckedFor = this.pwd; }
      finally { this.isCheckingPwned = false; }
    }, 700);
  }

  // ====== Alias/Email únicos ======
  private setUniqueStatus(kind: UniqueKind, status: boolean | null, value: string) {
    if (kind === 'alias') { this.aliasUnique = status; this.aliasCheckedFor = value; }
    else { this.emailUnique = status; this.emailCheckedFor = value; }
  }
  private setCheckingStatus(kind: UniqueKind, status: boolean) {
    if (kind === 'alias') this.isCheckingAlias = status; else this.isCheckingEmail = status;
  }
  private async performUniqueCheck(kind: UniqueKind, value: string): Promise<boolean | null> {
    if (kind === 'alias') {
      const r = await firstValueFrom(this.usersService.checkAlias(value));
      this.setUniqueStatus(kind, !!r?.available, value);
      return this.aliasUnique;
    } else {
      const r = await firstValueFrom(this.usersService.checkEmail(value));
      this.setUniqueStatus(kind, !!r?.available, value);
      return this.emailUnique;
    }
  }
  private async ensureUnique(kind: UniqueKind, raw: string): Promise<boolean | null> {
    const value = kind === 'email' ? lower(raw) : trim(raw);
    if ((kind === 'alias' && this.esAltaAdmin) || isBlank(value)) { this.setUniqueStatus(kind, null, ''); return null; }
    if (kind === 'alias' && !within(value, ALIAS_MIN, MAX.alias)) { this.setUniqueStatus(kind, null, ''); return null; }
    if (kind === 'email' && !EMAIL_RE.test(value)) { this.setUniqueStatus(kind, null, ''); return null; }
    if (value === (kind === 'alias' ? this.aliasCheckedFor : this.emailCheckedFor)) return (kind === 'alias' ? this.aliasUnique : this.emailUnique);
    this.setCheckingStatus(kind, true);
    try { return await this.performUniqueCheck(kind, value); }
    catch { this.setUniqueStatus(kind, null, value); return null; }
    finally { this.setCheckingStatus(kind, false); }
  }
  onAliasChange() {
    if (this.esAltaAdmin) return;
    this.aliasUnique = null; this.aliasCheckedFor = '';
    const v = trim(this.alias); if (!v || !within(v, ALIAS_MIN, MAX.alias)) return;
    this.debouncer.set('alias', async () => { this.isCheckingAlias = true; await this.ensureUnique('alias', this.alias); }, 600);
  }
  onEmailChange() {
    this.emailUnique = null; this.emailCheckedFor = '';
    const v = trim(this.email); if (!v) return;
    this.debouncer.set('email', async () => { this.isCheckingEmail = true; await this.ensureUnique('email', this.email); }, 600);
  }

  // ====== Validaciones ======
  private validateAge(): string | null {
    return (!this.esAltaAdmin && !!this.fechaNac && this.isUnder4) ? 'No se permiten registros de menores de 4 años.' : null;
  }
  private checkLengths(): string | null {
    const { nombre, apellidos, email, departamento, especialidad, descripcion, alias, esAltaAdmin, isGestor } = this;
    const checks: Array<[boolean, string]> = [
      [over(nombre, MAX.nombre), `El nombre supera ${MAX.nombre} caracteres.`],
      [over(apellidos, MAX.apellidos), `Los apellidos superan ${MAX.apellidos} caracteres.`],
      [over(email, MAX.email), `El email supera ${MAX.email} caracteres.`],
      [over(departamento, MAX.departamento), `El departamento supera ${MAX.departamento} caracteres.`],
      [over(especialidad, MAX.especialidad), `La especialidad supera ${MAX.especialidad} caracteres.`],
      [over(descripcion, MAX.descripcion), `La descripción supera ${MAX.descripcion} caracteres.`],
      [!esAltaAdmin && over(alias, MAX.alias), `El alias supera ${MAX.alias} caracteres.`],
      [isGestor && !!alias && !within(alias, ALIAS_MIN, MAX.alias), `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`]
    ];
    const found = checks.find(([cond]) => cond);
    return found ? found[1] : null;
  }
  private async validateAliasBlock(): Promise<string | null> {
    const { isGestor, esAltaAdmin } = this;
    const a = trim(this.alias);
    if (isGestor) {
      if (!a) return 'Para Gestor de Contenido, el alias es obligatorio.';
      if (!within(a, ALIAS_MIN, MAX.alias)) return `El alias debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
      await this.ensureUnique('alias', a);
      return this.aliasUnique !== true ? 'El alias ya existe o no se ha podido verificar. Elige otro.' : null;
    }
    if (!esAltaAdmin && !isBlank(a)) {
      if (!within(a, ALIAS_MIN, MAX.alias)) return `El alias (si lo indicas) debe tener entre ${ALIAS_MIN} y ${MAX.alias} caracteres.`;
      await this.ensureUnique('alias', a);
      if (this.aliasUnique === false) return 'El alias ya existe. Elige otro o deja el campo vacío.';
    }
    return null;
  }
  private async validatePasswordsBlock(form: NgForm): Promise<string | null> {
    const basicInvalid = form.invalid || this.fechaInvalida;
    if (!this.showPasswordFields) return basicInvalid ? 'Hay campos con errores. Corrígelos y vuelve a intentarlo.' : null;
    if (basicInvalid || this.pwdIssues.length > 0 || this.pwdMismatch) return 'Hay campos con errores. Corrígelos y vuelve a intentarlo.';
    // pwned
    if (this.pwd && this.pwd !== this.pwnedCheckedFor) {
      this.isCheckingPwned = true;
      try { this.pwnedCount = await checkPasswordPwned(this.pwd); this.pwnedCheckedFor = this.pwd; }
      catch { this.pwnedCount = null; this.pwnedCheckedFor = this.pwd; }
      finally { this.isCheckingPwned = false; }
    }
    return (this.pwnedCount ?? 0) > 0 ? `Esta contraseña aparece en filtraciones públicas ${this.pwnedCount} veces.` : null;
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
    if (this.esAltaAdmin && isBlank(this.departamento)) return 'Para Administrador, el departamento es obligatorio.';
    const pwdMsg = await this.validatePasswordsBlock(form); if (pwdMsg) return pwdMsg;

    if (this.isGestor) {
      this.aliasTouched = this.especialidadTouched = this.tipoContenidoTouched = true;
      if (isBlank(this.especialidad) || !oneOf(this.tipoContenido, ['Audio','Video',''] as const)) {
        return 'Para Gestor de Contenido, especialidad y tipo de contenido (Audio/Video) son obligatorios.';
      }
      this.descripcion = trim(this.descripcion);
    }
    return null;
  }

  // ====== Submit ======
  private resolveRole() {
    return this.esAltaAdmin ? 'Administrador' : this.esAltaCreador ? 'Gestor de Contenido' : this.role;
  }
  private buildPayload(): any {
    const base: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: lower(this.email),
      vip: this.vip,
      role: this.resolveRole(),
      foto: this.foto
    };
    if (!(this.esAltaCreador || this.esAltaAdmin) && this.fechaNac) base.fechaNac = this.fechaNac;
    if (this.isGestor || (!this.esAltaAdmin && !isBlank(this.alias))) base.alias = trim(this.alias);
    if (this.isGestor) { base.descripcion = trim(this.descripcion) || null; base.especialidad = trim(this.especialidad); base.tipoContenido = this.tipoContenido; }
    if (this.esAltaAdmin) { base.departamento = trim(this.departamento); base.alias = null; }
    if (this.showPasswordFields) { base.pwd = this.pwd; base.pwd2 = this.pwd2; }
    return base;
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
    showAlert('Error', msg, 'error');
  }
  private submitByRole(base: any): void {
    const ok = () => { this.isLoading = false; showAlert('¡Éxito!', 'Registro correcto.', 'success'); this.router.navigate(['/auth']); };
    const creador = () => this.usersService.crearCreadorComoAdmin(base).subscribe({
      next: () => { this.isLoading = false; showAlert('¡Listo!', 'Creador dado de alta.', 'success'); this.creado.emit(); },
      error: (e) => this.handleHttpError(e)
    });
    const admin = () => (this.usersService.createAdminByAdmin(base)?.subscribe({
      next: () => { this.isLoading = false; showAlert('¡Listo!', 'Administrador dado de alta.', 'success'); this.creado.emit(); },
      error: (e) => this.handleHttpError(e)
    }) ?? (this.isLoading = false));
    const usuario = () => this.usersService.registrar(base).subscribe({ next: ok, error: (e) => this.handleHttpError(e) });

    (this.esAltaCreador ? creador : this.esAltaAdmin ? admin : usuario)();
  }

  async onSubmit(form: NgForm) {
    const now = Date.now();
    const msg = await this.preflightValidate(form, now);
    if (msg) { this.handleFormError(msg); return; }
    const base = this.buildPayload();
    this.isLoading = true; this.lastSubmitAt = now;
    this.submitByRole(base);
  }

  // ====== UI pwned ======
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
