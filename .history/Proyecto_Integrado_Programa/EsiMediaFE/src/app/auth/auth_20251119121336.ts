import { Component, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.html',
  styleUrls: ['./auth.css'],
  imports: [
    RouterModule,
    CommonModule,
    FormsModule
  ]
})
export class Auth implements OnDestroy {
  
  fotos: string[] = [
    'assets/Hasta_el_ultimo_HOmbre.png',
    'assets/El_Joker.png',
    'assets/Piratas_del_caribe.png',
    'assets/Avatar.png',
    'assets/Garfield.png',
    'assets/Mikaela.jpeg'
  ];

  currentIndex = 0;
  menuOpen = false;
  private intervalId: any;

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.fotos.length) % this.fotos.length;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.fotos.length;
  }

  constructor(public router: Router) {
    this.intervalId = setInterval(() => this.next(), 3000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
