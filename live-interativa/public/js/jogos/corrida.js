// JOGO 2 — CORRIDA DE BANDEIRAS
// Cada corredor é um país (ou qualquer coisa que você configurar).
// Comentar o nome/número empurra o corredor. Presente = TURBO. Curtida = empurrãozinho.
// O primeiro a cruzar a linha de chegada vence. Recomeça sozinho.

import {
  W, COR, FONTE_TITULO, texto, painel, retArredondado, acharOpcao, formatarNumero,
  easeOutBack, limitar, lerp, cortarNome, comAlfa,
} from '../motor.js';

const PADRAO = {
  tamanhoPista: 250,
  passoComentario: 4,
  curtidasPorPasso: 10,
  passoPorDiamante: 6,
  intervaloSegundos: 12,
  corredores: [
    { nome: 'BRASIL', bandeira: 'brasil', palavras: ['brasil', 'br', '1'] },
    { nome: 'ARGENTINA', bandeira: 'argentina', palavras: ['argentina', 'arg', '2'] },
    { nome: 'PORTUGAL', bandeira: 'portugal', palavras: ['portugal', 'pt', '3'] },
    { nome: 'MÉXICO', bandeira: 'mexico', palavras: ['mexico', 'mx', '4'] },
    { nome: 'EUA', bandeira: 'eua', palavras: ['eua', 'usa', '5'] },
    { nome: 'JAPÃO', bandeira: 'japao', palavras: ['japao', 'jp', '6'] },
  ],
};

const COR_BANDEIRA = {
  brasil: '#16A34A', argentina: '#60A5FA', portugal: '#DC2626', mexico: '#15803D', eua: '#1D4ED8', japao: '#F43F5E',
};

const PISTA_X0 = 150;
const PISTA_X1 = 950;
const TOPO_PISTAS = 470;

export default class Corrida {
  constructor(motor, cfg) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    if (!Array.isArray(this.cfg.corredores) || this.cfg.corredores.length < 2) this.cfg.corredores = PADRAO.corredores;
    this.cfg.corredores = this.cfg.corredores.slice(0, 8);
    this.titulo = 'CORRIDA DE BANDEIRAS';
    this.vitorias = this.cfg.corredores.map(() => 0);
    this.yNotificacoes = 1250;
    this.novaCorrida();
  }

  novaCorrida() {
    this.fase = 'correndo';
    this.corredores = this.cfg.corredores.map((c) => ({
      ...c,
      cor: c.cor || COR_BANDEIRA[c.bandeira] || COR.secundaria,
      progresso: 0,
      exibido: 0,
      turbo: 0,
      fas: new Map(),
    }));
    this.torcida = new Map(); // usuarioId -> índice
    this.curtidasAcum = new Map();
    this.ultimo = new Map();
    this.vencedor = -1;
    this.tFim = 0;
    this.tempo = 0;
  }

  palavrasChave() {
    return this.corredores.map((c) => String(c.palavras[c.palavras.length - 1] || c.palavras[0]).toLowerCase());
  }

  instrucoes() {
    if (this.fase === 'fim') return [{ texto: `Nova corrida em ${Math.ceil(this.tFim)}s`, cor: COR.ciano }];
    return [
      { texto: 'Comente o NÚMERO ou o NOME do país', cor: COR.ouro },
      { texto: 'Presente = TURBO  •  Curtida = empurrão', cor: COR.suave },
    ];
  }

  acoes() {
    return [
      { id: 'reiniciar', rotulo: 'Nova corrida agora' },
      { id: 'zerarPlacar', rotulo: 'Zerar vitórias da noite' },
    ];
  }

  aoAcao(acao) {
    if (acao === 'reiniciar') this.novaCorrida();
    else if (acao === 'zerarPlacar') this.vitorias = this.cfg.corredores.map(() => 0);
  }

  empurrar(i, usuario, passos, turbo = 0) {
    if (this.fase !== 'correndo' || i < 0 || passos <= 0) return;
    const c = this.corredores[i];
    c.progresso = Math.min(this.cfg.tamanhoPista, c.progresso + passos);
    if (turbo) c.turbo = Math.max(c.turbo, turbo);
    const f = c.fas.get(usuario.id) || { usuario, valor: 0 };
    f.valor += passos;
    f.usuario = usuario;
    c.fas.set(usuario.id, f);
    if (c.progresso >= this.cfg.tamanhoPista) this.chegou(i);
  }

  aoEvento(ev) {
    if (this.fase !== 'correndo') return;
    const u = ev.usuario;
    switch (ev.tipo) {
      case 'comentario': {
        const i = acharOpcao(ev.texto, this.corredores);
        if (i < 0) return;
        this.torcida.set(u.id, i);
        const agora = performance.now();
        if (agora - (this.ultimo.get(u.id) || 0) < 1000) return;
        this.ultimo.set(u.id, agora);
        this.empurrar(i, u, this.cfg.passoComentario);
        const p = this.posicao(i);
        this.m.explodir(p.x - 50, p.y, [this.corredores[i].cor, '#fff'], 4, 220, { grav: 0, tam: [4, 8], vida: [0.3, 0.6] });
        this.m.som.tocar('ponto');
        break;
      }
      case 'curtida': {
        const i = this.torcida.get(u.id);
        if (i === undefined) return;
        const acum = (this.curtidasAcum.get(u.id) || 0) + ev.curtidas;
        const passos = Math.floor(acum / this.cfg.curtidasPorPasso);
        this.curtidasAcum.set(u.id, acum - passos * this.cfg.curtidasPorPasso);
        this.empurrar(i, u, passos);
        break;
      }
      case 'presente': {
        // Sem torcida definida: o presente vai pro último colocado
        let i = this.torcida.get(u.id);
        if (i === undefined) {
          i = this.corredores.reduce((b, c, k) => (c.progresso < this.corredores[b].progresso ? k : b), 0);
          this.torcida.set(u.id, i);
        }
        const total = ev.presente.diamantes * ev.presente.quantidade;
        const passos = total * this.cfg.passoPorDiamante;
        const fx = this.m.faixa(total);
        this.empurrar(i, u, passos, fx === 'pequeno' ? 1.5 : fx === 'medio' ? 3 : 5);
        const p = this.posicao(i);
        this.m.explodir(p.x, p.y, [COR.ouro, COR.laranja, '#fff'], fx === 'pequeno' ? 16 : 50, 700);
        this.m.flutuar(p.x, p.y - 50, 'TURBO!', COR.ouro, 44);
        if (fx === 'pequeno') this.m.notificar(`TURBO pro ${this.corredores[i].nome}!`, { cor: COR.ouro, usuario: u });
        break;
      }
      case 'seguir':
      case 'compartilhar': {
        const i = this.torcida.get(u.id);
        if (i !== undefined) this.empurrar(i, u, this.cfg.passoComentario * 3, 1);
        break;
      }
    }
  }

  chegou(i) {
    this.fase = 'fim';
    this.vencedor = i;
    this.vitorias[i]++;
    this.tFim = this.cfg.intervaloSegundos;
    this.m.confete(220);
    this.m.som.tocar('vitoria');
    this.m.flash(this.corredores[i].cor, 0.5);
  }

  atualizar(dt) {
    this.tempo += dt;
    for (const c of this.corredores) {
      c.exibido = lerp(c.exibido, c.progresso, Math.min(1, dt * (c.turbo > 0 ? 10 : 5)));
      c.turbo = Math.max(0, c.turbo - dt);
      if (c.turbo > 0 && Math.random() < 0.6) {
        const p = this.posicao(this.corredores.indexOf(c));
        this.m.explodir(p.x - 55, p.y + (Math.random() - 0.5) * 30, [COR.laranja, COR.ouro, COR.destaque], 1, 260, { grav: -100, tam: [6, 12], vida: [0.2, 0.45] });
      }
    }
    if (this.fase === 'fim') {
      this.tFim -= dt;
      if (this.tFim <= 0) this.novaCorrida();
    }
  }

  alturaPista() {
    const n = this.corredores.length;
    return Math.min(108, Math.floor(660 / n));
  }

  posicao(i) {
    const h = this.alturaPista();
    const c = this.corredores[i];
    const frac = limitar(c.exibido / this.cfg.tamanhoPista, 0, 1);
    return { x: PISTA_X0 + (PISTA_X1 - PISTA_X0) * frac, y: TOPO_PISTAS + i * h + h / 2 };
  }

  ordem() {
    return this.corredores.map((c, i) => ({ c, i })).sort((a, b) => b.c.progresso - a.c.progresso);
  }

  desenhar(ctx) {
    const h = this.alturaPista();
    const ordem = this.ordem();
    const posicaoDe = new Map(ordem.map((o, k) => [o.i, k + 1]));

    // pista
    painel(ctx, 24, TOPO_PISTAS - 18, W - 48, h * this.corredores.length + 36, { r: 28, fundo: 'rgba(12, 8, 32, 0.78)' });
    // linha de chegada quadriculada
    const q = 16;
    for (let y = TOPO_PISTAS - 6; y < TOPO_PISTAS + h * this.corredores.length + 6; y += q) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (Math.floor((y - TOPO_PISTAS) / q) + k) % 2 ? '#fff' : '#111';
        ctx.fillRect(PISTA_X1 + 50 + k * q, y, q, q);
      }
    }

    this.corredores.forEach((c, i) => {
      const y = TOPO_PISTAS + i * h;
      // faixa da pista
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(40, y + 3, W - 80, h - 6);
      // nome grande de fundo
      texto(ctx, c.nome, 560, y + h / 2 + 2, { tam: Math.min(64, h * 0.62), fonte: FONTE_TITULO, peso: 400, cor: comAlfa(c.cor.startsWith('#') ? c.cor : '#A78BFA', 0.28), contorno: 0 });
      // número/atalho
      const atalho = String(c.palavras[c.palavras.length - 1] || '').toUpperCase();
      painel(ctx, 50, y + h / 2 - 28, 70, 56, { r: 16, fundo: 'rgba(12,8,32,0.9)', borda: COR.ouro });
      texto(ctx, atalho, 85, y + h / 2 + 2, { tam: 34, fonte: FONTE_TITULO, peso: 400, cor: COR.ouro, contorno: 0, maxLarg: 60 });
      // trilha percorrida
      const p = this.posicao(i);
      const g = ctx.createLinearGradient(PISTA_X0, 0, p.x, 0);
      g.addColorStop(0, comAlfa(c.cor.startsWith('#') ? c.cor : '#A78BFA', 0));
      g.addColorStop(1, comAlfa(c.cor.startsWith('#') ? c.cor : '#A78BFA', 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(PISTA_X0, y + h / 2 - 6, Math.max(0, p.x - PISTA_X0), 12);
    });

    // corredores (desenhados por cima das faixas)
    this.corredores.forEach((c, i) => {
      const p = this.posicao(i);
      const bal = Math.sin(this.m.t * 10 + i) * (c.turbo > 0 ? 4 : 2);
      const fw = Math.min(96, h * 0.95);
      const fh = fw * 0.66;
      ctx.save();
      ctx.translate(p.x, p.y + bal);
      ctx.rotate(Math.sin(this.m.t * 6 + i) * 0.05);
      ctx.shadowColor = c.turbo > 0 ? COR.ouro : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = c.turbo > 0 ? 30 : 12;
      retArredondado(ctx, -fw / 2, -fh / 2, fw, fh, 8);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      retArredondado(ctx, -fw / 2, -fh / 2, fw, fh, 8);
      ctx.clip();
      desenharBandeira(ctx, c, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
      retArredondado(ctx, -fw / 2, -fh / 2, fw, fh, 8);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
      // posição (1º, 2º...)
      const pos = posicaoDe.get(i);
      if (c.progresso > 0) {
        texto(ctx, `${pos}º`, p.x + fw / 2 + 30, p.y + 2, { tam: 30, fonte: FONTE_TITULO, peso: 400, cor: pos === 1 ? COR.ouro : COR.suave, contorno: 5 });
      }
    });

    // vitórias da noite + líder
    const yb = TOPO_PISTAS + h * this.corredores.length + 50;
    const lider = ordem[0];
    if (lider && lider.c.progresso > 0 && this.fase === 'correndo') {
      const falta = Math.max(0, Math.round(100 - (lider.c.progresso / this.cfg.tamanhoPista) * 100));
      texto(ctx, `${lider.c.nome} na frente — falta ${falta}%`, W / 2, yb, { tam: 36, cor: COR.ouro });
    } else if (this.fase === 'correndo') {
      texto(ctx, 'Valendo! Quem larga primeiro?', W / 2, yb, { tam: 36, cor: COR.ouro });
    }
    const vit = this.corredores
      .map((c, i) => ({ nome: c.nome, v: this.vitorias[i] }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 4)
      .map((x) => `${x.nome} ${x.v}`)
      .join('  •  ');
    if (vit) texto(ctx, `VITÓRIAS DA NOITE: ${vit}`, W / 2, yb + 52, { tam: 28, cor: COR.suave, contorno: 0, maxLarg: 1000 });

    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharFim(ctx) {
    const c = this.corredores[this.vencedor];
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 2.5, 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(8, 6, 24, ${0.75 * limitar(t0 * 3, 0, 1)})`;
    ctx.fillRect(0, 0, W, 1920);
    ctx.translate(W / 2, 780);
    ctx.scale(ent, ent);
    painel(ctx, -480, -330, 960, 660, { r: 44, fundo: 'rgba(12, 8, 32, 0.95)', borda: COR.ouro, brilho: COR.ouro });
    texto(ctx, 'CAMPEÃO DA CORRIDA', 0, -270, { tam: 48, fonte: FONTE_TITULO, peso: 400, cor: COR.ouro });
    ctx.save();
    retArredondado(ctx, -120, -230, 240, 160, 14);
    ctx.clip();
    desenharBandeira(ctx, c, -120, -230, 240, 160);
    ctx.restore();
    retArredondado(ctx, -120, -230, 240, 160, 14);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    texto(ctx, c.nome, 0, -10, { tam: 96, fonte: FONTE_TITULO, peso: 400, cor: COR.texto, brilho: COR.ouro, maxLarg: 900 });
    const fas = [...c.fas.values()].sort((a, b) => b.valor - a.valor).slice(0, 3);
    if (fas.length) texto(ctx, 'Maiores torcedores:', 0, 80, { tam: 34, cor: COR.suave, contorno: 0 });
    fas.forEach((f, k) => {
      const x = (k - (fas.length - 1) / 2) * 290;
      this.m.desenharAvatar(ctx, f.usuario, x, 170, 50, [COR.ouro, '#E2E8F0', '#F59E0B'][k]);
      texto(ctx, cortarNome(f.usuario.nome, 12), x, 250, { tam: 30, maxLarg: 270 });
    });
    ctx.restore();
  }

  status() {
    return {
      fase: this.fase,
      restante: this.fase === 'fim' ? Math.round(this.tFim) : null,
      placar: this.ordem().map(({ c, i }) => ({
        nome: c.nome,
        cor: c.cor,
        pontos: Math.round((c.progresso / this.cfg.tamanhoPista) * 100),
        sufixo: '%',
        vitorias: this.vitorias[i],
      })),
      ranking: this.corredores
        .flatMap((c) => [...c.fas.values()].map((f) => ({ nome: f.usuario.nome, valor: f.valor, extra: c.nome })))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
    };
  }
}

// ---------- bandeiras desenhadas em vetor (emoji de bandeira não funciona no Windows) ----------
export function desenharBandeira(ctx, c, x, y, w, h) {
  const tipo = c.bandeira;
  const faixasH = (cores) => cores.forEach((cor, k) => { ctx.fillStyle = cor; ctx.fillRect(x, y + (h * k) / cores.length, w, h / cores.length + 1); });
  const faixasV = (cores) => cores.forEach((cor, k) => { ctx.fillStyle = cor; ctx.fillRect(x + (w * k) / cores.length, y, w / cores.length + 1, h); });
  switch (tipo) {
    case 'brasil':
      ctx.fillStyle = '#009C3B';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#FFDF00';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.1);
      ctx.lineTo(x + w * 0.92, y + h / 2);
      ctx.lineTo(x + w / 2, y + h * 0.9);
      ctx.lineTo(x + w * 0.08, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#002776';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1.5, h * 0.035);
      ctx.beginPath();
      ctx.arc(x + w / 2 + h * 0.05, y + h / 2 + h * 0.35, h * 0.38, -Math.PI * 0.72, -Math.PI * 0.36);
      ctx.stroke();
      break;
    case 'argentina':
      faixasH(['#74ACDF', '#FFFFFF', '#74ACDF']);
      ctx.fillStyle = '#F6B40E';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'portugal':
      ctx.fillStyle = '#006600';
      ctx.fillRect(x, y, w * 0.4, h);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(x + w * 0.4, y, w * 0.6, h);
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.arc(x + w * 0.4, y + h / 2, h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + w * 0.4 - h * 0.09, y + h / 2 - h * 0.11, h * 0.18, h * 0.22);
      break;
    case 'mexico':
      faixasV(['#006847', '#FFFFFF', '#CE1126']);
      ctx.fillStyle = '#8B5A2B';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'eua': {
      const n = 7;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k % 2 ? '#FFFFFF' : '#B22234';
        ctx.fillRect(x, y + (h * k) / n, w, h / n + 1);
      }
      ctx.fillStyle = '#3C3B6E';
      ctx.fillRect(x, y, w * 0.42, h * (4 / 7));
      ctx.fillStyle = '#fff';
      for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) {
        ctx.beginPath();
        ctx.arc(x + w * 0.06 + b * w * 0.1, y + h * 0.1 + a * h * 0.17, Math.max(1, h * 0.03), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'japao':
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#BC002D';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: {
      // Bandeira genérica: "cores": ["#hex", ...] e "orientacao": "h" ou "v"
      const cores = Array.isArray(c.cores) && c.cores.length ? c.cores : [c.cor || COR.secundaria];
      if (c.orientacao === 'v') faixasV(cores);
      else faixasH(cores);
      if (cores.length === 1) {
        texto(ctx, String(c.nome || '?').charAt(0), x + w / 2, y + h / 2 + 2, { tam: h * 0.7, fonte: FONTE_TITULO, peso: 400, contorno: 4 });
      }
    }
  }
}
