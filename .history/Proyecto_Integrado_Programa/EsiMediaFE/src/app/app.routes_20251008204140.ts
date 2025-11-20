import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { LoginComponent } from './auth/login';
import { Registro } from './registro/registro';
import { RecoverPassword } from './auth/recover-password/recover-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { PaginaInicialAdmin } from './pagina-inicial-admin/pagina-inicial-admin';
import { PaginaInicialUsuario } from './paginaInicialUsuario';
import { PaginaInicialGestor } from './pagina-inicial-gestor/pagina-inicial-gestor';


export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: Registro },
      { path: 'recover-password', component: RecoverPassword },
      { path: 'reset-password', component: ResetPassword },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'pagina-inicial-admin', component: PaginaInicialAdmin },
  { path: 'pagina-inicial-usuario', component: PaginaInicialUsuario },
  { path: 'pagina-inicial-gestor', component: PaginaInicialGestor }
];