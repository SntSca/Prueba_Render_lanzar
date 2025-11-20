import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { LoginComponent } from './auth/login';
import { Registro } from './registro/registro';
import { RecoverPassword } from './auth/recover-password/recover-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { PaginaInicialAdmin } from './pagina-inicial-admin/pagina-inicial-admin';
import { PaginaInicialUsuario } from './pagina-inicial-usuario/pagina-inicial-usuario';
import { PaginaInicialGestor } from './pagina-inicial-gestor/pagina-inicial-gestor';
import { roleGuard, userOrReadOnlyGuard } from './auth/auth.guard';
import { StatsPageComponent } from './stats/stats-page.component';

export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: Registro },
      { path: 'recover-password', component: RecoverPassword },
      { path: 'reset-password', component: ResetPassword },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  {
    path: 'stats',
    component: StatsPageComponent,
    canActivate: [roleGuard(['ADMINISTRADOR', 'GESTOR_CONTENIDO'])],
  },

  {
    path: 'admin',
    canActivate: [roleGuard(['ADMINISTRADOR'])],
    component: PaginaInicialAdmin,
  },

  {
    path: 'usuario',
    canActivate: [roleGuard(['USUARIO'])],
    component: PaginaInicialUsuario,
  },
  {
    path: 'usuarioReadOnly',
    canActivate: [userOrReadOnlyGuard],
    component: PaginaInicialUsuario,
  },

  {
    path: 'gestor',
    canActivate: [roleGuard(['GESTOR_CONTENIDO'])],
    component: PaginaInicialGestor,
  },

  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' },
];
