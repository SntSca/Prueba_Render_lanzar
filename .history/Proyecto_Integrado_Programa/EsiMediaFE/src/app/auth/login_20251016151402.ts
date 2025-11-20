import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BackendLoginResponse, MfaMethod, UserDto } from './models';

type Step = 'login' | 'mfa' | 'captcha' | 'done';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})

export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  loading = false;
  errorMsg = '';
  okMsg = '';
  showPwd = false;

  step: Step = 'login';

  mfaToken: string | null = null;
  mfaMethod: MfaMethod | null = null;
  captchaToken: string | null = null;
  captchaImage: string | null = null;

  remainingAttempts: number | null = null;
  retryAfterSeconds: number | null = null;
  countdown = 0;
  private timer: any ;

  currentUser: UserDto | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  mfaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(4)]],
  });

  captchaForm = this.fb.group({
    answer: ['', [Validators.required]],
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private navigateWithTransition(url: string, user: UserDto) {
    const go = () =>
      this.router.navigateByUrl(url, {
        replaceUrl: true,
        state: { user }, 
      });

    const anyDoc = document as any;
    if (anyDoc?.startViewTransition) {
      anyDoc.startViewTransition(go);
    } else {
      go();
    }
  }
  private redirectByRole(user: UserDto) {
    const map: Record<UserDto['role'], string> = {
      'ADMINISTRADOR': '/admin',
      'USUARIO': '/usuario',
      'GESTOR_CONTENIDO': '/gestor',
    };
    const target = map[user.role] ?? '/usuario';
    this.navigateWithTransition(target, user);
  }

  submit() {
    if (this.form.invalid || this.loading || this.retryAfterSeconds !== null) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';
    this.remainingAttempts = null;

    this.auth.login(this.form.value as any).subscribe({
      next: (res: BackendLoginResponse) => {
        this.loading = false;

        if (res.needMfa3) {
          this.captchaToken = res.captchaToken ?? null;
          this.captchaImage = res.captchaImage ?? null;
          this.step = 'captcha';
          return;
        }

        if (res.mfaMethod && res.mfaMethod !== 'NONE') {
          this.mfaMethod = res.mfaMethod;
          this.mfaToken = res.mfaToken ?? null;
          this.step = 'mfa';
          return;
        }

        if (res.user) {
          this.okMsg = `Bienvenido, ${res.user.nombre ?? res.user.email}`;
          this.auth.saveSession(res.user);
          this.currentUser = res.user;
          this.step = 'done';
          this.redirectByRole(res.user);
          return;
        }

        this.errorMsg = 'Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador.';
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.handleFriendlyError(err);
      },
    });
  }

  submitMfa() {
    if (!this.mfaToken || this.mfaForm.invalid || this.loading) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';

    const code = this.mfaForm.value.code ?? '';

    this.auth.verifyMfa({ mfaToken: this.mfaToken, code }).subscribe({
      next: (r: BackendLoginResponse) => {
        this.loading = false;

        if (r?.needMfa3) {
          this.captchaToken = r.captchaToken ?? null;
          this.captchaImage = r.captchaImage ?? null;
          this.step = 'captcha';
          return;
        }

        if (r?.user) {
          this.okMsg = 'Segundo factor verificado correctamente.';
          this.auth.saveSession(r.user);
          this.currentUser = r.user;
          this.step = 'done';
          this.redirectByRole(r.user);
          return;
        }

        this.errorMsg = 'No se pudo verificar el segundo factor.';
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;

        const body = err?.error as BackendLoginResponse;
        if (err.status === 401 && body?.needMfa3 && body?.captchaToken && body?.captchaImage) {
          this.captchaToken = body.captchaToken;
          this.captchaImage = body.captchaImage;
          this.mfaForm.reset();
          this.step = 'captcha';
          this.errorMsg = 'Código MFA incorrecto. Se ha generado un captcha.';
          return;
        }

        this.errorMsg = 'No se pudo verificar el segundo factor.';
      },
    });
  }

  submitCaptcha() {
    if (!this.captchaToken || this.captchaForm.invalid || this.loading) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';

    const answer = (this.captchaForm.value.answer ?? '').toString().trim();

    this.auth.verifyCaptcha({ captchaToken: this.captchaToken, answer }).subscribe({
      next: (r: BackendLoginResponse) => {
        this.loading = false;

        if (r?.user) {
          this.okMsg = 'Captcha verificado correctamente.';
          this.auth.saveSession(r.user);
          this.currentUser = r.user;
          this.step = 'done';
          this.redirectByRole(r.user);
          return;
        }

        if (r?.needMfa3 && r?.captchaToken && r?.captchaImage) {
          this.captchaToken = r.captchaToken;
          this.captchaImage = r.captchaImage;
          this.captchaForm.reset();
          this.errorMsg = 'Respuesta incorrecta. Se ha generado un nuevo captcha.';
          return;
        }

        this.errorMsg = 'No se pudo verificar el captcha.';
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;

        const body = err?.error as BackendLoginResponse;
        if (err.status === 401 && body?.needMfa3 && body?.captchaToken && body?.captchaImage) {
          this.captchaToken = body.captchaToken;
          this.captchaImage = body.captchaImage;
          this.captchaForm.reset();
          this.errorMsg = 'Respuesta incorrecta. Inténtalo de nuevo con el nuevo captcha.';
          return;
        }

        this.errorMsg = 'No se pudo verificar el captcha.';
      },
    });
  }

  private handleFriendlyError(err: HttpErrorResponse) {
    this.errorMsg = 'Credenciales incorrectas.';

    const data = (err?.error ?? {}) as {
      message?: string;
      attemptsLeft?: number;
      retryAfterSec?: number;
    };

    if (typeof data.message === 'string' && data.message.trim()) {
      this.errorMsg = data.message;
    }

    if (Number.isFinite(data.attemptsLeft as number)) {
      this.remainingAttempts = Number(data.attemptsLeft);
    } else {
      this.remainingAttempts = null;
    }

    if (Number.isFinite(data.retryAfterSec as number) && (data.retryAfterSec as number) > 0) {
      const seconds = Number(data.retryAfterSec);
      this.startCountdown(seconds);
    }
  }

  private startCountdown(totalSeconds: number) {
    this.clearTimer();
    this.retryAfterSeconds = totalSeconds;
    this.countdown = totalSeconds;

    this.errorMsg = '';

    this.timer = setInterval(() => {
      this.countdown = Math.max(0, this.countdown - 1);
      if (this.countdown === 0) {
        this.clearTimer();
        this.retryAfterSeconds = null;
        this.remainingAttempts = null;
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
