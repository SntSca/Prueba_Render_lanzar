import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-recover-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule], 
  templateUrl: './recover-password.html',
  styleUrls: ['./recover-password.css']
})
export class RecoverPassword {
  email: string = '';
  cargando: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  enviarCorreo() {
    if (!this.email) {
      Swal.fire('Error', 'Por favor, introduce un correo electrónico', 'error');
      return;
    }

    this.cargando = true;
    this.http.post('http://localhost:8081/users/forgot-password', { email: this.email }).subscribe({
      next: (res: any) => {
        this.cargando = false;
        Swal.fire('Éxito', res.message || 'Correo enviado correctamente', 'success');
        this.router.navigate(['/auth']);
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire('Error', err.error?.message || 'No se pudo enviar el correo', 'error');
      }
    });
  }
}
