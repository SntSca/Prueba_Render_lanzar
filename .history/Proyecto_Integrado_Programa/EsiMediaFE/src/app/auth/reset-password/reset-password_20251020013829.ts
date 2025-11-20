import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword {
  // UI
  showPwd = false;
  showPwd2 = false;
  cargando = false;

  // Modelo
  token = '';
  pwd = '';
  pwd2 = '';

  private readonly RESET_URL = 'http://localhost:8081/users/reset-password';

  constructor(route: ActivatedRoute, private http: HttpClient, private router: Router) {
    this.token = route.snapshot.queryParamMap.get('token') ?? '';
  }

  // --- Toggles ---
  togglePwd()  { this.showPwd  = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  // --- Validaciones de UI (derivadas) ---
  get requisitos(): string[] {
    const p = this.pwd;
    const tests: Array<[boolean, string]> = [
      [p.length >= 8, 'Al menos 8 caracteres'],
      (/[A-Z]/.test(p) ? [true, ''] : [false, 'Una letra mayúscula']),
      (/[a-z]/.test(p) ? [true, ''] : [false, 'Una letra minúscula']),
      (/\d/.test(p)    ? [true, ''] : [false, 'Un número']),
      (/[!@#$%^&*(),.?":{}|<>_-]/.test(p) ? [true, ''] : [false, 'Un carácter especial']),
    ];
    return tests.filter(([ok]) => !ok).map(([, msg]) => msg);
  }
  get coincide(): boolean { return this.pwd2.length > 0 && this.pwd !== this.pwd2; }

  // --- Submit principal ---
  async onSubmit() {
    const msg = this.validate();
    if (msg) return this.alertError(msg);

    const count = await this.safeCheckPwned(this.pwd);
    if (count > 0) {
      return this.alertError(
        `Esta contraseña aparece en filtraciones públicas <b>${count}</b> veces. Elige otra distinta.`
      );
    }

    this.cargando = true;
    this.http.post(this.RESET_URL, { token: this.token, newPassword: this.pwd }).subscribe({
      next: (res: any) => {
        this.cargando = false;
        this.alertOk(res?.message || 'Contraseña restablecida correctamente', () => this.router.navigate(['/auth']));
      },
      error: (err) => {
        this.cargando = false;
        this.alertError(err?.error?.message || 'Error al restablecer la contraseña');
      }
    });
  }

  // --- Validación compacta ---
  private validate(): string | null {
    if (!this.token) return 'Token inválido o ausente.';
    if (this.requisitos.length > 0) return 'La contraseña no cumple los requisitos.';
    if (this.coincide) return 'Las contraseñas no coinciden.';
    return null;
  }

  // --- HIBP (breached passwords) ---
  private async safeCheckPwned(password: string): Promise<number> {
    if (!password) return 0;
    try { return await this.checkPasswordPwned(password); }
    catch { return 0; } // En caso de error de red, no bloqueamos el flujo
  }

  private async sha1Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const buf  = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2,'0'))
      .join('')
      .toUpperCase();
  }

  private async checkPasswordPwned(password: string): Promise<number> {
    const full = await this.sha1Hex(password);
    const pref = full.slice(0,5), suf = full.slice(5);
    const res  = await fetch(`https://api.pwnedpasswords.com/range/${pref}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');

    for (const line of (await res.text()).split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if ((hashSuffix || '').toUpperCase() === suf) {
        return parseInt((countStr || '0').replace(/\D/g, ''), 10) || 0;
      }
    }
    return 0;
  }

  // --- Alerts helpers ---
  private alertError(html: string) {
    void Swal.fire({ title: 'Error', html, icon: 'error', confirmButtonText: 'Cerrar' });
  }
  private alertOk(text: string, then?: () => void) {
    void Swal.fire({ title: 'Éxito', text, icon: 'success', confirmButtonText: 'Continuar' }).then(() => then?.());
  }
}
