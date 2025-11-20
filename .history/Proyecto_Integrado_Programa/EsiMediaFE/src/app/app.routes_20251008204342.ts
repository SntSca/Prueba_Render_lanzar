import { Routes } from '@angular/router';

// 📂 AUTH
import { Auth } from './auth/auth';
import { LoginComponent } from './auth/login';
import { Registro } from './registro/registro';
import { RecoverPasswordComponent } from './auth/recover-password/recover-password';
import { ResetPasswordComponent } from './auth/reset-password/reset-password';

// 📂 PÁGINAS INICIALES
import { PaginaInicialAdmin } from './pagina-inicial-admin/pagina-inicial-admin';
import { PaginaInicialUsuario } from './pagina-inicial-usuario/pagina-inicial-usuario';
import { PaginaInicialGestor } from './pagina-inicial-gestor/pagina-inicial-gestor';

// ✅ Definición de rutas
export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: Registro },
      { path: 'recover-password', component: RecoverPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },

  { path: '', redirectTo: 'auth', pathMatch: 'full' },

  { path: 'pagina-inicial-admin', component: PaginaInicialAdmin },
  { path: 'pagina-inicial-usuario', component: PaginaInicialUsuario },
  { path: 'pagina-inicial-gestor', component: PaginaInicialGestor }
];
