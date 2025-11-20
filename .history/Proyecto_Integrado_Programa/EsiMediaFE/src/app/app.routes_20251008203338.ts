import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { LoginComponent } from './auth/login';
import { Registro } from './registro/registro';
import { ForgotPasswordComponent } from './auth/forgot-password';

export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: Registro },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' }
];