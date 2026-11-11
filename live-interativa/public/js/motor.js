// Motor compartilhado pelos jogos: desenho, partículas, textos flutuantes,
// alertas de presente, notificações, sons e utilidades.

export const W = 1080;
export const H = 1920;

// Tokens de cor (tema neon escuro)
export const COR = {
  fundo: '#0F0F23',
  fundo2: '#1B1240',
  painel: 'rgba(20, 16, 48, 0.82)',
  borda: 'rgba(167, 139, 250, 0.35)',
  primaria: '#7C3AED',
  secundaria: '#A78BFA',
  destaque: '#F43F5E',
  texto: '#F8FAFC',
  suave: '#CBD5E1',
  apagado: '#94A3B8',
  ouro: '#FBBF24',
  verde: '#22C55E',
  ciano: '#22D3EE',
  laranja: '#FB923C',
};

export const FONTE_TITULO = '"Russo One", "Arial Black", sans-serif';
export const FONTE = '"Chakra Petch", "Segoe UI", sans-serif';

// Áreas da tela que a interface do TikTok costuma cobrir no celular de quem assiste.
// O conteúdo principal fica entre ZONA.topo e ZONA.meio; a parte de baixo
// (onde aparecem os comentários) fica com informações secundárias.
export const ZONA = { topo: 210, meio: 1170, base: 1720 };

// ---------- utilidades ----------
export const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const aleatorio = (a, b) => a + Math.random() * (b - a);
export const easeOut = (t) => 1 - Math.pow(1 - limitar(t, 0, 1), 3);
export const easeOutBack = (t) => {
  t = limitar(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function tokens(txt) {
  return normalizar(txt).split(/[^a-z0-9]+/).filter(Boolean);
}

// Recebe opções [{palavras:[...]}, ...] e devolve o índice da opção que o comentário citou (ou -1)
export function acharOpcao(texto, opcoes) {
  const norm = normalizar(texto);
  const toks = tokens(texto);
  for (let i = 0; i < opcoes.length; i++) {
    for (const p of opcoes[i].palavras || []) {
      const pn = normalizar(p);
      if (!pn) continue;
      if (pn.includes(' ') ? norm.includes(pn) : toks.includes(pn)) return i;
    }
  }
  return -1;
}

export function formatarNumero(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.', ',') + 'mil';
  return n.toLocaleString('pt-BR');
}

export function formatarTempo(seg) {
  seg = Math.max(0, Math.ceil(seg));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function corDoId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

export function clarear(hex, f = 0.3) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * f);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

export function comAlfa(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- desenho ----------
export function retArredondado(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function painel(ctx, x, y, w, h, { r = 28, fundo = COR.painel, borda = COR.borda, brilho = null } = {}) {
  ctx.save();
  if (brilho) {
    ctx.shadowColor = brilho;
    ctx.shadowBlur = 30;
  }
  retArredondado(ctx, x, y, w, h, r);
  ctx.fillStyle = fundo;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (borda) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = borda;
    ctx.stroke();
  }
  ctx.restore();
}

// Texto com contorno escuro (legível em cima de qualquer fundo/câmera)
export function texto(ctx, str, x, y, o = {}) {
  const {
    tam = 40,
    cor = COR.texto,
    fonte = FONTE,
    peso = 700,
    alinhar = 'center',
    base = 'middle',
    contorno = 8,
    corContorno = 'rgba(8, 6, 24, 0.9)',
    brilho = null,
    maxLarg = null,
  } = o;
  ctx.save();
  let t = tam;
  ctx.font = `${peso} ${t}px ${fonte}`;
  if (maxLarg) {
    while (t > 14 && ctx.measureText(str).width > maxLarg) {
      t -= 2;
      ctx.font = `${peso} ${t}px ${fonte}`;
    }
  }
  ctx.textAlign = alinhar;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  if (contorno) {
    ctx.lineWidth = contorno;
    ctx.strokeStyle = corContorno;
    ctx.strokeText(str, x, y);
  }
  if (brilho) {
    ctx.shadowColor = brilho;
    ctx.shadowBlur = 24;
  }
  ctx.fillStyle = cor;
  ctx.fillText(str, x, y);
  ctx.restore();
  return t;
}

export function larguraTexto(ctx, str, tam, fonte = FONTE, peso = 700) {
  ctx.save();
  ctx.font = `${peso} ${tam}px ${fonte}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

export function cortarNome(nome, max = 14) {
  nome = String(nome || '');
  return nome.length > max ? nome.slice(0, max - 1) + '…' : nome;
}

// ---------- som (sintetizado, sem arquivos) ----------
class Som {
  constructor(ativo) {
    this.ativo = ativo;
    this.ctx = null;
    this.ultimo = {};
  }
  garantir() {
    if (!this.ativo) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ativo = false;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  nota(freq, dur, { tipo = 'square', vol = 0.06, ate = null, atraso = 0 } = {}) {
    const ac = this.garantir();
    if (!ac) return;
    const t0 = ac.currentTime + atraso;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  tocar(nome) {
    if (!this.ativo) return;
    const agora = performance.now();
    const minIntervalo = { ponto: 70, tiro: 60, explosao: 90, tick: 300 }[nome] || 0;
    if (agora - (this.ultimo[nome] || 0) < minIntervalo) return;
    this.ultimo[nome] = agora;
    switch (nome) {
      case 'ponto':
        this.nota(660 + Math.random() * 200, 0.08, { vol: 0.025 });
        break;
      case 'tiro':
        this.nota(900, 0.09, { tipo: 'sawtooth', ate: 300, vol: 0.02 });
        break;
      case 'explosao':
        this.nota(160, 0.25, { tipo: 'sawtooth', ate: 40, vol: 0.05 });
        break;
      case 'presente':
        [523, 659, 784].forEach((f, i) => this.nota(f, 0.14, { tipo: 'triangle', vol: 0.07, atraso: i * 0.07 }));
        break;
      case 'grande':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.nota(f, 0.2, { tipo: 'triangle', vol: 0.09, atraso: i * 0.08 }));
        break;
      case 'vitoria':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
          this.nota(f, 0.22, { tipo: 'square', vol: 0.05, atraso: i * 0.13 }),
        );
        break;
      case 'tick':
        this.nota(1200, 0.05, { vol: 0.03 });
        break;
      case 'erro':
        this.nota(220, 0.25, { tipo: 'square', ate: 110, vol: 0.05 });
        break;
      case 'certo':
        [660, 880].forEach((f, i) => this.nota(f, 0.12, { tipo: 'triangle', vol: 0.06, atraso: i * 0.08 }));
        break;
    }
  }
}

// ---------- motor ----------
export class Motor {
  constructor(ctx, { som = true, faixas } = {}) {
    this.ctx = ctx;
    this.t = 0;
    this.particulas = [];
    this.flutuantes = [];
    this.notificacoes = [];
    this.filaAlertas = [];
    this.alerta = null;
    this.tremor = 0;
    this.flashCor = null;
    this.flashT = 0;
    this.avatares = new Map();
    this.som = new Som(som);
    this.faixas = faixas || { medio: 10, grande: 100, lendario: 1000 };
    this.reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }

  // Classifica presente pelo total de diamantes
  faixa(diamantesTotal) {
    if (diamantesTotal >= this.faixas.lendario) return 'lendario';
    if (diamantesTotal >= this.faixas.grande) return 'grande';
    if (diamantesTotal >= this.faixas.medio) return 'medio';
    return 'pequeno';
  }

  explodir(x, y, cor, n = 20, forca = 600, { grav = 900, tam = [6, 14], vida = [0.5, 1.1], forma = 'circulo' } = {}) {
    if (this.reduzirMovimento) n = Math.ceil(n / 3);
    const cores = Array.isArray(cor) ? cor : [cor];
    for (let i = 0; i < n; i++) {
      if (this.particulas.length > 700) this.particulas.shift();
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.3 + Math.random() * 0.7);
      const max = aleatorio(vida[0], vida[1]);
      this.particulas.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - forca * 0.3,
        vida: max, max,
        cor: cores[i % cores.length],
        tam: aleatorio(tam[0], tam[1]),
        grav, forma,
        rot: Math.random() * 6, vr: aleatorio(-8, 8),
      });
    }
  }

  confete(n = 120) {
    const cores = [COR.destaque, COR.ouro, COR.ciano, COR.verde, COR.secundaria, '#ffffff'];
    if (this.reduzirMovimento) n = Math.ceil(n / 4);
    for (let i = 0; i < n; i++) {
      this.particulas.push({
        x: Math.random() * W, y: -20 - Math.random() * 400,
        vx: aleatorio(-120, 120), vy: aleatorio(200, 500),
        vida: 4, max: 4,
        cor: cores[i % cores.length], tam: aleatorio(10, 20),
        grav: 120, forma: 'confete', rot: Math.random() * 6, vr: aleatorio(-10, 10),
      });
    }
  }

  flutuar(x, y, str, cor = COR.texto, tam = 40, vida = 1.2) {
    if (this.flutuantes.length > 60) this.flutuantes.shift();
    this.flutuantes.push({ x, y, str, cor, tam, vida, max: vida, vy: -140 });
  }

  tremer(intensidade = 14) {
    if (this.reduzirMovimento) return;
    this.tremor = Math.max(this.tremor, intensidade);
  }

  flash(cor = '#ffffff', dur = 0.35) {
    this.flashCor = cor;
    this.flashT = dur;
    this.flashMax = dur;
  }

  notificar(str, { cor = COR.secundaria, usuario = null, icone = null } = {}) {
    this.notificacoes.unshift({ str, cor, usuario, icone, vida: 4.5, max: 4.5 });
    if (this.notificacoes.length > 4) this.notificacoes.length = 4;
  }

  // Anúncio: 'faixa' cobre o título no topo por alguns segundos; 'centro' é o banner grande (só pra coisas raras)
  anunciar({ titulo, sub = '', cor = COR.ouro, usuario = null, dur = 3, modo = 'faixa' }) {
    if (this.filaAlertas.length >= 3) {
      // fila cheia: vira notificação simples pra não travar a tela
      this.notificar(sub || titulo, { cor, usuario });
      return;
    }
    this.filaAlertas.push({ titulo, sub, cor, usuario, dur, t: 0, modo });
  }

  // Reação padrão a presentes, comum a todos os jogos
  reagirPresente(ev) {
    const p = ev.presente;
    const total = p.diamantes * p.quantidade;
    const fx = this.faixa(total);
    const qtd = p.quantidade > 1 ? ` x${p.quantidade}` : '';
    const frase = `${cortarNome(ev.usuario.nome, 18)} mandou ${p.nome}${qtd}`;
    if (fx === 'pequeno' || fx === 'medio') {
      this.notificar(frase, { cor: fx === 'medio' ? COR.ouro : COR.destaque, usuario: ev.usuario });
      this.som.tocar('presente');
    } else if (fx === 'grande') {
      this.anunciar({ titulo: 'SUPER PRESENTE!', sub: frase, cor: COR.ciano, usuario: ev.usuario, dur: 3 });
      this.som.tocar('grande');
      this.flash(COR.ciano, 0.3);
      this.tremer(10);
    } else {
      this.anunciar({ titulo: 'PRESENTE LENDÁRIO!', sub: frase, cor: COR.ouro, usuario: ev.usuario, dur: 3.5, modo: 'centro' });
      this.som.tocar('grande');
      this.flash(COR.ouro, 0.4);
      this.tremer(24);
      this.confete(200);
    }
    return fx;
  }

  atualizar(dt) {
    this.t += dt;
    for (const p of this.particulas) {
      p.vida -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.forma !== 'confete') {
        p.vx *= 0.985;
      }
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0 && p.y < H + 60);
    for (const f of this.flutuantes) {
      f.vida -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.97;
    }
    this.flutuantes = this.flutuantes.filter((f) => f.vida > 0);
    for (const n of this.notificacoes) n.vida -= dt;
    this.notificacoes = this.notificacoes.filter((n) => n.vida > 0);
    if (!this.alerta && this.filaAlertas.length) this.alerta = this.filaAlertas.shift();
    if (this.alerta) {
      this.alerta.t += dt;
      if (this.alerta.t > this.alerta.dur) this.alerta = null;
    }
    this.tremor = Math.max(0, this.tremor - dt * 60);
    this.flashT = Math.max(0, this.flashT - dt);
  }

  aplicarTremor(ctx) {
    if (this.tremor > 0.5) ctx.translate(aleatorio(-1, 1) * this.tremor, aleatorio(-1, 1) * this.tremor);
  }

  desenharParticulas(ctx) {
    for (const p of this.particulas) {
      const a = limitar(p.vida / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.cor;
      if (p.forma === 'confete') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        ctx.restore();
      } else if (p.forma === 'estrela') {
        desenharEstrela(ctx, p.x, p.y, p.tam, p.rot);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.tam * (0.4 + 0.6 * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  desenharFlutuantes(ctx) {
    for (const f of this.flutuantes) {
      const a = limitar(f.vida / f.max, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 2);
      const esc = 0.7 + 0.3 * easeOutBack(Math.min(1, (f.max - f.vida) * 5));
      texto(ctx, f.str, f.x, f.y, { tam: f.tam * esc, cor: f.cor, contorno: 7 });
    }
    ctx.globalAlpha = 1;
  }

  desenharNotificacoes(ctx, x = 540, y = 1250) {
    // Pílulas empilhadas (presentes pequenos, seguidores, compartilhamentos)
    let yy = y;
    for (const n of this.notificacoes) {
      const entrada = easeOut(Math.min(1, (n.max - n.vida) * 4));
      const saida = Math.min(1, n.vida * 2);
      ctx.globalAlpha = Math.min(entrada, saida);
      const larg = Math.min(900, larguraTexto(ctx, n.str, 34) + 120);
      const xx = x - larg / 2 + (1 - entrada) * 80;
      painel(ctx, xx, yy, larg, 70, { r: 35, fundo: 'rgba(15, 12, 40, 0.88)', borda: n.cor });
      this.desenharAvatar(ctx, n.usuario, xx + 38, yy + 35, 25, n.cor);
      texto(ctx, n.str, xx + 76, yy + 37, { tam: 34, alinhar: 'left', cor: COR.texto, contorno: 0, maxLarg: larg - 100 });
      yy += 82;
    }
    ctx.globalAlpha = 1;
  }

  desenharAlerta(ctx) {
    const a = this.alerta;
    if (!a) return;
    if (a.modo === 'faixa') return this.desenharFaixa(ctx, a);
    const ent = easeOutBack(Math.min(1, a.t * 3));
    const sai = Math.min(1, (a.dur - a.t) * 3);
    const cy = 760;
    ctx.save();
    ctx.globalAlpha = Math.min(1, sai);
    ctx.translate(W / 2, cy);
    ctx.scale(ent, ent);
    // raios girando atrás
    ctx.save();
    ctx.rotate(this.t * 0.6);
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = a.cor;
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-50, -460);
      ctx.lineTo(50, -460);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    painel(ctx, -450, -130, 900, 260, { r: 40, fundo: 'rgba(12, 8, 32, 0.94)', borda: a.cor, brilho: a.cor });
    this.desenharAvatar(ctx, a.usuario, 0, -130, 60, a.cor);
    texto(ctx, a.titulo, 0, -10, { tam: 70, fonte: FONTE_TITULO, peso: 400, cor: a.cor, brilho: a.cor, maxLarg: 840 });
    texto(ctx, a.sub, 0, 70, { tam: 44, cor: COR.texto, maxLarg: 840 });
    ctx.restore();
  }

  // Faixa que cobre o título por uns segundos (não atrapalha o jogo)
  desenharFaixa(ctx, a) {
    const ent = easeOut(Math.min(1, a.t * 4));
    const sai = Math.min(1, (a.dur - a.t) * 4);
    const x = 30;
    const y = ZONA.topo - 4;
    const w = W - 60;
    const h = 196;
    ctx.save();
    ctx.globalAlpha = Math.min(ent, sai);
    ctx.translate(0, (1 - ent) * -40);
    painel(ctx, x, y, w, h, { r: 32, fundo: 'rgba(12, 8, 32, 0.97)', borda: a.cor, brilho: a.cor });
    // brilho passando
    ctx.save();
    retArredondado(ctx, x, y, w, h, 32);
    ctx.clip();
    const bx = x - 300 + ((a.t * 900) % (w + 600));
    const g = ctx.createLinearGradient(bx, 0, bx + 300, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    if (a.usuario) {
      this.desenharAvatar(ctx, a.usuario, x + 100, y + h / 2, 62, a.cor);
      texto(ctx, a.titulo, x + 190, y + 66, { tam: 60, alinhar: 'left', fonte: FONTE_TITULO, peso: 400, cor: a.cor, brilho: a.cor, maxLarg: w - 220 });
      texto(ctx, a.sub, x + 190, y + 140, { tam: 40, alinhar: 'left', cor: COR.texto, contorno: 0, maxLarg: w - 220 });
    } else {
      texto(ctx, a.titulo, W / 2, y + 70, { tam: 68, fonte: FONTE_TITULO, peso: 400, cor: a.cor, brilho: a.cor, maxLarg: w - 60 });
      texto(ctx, a.sub, W / 2, y + 146, { tam: 40, cor: COR.texto, contorno: 0, maxLarg: w - 60 });
    }
    ctx.restore();
  }

  desenharFlash(ctx) {
    if (this.flashT <= 0 || !this.flashCor) return;
    ctx.globalAlpha = (this.flashT / this.flashMax) * 0.35;
    ctx.fillStyle = this.flashCor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Foto de perfil redonda (cai pra inicial colorida se não houver foto)
  desenharAvatar(ctx, usuario, x, y, r, borda = null) {
    if (!usuario) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = COR.primaria;
      ctx.fill();
      desenharIconePresente(ctx, x, y, r * 0.9);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    const img = this.carregarAvatar(usuario.avatar);
    if (img) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = corDoId(usuario.id);
      ctx.fill();
      const ini = (usuario.nome || '?').replace(/[^a-zA-Z0-9À-ú]/g, '').charAt(0).toUpperCase() || '?';
      texto(ctx, ini, x, y + r * 0.06, { tam: r * 1.1, contorno: 0, cor: '#fff', fonte: FONTE_TITULO, peso: 400 });
    }
    if (borda) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.strokeStyle = borda;
      ctx.stroke();
    }
    ctx.restore();
  }

  carregarAvatar(url) {
    if (!url) return null;
    let item = this.avatares.get(url);
    if (!item) {
      if (this.avatares.size > 400) this.avatares.clear();
      const img = new Image();
      item = { img, ok: false };
      img.referrerPolicy = 'no-referrer';
      img.onload = () => (item.ok = true);
      img.src = url;
      this.avatares.set(url, item);
    }
    return item.ok ? item.img : null;
  }

  // Lista de ranking (top doadores, top jogadores…)
  desenharRanking(ctx, x, y, w, titulo, lista, { max = 5, cor = COR.ouro, sufixo = 'pts' } = {}) {
    const linha = 66;
    const h = 80 + Math.max(1, Math.min(max, lista.length)) * linha + 10;
    painel(ctx, x, y, w, h, { r: 26 });
    texto(ctx, titulo, x + w / 2, y + 42, { tam: 34, fonte: FONTE_TITULO, peso: 400, cor, contorno: 0 });
    if (!lista.length) {
      texto(ctx, 'Ninguém ainda — comenta aí!', x + w / 2, y + 112, { tam: 30, cor: COR.apagado, contorno: 0 });
      return h;
    }
    const medalhas = [COR.ouro, '#E2E8F0', '#F59E0B'];
    lista.slice(0, max).forEach((item, i) => {
      const yy = y + 80 + i * linha + linha / 2;
      texto(ctx, String(i + 1), x + 36, yy, { tam: 32, fonte: FONTE_TITULO, peso: 400, cor: medalhas[i] || COR.apagado, contorno: 0 });
      this.desenharAvatar(ctx, item.usuario, x + 92, yy, 24, medalhas[i] || null);
      texto(ctx, cortarNome(item.usuario.nome, 15), x + 130, yy, { tam: 32, alinhar: 'left', contorno: 0, maxLarg: w - 300 });
      texto(ctx, `${formatarNumero(item.valor)} ${sufixo}`, x + w - 24, yy, { tam: 30, alinhar: 'right', cor, contorno: 0 });
    });
    return h;
  }
}

export function desenharEstrela(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Ícone simples de presente (caixinha com laço), desenhado em vetor
export function desenharIconePresente(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff';
  const b = s * 0.55;
  ctx.fillRect(-b, -b * 0.2, b * 2, b * 1.2);
  ctx.fillRect(-b * 1.1, -b * 0.6, b * 2.2, b * 0.45);
  ctx.fillStyle = COR.destaque;
  ctx.fillRect(-b * 0.15, -b * 0.6, b * 0.3, b * 1.6);
  ctx.restore();
}

// Relógio circular de contagem regressiva
export function desenharRelogio(ctx, x, y, r, restante, total, { cor = COR.ciano } = {}) {
  const frac = total > 0 ? limitar(restante / total, 0, 1) : 0;
  const urgente = restante <= 10;
  const c = urgente ? COR.destaque : cor;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12, 8, 32, 0.85)';
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.strokeStyle = c;
  ctx.lineCap = 'round';
  ctx.shadowColor = c;
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.restore();
  const pulso = urgente ? 1 + 0.08 * Math.sin(performance.now() / 90) : 1;
  texto(ctx, restante >= 60 ? formatarTempo(restante) : String(Math.max(0, Math.ceil(restante))), x, y + 3, {
    tam: r * 0.62 * pulso, fonte: FONTE_TITULO, peso: 400, cor: urgente ? COR.destaque : COR.texto, contorno: 0,
  });
}
