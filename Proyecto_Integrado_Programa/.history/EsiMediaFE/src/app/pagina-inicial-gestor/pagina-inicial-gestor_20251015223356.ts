import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';

@Component({
  selector: 'app-pagina-inicial-admin',
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit {

  // Información del usuario logueado
  userName = 'Administrador';
  userEmail = '';
  userRole = '';
  userInitials = 'U';
  userAvatarUrl: string | null = null;

  // Listado de usuarios (simulación)
  users: (UserDto & { tipoContenido?: 'AUDIO' | 'VIDEO' })[] = [];

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Cargar usuario logueado
    const currentUser = this.auth.getCurrentUser?.();
    if (currentUser) this.setLoggedUser(currentUser);

    // Simulación de carga de usuarios
    this.users = [
      { alias: 'ana', nombre: 'Ana Pérez', email: 'ana@mail.com', role: 'USUARIO', blocked: false, vip: true, tipoContenido: 'VIDEO' },
      { alias: 'luis', nombre: 'Luis Gómez', email: 'luis@mail.com', role: 'GESTOR_CONTENIDO', blocked: false, vip: false, tipoContenido: 'AUDIO' },
      { alias: 'maria', nombre: 'María Ruiz', email: 'maria@mail.com', role: 'ADMINISTRADOR', blocked: true, vip: false, tipoContenido: 'VIDEO' }
    ];
  }

  // Inicializar datos del usuario logueado
  private setLoggedUser(user: UserDto) {
    this.userName = user.nombre || user.email.split('@')[0];
    this.userEmail = user.email;
    this.userRole = this.mapRoleToLabel(user.role);
    this.userInitials = this.getInitials(this.userName);
    this.userAvatarUrl = (user as any)?.foto || null;
  }

  // Calcular iniciales del nombre
  private getInitials(name: string): string {
    return (name || '').split(/\s+/).map(n => n[0]).join('').toUpperCase() || 'U';
  }

  // Mapeo de roles a etiquetas legibles
  mapRoleToLabel(role?: UserDto['role']): string {
    const labels: Record<string, string> = {
      ADMINISTRADOR: 'Administrador',
      USUARIO: 'Usuario',
      GESTOR_CONTENIDO: 'Gestor de contenido'
    };
    return role ? labels[role] || 'Desconocido' : 'Desconocido';
  }

  // Manejar error al cargar avatar
  onAvatarError() {
    this.userAvatarUrl = null;
  }

  // Editar usuario
  editUser(user: UserDto) {
    console.log('Editar usuario', user);
    alert(`Editar usuario: ${user.alias}`);
  }

  // Bloquear/desbloquear usuario
  toggleBlockUser(user: UserDto) {
    user.blocked = !user.blocked;
  }

  // Eliminar usuario
  deleteUser(user: UserDto) {
    const confirmed = confirm(`¿Eliminar usuario ${user.alias}?`);
    if (confirmed) this.users = this.users.filter(u => u !== user);
  }

  // Cerrar sesión
  cerrarSesion() {
    if (confirm('¿Cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
}
