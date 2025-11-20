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
  private timer: any;

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

  ngOnDestroy(): void { this.clearTimer(); }

  private navigateWithTransition(url: string, user: UserDto) {
    const go = () => this.router.navigateByUrl(url, { replaceUrl: true, state: { user } });
    const anyDoc = document as any;
    anyDoc?.startViewTransition ? anyDoc.startViewTransition(go) : go();
  }
  private redirectByRole(user: UserDto) {
    const map: Record<UserDto['role'], string> = { ADMINISTRADOR:'/admin', USUARIO:'/usuario', GESTOR_CONTENIDO:'/gestor' };
    this.navigateWithTransition(map[user.role] ?? '/usuario', user);
  }

  private setLoading(v: boolean) { this.loading = v; }
  private clearMsgs() { this.errorMsg=''; this.okMsg=''; }
  private finish(user: UserDto, ok: string) {
    this.okMsg = ok;
    this.auth.saveSession(user);
    this.currentUser = user;
    this.step = 'done';
    this.redirectByRole(user);
  }
  private showCaptcha(token: string|null|undefined, img: string|null|undefined, reset?: () => void, msg?: string) {
    if (!(token && img)) return false;
    this.captchaToken = token;
    this.captchaImage = img;
    reset?.();
    if (msg) this.errorMsg = msg;
    this.step = 'captcha';
    return true;
  }
  private showMfa(method: MfaMethod|null|undefined, token: string|null|undefined) {
    if (!method || method === 'NONE') return false;
    this.mfaMethod = method;
    this.mfaToken = token ?? null;
    this.step = 'mfa';
    return true;
  }
  private handleCaptchaError(err: HttpErrorResponse, reset: () => void, msg: string) {
    const b = err?.error as BackendLoginResponse;
    if (err.status === 401 && b?.needMfa3 && b?.captchaToken && b?.captchaImage) {
      this.showCaptcha(b.captchaToken, b.captchaImage, reset, msg);
      return true;
    }
    return false;
  }

  submit() {
    if (this.form.invalid || this.loading || this.retryAfterSeconds !== null) return;
    this.setLoading(true); this.clearMsgs(); this.remainingAttempts = null;

    this.auth.login(this.form.value as any).subscribe({
      next: (r) => {
        this.setLoading(false);
        if (this.showCaptcha(r.captchaToken, r.captchaImage)) return;
        if (this.showMfa(r.mfaMethod, r.mfaToken)) return;
        if (r.user) { this.finish(r.user, `Bienvenido, ${r.user.nombre ?? r.user.email}`); return; }
        this.errorMsg = 'Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador.';
      },
      error: (err: HttpErrorResponse) => {
        this.setLoading(false);
        this.handleFriendlyError(err);
      }
    });
  }

  submitMfa() {
    if (!this.mfaToken || this.mfaForm.invalid || this.loading) return;
    this.setLoading(true); this.clearMsgs();
    const code = this.mfaForm.value.code ?? '';

    this.auth.verifyMfa({ mfaToken: this.mfaToken, code }).subscribe({
      next: (r) => {
        this.setLoading(false);
        if (this.showCaptcha(r.captchaToken, r.captchaImage, () => this.mfaForm.reset())) return;
        if (r?.user) { this.finish(r.user, 'Segundo factor verificado correctamente.'); return; }
        this.errorMsg = 'No se pudo verificar el segundo factor.';
      },
      error: (err: HttpErrorResponse) => {
        this.setLoading(false);
        if (this.handleCaptchaError(err, () => this.mfaForm.reset(), 'Código MFA incorrecto. Se ha generado un captcha.')) return;
        this.errorMsg = 'No se pudo verificar el segundo factor.';
      }
    });
  }

  submitCaptcha() {
    if (!this.captchaToken || this.captchaForm.invalid || this.loading) return;
    this.setLoading(true); this.clearMsgs();
    const answer = (this.captchaForm.value.answer ?? '').toString().trim();

    this.auth.verifyCaptcha({ captchaToken: this.captchaToken, answer }).subscribe({
      next: (r) => {
        this.setLoading(false);
        if (r?.user) { this.finish(r.user, 'Captcha verificado correctamente.'); return; }
        if (this.showCaptcha(r.captchaToken, r.captchaImage, () => this.captchaForm.reset(), 'Respuesta incorrecta. Se ha generado un nuevo captcha.')) return;
        this.errorMsg = 'No se pudo verificar el captcha.';
      },
      error: (err: HttpErrorResponse) => {
        this.setLoading(false);
        if (this.handleCaptchaError(err, () => this.captchaForm.reset(), 'Respuesta incorrecta. Inténtalo de nuevo con el nuevo captcha.')) return;
        this.errorMsg = 'No se pudo verificar el captcha.';
      }
    });
  }

  private handleFriendlyError(err: HttpErrorResponse) {
    this.errorMsg = 'Credenciales incorrectas.';
    const data = (err?.error ?? {}) as { message?: string; attemptsLeft?: number; retryAfterSec?: number; };
    if (typeof data.message === 'string' && data.message.trim()) this.errorMsg = data.message;
    this.remainingAttempts = Number.isFinite(data.attemptsLeft as number) ? Number(data.attemptsLeft) : null;
    if (Number.isFinite(data.retryAfterSec as number) && (data.retryAfterSec as number) > 0) this.startCountdown(Number(data.retryAfterSec));
  }

  private startCountdown(totalSeconds: number) {
    this.clearTimer();
    this.retryAfterSeconds = totalSeconds;
    this.countdown = totalSeconds;
    this.errorMsg = '';
    this.timer = setInterval(() => {
      this.countdown = Math.max(0, this.countdown - 1);
      if (this.countdown === 0) { this.clearTimer(); this.retryAfterSeconds = null; this.remainingAttempts = null; }
    }, 1000);
  }

  private clearTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
