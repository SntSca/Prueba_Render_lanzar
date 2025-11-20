import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { StatsService } from '../stats.service';
import { StatsResponse, TopReproItem, TopValItem, TopCatItem } from '../stats';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';

import Chart, { ChartConfiguration, ChartType } from 'chart.js/auto';

type TipoContenido = 'AUDIO' | 'VIDEO' | 'TODOS';
type Role = UserDto['role'];

const trim = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const roleLabel = (role?: Role | null): string =>
  ({ ADMINISTRADOR: 'Administrador', USUARIO: 'Usuario', GESTOR_CONTENIDO: 'Gestor de contenido' } as const)[role as Role] ?? 'Desconocido';
const computeInitials = (text: string) =>
  (trim(text) || 'U').split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
const normalizeAvatarUrl = (raw: unknown): string => {
  const s = trim(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
  return s;
};

@Component({
  selector: 'app-stats-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats-page.component.html',
  styleUrls: ['./stats-page.component.css'],
})
export class StatsPageComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly stats = inject(StatsService);
  private readonly auth  = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  userName = 'Usuario';
  userAlias: string | null = null;
  userEmail = '';
  userRole: Role = 'USUARIO';
  userRoleText = 'Usuario';
  userInitials = 'U';
  userAvatarUrl: string | null = null;

  loading = false;
  error: string | null = null;
  raw: StatsResponse | null = null;

  tipo: TipoContenido = 'TODOS';
  topKind: 'repro' | 'valor' | 'cat' = 'repro';
  chartKind: 'tarta' | 'barras' | 'lineas' = 'tarta';

  constructor() {}

  ngOnInit(): void {
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(sessionUser ?? null);

    this.load(this.userRole);

    setTimeout(() => this.renderChart(), 300);
  }

  get panelTitle(): string {
    return (this.userAlias?.trim() || this.userName?.trim() || 'Usuario');
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user'); if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return (parsed?.email && parsed?.role) ? (parsed as UserDto) : null;
    } catch { return null; }
  }

  private setLoggedUser(user: UserDto | null) {
    if (!user) return;
    const nombre = (trim(user.nombre) || user.email.split('@')[0]);

    this.userEmail = user.email;
    this.userRole  = user.role;
    this.userRoleText = roleLabel(user.role);
    this.userName  = nombre;
    this.userAlias = user.alias ?? null;
    this.userInitials = computeInitials(this.userAlias || nombre);

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        const alias = trim(u?.alias);
        if (alias) {
          this.userAlias = alias;
          this.userInitials = computeInitials(alias);
        }
        this.userAvatarUrl = normalizeAvatarUrl(u?.fotoUrl ?? u?.foto) || null;
        this.cdr.markForCheck();
      },
      error: () => { this.cdr.markForCheck(); }
    });
  }

  onAvatarError() { this.userAvatarUrl = null; }

  load(roleHeader: Role) {
    this.loading = true;
    this.error = null;

    let header: 'ADMINISTRADOR' | 'GESTOR_CONTENIDO' | 'USUARIO';
    switch (roleHeader) {
      case 'ADMINISTRADOR':
        header = 'ADMINISTRADOR';
        break;
      case 'GESTOR_CONTENIDO':
        header = 'GESTOR_CONTENIDO';
        break;
      default:
        header = 'USUARIO';
    }

    this.stats.getTops(header).subscribe({
      next: (res) => {
        this.raw = res;
        this.loading = false;
        this.renderChart();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.status === 403
          ? 'No autorizado: solo Administradores y Gestores.'
          : 'Error cargando estadísticas.';
      }
    });
  }

  private filtraTipo<T extends { tipo?: any }>(arr: T[]): T[] {
    if (!arr || this.tipo === 'TODOS') return arr;
    return arr.filter(x => (x as any).tipo === this.tipo);
  }

  get topRepro(): TopReproItem[] {
    const src = this.raw?.topReproducciones ?? [];
    return this.filtraTipo(src);
  }
  get topValor(): TopValItem[] {
    const src = this.raw?.topValoraciones ?? [];
    return this.filtraTipo(src);
  }
  get topCat(): TopCatItem[] {
    return this.raw?.topCategorias ?? [];
  }

  get currentTableTitle(): string {
    switch (this.topKind) {
      case 'repro': return 'Top 5 reproducciones';
      case 'valor': return 'Top 5 valoraciones';
      default:      return 'Top 5 categorías vistas';
    }
  }

  get currentChartTitle(): string {
    let tipo: string;
    switch (this.chartKind) {
      case 'tarta':  tipo = 'tarta';  break;
      case 'barras': tipo = 'barras'; break;
      default:       tipo = 'líneas';
    }
    return `${this.currentTableTitle} (${tipo})`;
  }

  onFilterChange() {
    this.renderChart();
  }

<<<<<<< HEAD
  // ====== Chart ======
=======
>>>>>>> HotFix_Sprint_2
  private buildChartData() {
    if (this.topKind === 'repro') {
      const data = this.topRepro;
      return { labels: data.map(d => d.titulo), values: data.map(d => d.reproducciones) };
    }
    if (this.topKind === 'valor') {
      const data = this.topValor;
      return { labels: data.map(d => d.titulo), values: data.map(d => +d.avg.toFixed(2)) };
    }
<<<<<<< HEAD
    const data = this.topCat; // categorías
=======
    const data = this.topCat; 
>>>>>>> HotFix_Sprint_2
    return { labels: data.map(d => d.especialidad), values: data.map(d => d.reproducciones) };
  }

  renderChart() {
<<<<<<< HEAD
    // Esperar a que el canvas exista
=======
>>>>>>> HotFix_Sprint_2
    setTimeout(() => {
      const canvas = this.chartCanvas?.nativeElement;
      if (!canvas) return;

      const { labels, values } = this.buildChartData();

<<<<<<< HEAD
      // Destruye anterior
=======
>>>>>>> HotFix_Sprint_2
      this.chart?.destroy();

      const typeMap: Record<typeof this.chartKind, ChartType> = {
        tarta: 'pie',
        barras: 'bar',
        lineas: 'line'
      };
      const chartType: ChartType = typeMap[this.chartKind];

      const colors = ['#8fb1ff','#b48cff','#ffb36b','#7bd3ff','#ffd86b'];

      const cfg: ChartConfiguration = {
        type: chartType,
        data: {
          labels,
          datasets: [{
            label: this.currentTableTitle,
            data: values,
            backgroundColor: chartType === 'pie' ? colors : undefined,
            borderColor: chartType !== 'pie' ? '#8fb1ff' : undefined,
            borderWidth: chartType === 'pie' ? 1 : 2,
            tension: chartType === 'line' ? 0.3 : 0
          } as any]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: this.chartKind === 'tarta'
              ? { left: 8, right: 28, top: 0, bottom: 0 }
              : { left: 0, right: 0, top: 0, bottom: 0 }
          },
          plugins: {
            legend: {
              position: this.chartKind === 'tarta' ? 'left' : 'top',
              labels: { boxWidth: 18 }
            },
            title: { display: false }
          },
          scales: (chartType === 'bar' || chartType === 'line') ? {
            x: { grid: { color: 'rgba(255,255,255,.08)' } },
            y: { grid: { color: 'rgba(255,255,255,.08)' } }
          } : undefined
        }
      };

      const ctx = canvas.getContext('2d');
<<<<<<< HEAD
      if (!ctx) return; // evita non-null assertion
=======
      if (!ctx) return; 
>>>>>>> HotFix_Sprint_2
      this.chart = new Chart(ctx, cfg);
    });
  }
}
