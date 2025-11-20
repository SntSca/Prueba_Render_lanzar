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
  


  currentIndex = 0;
  menuOpen = false;
  private intervalId: any;

  toggleMenu() { this.menuOpen = !this.menuOpen; }



  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
