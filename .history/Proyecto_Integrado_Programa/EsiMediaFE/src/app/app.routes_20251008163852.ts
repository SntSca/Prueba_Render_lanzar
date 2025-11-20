import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { Registro } from './registro/registro';
import { RecoverPassword } from './auth/recover-password/recover-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { PaginaInicialComponent } from './paginaInicial/paginaInicial';

export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'register', component: Registro },
      { path: 'recover-password', component: RecoverPassword },
      { path: 'reset-password', component: ResetPassword },
    ]
  },
  { path: 'pagina-inicial', component: PaginaInicialC }, 
  { path: '', redirectTo: 'pagina-inicial', pathMatch: 'full' } // default
];
