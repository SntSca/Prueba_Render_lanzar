import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { UserDto } from './models';

export type Role = UserDto['role'];

function roleHome(role: Role): string {
  switch (role) {
    case 'ADMINISTRADOR':     return '/admin';
    case 'GESTOR_CONTENIDO':  return '/gestor';
    case 'USUARIO':           return '/usuario';
    default:                  return '/auth/login';
  }
}

export function roleGuard(allowed: Role[]): CanActivateFn {
  return (): boolean | UrlTree => {
    const router = inject(Router);
    const auth   = inject(AuthService);

    const user = auth.getCurrentUser();
    if (!user) {
      return router.createUrlTree(['/auth/login']);
    }

    if (!allowed?.length || allowed.includes(user.role)) {
      return true;
    }

    return router.createUrlTree([roleHome(user.role)]);
  };
}

export const userOrReadOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const auth   = inject(AuthService);
  const readOnly = localStorage.getItem('users_readonly_mode') === '1';
  if (readOnly) return true;
  const user = auth.getCurrentUser();
  if (!user) return router.createUrlTree(['/auth/login']);
  if (user.role === 'USUARIO') return true;
  return router.createUrlTree([roleHome(user.role)]);
};
