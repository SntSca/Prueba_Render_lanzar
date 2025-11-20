export interface TopReproItem {
  id: string;
  titulo: string;
  tipo: 'AUDIO' | 'VIDEO' | null;
  reproducciones: number;
}

export interface TopValItem {
  id: string;
  titulo: string;
  tipo: 'AUDIO' | 'VIDEO' | null;
  avg: number;
  count: number;
}

export interface TopCatItem {
  especialidad: string;
  reproducciones: number;
}

export interface StatsResponse {
  topReproducciones: TopReproItem[];
  topValoraciones: TopValItem[];
  topCategorias: TopCatItem[];
}