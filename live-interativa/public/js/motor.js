// Motor compartilhado pelos jogos: desenho, partículas, textos flutuantes,
// alertas de presente, notificações, legenda de presentes, sons e utilidades.
//
// Estilo visual: placar esportivo de TV. Cores chapadas, alto contraste,
// sombra "dura" deslocada, sem brilho, sem degradê.

export const W = 1080;
export const H = 1920;

// Tokens de cor
export const COR = {
  fundo: '#121417',
  superficie: '#1D2027',
  superficie2: '#262A33',
  linha: '#363B47',
  sombra: '#000000',
  texto: '#FFFFFF',
  suave: '#B4BAC6',
  apagado: '#7C8494',
  amarelo: '#FFD23F',
  vermelho: '#FF4D4D',
  azul: '#3D7BFF',
  verde: '#2ECC71',
  laranja: '#FF8A3D',
  ciano: '#2BC4E8',
  tinta: '#111111', // texto em cima de fundo claro
};
// Apelidos (os jogos usam esses nomes)
COR.ouro = COR.amarelo;
COR.destaque = COR.vermelho;
COR.secundaria = COR.suave;

export const FONTE_TITULO = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const FONTE = '"Barlow", "Segoe UI", sans-serif';

// Áreas da tela que a interface do TikTok cobre no celular de quem assiste.
export const ZONA = { topo: 210, meio: 1170, base: 1720 };

// Onde cada parte fixa da tela fica
export const LAYOUT = {
  titulo: 262, // centro do título
  instrucao: 326, // centro da linha de instrução
  legenda: 366, // topo da legenda de presentes
  legendaAltura: 84,
  jogo: 476, // a partir daqui é a área do jogo
};

// ---------- utilidades ----------
export const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const aleatorio = (a, b) => a + Math.random() * (b - a);
export const easeOut = (t) => 1 - Math.pow(1 - limitar(t, 0, 1), 3);
export const easeOutBack = (t) => {
  t = limitar(t, 0, 1);
  const c1 = 1.4;
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
  if (n >= 1e5) return Math.round(n / 1e3) + 'mil';
  return n.toLocaleString('pt-BR');
}

export function formatarTempo(seg) {
  seg = Math.max(0, Math.ceil(seg));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PALETA_AVATAR = ['#3D7BFF', '#FF4D4D', '#2ECC71', '#FF8A3D', '#B26BFF', '#2BC4E8', '#FF5FA2', '#E5B800'];
export function corDoId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA_AVATAR[h % PALETA_AVATAR.length];
}

export function clarear(hex, f = 0.3) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const m = (c) => Math.round(c + (255 - c) * f);
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
}

export function escurecer(hex, f = 0.3) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const m = (c) => Math.round(c * (1 - f));
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
}

export function comAlfa(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function cortarNome(nome, max = 14) {
  nome = String(nome || '');
  return nome.length > max ? nome.slice(0, max - 1) + '…' : nome;
}

// ---------- desenho ----------
export function retArredondado(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Bloco chapado com sombra dura opcional
export function bloco(ctx, x, y, w, h, { r = 10, cor = COR.superficie, borda = null, sombra = 0, larguraBorda = 3 } = {}) {
  ctx.save();
  if (sombra) {
    retArredondado(ctx, x + sombra, y + sombra, w, h, r);
    ctx.fillStyle = COR.sombra;
    ctx.fill();
  }
  retArredondado(ctx, x, y, w, h, r);
  ctx.fillStyle = cor;
  ctx.fill();
  if (borda) {
    ctx.lineWidth = larguraBorda;
    ctx.strokeStyle = borda;
    ctx.stroke();
  }
  ctx.restore();
}
// Compatibilidade com o nome antigo
export function painel(ctx, x, y, w, h, o = {}) {
  bloco(ctx, x, y, w, h, { r: o.r ?? 10, cor: o.fundo ?? COR.superficie, borda: o.borda ?? null });
}

export function texto(ctx, str, x, y, o = {}) {
  const {
    tam = 40,
    cor = COR.texto,
    fonte = FONTE,
    peso = 700,
    italico = false,
    alinhar = 'center',
    base = 'middle',
    contorno = 0,
    corContorno = 'rgba(0,0,0,0.85)',
    maxLarg = null,
    espaco = 0,
  } = o;
  ctx.save();
  let t = tam;
  const fnt = (tt) => `${italico ? 'italic ' : ''}${peso} ${tt}px ${fonte}`;
  ctx.font = fnt(t);
  if (espaco && 'letterSpacing' in ctx) ctx.letterSpacing = `${espaco}px`;
  if (maxLarg) {
    while (t > 14 && ctx.measureText(str).width > maxLarg) {
      t -= 2;
      ctx.font = fnt(t);
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

// Etiqueta: bloco pequeno com texto (ex.: "NA FRENTE")
export function etiqueta(ctx, str, x, y, { tam = 26, cor = COR.amarelo, corTexto = COR.tinta, alinhar = 'center' } = {}) {
  const w = larguraTexto(ctx, str, tam, FONTE_TITULO, 800) + tam * 0.9;
  const h = tam * 1.5;
  const xx = alinhar === 'center' ? x - w / 2 : alinhar === 'right' ? x - w : x;
  bloco(ctx, xx, y - h / 2, w, h, { r: 6, cor });
  texto(ctx, str, xx + w / 2, y + 1, { tam, fonte: FONTE_TITULO, peso: 800, cor: corTexto, espaco: 1 });
  return w;
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
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.nota(f, 0.22, { tipo: 'square', vol: 0.05, atraso: i * 0.13 }));
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
    this.imagens = new Map();
    this.imagensPresentes = {}; // nome/id (minúsculo) -> url
    this.som = new Som(som);
    this.faixas = faixas || { medio: 10, grande: 100, lendario: 1000 };
    this.reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }

  faixa(diamantesTotal) {
    if (diamantesTotal >= this.faixas.lendario) return 'lendario';
    if (diamantesTotal >= this.faixas.grande) return 'grande';
    if (diamantesTotal >= this.faixas.medio) return 'medio';
    return 'pequeno';
  }

  explodir(x, y, cor, n = 20, forca = 600, { grav = 900, tam = [6, 14], vida = [0.5, 1.1], forma = 'quadrado' } = {}) {
    if (this.reduzirMovimento) n = Math.ceil(n / 3);
    const cores = Array.isArray(cor) ? cor : [cor];
    for (let i = 0; i < n; i++) {
      if (this.particulas.length > 600) this.particulas.shift();
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.3 + Math.random() * 0.7);
      const max = aleatorio(vida[0], vida[1]);
      this.particulas.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - forca * 0.3, vida: max, max,
        cor: cores[i % cores.length], tam: aleatorio(tam[0], tam[1]), grav, forma,
        rot: Math.random() * 6, vr: aleatorio(-8, 8),
      });
    }
  }

  confete(n = 120) {
    const cores = [COR.amarelo, COR.vermelho, COR.azul, COR.verde, '#ffffff'];
    if (this.reduzirMovimento) n = Math.ceil(n / 4);
    for (let i = 0; i < n; i++) {
      this.particulas.push({
        x: Math.random() * W, y: -20 - Math.random() * 400, vx: aleatorio(-120, 120), vy: aleatorio(200, 500),
        vida: 4, max: 4, cor: cores[i % cores.length], tam: aleatorio(12, 22), grav: 120, forma: 'confete',
        rot: Math.random() * 6, vr: aleatorio(-10, 10),
      });
    }
  }

  flutuar(x, y, str, cor = COR.texto, tam = 40, vida = 1.1) {
    if (this.flutuantes.length > 40) this.flutuantes.shift();
    this.flutuantes.push({ x, y, str, cor, tam, vida, max: vida, vy: -120 });
  }

  tremer(intensidade = 14) {
    if (this.reduzirMovimento) return;
    this.tremor = Math.max(this.tremor, intensidade);
  }

  flash(cor = '#ffffff', dur = 0.3) {
    this.flashCor = cor;
    this.flashT = dur;
    this.flashMax = dur;
  }

  notificar(str, { cor = COR.suave, usuario = null, presente = null } = {}) {
    this.notificacoes.unshift({ str, cor, usuario, presente, vida: 4, max: 4 });
    if (this.notificacoes.length > 3) this.notificacoes.length = 3;
  }

  // 'faixa' cobre o título e a legenda por alguns segundos; 'centro' é o card grande (coisas raras)
  anunciar({ titulo, sub = '', cor = COR.amarelo, usuario = null, dur = 3, modo = 'faixa', presente = null }) {
    if (this.filaAlertas.length >= 3) {
      this.notificar(sub || titulo, { cor, usuario });
      return;
    }
    this.filaAlertas.push({ titulo, sub, cor, usuario, dur, t: 0, modo, presente });
  }

  // Reação padrão a presentes. "efeito" é o texto que o jogo devolve (ex.: "+10 pts")
  reagirPresente(ev, efeito = '') {
    const p = ev.presente;
    const total = p.diamantes * p.quantidade;
    const fx = this.faixa(total);
    const qtd = p.quantidade > 1 ? ` x${p.quantidade}` : '';
    const frase = `${cortarNome(ev.usuario.nome, 16)} · ${p.nome}${qtd}${efeito ? ` → ${efeito}` : ''}`;
    if (fx === 'pequeno' || fx === 'medio') {
      this.notificar(frase, { cor: fx === 'medio' ? COR.amarelo : COR.vermelho, usuario: ev.usuario, presente: p });
      this.som.tocar('presente');
    } else if (fx === 'grande') {
      this.anunciar({ titulo: 'SUPER PRESENTE', sub: frase, cor: COR.amarelo, usuario: ev.usuario, presente: p, dur: 3 });
      this.som.tocar('grande');
      this.tremer(8);
    } else {
      this.anunciar({ titulo: 'PRESENTE LENDÁRIO', sub: frase, cor: COR.amarelo, usuario: ev.usuario, presente: p, dur: 3.5, modo: 'centro' });
      this.som.tocar('grande');
      this.flash(COR.amarelo, 0.3);
      this.tremer(18);
      this.confete(180);
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
      if (p.forma !== 'confete') p.vx *= 0.985;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0 && p.y < H + 60);
    for (const f of this.flutuantes) {
      f.vida -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
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
      ctx.globalAlpha = limitar(p.vida / p.max, 0, 1);
      ctx.fillStyle = p.cor;
      if (p.forma === 'confete') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        ctx.restore();
      } else {
        const s = p.tam * (0.5 + 0.5 * (p.vida / p.max));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  desenharFlutuantes(ctx) {
    for (const f of this.flutuantes) {
      const a = limitar(f.vida / f.max, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 2);
      texto(ctx, f.str, f.x, f.y, { tam: f.tam, cor: f.cor, fonte: FONTE_TITULO, peso: 800, contorno: 6 });
    }
    ctx.globalAlpha = 1;
  }

  // Notificações compactas (presentes pequenos/médios e seguidores)
  desenharNotificacoes(ctx, x = W / 2, y = 1250) {
    let yy = y;
    for (const n of this.notificacoes) {
      const entrada = easeOut(Math.min(1, (n.max - n.vida) * 5));
      const saida = Math.min(1, n.vida * 2.5);
      ctx.globalAlpha = Math.min(entrada, saida);
      const tam = 30;
      const larg = Math.min(980, larguraTexto(ctx, n.str, tam, FONTE, 600) + 96);
      const xx = x - larg / 2;
      const h = 58;
      bloco(ctx, xx, yy, larg, h, { r: 8, cor: COR.superficie });
      ctx.fillStyle = n.cor;
      ctx.fillRect(xx, yy, 8, h);
      if (n.presente) this.desenharPresente(ctx, n.presente, xx + 46, yy + h / 2, 21);
      else this.desenharAvatar(ctx, n.usuario, xx + 46, yy + h / 2, 21);
      texto(ctx, n.str, xx + 78, yy + h / 2 + 1, { tam, alinhar: 'left', peso: 600, maxLarg: larg - 96 });
      yy += h + 10;
    }
    ctx.globalAlpha = 1;
  }

  desenharAlerta(ctx) {
    const a = this.alerta;
    if (!a) return;
    if (a.modo === 'faixa') return this.desenharFaixa(ctx, a);
    const ent = easeOutBack(Math.min(1, a.t * 3.5));
    const sai = Math.min(1, (a.dur - a.t) * 3);
    ctx.save();
    ctx.globalAlpha = sai;
    ctx.translate(W / 2, 780);
    ctx.scale(ent, ent);
    bloco(ctx, -450, -150, 900, 300, { r: 14, cor: a.cor, sombra: 14 });
    if (a.presente) this.desenharPresente(ctx, a.presente, 0, -150, 72, { fundo: COR.tinta });
    else this.desenharAvatar(ctx, a.usuario, 0, -150, 64, COR.tinta);
    texto(ctx, a.titulo, 0, 0, { tam: 92, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta, maxLarg: 840 });
    texto(ctx, a.sub, 0, 90, { tam: 40, peso: 700, cor: COR.tinta, maxLarg: 840 });
    ctx.restore();
  }

  // Faixa amarela por cima do título (não atrapalha o jogo)
  desenharFaixa(ctx, a) {
    const ent = easeOut(Math.min(1, a.t * 5));
    const sai = Math.min(1, (a.dur - a.t) * 5);
    const x = 30;
    const y = ZONA.topo + 4;
    const w = W - 60;
    const h = LAYOUT.legenda + LAYOUT.legendaAltura - y;
    ctx.save();
    ctx.globalAlpha = Math.min(ent, sai);
    ctx.translate((1 - ent) * -60, 0);
    bloco(ctx, x, y, w, h, { r: 12, cor: a.cor, sombra: 10 });
    const temIcone = a.presente || a.usuario;
    if (temIcone) {
      if (a.presente) this.desenharPresente(ctx, a.presente, x + 110, y + h / 2, 70, { fundo: COR.tinta });
      else this.desenharAvatar(ctx, a.usuario, x + 110, y + h / 2, 66, COR.tinta);
      texto(ctx, a.titulo, x + 210, y + h * 0.36, { tam: 80, alinhar: 'left', fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta, maxLarg: w - 240 });
      texto(ctx, a.sub, x + 210, y + h * 0.72, { tam: 40, alinhar: 'left', peso: 700, cor: COR.tinta, maxLarg: w - 240 });
    } else {
      texto(ctx, a.titulo, W / 2, y + h * 0.4, { tam: 86, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta, maxLarg: w - 60 });
      texto(ctx, a.sub, W / 2, y + h * 0.75, { tam: 40, peso: 700, cor: COR.tinta, maxLarg: w - 60 });
    }
    ctx.restore();
  }

  desenharFlash(ctx) {
    if (this.flashT <= 0 || !this.flashCor) return;
    ctx.globalAlpha = (this.flashT / this.flashMax) * 0.22;
    ctx.fillStyle = this.flashCor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // ---------- imagens ----------
  carregarImagem(url) {
    if (!url) return null;
    let item = this.imagens.get(url);
    if (!item) {
      if (this.imagens.size > 400) this.imagens.clear();
      const img = new Image();
      item = { img, ok: false };
      img.referrerPolicy = 'no-referrer';
      img.onload = () => (item.ok = true);
      img.src = url;
      this.imagens.set(url, item);
    }
    return item.ok ? item.img : null;
  }

  // Acha a imagem de um presente: imagem do evento → imagem configurada → cache do TikTok
  imagemDoPresente(p) {
    if (!p) return null;
    if (p.imagem) return p.imagem;
    const nomes = [p.nome, ...(p.apelidos || [])].filter(Boolean).map((n) => String(n).toLowerCase().trim());
    for (const n of nomes) if (this.imagensPresentes[n]) return this.imagensPresentes[n];
    return null;
  }

  // Desenha o presente (imagem real se tiver; senão, ícone de caixinha)
  desenharPresente(ctx, p, x, y, r, { fundo = COR.superficie2 } = {}) {
    const img = this.carregarImagem(this.imagemDoPresente(p));
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fundo;
    ctx.fill();
    if (img) {
      const s = r * 1.6;
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    } else {
      desenharIconePresente(ctx, x, y, r * 0.95, this.faixa((p.diamantes || 1) * (p.quantidade || 1)));
    }
    ctx.restore();
  }

  desenharAvatar(ctx, usuario, x, y, r, borda = null) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    const img = usuario ? this.carregarImagem(usuario.avatar) : null;
    if (img) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = usuario ? corDoId(usuario.id) : COR.linha;
      ctx.fill();
      const ini = usuario ? (usuario.nome || '?').replace(/[^a-zA-Z0-9À-ú]/g, '').charAt(0).toUpperCase() || '?' : '?';
      texto(ctx, ini, x, y + r * 0.04, { tam: r * 1.15, cor: '#fff', fonte: FONTE_TITULO, peso: 800 });
    }
    if (borda) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, r * 0.1);
      ctx.strokeStyle = borda;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ranking grande em painel (é o que motiva a galera a aparecer)
  desenharRanking(ctx, x, y, w, titulo, lista, { max = 5, cor = COR.amarelo, sufixo = 'pts' } = {}) {
    const linha = 70;
    const topo = 78;
    const n = Math.max(1, Math.min(max, lista.length));
    const h = topo + n * linha + 14;
    bloco(ctx, x, y, w, h, { r: 14, cor: 'rgba(29, 32, 39, 0.94)', sombra: 8 });
    // título com faixa de cor
    ctx.fillStyle = cor;
    retArredondado(ctx, x, y, w, 60, 14);
    ctx.fill();
    ctx.fillRect(x, y + 40, w, 20);
    texto(ctx, titulo, x + w / 2, y + 31, { tam: 40, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta, espaco: 1 });
    if (!lista.length) {
      texto(ctx, 'Ninguém ainda. Comenta aí e aparece aqui!', x + w / 2, y + topo + linha / 2, { tam: 32, peso: 600, cor: COR.suave });
      return h;
    }
    const medalhas = [COR.amarelo, '#D3D7DE', '#E0A060'];
    lista.slice(0, max).forEach((item, i) => {
      const yy = y + topo + i * linha;
      const cy = yy + linha / 2 - 4;
      if (i === 0) bloco(ctx, x + 10, yy - 4, w - 20, linha - 4, { r: 10, cor: comAlfa(cor, 0.16) });
      // posição
      if (i < 3) {
        ctx.fillStyle = medalhas[i];
        ctx.beginPath();
        ctx.arc(x + 46, cy, 22, 0, Math.PI * 2);
        ctx.fill();
        texto(ctx, String(i + 1), x + 46, cy + 1, { tam: 32, fonte: FONTE_TITULO, peso: 800, cor: COR.tinta });
      } else {
        texto(ctx, String(i + 1), x + 46, cy + 1, { tam: 34, fonte: FONTE_TITULO, peso: 800, cor: COR.suave });
      }
      this.desenharAvatar(ctx, item.usuario, x + 108, cy, 26, i === 0 ? cor : null);
      texto(ctx, cortarNome(item.usuario.nome, 18), x + 148, cy + 1, { tam: 36, alinhar: 'left', peso: 700, maxLarg: w - 380 });
      const suf = item.valor === 1 && sufixo.endsWith('s') ? sufixo.slice(0, -1) : sufixo;
      texto(ctx, `${formatarNumero(item.valor)} ${suf}`, x + w - 24, cy + 1, { tam: 40, alinhar: 'right', fonte: FONTE_TITULO, peso: 800, cor: i === 0 ? cor : COR.texto });
    });
    return h;
  }

  // Legenda de presentes no topo: [imagem] Rosa / +10 pts
  desenharLegenda(ctx, itens, y = LAYOUT.legenda) {
    if (!itens?.length) return;
    const n = Math.min(4, itens.length);
    const gap = 12;
    const w = Math.min(300, (W - 60 - gap * (n - 1)) / n);
    const total = n * w + gap * (n - 1);
    let x = W / 2 - total / 2;
    const h = LAYOUT.legendaAltura;
    for (const it of itens.slice(0, n)) {
      bloco(ctx, x, y, w, h, { r: 10, cor: COR.superficie });
      this.desenharPresente(ctx, it, x + 44, y + h / 2, 30);
      texto(ctx, it.nome, x + 86, y + 26, { tam: 22, alinhar: 'left', peso: 600, cor: COR.suave, maxLarg: w - 96 });
      texto(ctx, it.efeito, x + 86, y + 57, { tam: 32, alinhar: 'left', fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo, maxLarg: w - 96 });
      x += w + gap;
    }
  }
}

// Ícone de caixinha de presente (cor muda conforme o tamanho do presente)
export function desenharIconePresente(ctx, x, y, s, faixa = 'pequeno') {
  const cor = { pequeno: COR.vermelho, medio: COR.laranja, grande: COR.azul, lendario: COR.amarelo }[faixa] || COR.vermelho;
  ctx.save();
  ctx.translate(x, y);
  const b = s * 0.5;
  ctx.fillStyle = cor;
  ctx.fillRect(-b, -b * 0.15, b * 2, b * 1.15);
  ctx.fillRect(-b * 1.12, -b * 0.6, b * 2.24, b * 0.5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-b * 0.14, -b * 0.6, b * 0.28, b * 1.6);
  ctx.beginPath();
  ctx.ellipse(-b * 0.35, -b * 0.78, b * 0.3, b * 0.2, -0.5, 0, Math.PI * 2);
  ctx.ellipse(b * 0.35, -b * 0.78, b * 0.3, b * 0.2, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Cronômetro chapado (bloco com o tempo)
export function desenharRelogio(ctx, x, y, r, restante, total) {
  const urgente = restante <= 10;
  const w = r * 2.9;
  const h = r * 1.15;
  bloco(ctx, x - w / 2, y - h / 2, w, h, { r: 10, cor: urgente ? COR.vermelho : COR.texto, sombra: 6 });
  // barrinha de progresso embaixo
  const frac = total > 0 ? limitar(restante / total, 0, 1) : 0;
  ctx.fillStyle = urgente ? escurecer(COR.vermelho, 0.35) : COR.amarelo;
  ctx.fillRect(x - w / 2 + 10, y + h / 2 - 12, (w - 20) * frac, 6);
  const str = restante >= 60 ? formatarTempo(restante) : `0:${String(Math.max(0, Math.ceil(restante))).padStart(2, '0')}`;
  texto(ctx, str, x, y - 3, { tam: h * 0.78, fonte: FONTE_TITULO, peso: 800, cor: urgente ? COR.texto : COR.tinta });
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
