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

  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

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

  get esAltaCreador(): boolean {
    return this.rolFijo === 'GESTOR_CONTENIDO' || this.modoAdminCreador === true;
  }
  get esAltaAdmin(): boolean {
    return this.rolFijo === 'ADMINISTRADOR';
  }
  get isGestor(): boolean {
    return this.esAltaCreador || this.role === 'Gestor de Contenido';
  }
  get showPasswordFields(): boolean {
    return this.esAltaAdmin ? this.pedirPwdAdmin : true;
  }
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
  get isUnder4(): boolean {
    const a = this.ageYears;
    return a !== null && a < 4;
  }
  get fechaInvalida(): boolean {
    if (!this.fechaNac) return false;
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
    if (!this.showPasswordFields) return '';
    if (this.pwdScore <= 1) return 'Débil';
    if (this.pwdScore <= 3) return 'Media';
    return 'Fuerte';
  }
  get pwdMismatch(): boolean {
    if (!this.showPasswordFields) return false;
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  get extraDisabled(): boolean {
    if (!this.foto) return true;
    if (this.fechaNac && this.isUnder4) return true;
    if (this.esAltaAdmin && !this.departamento.trim()) return true;
    if (this.isGestor) {
      const tipoOk = this.tipoContenido === 'Audio' || this.tipoContenido === 'Video';
      if (!this.alias.trim()) return true;
      if (this.aliasUnique === false) return true;
      if (!this.especialidad.trim() || !tipoOk) return true;
    } else {
      if (this.alias.trim() && this.aliasUnique === false) return true;
    }
    if (this.emailUnique === false) return true;
    if (this.showPasswordFields) {
      if (this.pwdIssues.length > 0 || this.pwdMismatch) return true;
      if ((this.pwnedCount ?? 0) > 0) return true;
    }
    return false;
  }

  ngOnInit(): void {
    if (!this.rolFijo && this.modoAdminCreador) {
      this.rolFijo = 'GESTOR_CONTENIDO';
    }
    if (this.esAltaCreador) {
      this.role = 'Gestor de Contenido';
      this.vip = false;
      this.fechaNac = '';
    } else if (this.esAltaAdmin) {
      this.role = 'Administrador';
      this.vip = false;
      this.fechaNac = '';
      if (!this.pedirPwdAdmin) {
        this.pwd = '';
        this.pwd2 = '';
      }
    }
  }

  togglePwd()  { if (this.showPasswordFields) this.showPwd  = !this.showPwd; }
  togglePwd2() { if (this.showPasswordFields) this.showPwd2 = !this.showPwd2; }

  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') {
    void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' });
  }
  private handleFormError(message: string) {
    const firstInvalid = document.querySelector('.input.input-error') as HTMLElement | null;
    firstInvalid?.focus();
    this.showAlert('Revisa el formulario', message, 'error');
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
    this.pwnedDebounce = setTimeout(async () => {
      await this.ensurePwnedChecked();
    }, 700);
  }

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

  private async ensureEmailChecked(): Promise<void> {
    const value = this.email.trim().toLowerCase();
    if (!value || value === this.emailCheckedFor) return;
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
    this.emailDebounce = setTimeout(async () => {
      await this.ensureEmailChecked();
    }, 600);
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.foto = avatar;
    self.setTimeout(() => {}, 0);
    this.closeAvatarModal();
  }
  onRoleChange(val: string) {
    if (this.rolFijo) return;
    this.role = val as any;
    if (val !== 'usuario') this.vip = false;
    if (val === 'Gestor de Contenido' && !this.alias.trim()) {
      this.aliasUnique = null;
      this.isCheckingAlias = false;
    }
  }

  private checkLengths(): string | null {
    if (this.nombre.length > 100) return 'Nombre demasiado largo.';
    if (this.apellidos.length > 120) return 'Apellidos demasiado largos.';
    if (this.email.length > 120) return 'Email demasiado largo.';
    if (this.alias.length > 12) return 'El alias tiene un máximo de 12 caracteres.';
    if (this.especialidad.length > 60) return 'Especialidad demasiado larga.';
    if (this.descripcion.length > 500) return 'Descripción demasiado larga.';
    if (this.departamento.length > 120) return 'Departamento demasiado largo.';
    return null;
  }

  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (now - this.lastSubmitAt < 5000)
      return this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning');
    const lenErr = this.checkLengths();
    if (lenErr) return this.handleFormError(lenErr);
    if (!this.foto)
      return this.showAlert('Falta avatar', 'Debes seleccionar una foto de perfil (obligatoria).', 'info');
    if (this.fechaNac && this.isUnder4) {
      return this.handleFormError('No se permiten registros de menores de 4 años.');
    }
    await this.ensureEmailChecked();
    if (this.emailUnique === false) {
      return this.showAlert('Email en uso', 'Este email ya está registrado. Elige otro.', 'error');
    }
    if (this.isGestor) {
      if (!this.alias.trim()) {
        return this.handleFormError('Para Gestor de Contenido, el alias es obligatorio.');
      }
      await this.ensureAliasChecked();
      if (this.aliasUnique !== true) {
        return this.showAlert('Alias no disponible', 'El alias ya existe o no se ha podido verificar. Elige otro.', 'error');
      }
    } else if (!this.esAltaAdmin && !!this.alias.trim()) {
      await this.ensureAliasChecked();
      if (this.aliasUnique === false) {
        return this.showAlert('Alias no disponible', 'El alias ya existe. Elige otro o deja el campo vacío.', 'error');
      }
    }

    let formHasErrors = form.invalid || this.fechaInvalida;

    if (this.esAltaAdmin && !this.departamento.trim()) {
      return this.handleFormError('Para Administrador, el departamento es obligatorio.');
    }

    if (this.showPasswordFields) {
      formHasErrors = formHasErrors || this.pwdIssues.length > 0 || this.pwdMismatch;
      if (formHasErrors) {
        return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');
      }
      await this.ensurePwnedChecked();
      if ((this.pwnedCount ?? 0) > 0)
        return this.showAlert(
          'Contraseña insegura',
          `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`,
          'error'
        );
    } else if (formHasErrors) {
      return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');
    }
    if (this.isGestor) {
      if (!this.especialidad.trim() || !(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video')) {
        return this.handleFormError('Para Gestor de Contenido, especialidad y tipo de contenido (Audio/Video) son obligatorios.');
      }
      if (this.descripcion != null) this.descripcion = this.descripcion.trim();
    }
    const base: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email?.trim()?.toLowerCase(),
      vip: this.vip,
      role: (() => {
        if (this.esAltaAdmin) return 'Administrador';
        if (this.esAltaCreador) return 'Gestor de Contenido';
        return this.role;
      })(),
      foto: this.foto
    };

    if (!this.esAltaCreador && !this.esAltaAdmin && this.fechaNac) {
      base.fechaNac = this.fechaNac;
    }
    if (this.isGestor || (!this.esAltaAdmin && this.alias.trim())) {
      base.alias = this.alias.trim();
    }

    if (this.isGestor) {
      base.descripcion = (this.descripcion ?? '').trim() || null;
      base.especialidad = this.especialidad.trim();
      base.tipoContenido = this.tipoContenido;
    }
    if (this.esAltaAdmin) {
      base.departamento = this.departamento.trim();
    }
    if (this.showPasswordFields) {
      base.pwd  = this.pwd;
      base.pwd2 = this.pwd2;
    }

    this.isLoading = true;
    this.lastSubmitAt = now;

    if (this.esAltaCreador) {
      this.usersService.crearCreadorComoAdmin(base).subscribe({
        next: () => {
          this.isLoading = false;
          this.showAlert('¡Listo!', 'Creador dado de alta.', 'success');
          this.creado.emit();
        },
        error: (error) => this.handleHttpError(error)
      });
      return;
    }

    if (this.esAltaAdmin) {
      this.usersService.createAdminByAdmin(base)?.subscribe({
        next: () => {
          this.isLoading = false;
          this.showAlert('¡Listo!', 'Administrador dado de alta.', 'success');
          this.creado.emit();
        },
        error: (error: any) => this.handleHttpError(error)
      }) ?? (() => { this.isLoading = false; })();
      return;
    }

    this.usersService.registrar(base).subscribe({
      next: () => {
        this.isLoading = false;
        this.showAlert('¡Éxito!', 'Registro correcto.', 'success');
        this.router.navigate(['/auth']);
      },
      error: (error) => this.handleHttpError(error)
    });
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

  ngOnDestroy() {
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    if (this.emailDebounce) clearTimeout(this.emailDebounce);
  }
}
