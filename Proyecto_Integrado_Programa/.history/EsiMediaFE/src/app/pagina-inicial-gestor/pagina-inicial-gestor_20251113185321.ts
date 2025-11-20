import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router'; 
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto } from '../auth/models';
import { Contenidos, Contenido, ModificarContenidoRequest, TipoContenido } from '../contenidos';
import { ListasPublicasService } from '../listas-publicas.service';

type Role = UserDto['role'];

interface ContenidoCreate {
  userEmail: string;
  titulo: string;
  descripcion?: string;
  tipo: TipoContenido;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags: string[];
  duracionMinutos: number;
  vip: boolean;
  visible: boolean;
  restringidoEdad: number;
  disponibleHasta?:string | null;
  imagen?: string | null;
}

const trim = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const yes = (v: 'si' | 'no') => v === 'si';
const showAlert = (title: string, text: string, icon: 'error' | 'warning' | 'success') =>
  Swal.fire({ title, text, icon, confirmButtonText: 'Cerrar' });
const showConfirm = (title: string, text?: string) =>
  Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'Cancelar', reverseButtons: true });
const computeInitials = (text: string) =>
  (trim(text) || 'U').split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
const cleanPayload = <T extends Record<string, any>>(obj: T): T => {
  const out: any = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out as T;
};
const roleLabel = (role?: Role | null): string =>
  ({ ADMINISTRADOR: 'Administrador', USUARIO: 'Usuario', GESTOR_CONTENIDO: 'Gestor de contenido' } as const)[role as Role] ?? 'Desconocido';
const normalizeAvatarUrl = (raw: unknown): string => {
  const s = trim(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
  return s;
};
const normPath = (s?: string | null): string | null => {
  const v = trim(s); if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
  if (v.startsWith('assets/')) return `/${v}`;
  return v.startsWith('/') ? v : `/${v}`;
};
const cacheBust = (u: string | null): string | null => {
  if (!u) return null;
  const separator = u.includes('?') ? '&' : '?';
  return `${u}${separator}v=${Date.now()}`;
};

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule], // ⬅️ AÑADIDO RouterModule
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css'],
})
export class PaginaInicialGestor implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly contenidos = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly listasPublicasService = inject(ListasPublicasService);

  private idEq = (a: any, b: any) => String(a) === String(b);

  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = 'U';
  userTipoContenido: TipoContenido | '' = '';
  userAvatarUrl: string | null = null;
  readOnly = false;

  loading = false;
  loadingList = false;
  errorMsg = '';
  successMsg = '';
  crearAbierto = false;
  lastSubmitAt = 0;
  imgError = false;
  formSubmitted = false;

  contenidosList: Contenido[] = [];
  trackContenido = (_: number, c: Contenido) => c.id;
  listasPublicas: Array<{ id: any; nombre: string; contenidosIds?: any[] }> = [];
  crearListaAbierto = false;
  listasDelContenido: string[] = [];
  listasSeleccionadas: any[] = [];
  nombreListaNueva = '';
  savingLista = false;
  descripcionListaNueva = '';
  listasDropdownOpen = false;

  edadesDisponibles = [0, 6, 12, 16, 18];

  aliasChecking = false;
  aliasAvailable: boolean | null = null;
  aliasMinLength = 3;
  aliasMaxLength = 20;
  private aliasDebounce: any = null;
  editOpen = false;
  okMsg: string | null = null;
  saving = false;
  especialidadInvalid = false;

  userAliasActual = '';
  model: {
    nombre?: string;
    apellidos?: string;
    alias?: string;
    foto?: string;
    descripcion?: string;
    tipoContenido?: string;
    especialidad?: string;
  } = {};

  nuevo = {
    titulo: '',
    descripcion: '',
    tipo: '' as TipoContenido | '',
    ficheroAudio: '',
    urlVideo: '',
    resolucion: '' as '720p' | '1080p' | '4K' | '',
    tagsStr: '',
    duracionMinutos: null as number | null,
    vip: 'no' as 'si' | 'no',
    visible: 'no' as 'si' | 'no',
    restringidoEdad: null as number | null,
    imagen: '',
    disponibleHasta: null as string | null
  };

  canManage = (c: Contenido | null | undefined): boolean =>
    !!c && !!this.userTipoContenido && c.tipo === this.userTipoContenido;

  private requireTipoContenido(): boolean {
    if (!this.userTipoContenido) {
      void showAlert('Aviso', 'Tu perfil no tiene Tipo de Contenido (AUDIO/VIDEO).', 'warning');
      return false;
    }
    return true;
  }
  private notAllowedMsg = (contenidoTipo?: string | null) =>
    `Tu perfil es de tipo ${this.userTipoContenido || '—'} y este contenido es ${contenidoTipo || '—'}. No puedes realizar esta acción.`;

  private withPermission(c: Contenido, action: () => void) {
    if (!this.requireTipoContenido()) return;
    if (!this.canManage(c)) {
      void showAlert('Acción no permitida', this.notAllowedMsg(c?.tipo), 'error');
      return;
    }
    action();
  }

  editContentOpen = false;
  editing: Contenido | null = null;
  cambios: ModificarContenidoRequest = {};

  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;
  avatars: string[] = [
    'assets/avatars/avatar1.png', 'assets/avatars/avatar2.png', 'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png', 'assets/avatars/avatar5.png', 'assets/avatars/avatar6.png'
  ];

  availableTags = {
    video: ['Acción', 'Comedia', 'Drama', 'Suspenso', 'Animación', 'Ciencia Ficción', 'Terror', 'Documental', 'Romance', 'Aventura'],
    audio: ['Comedia', 'Podcast', 'Humor', 'Música', 'Entrevista', 'Relajación', 'Educativo', 'Narrativa', 'Motivacional', 'Noticias']
  };

  dropdownOpen = false;

  vistaAbierta = false;
  vistaContenido: Contenido | null = null;
  vistaPoster: string | null = null;

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.loadContenidos();
    this.cargarListasDelContenido();
    this.loadListasPublicas();
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
    const nombre = trim(user.nombre) || user.email.split('@')[0];
    this.userEmail = user.email;
    this.userRole = roleLabel(user.role);
    this.userTipoContenido = (user.tipoContenido ?? '') as TipoContenido | '';
    this.userName = nombre;
    this.userInitials = computeInitials(nombre);

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);
        this.userAvatarUrl = normalizeAvatarUrl((user as any)?.foto) || null;
        if (!this.userAvatarUrl) this.userInitials = computeInitials(u?.alias || u?.nombre || nombre);
        this.cdr.markForCheck();
      },
      error: () => { this.errorMsg = 'No se pudo cargar tu perfil'; this.cdr.markForCheck(); }
    });
  }

  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;
    const nombre = trim(u?.nombre);
    const apellidos = trim(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();
    this.userName = trim(u?.alias) || fullName || u?.email || this.userName;
    this.userInitials = computeInitials(trim(u?.alias) || fullName || trim(u?.email));
    this.userAliasActual = trim(u?.alias);
    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      foto: u?.foto ?? u?.fotoUrl ?? '',
      descripcion: u?.descripcion ?? '',
      tipoContenido: u?.tipoContenido ?? '',
      especialidad: u?.especialidad ?? '',
    };
  }

  checkAlias(aliasInput?: string) {
    const alias = trim(aliasInput ?? this.model.alias);
    this.aliasAvailable = null;
    this.aliasChecking = false;
    if (!alias || alias.length < this.aliasMinLength || alias.length > this.aliasMaxLength) {
      this.cdr.markForCheck();
      return;
    }
    clearTimeout(this.aliasDebounce);
    this.aliasChecking = true;
    this.aliasDebounce = setTimeout(() => {
      this.auth.checkAlias(alias).subscribe({
        next: (res: { available: boolean }) => { this.aliasAvailable = res.available; this.aliasChecking = false; this.cdr.markForCheck(); },
        error: () => { this.aliasAvailable = null; this.aliasChecking = false; this.cdr.markForCheck(); }
      });
    }, 400);
  }

  loadContenidos() {
    this.loadingList = true;
    this.contenidos.listar().subscribe({
      next: (list) => {
        this.contenidosList = list || [];
        this.loadingList = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingList = false;
        const msg = err?.error?.message || err?.message || 'No se pudo cargar el listado de contenidos.';
        void showAlert('Error', msg, 'error');
        this.cdr.markForCheck();
      }
    });
  }

  cerrarVista() {
    this.vistaAbierta = false;
    this.vistaContenido = null;
    this.vistaPoster = null;
  }

  get tagsArray(): string[] { return (this.nuevo.tagsStr ?? '').split(',').map(t => trim(t)).filter(Boolean); }
  set tagsArray(val: string[]) { this.nuevo.tagsStr = val.join(', '); }
  get tagsInvalid(): boolean { return this.tagsArray.length === 0; }
  get vipNoAnd4k(): boolean { return this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion === '4K' && this.nuevo.vip === 'no'; }
  get audioHasVideoFields(): boolean { return this.nuevo.tipo === 'AUDIO' && (!!trim(this.nuevo.urlVideo) || !!trim(this.nuevo.resolucion)); }
  get videoHasAudioField(): boolean { return this.nuevo.tipo === 'VIDEO' && !!trim(this.nuevo.ficheroAudio); }
  get crossErrorsPresent(): boolean { return this.audioHasVideoFields || this.videoHasAudioField || this.vipNoAnd4k; }

  private validateBeforeSubmit(form: NgForm): string | null {
    if (Date.now() - this.lastSubmitAt < 5000) return 'Espera unos segundos antes de volver a intentarlo.';
    if (this.crossErrorsPresent) return this.vipNoAnd4k ? 'No puedes seleccionar 4K si no es VIP.' : 'Campos cruzados incorrectos (Audio/Video).';
    if (form.invalid) return 'Hay campos con errores. Corrígelos y vuelve a intentarlo.';
    if (!this.userTipoContenido) return 'Tu perfil no tiene un tipo de creador asignado.';
    return null;
  }

  private buildContenidoPayload(): ContenidoCreate {
    const tipo = (this.userTipoContenido || '').toString() as TipoContenido;
    const isA = tipo === 'AUDIO', isV = tipo === 'VIDEO';
    const ymd = this.nuevo.disponibleHasta;
    return {
      userEmail: this.userEmail,
      titulo: trim(this.nuevo.titulo),
      descripcion: trim(this.nuevo.descripcion) || undefined,
      tipo,
      ficheroAudio: isA ? trim(this.nuevo.ficheroAudio) : null,
      urlVideo: isV ? trim(this.nuevo.urlVideo) : null,
      resolucion: isV && this.nuevo.resolucion ? this.nuevo.resolucion : null,
      tags: this.tagsArray,
      duracionMinutos: Number(this.nuevo.duracionMinutos),
      vip: yes(this.nuevo.vip),
      visible: yes(this.nuevo.visible),
      restringidoEdad: this.nuevo.restringidoEdad ?? 0,
      imagen: trim(this.nuevo.imagen) || null,
      disponibleHasta: ymd ? this.toLdtFromYmd(ymd) : undefined,
    };
  }

  onFormChange() { this.errorMsg = ''; this.successMsg = ''; }
  abrirCrear() { this.errorMsg = ''; this.successMsg = ''; this.crearAbierto = true; }
  cerrarCrear() { if (!this.loading) this.crearAbierto = false; }

  onSubmit(form: NgForm): void {
    this.formSubmitted = true;
    const msg = this.validateBeforeSubmit(form);
    if (msg) {
      Object.values(form.controls).forEach(c => c.markAsTouched());
      document.querySelector<HTMLElement>('.input-error')?.focus();
      void showAlert('Revisa el formulario', msg, 'error');
      return;
    }
    this.loading = true; this.lastSubmitAt = Date.now();
    this.contenidos.subirContenido(this.buildContenidoPayload()).subscribe({
      next: () => this.onUploadSuccess(),
      error: (err) => this.onUploadError(err)
    });
  }

  private onUploadSuccess() {
    this.loading = false; this.crearAbierto = false;
    Object.assign(this.nuevo, {
      titulo:'', descripcion:'', tipo:'', ficheroAudio:'', urlVideo:'', resolucion:'', tagsStr:'',
      duracionMinutos:null, vip:'no', visible:'no', restringidoEdad:null, imagen:'', disponibleHasta:null
    });
    this.imgError = false;
    this.loadContenidos();
    setTimeout(() => void showAlert('¡Éxito!', 'Contenido subido correctamente.', 'success'), 0);
  }

  private onUploadError(error: any) {
    this.loading = false;
    let msg = 'No se pudo subir el contenido.';
    const raw = error?.error;
    if (raw) {
      if (typeof raw === 'object' && (raw.message || raw.error)) msg = raw.message || raw.error;
      else if (typeof raw === 'string') { try { msg = JSON.parse(raw)?.message ?? raw; } catch { msg = raw; } }
    }
    void showAlert('Error', msg, 'error');
  }

  toggleTag(tag: string) {
    const tags = (this.nuevo.tagsStr ?? '').split(',').map(t => trim(t)).filter(Boolean);
    const index = tags.indexOf(tag);
    if (index >= 0) tags.splice(index, 1); else tags.push(tag);
    this.nuevo.tagsStr = tags.join(', ');
  }
  isSelected(tag: string): boolean { return this.tagsArray.includes(tag); }
  toggleDropdown() { this.dropdownOpen = !this.dropdownOpen; }
  clearImage() { this.nuevo.imagen = ''; this.imgError = false; }

  closeEdit() {
    this.editContentOpen = false;
    this.editing = null;
    this.cambios = {};
    this.listasSeleccionadas = [];
  }

  savingEdit = false;

  private replaceInList(updated: Contenido) {
    const i = this.contenidosList.findIndex(x => x.id === updated.id);
    if (i >= 0) this.contenidosList[i] = updated;
    this.cdr.markForCheck();
  }

  dropdownOpenEdit = false;
  tagsInvalidEdit = false;
  formSubmittedEdit = false;

  toggleDropdownEdit() { this.dropdownOpenEdit = !this.dropdownOpenEdit; }
  isSelectedEdit(tag: string): boolean { return (this.cambios.tags ?? []).includes(tag); }
  toggleTagEdit(tag: string) {
    this.cambios.tags ??= [];
    const idx = this.cambios.tags.indexOf(tag);
    if (idx >= 0) this.cambios.tags.splice(idx, 1);
    else this.cambios.tags.push(tag);
  }

  onView(c: Contenido) {
    this.vistaContenido = c;
    this.vistaPoster = c.imagen || null;
    this.listasDelContenido = (this.listasPublicas ?? [])
      .filter(lista => (lista?.contenidosIds ?? []).some(id => this.idEq(id, c.id)))
      .map(lista => lista.nombre);
    this.vistaAbierta = true;
  }
  closeView() { this.vistaAbierta = false; this.vistaContenido = null; this.vistaPoster = null; }

  onEditClick(c: Contenido) {
    this.withPermission(c, () => {
      this.editing = { ...c };
      this.cambios = {
        titulo: c.titulo,
        descripcion: c.descripcion,
        resolucion: c.resolucion ?? null,
        tags: [...(c.tags ?? [])],
        duracionMinutos: c.duracionMinutos,
        vip: !!c.vip,
        visible: !!c.visible,
        disponibleHasta: (c as any).disponibleHasta ?? null,
        restringidoEdad: c.restringidoEdad,
        imagen: c.imagen ?? null
      };
      this.editContentOpen = true;
      const publicas = Array.isArray(this.listasPublicas) ? this.listasPublicas : [];
      this.listasSeleccionadas = publicas
        .filter(lista => Array.isArray(lista?.contenidosIds) && lista.contenidosIds.some(id => this.idEq(id, c.id)))
        .map(lista => lista.id);
    });
  }

  fechaHoy: string = new Date().toISOString().split('T')[0];
  disponibleHastaInvalido = false;

  validarDisponibleHasta() {
    if (this.nuevo.disponibleHasta) {
      const [y, m, d] = this.nuevo.disponibleHasta.split('-').map(Number);
      const fechaSeleccionada = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
      const hoy = new Date().setHours(0, 0, 0, 0);
      this.disponibleHastaInvalido = fechaSeleccionada < hoy;
      if (this.disponibleHastaInvalido) {
        this.nuevo.disponibleHasta = null;
      }
    }
}


  async saveEdit() {
    if (!this.editing) return;
    this.savingEdit = true;

    try {
      this.ensureResolutionCompatibleWithVip();

      const body = { ...cleanPayload(this.cambios) } as any;
      if (body.disponibleHasta) {
        body.disponibleHasta = this.toLdtFromYmd(body.disponibleHasta); // "YYYY-MM-DDT00:00:00"
      }

      const updated = await firstValueFrom(
        this.contenidos.modificar(this.editing.id, cleanPayload(this.cambios), this.userTipoContenido as TipoContenido)
      );
      this.replaceInList(updated);

      const contenidoId = String(this.editing.id);
      const selectedSet = new Set((this.listasSeleccionadas ?? []).map(String));

      for (const lista of (this.listasPublicas ?? [])) {
        const listaIdStr = String(lista.id);
        const antesSet = new Set((lista?.contenidosIds ?? []).map(String));

        const estabaAntes = antesSet.has(contenidoId);
        const estaSeleccionada = selectedSet.has(listaIdStr);

        if (estaSeleccionada && !estabaAntes) {
          await firstValueFrom(this.listasPublicasService.añadirContenido(lista.id, contenidoId));
        } else if (!estaSeleccionada && estabaAntes) {
          await firstValueFrom(this.listasPublicasService.eliminarContenido(lista.id, contenidoId));
        }
      }

      this.closeEdit();
      void showAlert('¡Actualizado!', 'El contenido y sus listas se han modificado correctamente.', 'success');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'No se pudo modificar el contenido.';
      void showAlert('Error', msg, 'error');
    } finally {
      this.savingEdit = false;
      this.loadListasPublicas();
    }
  }

  async onDeleteClick(c: Contenido) {
    this.withPermission(c, async () => {
      const r = await showConfirm('¿Eliminar contenido?', `Se eliminará "${c.titulo}".`);
      if (!r.isConfirmed) return;
      if (!this.userTipoContenido) {
        void showAlert('Error', 'Tipo de contenido no definido.', 'error');
        return;
      }
      this.contenidos.eliminar(c.id, this.userTipoContenido).subscribe({
        next: () => {
          this.contenidosList = this.contenidosList.filter(x => x.id !== c.id);
          this.cdr.markForCheck();
          void showAlert('Eliminado', 'Contenido eliminado correctamente.', 'success');
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'No se pudo eliminar el contenido.';
          void showAlert('Error', msg, 'error');
        }
      });
    });
  }

  onToggleVisible(c: Contenido) {
    this.withPermission(c, () => {
      const next = !c.visible;
      const prev = c.visible;
      c.visible = next;
      this.contenidos.modificar(c.id, { visible: next }, this.userTipoContenido as TipoContenido).subscribe({
        next: (actualizado: Contenido) => { Object.assign(c, actualizado); this.cdr.markForCheck(); },
        error: (err: any) => {
          c.visible = prev;
          const msg = err?.error?.message || err?.message || 'No se pudo cambiar la visibilidad.';
          void showAlert('Error', msg, 'error');
          this.cdr.markForCheck();
        }
      });
    });
  }

  toggleEditar() { this.editOpen = !this.editOpen; }
  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }
  checkEspecialidad() { this.especialidadInvalid = !trim(this.model?.especialidad); }

  guardarCambios() {
    this.errorMsg = '';
    if (!trim(this.model?.especialidad)) { this.errorMsg = 'La especialidad no puede estar vacía.'; this.cdr.markForCheck(); return; }
    const aliasNuevo = trim(this.model?.alias);
    const igualActual = this.userAliasActual && aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0;
    const aliasAEnviar = igualActual ? undefined : (aliasNuevo || undefined);
    const fotoSeleccionada = trim(this.selectedAvatar || this.foto || this.model?.foto) || undefined;
    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: trim(this.model?.nombre) || undefined,
      apellidos: trim(this.model?.apellidos) || undefined,
      descripcion: trim(this.model?.descripcion),
      tipoContenido: trim(this.model?.tipoContenido) || undefined,
      especialidad: trim(this.model?.especialidad) || undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };
    this.auth.putPerfilCreadorContenido(cleanPayload(raw)).subscribe({
      next: (perfil: any) => {
        this.paintFromProfile(perfil);
        const apiAvatar = normPath(perfil?.fotoUrl ?? perfil?.foto);
        const localAvatar = normPath(fotoSeleccionada ?? this.foto ?? this.model?.foto ?? null);
        this.userAvatarUrl = cacheBust(apiAvatar || localAvatar);
        this.selectedAvatar = null;
        this.foto = apiAvatar || localAvatar || null;
        this.editOpen = false;
        this.errorMsg = '';
        this.saving = false;
        this.cdr.markForCheck();
        void showAlert('¡Éxito!', 'Perfil actualizado correctamente.', 'success');
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  async cerrarSesion() {
    const r = await showConfirm('¿Seguro que deseas cerrar sesión?');
    if (!r.isConfirmed) return;
    this.auth.logout?.();
    localStorage.removeItem('user');
    await Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false });
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async DarDeBaja() {
    const r = await showConfirm('¿Seguro que deseas darte de baja de la plataforma?', 'Esta acción no se puede deshacer.');
    if (!r.isConfirmed) return;
    this.auth.darseBaja(this.userEmail).subscribe({
      next: (msg: string) => {
        alert(msg || 'Usuario eliminado correctamente');
        this.auth.logout?.();
        localStorage.removeItem('user');
        sessionStorage.clear();
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      },
      error: (err: any) => alert(err?.error || err?.message || 'Error al eliminar usuario')
    });
  }

  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; this.closeAvatarModal(); }
  onAvatarError() { this.userAvatarUrl = null; }
  handleKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') this.closeAvatarModal(); }

  loadListasPublicas() {
    this.listasPublicasService.listarListas().subscribe({
      next: (listas) => {
        this.listasPublicas = (listas || []).filter(lista => lista.id !== undefined) as { id: any; nombre: string; contenidosIds?: any[] }[];
        this.cdr.markForCheck();
      },
      error: () => { void showAlert('Error', 'No se pudieron cargar las listas públicas', 'error'); }
    });
  }

  abrirCrearLista() { this.crearListaAbierto = true; }
  cerrarCrearLista() {
    this.crearListaAbierto = false;
    this.nombreListaNueva = '';
    this.descripcionListaNueva = '';
  }

  toggleLista(listaId: any) {
    const listaIdStr = String(listaId);
    const idx = this.listasSeleccionadas.map(String).indexOf(listaIdStr);
    if (idx >= 0) {
      this.listasSeleccionadas.splice(idx, 1);
    } else {
      this.listasSeleccionadas.push(listaId);
    }
  }

  getListaNombre(id: any): string {
    const lista = (this.listasPublicas ?? []).find(l => this.idEq(l.id, id));
    return lista ? lista.nombre : 'Desconocido';
  }

  isListaSelected(id: any): boolean {
    return this.listasSeleccionadas.map(String).includes(String(id));
  }

  crearListaPublica() {
    const nombre = (this.nombreListaNueva ?? '').trim();
    const descripcion = (this.descripcionListaNueva ?? '').trim();

    if (!nombre) { void showAlert('Error', 'Debes indicar un nombre para la lista.', 'error'); return; }
    if (!descripcion) { void showAlert('Error', 'Debes indicar una descripción para la lista.', 'error'); return; }

    const existe = (this.listasPublicas ?? []).some(
      (l: any) => (l?.nombre ?? '').trim().toLowerCase() === nombre.toLowerCase()
    );
    if (existe) {
      void showAlert('Error', `Ya existe una lista pública llamada "${nombre}".`, 'error');
      return;
    }

    const nuevaLista = { nombre, descripcion, userEmail: this.userEmail, visibilidad: 'PUBLICA' };
    this.savingLista = true;

    this.http.post('http://localhost:8082/listas', nuevaLista).subscribe({
      next: (listaCreada: any) => {
        void showAlert('¡Éxito!', `La lista "${nombre}" se ha creado correctamente.`, 'success');
        this.listasPublicas = [listaCreada ?? nuevaLista, ...(this.listasPublicas || [])];
        this.cerrarCrearLista();
      },
      error: (err) => {
        const msg = err?.status === 409
          ? `Ya existe una lista con el nombre "${nombre}".`
          : (err?.error?.message || 'Error al crear la lista pública.');
        void showAlert('Error', msg, 'error');
      },
      complete: () => { this.savingLista = false; }
    });
  }

  getListaNombresSeleccionadas(): string {
    if (!this.listasSeleccionadas?.length) return 'Selecciona listas';
    return this.listasSeleccionadas
      .map(id => this.getListaNombre(id))
      .filter(Boolean)
      .join(', ');
  }

  cargarListasDelContenido() {
    if (!this.vistaContenido?.id) return;
    const idStr = String(this.vistaContenido.id);
    this.listasDelContenido = (this.listasPublicas ?? [])
      .filter(lista => (lista?.contenidosIds ?? []).map(String).includes(idStr))
      .map(lista => lista.nombre);
  }

  filtros: {
    q: string;
    tipo: '' | 'AUDIO' | 'VIDEO';
    visible: '' | boolean;
    vip: '' | boolean;
    edadMin: number | null;
    listaId: string | number;
    tag: string;
    ordenar: '' | 'tituloAsc' | 'tituloDesc' | 'autorAsc' | 'autorDesc' | 'ratingAsc' | 'ratingDesc';
  } = {
      q: '',
      tipo: '',
      visible: '',
      vip: '',
      edadMin: null,
      listaId: '',
      tag: '',
      ordenar: ''
    };

  get allTags(): string[] {

    const base = new Set<string>([
      ...this.availableTags.video,
      ...this.availableTags.audio
    ]);
    for (const c of (this.contenidosList || [])) {
      (c.tags || []).forEach(t => base.add((t || '').toString().trim()));
    }
    return Array.from(base).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  private norm(s: any): string {
    return (typeof s === 'string' ? s : (s ?? '')).toString().normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private pasaTexto(c: Contenido, q: string): boolean {
    if (!q) return true;
    const needle = this.norm(q);
    const haystack = [
      c.titulo,
      c.descripcion,
      c.userEmail,
      ...(c.tags || [])
    ].map(v => this.norm(v)).join(' | ');
    return haystack.includes(needle);
  }

  private pasaTipo(c: Contenido): boolean {
    return !this.filtros.tipo || c.tipo === this.filtros.tipo;
  }

  private pasaVisible(c: Contenido): boolean {
    return this.filtros.visible === '' || !!c.visible === this.filtros.visible;
  }

  private pasaVip(c: Contenido): boolean {
    return this.filtros.vip === '' || !!c.vip === this.filtros.vip;
  }

  private pasaEdad(c: Contenido): boolean {
    if (this.filtros.edadMin == null || isNaN(this.filtros.edadMin as any)) return true;
    const restr = Number(c.restringidoEdad ?? 0);
    return restr >= Number(this.filtros.edadMin);
  }

  private pasaLista(c: Contenido): boolean {
    if (this.filtros.listaId === '' || !this.listasPublicas?.length) return true;
    const lista = this.listasPublicas.find(l => String(l.id) === String(this.filtros.listaId));
    const ids = (lista?.contenidosIds || []).map(String);
    return ids.includes(String(c.id));
  }

  private pasaTag(c: Contenido): boolean {
    if (!this.filtros.tag) return true;
    return (c.tags || []).some(t => (t || '').toString().trim() === this.filtros.tag);
  }

  get contenidosFiltrados(): Contenido[] {
    const base = (this.contenidosList || []).filter(c =>
      this.pasaTexto(c, this.filtros.q) &&
      this.pasaTipo(c) &&
      this.pasaVisible(c) &&
      this.pasaVip(c) &&
      this.pasaEdad(c) &&
      this.pasaLista(c) &&
      this.pasaTag(c)
    );

    const ordenar = this.filtros.ordenar;
    if (!ordenar) return base;

    const compareValues = <T>(a: T | null | undefined, b: T | null | undefined, asc: boolean): number => {
      if (a == null && b == null) return 0;
      if (a == null) return asc ? 1 : -1;
      if (b == null) return asc ? -1 : 1;

      if (typeof a === 'string' && typeof b === 'string') {
        const cmp = a.localeCompare(b, 'es', { sensitivity: 'base' });
        return asc ? cmp : -cmp;
      }

      let cmp = 0;
      if ((a as any) < (b as any)) cmp = -1;
      else if ((a as any) > (b as any)) cmp = 1;

      return asc ? cmp : -cmp;
    };

    const sortBy = <T>(sel: (c: Contenido) => T, asc: boolean) => {
      const arr = [...base];
      arr.sort((a, b) => compareValues(sel(a), sel(b), asc));
      return arr;
    };

    const sorters: Record<string, { sel: (c: Contenido) => any; asc: boolean }> = {
<<<<<<< HEAD
      tituloAsc: { sel: c => c.titulo ?? '', asc: true },
      tituloDesc: { sel: c => c.titulo ?? '', asc: false },
      autorAsc: { sel: c => c.userEmail ?? '', asc: true },
      autorDesc: { sel: c => c.userEmail ?? '', asc: false },
      ratingAsc: { sel: c => Number(c.ratingAvg ?? 0), asc: true },
=======
      tituloAsc:  { sel: c => c.titulo ?? '',     asc: true  },
      tituloDesc: { sel: c => c.titulo ?? '',     asc: false },
      autorAsc:   { sel: c => c.userEmail ?? '',  asc: true  },
      autorDesc:  { sel: c => c.userEmail ?? '',  asc: false },
      ratingAsc:  { sel: c => Number(c.ratingAvg ?? 0), asc: true  },
>>>>>>> HU17_Estadisticas_Reproduccion
      ratingDesc: { sel: c => Number(c.ratingAvg ?? 0), asc: false },
    };

    const s = sorters[ordenar];
    return s ? sortBy(s.sel, s.asc) : base;
  }

<<<<<<< HEAD

=======
>>>>>>> HU17_Estadisticas_Reproduccion
  resetFiltros() {
    this.filtros = {
      q: '',
      tipo: '',
      visible: '',
      vip: '',
      edadMin: null,
      listaId: '',
      tag: '',
      ordenar: ''
    };
<<<<<<< HEAD
    this.pageIndex = 1; 
  }
  private ensureResolutionCompatibleWithVip(): void {
    if (!this.editing) return;
    const esVideo = this.editing.tipo === 'VIDEO';
    const vipFinal = !!this.cambios.vip;                
    const vipPrev = !!this.editing.vip;                
    const resolPrev = (this.cambios.resolucion ?? this.editing.resolucion ?? '').toString();


    if (esVideo && vipPrev && !vipFinal && resolPrev.toUpperCase() === '4K') {
      this.cambios.resolucion = '1080p';               
      Swal.fire({
        icon: 'info',
        title: 'Cambio de resolución',
        text: 'Al quitar VIP en un vídeo 4K, la resolución se ha ajustado automáticamente a 1020p.',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  private toYmdFromLdt(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    const DATE_RE = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/;
    const m = DATE_RE.exec(s);
    return m ? m[1] : null;
  }

  private toLdtFromYmd(ymd?: string | null): string | null {
    if (!ymd) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T00:00:00` : ymd;
  }

  pageIndex = 1;
  pageSize = 4;
  pageSizes: number[] = [4, 8, 16, 32, 64, 100, 200];

  get totalItems(): number {
    return this.contenidosFiltrados.length;
  }

  get totalPages(): number {
    return this.totalItems ? Math.ceil(this.totalItems / this.pageSize) : 1;
  }

  get contenidosPaginados(): Contenido[] {
    const filtered = this.contenidosFiltrados;
    if (!filtered.length) return [];

    const safePage = Math.min(Math.max(this.pageIndex, 1), this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    const end = start + this.pageSize;

    return filtered.slice(start, end);
  }

  nextPage(): void {
    if (this.pageIndex < this.totalPages) {
      this.pageIndex++;
    }
  }

  prevPage(): void {
    if (this.pageIndex > 1) {
      this.pageIndex--;
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size) || 10;
    this.pageIndex = 1; 
  }

  get startIndex(): number {
  if (!this.totalItems) return 0;
  return (this.pageIndex - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    if (!this.totalItems) return 0;
    const end = this.pageIndex * this.pageSize;
    return end > this.totalItems ? this.totalItems : end;
  }



}
=======
  }

  goToStats() {
    this.router.navigate(['/stats']);
  }
}
>>>>>>> HU17_Estadisticas_Reproduccion
