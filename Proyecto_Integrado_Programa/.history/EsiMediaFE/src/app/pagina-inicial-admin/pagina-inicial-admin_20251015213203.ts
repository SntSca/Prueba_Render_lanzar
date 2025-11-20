import { Component, OnDestroy, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro implements OnInit, OnDestroy {
  /** Forzar contexto de alta desde panel para reusar el form */
  @Input() rolFijo?: 'ADMINISTRADOR' | 'GESTOR_CONTENIDO';
  /** Mostrar contraseñas en alta de admin si lo pides explícitamente */
  @Input() pedirPwdAdmin = false;

  @Output() creado = new EventEmitter<void>();

  // Campos comunes
  nombre = '';
  apellidos = '';
  email = '';
  alias = '';
  fechaNac = '';
  // VIP sólo aplica a usuarios (se controla en HTML y en onRoleChange)
  vip = false;

  // Control de rol en UI
  role: 'usuario' | 'Gestor de Contenido' | 'Administrador' = 'usuario';
  get roleDisabled(): boolean { return !!this.rolFijo; }

  // Admin extra
  departamento = '';

  // Creador extra
  foto: string | null = null;
  descripcion = '';
  especialidad = '';
  tipoContenido: '' | 'Audio' | 'Video' = '';

  // Passwords
  pwd = '';
  pwd2 = '';
  showPwd = false;
  showPwd2 = false;

  // Estado UI
  termsAccepted = false;
  isLoading = false;
  private lastSubmitAt = 0;
  mensajeError = '';

  // Validaciones/async
  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  pwnedCount: number | null = null;
  pwnedCheckedFor = '';
  isCheckingPwned = false;
  private pwnedDebounce: any = null;

  aliasUnique: boolean | null = null;
  aliasCheckedFor = '';
  isCheckingAlias = false;
  private aliasDebounce: any = null;

  // Avatares
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

  constructor(private readonly usersService: UsersService) {}

  // ======= Derivados de contexto =======
  get esAltaCreador(): boolean { return this.rolFijo === 'GESTOR_CONTENIDO'; }
  get esAltaAdmin(): boolean { return this.rolFijo === 'ADMINISTRADOR'; }
  get isGestor(): boolean {
    return this.esAltaCreador || this.role === 'Gestor de Contenido';
  }
  get showPasswordFields(): boolean {
    // Para admin no se piden passwords salvo que lo fuerces
    return !this.esAltaAdmin || this.pedirPwdAdmin;
  }
  get hasPwd(): boolean { return this.pwd.trim().length > 0; }

  ngOnInit(): void {
    if (this.esAltaCreador) {
      this.role = 'Gestor de Contenido';
      this.vip = false;                 // VIP NO aplica a creadores
      this.termsAccepted = true;
      this.fechaNac = '';
    } else if (this.esAltaAdmin) {
      this.role = 'Administrador';
      this.vip = false;                 // VIP NO aplica a admins
      this.termsAccepted = true;
      this.fechaNac = '';
      if (!this.pedirPwdAdmin) {        // sin password por defecto
        this.pwd = '';
        this.pwd2 = '';
      }
    }
  }

  // ======= Password helpers =======
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
    if (!this.showPasswordFields) return '';
    if (this.pwdScore <= 1) return 'Débil';
    if (this.pwdScore <= 3) return 'Media';
    return 'Fuerte';
  }
  get pwdMismatch(): boolean {
    if (!this.showPasswordFields) return false;
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  get fechaInvalida(): boolean {
    if (this.esAltaAdmin) return false;
    if (!this.fechaNac) return false;
    return new Date(this.fechaNac) > new Date();
  }

  get pwnedSeverity(): 'ok' | 'warn' | 'unknown' {
    if (!this.showPasswordFields || !this.hasPwd || this.isCheckingPwned || this.pwnedCount === null) return 'unknown';
    return (this.pwnedCount ?? 0) > 0 ? 'warn' : 'ok';
  }
  get pwnedMessage(): string {
    if (!this.showPasswordFields || !this.hasPwd) return '';
    if (this.isCheckingPwned) return 'Comprobando en filtraciones públicas…';
    if (this.pwnedCount === null) return 'No se pudo verificar ahora. Intenta de nuevo más tarde.';
    if ((this.pwnedCount ?? 0) > 0) return `⚠️ Aparece en filtraciones <b>${this.pwnedCount}</b> veces. Elige otra.`;
    return '✅ No aparece en filtraciones conocidas.';
  }

  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }

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
    if (!this.pwd || this.pwnedCheckedFor === this.pwd) return;
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
    this.pwnedDebounce = setTimeout(async () => {
      await this.ensurePwnedChecked();
    }, 700);
  }

  // ======= Alias =======
  private async ensureAliasChecked(): Promise<void> {
    const value = this.alias.trim();
    if (!value || value === this.aliasCheckedFor) return;
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
    this.aliasUnique = null;
    this.aliasCheckedFor = '';
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    const value = this.alias.trim();
    if (!value) return;
    this.isCheckingAlias = true;
    this.aliasDebounce = setTimeout(async () => {
      await this.ensureAliasChecked();
    }, 600);
  }

  // ======= Avatares =======
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.foto = avatar;
    this.closeAvatarModal();
  }

  // ======= Cambio de rol (reglas VIP) =======
  onRoleChange(val: string) {
    if (this.rolFijo) return; // si viene fijado desde el padre ignoramos cambios
    this.role = val as any;
    // VIP solo para 'usuario'. Si cambia a otro rol, lo desactivamos
    if (this.role !== 'usuario') this.vip = false;
  }

  // ======= Submit =======
  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') {
    void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' });
  }
  private handleFormError(message: string) {
    const firstInvalid = document.querySelector('.input.input-error') as HTMLElement | null;
    firstInvalid?.focus();
    this.showAlert('Revisa el formulario', message, 'error');
  }
  private handleHttpError(error: any) {
    this.isLoading = false;
    this.mensajeError = 'Hubo un problema en el registro';
    if (error?.error) {
      if (typeof error.error === 'object' && error.error.message) this.mensajeError = error.error.message;
      else if (typeof error.error === 'string') {
        try {
          const obj = JSON.parse(error.error);
          if (obj.message) this.mensajeError = obj.message;
        } catch {
          this.mensajeError = error.error;
        }
      }
    }
    this.showAlert('Error', this.mensajeError, 'error');
  }

  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (now - this.lastSubmitAt < 5000)
      return this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning');

    // Condiciones generales según contexto
    if (!this.esAltaCreador && !this.esAltaAdmin && !this.termsAccepted)
      return this.showAlert('Falta aceptación', 'Debes aceptar los Términos y la Política de Privacidad.', 'info');

    if (!this.foto)
      return this.showAlert('Falta avatar', 'Debes seleccionar una foto de perfil (obligatoria).', 'info');

    if (!this.alias.trim())
      return this.showAlert('Alias obligatorio', 'Debes indicar un alias.', 'info');

    await this.ensureAliasChecked();
    if (this.aliasUnique !== true)
      return this.showAlert('Alias no disponible', 'El alias ya existe o no se ha podido verificar. Elige otro.', 'error');

    // Validaciones específicas
    let formHasErrors = form.invalid || this.fechaInvalida;

    if (this.esAltaAdmin && !this.departamento.trim()) {
      return this.handleFormError('Para Administrador, el departamento es obligatorio.');
    }

    if (this.showPasswordFields) {
      formHasErrors = formHasErrors || this.pwdIssues.length > 0 || this.pwdMismatch;
      if (formHasErrors)
        return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');

      await this.ensurePwnedChecked();
      if ((this.pwnedCount ?? 0) > 0)
        return this.showAlert('Contraseña insegura',
          `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`,
          'error');
    } else if (formHasErrors) {
      return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');
    }

    if (this.isGestor) {
      if (!this.descripcion.trim() || !this.especialidad.trim() || !(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video')) {
        return this.handleFormError('Para Gestor de Contenido, descripción, especialidad y tipo de contenido son obligatorios.');
      }
    }

    // Payload (VIP solo si es registro normal y rol usuario)
    const base: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email?.trim()?.toLowerCase(),
      alias: this.alias.trim(),
      role: this.esAltaAdmin ? 'Administrador' : (this.esAltaCreador ? 'Gestor de Contenido' : this.role),
      foto: this.foto
    };

    if (!this.esAltaCreador && !this.esAltaAdmin && this.fechaNac) base.fechaNac = this.fechaNac;
    if (!this.esAltaCreador && !this.esAltaAdmin && this.role === 'usuario') base.vip = this.vip === true;

    if (this.isGestor) {
      base.descripcion = this.descripcion.trim();
      base.especialidad = this.especialidad.trim();
      base.tipoContenido = this.tipoContenido;
    }
    if (this.esAltaAdmin) base.departamento = this.departamento.trim();
    if (this.showPasswordFields) { base.pwd = this.pwd; base.pwd2 = this.pwd2; }

    // Petición
    this.isLoading = true;
    this.lastSubmitAt = now;

    if (this.esAltaCreador) {
      this.usersService.crearCreadorComoAdmin(base).subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Creador dado de alta.', 'success'); this.creado.emit(); },
        error: (e) => this.handleHttpError(e)
      });
      return;
    }

    if (this.esAltaAdmin) {
      // Implementa crearAdminComoAdmin en tu UsersService (ya lo hiciste antes)
      (this.usersService as any).crearAdminComoAdmin?.(base)?.subscribe({
        next: () => { this.isLoading = false; this.showAlert('¡Listo!', 'Administrador dado de alta.', 'success'); this.creado.emit(); },
        error: (e: any) => this.handleHttpError(e)
      }) ?? (() => {
        this.isLoading = false;
        this.showAlert('Pendiente de backend', 'Implementa UsersService.crearAdminComoAdmin(base).', 'info');
      })();
      return;
    }

    // Registro normal
    this.usersService.registrar(base).subscribe({
      next: () => { this.isLoading = false; this.showAlert('¡Éxito!', 'Registro correcto.', 'success'); },
      error: (e) => this.handleHttpError(e)
    });
  }

  ngOnDestroy() {
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
  }
}
