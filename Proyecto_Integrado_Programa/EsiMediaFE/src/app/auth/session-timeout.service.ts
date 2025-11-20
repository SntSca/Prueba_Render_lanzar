import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly WARNING_MS = 14 * 60 * 1000;   
  private readonly EXTRA_MS = 15 * 60 * 1000;    

  private readonly ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;         
  private readonly ABSOLUTE_WARNING_MS = 1 * 60 * 1000;              
  private readonly ABSOLUTE_LOGOUT_DELAY_MS = 60 * 1000;             

  private warningTimeoutId: any = null;
  private logoutTimeoutId: any = null;
  private countdownIntervalId: any = null;

  private absoluteTimeoutId: any = null;
  private absoluteWarningTimeoutId: any = null;
  private absoluteCountdownInterval: any = null;

  private enabled = false;

  private readonly warningVisibleSubject = new BehaviorSubject<boolean>(false);
  readonly warningVisible$ = this.warningVisibleSubject.asObservable();

  private readonly countdownSubject = new BehaviorSubject<number | null>(null);
  readonly countdown$ = this.countdownSubject.asObservable();

  private readonly absoluteWarningVisibleSubject = new BehaviorSubject<boolean>(false);
  readonly absoluteWarningVisible$ = this.absoluteWarningVisibleSubject.asObservable();

  private readonly absoluteCountdownSubject = new BehaviorSubject<number | null>(null);
  readonly absoluteCountdown$ = this.absoluteCountdownSubject.asObservable();

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  start(): void {
    this.enabled = true;
    this.resetTimersIfLogged();
    this.startAbsoluteTimeout();
  }

  stop(): void {
    this.enabled = false;
    this.clearTimers();
    this.clearAbsoluteTimeouts();

    this.hideWarningModal();
    this.hideAbsoluteWarningModal();
  }

  userActivity(): void {
    if (!this.enabled) return;

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.clearTimers();
      this.hideWarningModal();
      return;
    }

    if (this.warningVisibleSubject.value) {
      this.hideWarningModal();
    }

    this.resetTimers(); 
  }

  stayConnectedFromModal(): void {
    if (!this.enabled) return;
    this.hideWarningModal();
    this.resetTimersIfLogged();
  }

  logoutFromModal(): void {
    this.forceLogout();
  }

  private resetTimersIfLogged(): void {
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.clearTimers();
      this.hideWarningModal();
      return;
    }
    this.resetTimers();
  }

  private resetTimers(): void {
    this.clearTimers();

    this.warningTimeoutId = setTimeout(
      () => this.showWarningModal(),
      this.WARNING_MS
    );

    this.logoutTimeoutId = setTimeout(
      () => this.forceLogout(),
      this.WARNING_MS + this.EXTRA_MS
    );
  }

  private clearTimers(): void {
    if (this.warningTimeoutId !== null) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    if (this.logoutTimeoutId !== null) {
      clearTimeout(this.logoutTimeoutId);
      this.logoutTimeoutId = null;
    }
  }

  private showWarningModal(): void {
    const user = this.auth.getCurrentUser();
    if (!user || !this.enabled) return;

    this.warningVisibleSubject.next(true);
    this.startCountdown();
  }

  private hideWarningModal(): void {
    this.warningVisibleSubject.next(false);
    this.countdownSubject.next(null);
    this.clearCountdown();
  }

  private startCountdown(): void {
    this.clearCountdown();
    let secondsLeft = this.EXTRA_MS / 1000;

    this.countdownSubject.next(secondsLeft);

    this.countdownIntervalId = setInterval(() => {
      secondsLeft -= 1;
      this.countdownSubject.next(secondsLeft);

      if (secondsLeft <= 0) {
        this.forceLogout();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private startAbsoluteTimeout(): void {
    this.clearAbsoluteTimeouts();

    this.absoluteWarningTimeoutId = setTimeout(() => {
      this.showAbsoluteWarningModal();
    }, this.ABSOLUTE_TIMEOUT_MS - this.ABSOLUTE_WARNING_MS);

    this.absoluteTimeoutId = setTimeout(() => {
      this.forceLogout();
    }, this.ABSOLUTE_TIMEOUT_MS);
  }

  private clearAbsoluteTimeouts(): void {
    if (this.absoluteWarningTimeoutId) {
      clearTimeout(this.absoluteWarningTimeoutId);
      this.absoluteWarningTimeoutId = null;
    }
    if (this.absoluteTimeoutId) {
      clearTimeout(this.absoluteTimeoutId);
      this.absoluteTimeoutId = null;
    }
    if (this.absoluteCountdownInterval) {
      clearInterval(this.absoluteCountdownInterval);
      this.absoluteCountdownInterval = null;
    }
  }

  private showAbsoluteWarningModal(): void {
    this.absoluteWarningVisibleSubject.next(true);
    this.startAbsoluteCountdown();
  }

  private hideAbsoluteWarningModal(): void {
    this.absoluteWarningVisibleSubject.next(false);
    this.absoluteCountdownSubject.next(null);

    if (this.absoluteCountdownInterval) {
      clearInterval(this.absoluteCountdownInterval);
      this.absoluteCountdownInterval = null;
    }
  }

  private startAbsoluteCountdown(): void {
    let secondsLeft = 60;

    this.absoluteCountdownSubject.next(secondsLeft);

    this.absoluteCountdownInterval = setInterval(() => {
      secondsLeft -= 1;
      this.absoluteCountdownSubject.next(secondsLeft);

      if (secondsLeft <= 0) {
        this.forceLogout();
      }
    }, 1000);
  }

  continueAbsoluteSession(): void {
    this.hideAbsoluteWarningModal();
    this.clearAbsoluteTimeouts();
    this.startAbsoluteTimeout();
    this.resetTimers();          
  }

  private forceLogout(): void {
    this.clearTimers();
    this.clearAbsoluteTimeouts();

    this.hideWarningModal();
    this.hideAbsoluteWarningModal();

    this.enabled = false;
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
