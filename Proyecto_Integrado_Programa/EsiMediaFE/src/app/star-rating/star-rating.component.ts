import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { CommonModule, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ContenidosService, RatingResumen } from '../contenidos.service';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf, DecimalPipe],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css'],
})
export class StarRatingComponent implements OnInit {
  @Input() contentId!: string;
  @Input() userEmail!: string;
  @Input() enabled = true;
  @Input() autoReproducir = false;

  @Output() rated = new EventEmitter<RatingResumen>();

  stars = [1, 2, 3, 4, 5];

  hoverValue: number | null = null;   
  userValue: number | null = null;    

  avg = 0;
  count = 0;
  loading = false;
  alreadyRated = false;
  errorMsg: string | null = null;

  constructor(private api: ContenidosService) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.api.obtenerRating(this.contentId).subscribe({
      next: (r) => {
        this.avg = r?.avg ?? 0;
        this.count = r?.count ?? 0;
      },
      error: (e) => {
        this.errorMsg =
          e?.error?.message || 'No se pudo cargar la valoración';
      }
    });
  }

  private get currentValue(): number {
    if (this.hoverValue != null) return this.hoverValue;
    if (this.userValue != null) return this.userValue;
    return this.avg ?? 0;
  }

  starFill(index: number): 'full' | 'half' | 'empty' {
    const v = this.currentValue;
    if (v >= index) return 'full';
    if (v >= index - 0.5) return 'half';
    return 'empty';
  }

  private valueFromStar(event: MouseEvent, index: number): number {
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return this.currentValue;

    const rect = el.getBoundingClientRect();
    let ratio = (event.clientX - rect.left) / rect.width; 

    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;

    let raw = (index - 1) + ratio;  

    let snapped = Math.round(raw * 2) / 2; 

    if (snapped < 0.5) snapped = 0.5;
    if (snapped > 5) snapped = 5;

    console.log('hover', { index, ratio, raw, snapped });

    return snapped;
  }

  onMove(event: MouseEvent, index: number): void {
    if (!this.enabled || this.alreadyRated || this.loading) return;
    this.hoverValue = this.valueFromStar(event, index);
  }

  onLeave(): void {
    if (!this.enabled || this.alreadyRated || this.loading) return;
    this.hoverValue = null;
  }

  onClick(index: number, event: MouseEvent): void {
    if (!this.enabled || this.alreadyRated || this.loading) return;

    event.preventDefault();
    event.stopPropagation();

    const normalized = this.valueFromStar(event, index); 
    if (normalized < 0.5 || normalized > 5) return;

    this.loading = true;
    this.errorMsg = null;
    this.userValue = normalized;   

    this.api
      .valorarContenido(this.contentId, normalized, this.userEmail)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.avg = r?.avg ?? normalized;
          this.count = r?.count ?? this.count + 1;
          this.alreadyRated = true;
          this.hoverValue = null;
          this.rated.emit(r);
        },
        error: (err) => {
          const msg =
            err?.error?.message || 'No se pudo registrar tu valoración';
          this.errorMsg = msg;
          if (msg.toLowerCase().includes('ya has valorado')) {
            this.alreadyRated = true;
          }
        }
      });
  }
}
