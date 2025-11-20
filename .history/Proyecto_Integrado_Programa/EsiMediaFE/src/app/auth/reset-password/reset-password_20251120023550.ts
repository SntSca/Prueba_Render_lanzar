import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { API_BASE_URL } from './auth/app.config';


@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword {
  token = '';
  pwd = '';
  pwd2 = '';
  showPwd = false;
  showPwd2 = false;
  cargando = false;

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  togglePwd() { this.showPwd = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  get requisitos(): string[] {
    const errores: string[] = [];
    if (this.pwd.length < 8) errores.push('Al menos 8 caracteres');
    if (!/[A-Z]/.test(this.pwd)) errores.push('Una letra mayúscula');
    if (!/[a-z]/.test(this.pwd)) errores.push('Una letra minúscula');
    if (!/\d/.test(this.pwd)) errores.push('Un número');
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(this.pwd)) errores.push('Un carácter especial');
    return errores;
  }

  get coincide(): boolean {
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  async onSubmit() {
    if (this.requisitos.length > 0 || this.coincide || !this.token) {
      Swal.fire('Error', 'Revisa los campos: la contraseña debe cumplir los requisitos y coincidir', 'error');
      return;
    }

    try {
      await this.ensurePwnedChecked();
    } catch {
      return;
    }

    this.cargando = true;
    this.http.post('http://localhost:8081/users/reset-password', {
      token: this.token,
      newPassword: this.pwd
    }).subscribe({
      next: (res: any) => {
        this.cargando = false;
        Swal.fire('Éxito', res.message || 'Contraseña restablecida correctamente', 'success')
          .then(() => this.router.navigate(['/auth']));
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire('Error', err.error?.message || 'Error al restablecer la contraseña', 'error');
      }
    });
  }

  private async sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

private async checkPasswordPwned(password: string): Promise<number> {
  if (!password) return 0;

  const fullHash = await this.sha1Hex(password);
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' }
  });

  if (!res.ok) throw new Error('Fallo consultando diccionario online');
  const text = await res.text();

  const lines = text.split('\n');
  for (const line of lines) {
    const [hashSuffix, countStr] = line.trim().split(':');
    if (hashSuffix?.toUpperCase() === suffix) {
      const count = parseInt((countStr || '0').replace(/\D/g, ''), 10) || 0;
      return count;
    }
  }
  return 0;
}

private async ensurePwnedChecked(): Promise<void> {
  if (!this.pwd) return;
  this.cargando = true;
  try {
    const count = await this.checkPasswordPwned(this.pwd);
    if (count > 0) {
      Swal.fire({
        title: 'Contraseña insegura',
        html: `Esta contraseña aparece en filtraciones públicas <b>${count}</b> veces.<br>Por favor, elige otra distinta.`,
        icon: 'error',
        confirmButtonText: 'Cambiar contraseña'
      });
      throw new Error('Contraseña comprometida');
    }
  } finally {
    this.cargando = false;
  }
}


}
