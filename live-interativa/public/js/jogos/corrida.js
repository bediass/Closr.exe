// JOGO 2 — CORRIDA DE BANDEIRAS
// Cada corredor é um país (ou qualquer coisa que você configurar).
// Comentar o nome/número empurra o corredor. Presente = TURBO. Curtida = empurrãozinho.
// O primeiro a cruzar a linha de chegada vence. Recomeça sozinho.

import {
  W, COR, LAYOUT, FONTE_TITULO, texto, bloco, etiqueta, retArredondado, acharOpcao, formatarNumero,
  easeOutBack, limitar, lerp, cortarNome,
} from '../motor.js';

const PADRAO = {
  tamanhoPista: 250,
  passoComentario: 4,
  curtidasPorPasso: 10,
  turboBase: 10,
  turboExpoente: 0.6,
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
  brasil: '#16A34A', argentina: '#60A5FA', portugal: '#DC2626', mexico: '#15803D', eua: '#1D4ED8', japao: '#E11D48',
};

const PISTA_X0 = 160; // onde a bandeira começa (centro)
const PISTA_X1 = 900; // onde a bandeira termina (centro)
const CHEGADA = 968;
const TOPO_PISTAS = LAYOUT.jogo + 24;

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
      cor: c.cor || COR_BANDEIRA[c.bandeira] || COR.suave,
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
  }

  palavrasChave() {
    return this.corredores.map((c) => String(c.palavras[c.palavras.length - 1] || c.palavras[0]).toLowerCase());
  }

  instrucoes() {
    if (this.fase === 'fim') return [`Nova corrida em ${Math.ceil(this.tFim)}s`];
    return ['Comente o número ou o nome do país'];
  }

  // Turbo cresce com o valor do presente, mas não linear: presente caro ajuda muito sem acabar a corrida
  passosDoPresente(diamantes) {
    return Math.round(this.cfg.turboBase * Math.pow(Math.max(1, diamantes), this.cfg.turboExpoente));
  }

  legendaPresente(diamantes) {
    const pct = Math.max(1, Math.round((this.passosDoPresente(diamantes) / this.cfg.tamanhoPista) * 100));
    return pct >= 100 ? 'Vitória na hora' : `Turbo +${pct}%`;
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
        const fx = this.m.faixa(total);
        this.empurrar(i, u, this.passosDoPresente(total), fx === 'pequeno' ? 1.5 : fx === 'medio' ? 3 : 5);
        const p = this.posicao(i);
        this.m.explodir(p.x, p.y, [COR.amarelo, COR.laranja, '#fff'], fx === 'pequeno' ? 12 : 40, 600);
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
    this.m.confete(200);
    this.m.som.tocar('vitoria');
  }

  atualizar(dt) {
    for (const [k, c] of this.corredores.entries()) {
      c.exibido = lerp(c.exibido, c.progresso, Math.min(1, dt * (c.turbo > 0 ? 10 : 5)));
      c.turbo = Math.max(0, c.turbo - dt);
      if (c.turbo > 0 && Math.random() < 0.5) {
        const p = this.posicao(k);
        this.m.explodir(p.x - 50, p.y + (Math.random() - 0.5) * 24, [COR.laranja, COR.amarelo], 1, 220, { grav: 0, tam: [6, 12], vida: [0.2, 0.4] });
      }
    }
    if (this.fase === 'fim') {
      this.tFim -= dt;
      if (this.tFim <= 0) this.novaCorrida();
    }
  }

  alturaPista() {
    return Math.min(104, Math.floor(640 / this.corredores.length));
  }

  posicao(i) {
    const h = this.alturaPista();
    const frac = limitar(this.corredores[i].exibido / this.cfg.tamanhoPista, 0, 1);
    return { x: PISTA_X0 + (PISTA_X1 - PISTA_X0) * frac, y: TOPO_PISTAS + i * h + h / 2 };
  }

  ordem() {
    return this.corredores.map((c, i) => ({ c, i })).sort((a, b) => b.c.progresso - a.c.progresso);
  }

  desenhar(ctx) {
    const h = this.alturaPista();
    const ordem = this.ordem();
    const posicaoDe = new Map(ordem.map((o, k) => [o.i, k + 1]));
    const altura = h * this.corredores.length;

    // pistas
    this.corredores.forEach((c, i) => {
      const y = TOPO_PISTAS + i * h;
      ctx.fillStyle = i % 2 ? COR.superficie : COR.superficie2;
      ctx.fillRect(36, y, W - 72, h);
      // número do corredor
      const atalho = String(c.palavras[c.palavras.length - 1] || '').toUpperCase();
      ctx.fillStyle = COR.amarelo;
      ctx.fillRect(36, y, 64, h);
      texto(ctx, atalho, 68, y + h / 2 + 1, { tam: 44, fonte: FONTE_TITULO, peso: 800, cor: COR.tinta, maxLarg: 56 });
      // rastro
      const p = this.posicao(i);
      ctx.fillStyle = c.cor;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(PISTA_X0 - 40, y + h / 2 - 4, Math.max(0, p.x - PISTA_X0), 8);
      ctx.globalAlpha = 1;
    });
    // linha de chegada quadriculada
    const q = 14;
    for (let y = TOPO_PISTAS, k = 0; y < TOPO_PISTAS + altura; y += q, k++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111';
        ctx.fillRect(CHEGADA + j * q, y, q, Math.min(q, TOPO_PISTAS + altura - y));
      }
    }

    // corredores
    this.corredores.forEach((c, i) => {
      const p = this.posicao(i);
      const bal = Math.sin(this.m.t * 10 + i) * (c.turbo > 0 ? 3 : 1.5);
      const fh = h * 0.56;
      const fw = fh * 1.5;
      const x = p.x - fw / 2;
      const y = p.y - fh / 2 + bal;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 5, y + 5, fw, fh);
      ctx.save();
      retArredondado(ctx, x, y, fw, fh, 4);
      ctx.clip();
      desenharBandeira(ctx, c, x, y, fw, fh);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      retArredondado(ctx, x, y, fw, fh, 4);
      ctx.stroke();
      // nome + posição ao lado da bandeira (vai pra esquerda quando chega perto da chegada)
      const pos = posicaoDe.get(i);
      const rotulo = c.progresso > 0 ? `${pos}º ${c.nome}` : c.nome;
      const perto = p.x > 640;
      texto(ctx, rotulo, perto ? x - 14 : x + fw + 14, p.y + 1, {
        tam: 30, alinhar: perto ? 'right' : 'left', fonte: FONTE_TITULO, peso: 800,
        cor: pos === 1 && c.progresso > 0 ? COR.amarelo : COR.texto,
      });
    });

    // linha de status
    const yb = TOPO_PISTAS + altura + 50;
    const lider = ordem[0];
    if (this.fase === 'correndo') {
      const str = lider && lider.c.progresso > 0
        ? `${lider.c.nome} NA FRENTE · FALTA ${Math.max(0, Math.round(100 - (lider.c.progresso / this.cfg.tamanhoPista) * 100))}%`
        : 'VALENDO! QUEM LARGA PRIMEIRO?';
      texto(ctx, str, W / 2, yb, { tam: 38, fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo, espaco: 1 });
    }
    const vit = this.corredores
      .map((c, i) => ({ nome: c.nome, v: this.vitorias[i] }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 4)
      .map((x) => `${x.nome} ${x.v}`)
      .join('  ·  ');
    if (vit) texto(ctx, `VITÓRIAS DA NOITE   ${vit}`, W / 2, yb + 50, { tam: 28, fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1, maxLarg: 1000 });

    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharFim(ctx) {
    const c = this.corredores[this.vencedor];
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 3, 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(10, 11, 13, ${0.8 * limitar(t0 * 4, 0, 1)})`;
    ctx.fillRect(0, LAYOUT.jogo - 10, W, 1920);
    ctx.translate(W / 2, 800);
    ctx.scale(ent, ent);
    bloco(ctx, -470, -300, 940, 600, { r: 16, cor: COR.texto, sombra: 14 });
    etiqueta(ctx, 'CAMPEÃO DA CORRIDA', 0, -300, { tam: 36 });
    ctx.fillStyle = '#000';
    ctx.fillRect(-120 + 8, -240 + 8, 240, 160);
    desenharBandeira(ctx, c, -120, -240, 240, 160);
    texto(ctx, c.nome, 0, -10, { tam: 120, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta, maxLarg: 880 });
    const fas = [...c.fas.values()].sort((a, b) => b.valor - a.valor).slice(0, 3);
    if (fas.length) texto(ctx, 'MAIORES TORCEDORES', 0, 80, { tam: 30, fonte: FONTE_TITULO, peso: 800, cor: '#555', espaco: 2 });
    fas.forEach((f, k) => {
      const x = (k - (fas.length - 1) / 2) * 280;
      this.m.desenharAvatar(ctx, f.usuario, x, 170, 46, k === 0 ? COR.amarelo : null);
      texto(ctx, cortarNome(f.usuario.nome, 12), x, 248, { tam: 30, peso: 700, cor: COR.tinta, maxLarg: 260 });
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
      const cores = Array.isArray(c.cores) && c.cores.length ? c.cores : [c.cor || COR.suave];
      if (c.orientacao === 'v') faixasV(cores);
      else faixasH(cores);
      if (cores.length === 1) {
        texto(ctx, String(c.nome || '?').charAt(0), x + w / 2, y + h / 2 + 2, { tam: h * 0.7, fonte: FONTE_TITULO, peso: 800, contorno: 4 });
      }
    }
  }
}
