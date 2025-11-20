import { Component, HostListener, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { SessionTimeoutService } from './auth/session-timeout.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('EsiMediaFE');

  constructor(
    private readonly sessionTimeout: SessionTimeoutService,
    private readonly router: Router
  ) {}

  get warningVisible$() {
    return this.sessionTimeout.warningVisible$;
  }

  get countdown$() {
    return this.sessionTimeout.countdown$;
  }

  get absoluteWarningVisible$() {
    return this.sessionTimeout.absoluteWarningVisible$;
  }

  get absoluteCountdown$() {
    return this.sessionTimeout.absoluteCountdown$;
  }

  ngOnInit(): void {
    this.sessionTimeout.start();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url || '';
        if (url.startsWith('/auth')) {
          this.sessionTimeout.stop();
        } else {
          this.sessionTimeout.start();
        }
      });
  }

  @HostListener('document:click')
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:wheel')
  onUserActivity(): void {
    this.sessionTimeout.userActivity();
  }

  onStayConnectedClick(): void {
    this.sessionTimeout.stayConnectedFromModal();
  }

  onLogoutClick(): void {
    this.sessionTimeout.logoutFromModal();
  }

  onContinueAbsoluteClick(): void {
    this.sessionTimeout.continueAbsoluteSession();
  }

  onAbsoluteLogoutClick(): void {
    this.sessionTimeout.logoutFromModal();
  }
}
