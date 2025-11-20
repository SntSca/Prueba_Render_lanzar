// shared/form-kit.ts
// Removed redundant type alias DebounceKey

export class Debouncer {
  private timers: Record<string, any> = {};
  set(key: string, fn: () => void, ms: number) {
    if (this.timers[key]) clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(fn, ms);
  }
  clearAll() {
    Object.values(this.timers).forEach(t => t && clearTimeout(t));
    this.timers = {};
  }
}

export class FormKit {
  static readonly EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  static trim(s: string | null | undefined) { return (s ?? '').trim(); }
  static lower(s: string | null | undefined) { return this.trim(s).toLowerCase(); }
  static blank(s: string | null | undefined) { return this.trim(s).length === 0; }
  static within(v: string, min: number, max: number) { return v.length >= min && v.length <= max; }
  static over(v: string | null | undefined, max: number) { const t = (v ?? ''); return !!t && t.length > max; }
  static oneOf<T extends string>(v: T, list: readonly T[]) { return list.includes(v); }
  static initials(name: string) { const s = this.trim(name); return s ? s.split(/\s+/).map(p => p[0]).join('').toUpperCase() : 'U'; }
  static toDateInput(iso?: string | null) { 
    if (!iso) {
      return ''; 
    }
    return iso.length > 10 ? iso.slice(0, 10) : iso; 
  }
  static ageInfo(fechaISO: string) { const f = new Date(fechaISO), h = new Date(); let e = h.getFullYear() - f.getFullYear(); const m = h.getMonth() - f.getMonth(), d = h.getDate() - f.getDate(); if (m < 0 || (m === 0 && d < 0)) e--; return { edad: e, futura: f > h }; }
  static emailValid(v: string) { return this.EMAIL_RE.test(this.trim(v)); }
  static maxLenError(label: string, v: string | null | undefined, max: number) { return this.over(v, max) ? `${label} supera ${max} caracteres.` : null; }
  static aliasLenError(v: string, min: number, max: number) { 
    const t = this.trim(v); 
    if (!t) { 
      return null; 
    } 
    return this.within(t, min, max) ? null : `El alias debe tener entre ${min} y ${max} caracteres.`; 
  }
}

export class RoleKit {
  static label(role: 'ADMINISTRADOR'|'USUARIO'|'GESTOR_CONTENIDO') {
    const m: Record<string,string> = { ADMINISTRADOR:'Administrador', USUARIO:'Usuario', GESTOR_CONTENIDO:'Gestor de contenido' };
    return m[role] ?? 'Desconocido';
  }
  static isCreator(r: string) { return r === 'GESTOR_CONTENIDO'; }
  static isAdmin(r: string) { return r === 'ADMINISTRADOR'; }
  static isUser(r: string) { return r === 'USUARIO'; }
  static isSuperAdmin(email: string, superEmail: string) { return FormKit.lower(email) === FormKit.lower(superEmail); }
}

export class SecurityKit {
  static async sha1UpperHex(text: string) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  static async hibpCount(password: string) {
    if (!password) return 0;
    const full = await this.sha1UpperHex(password), pref = full.slice(0,5), suf = full.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${pref}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('hibp');
    for (const line of (await res.text()).split('\n')) {
      const [hs, c] = line.trim().split(':');
      if ((hs||'').toUpperCase() === suf) return parseInt((c||'').replace(/\D/g,''),10) || 0;
    }
    return 0;
  }
}

export type UniqueState = {
  valueCheckedFor: string;
  unique: boolean | null;
  checking: boolean;
};

export class UniqueKit {
  static async ensure(
    kind: 'alias'|'email',
    raw: string,
    opts: {
      minAlias?: number;
      maxAlias?: number;
      skipAlias?: boolean;
      state: UniqueState;
      setState: (s: Partial<UniqueState>) => void;
      checkFn: (normalized: string) => Promise<{ available: boolean } | null | undefined>;
    }
  ): Promise<boolean | null> {
    const normalize = kind === 'email' ? FormKit.lower : FormKit.trim;
    const v = normalize(raw);
    if (kind === 'alias' && opts.skipAlias) return null;
    if (FormKit.blank(v)) { opts.setState({ unique: null, valueCheckedFor: '' }); return null; }
    if (kind === 'alias' && (opts.minAlias && opts.maxAlias) && !FormKit.within(v, opts.minAlias, opts.maxAlias)) { opts.setState({ unique: null, valueCheckedFor: '' }); return null; }
    if (kind === 'email' && !FormKit.emailValid(v)) { opts.setState({ unique: null, valueCheckedFor: '' }); return null; }
    if (v === opts.state.valueCheckedFor) return opts.state.unique;
    opts.setState({ checking: true });
    try {
      const r = await opts.checkFn(v);
      const ok = !!r?.available;
      opts.setState({ unique: ok, valueCheckedFor: v });
      return ok;
    } catch {
      opts.setState({ unique: null, valueCheckedFor: v });
      return null;
    } finally {
      opts.setState({ checking: false });
    }
  }
}
