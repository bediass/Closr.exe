// JOGO 4 — PROTEJA O NÚCLEO
// Inimigos vêm de todos os lados atrás do núcleo. QUALQUER comentário dispara um tiro.
// Curtidas enchem a energia → onda de choque. Seguir = drone ajudante.
// Presentes: bomba, laser, escudo. Se a vida do núcleo zerar, mostra o placar e recomeça.

import {
  W, COR, LAYOUT, FONTE_TITULO, texto, bloco, etiqueta, retArredondado, formatarNumero, limitar,
  easeOutBack, cortarNome, desenharEstrela,
} from '../motor.js';

const PADRAO = {
  vidaNucleo: 100,
  segundosPorOnda: 30,
  curtidasParaOndaDeChoque: 200,
  segundosDrone: 30,
  intervaloSegundos: 12,
};

const CX = 540;
const CY = 850;
const R_NUCLEO = 70;
const R_SPAWN = 640;

const TIPOS = {
  normal: { vida: 1, raio: 26, vel: 1, dano: 5, cor: '#FF4D4D', pontos: 1 },
  rapido: { vida: 1, raio: 20, vel: 1.8, dano: 3, cor: '#FF8A3D', pontos: 1 },
  tanque: { vida: 4, raio: 40, vel: 0.6, dano: 10, cor: '#B26BFF', pontos: 3 },
  chefe: { vida: 30, raio: 74, vel: 0.35, dano: 35, cor: '#E02424', pontos: 20 },
};

export default class Defesa {
  constructor(motor, cfg) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    this.titulo = 'PROTEJA O NÚCLEO';
    this.yNotificacoes = 1696;
    this.recorde = 0;
    this.novaPartida();
  }

  novaPartida() {
    this.fase = 'jogando';
    this.vida = this.cfg.vidaNucleo;
    this.onda = 1;
    this.tOnda = this.cfg.segundosPorOnda;
    this.inimigos = [];
    this.tiros = [];
    this.drones = [];
    this.ondasChoque = [];
    this.lasers = [];
    this.energia = 0;
    this.escudo = 0;
    this.acumSpawn = 0;
    this.autoTiro = 0;
    this.filaTiros = [];
    this.abates = new Map(); // usuarioId -> { usuario, valor }
    this.ultimoTiro = new Map();
    this.tFim = 0;
    this.danoT = 0;
    this.tempo = 0;
  }

  palavrasChave() {
    return ['fogo', 'atira', 'vai', 'bora', 'defende'];
  }

  instrucoes() {
    if (this.fase === 'fim') return [`Nova partida em ${Math.ceil(this.tFim)}s`];
    return ['Comente qualquer coisa pra atirar · seguir vira drone'];
  }

  legendaPresente(diamantes) {
    const fx = this.m.faixa(diamantes);
    if (fx === 'pequeno') return `Rajada x${Math.min(30, 3 * diamantes)}`;
    if (fx === 'medio') return 'Bomba';
    if (fx === 'grande') return 'Laser + cura';
    return 'Escudo + cura';
  }

  acoes() {
    return [
      { id: 'reiniciar', rotulo: 'Nova partida' },
      { id: 'curar', rotulo: 'Curar núcleo (+30)' },
      { id: 'proximaOnda', rotulo: 'Pular pra próxima onda' },
      { id: 'chefe', rotulo: 'Soltar um CHEFÃO' },
    ];
  }

  aoAcao(acao) {
    if (acao === 'reiniciar') this.novaPartida();
    else if (this.fase !== 'jogando') return;
    else if (acao === 'curar') this.curar(30);
    else if (acao === 'proximaOnda') this.avancarOnda();
    else if (acao === 'chefe') this.criarInimigo('chefe');
  }

  // ---------- poderes ----------
  creditar(usuario, n = 1) {
    if (!usuario) return;
    const a = this.abates.get(usuario.id) || { usuario, valor: 0 };
    a.valor += n;
    a.usuario = usuario;
    this.abates.set(usuario.id, a);
  }

  alvoMaisProximo(x = CX, y = CY) {
    let melhor = null;
    let dm = Infinity;
    for (const e of this.inimigos) {
      if (e.vida <= e.mirado) continue; // já tem tiros suficientes indo nele
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < dm) {
        dm = d;
        melhor = e;
      }
    }
    return melhor || this.inimigos[0] || null;
  }

  atirar(usuario, { x = CX, y = CY, cor = COR.ciano, dano = 1 } = {}) {
    const alvo = this.alvoMaisProximo(x, y);
    let ang;
    if (alvo) {
      alvo.mirado += dano;
      ang = Math.atan2(alvo.y - y, alvo.x - x);
    } else ang = Math.random() * Math.PI * 2;
    const v = 1500;
    this.tiros.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 0.8, usuario, cor, dano, alvo });
    this.m.som.tocar('tiro');
  }

  matar(e, usuario) {
    e.morto = true;
    this.m.explodir(e.x, e.y, [e.cor, '#fff', COR.amarelo], e.tipo === 'chefe' ? 80 : 14, e.tipo === 'chefe' ? 900 : 420, { grav: 200 });
    this.m.som.tocar('explosao');
    if (usuario) {
      this.creditar(usuario, e.pontos);
      if (e.tipo === 'chefe') {
        this.m.anunciar({ titulo: 'CHEFÃO DERROTADO!', sub: `Golpe final de ${cortarNome(usuario.nome, 16)}`, cor: COR.amarelo, usuario });
        this.m.confete(120);
      } else if (Math.random() < 0.5) {
        this.m.flutuar(e.x, e.y - 20, cortarNome(usuario.nome, 10), COR.ciano, 26, 0.9);
      }
    }
  }

  ondaDeChoque(usuario, raio = 480, cor = COR.ciano) {
    this.ondasChoque.push({ r: R_NUCLEO, max: raio, cor, usuario });
    this.m.som.tocar('explosao');
    this.m.tremer(12);
  }

  laser(usuario) {
    this.lasers.push({ t: 1.2, usuario });
    for (const e of this.inimigos) if (!e.morto) this.matar(e, usuario);
    this.m.flash(COR.ciano, 0.6);
    this.m.tremer(24);
  }

  curar(n) {
    this.vida = Math.min(this.cfg.vidaNucleo, this.vida + n);
    this.m.flutuar(CX, CY - 110, `+${n} VIDA`, COR.verde, 44);
  }

  aoEvento(ev) {
    if (this.fase !== 'jogando') return;
    const u = ev.usuario;
    switch (ev.tipo) {
      case 'comentario': {
        const agora = performance.now();
        if (agora - (this.ultimoTiro.get(u.id) || 0) < 800) return;
        this.ultimoTiro.set(u.id, agora);
        this.atirar(u);
        break;
      }
      case 'curtida': {
        this.energia += ev.curtidas;
        if (this.energia >= this.cfg.curtidasParaOndaDeChoque) {
          this.energia = 0;
          this.ondaDeChoque(u);
          this.m.flutuar(CX, CY - 120, 'ONDA DE CHOQUE!', COR.ciano, 48, 1.5);
        }
        break;
      }
      case 'presente': {
        const total = ev.presente.diamantes * ev.presente.quantidade;
        const fx = this.m.faixa(total);
        if (fx === 'pequeno') {
          // rajada: 3 tiros por unidade de presente (máx 30)
          const n = Math.min(30, 3 * ev.presente.quantidade * Math.max(1, ev.presente.diamantes));
          for (let k = 0; k < n; k++) this.filaTiros.push({ usuario: u, cor: COR.amarelo, t: k * 0.07 });
        } else if (fx === 'medio') {
          this.ondaDeChoque(u, 520, COR.amarelo);
        } else if (fx === 'grande') {
          this.laser(u);
          this.curar(25);
        } else {
          this.laser(u);
          this.curar(this.cfg.vidaNucleo);
          this.escudo = 15;
        }
        break;
      }
      case 'seguir': {
        this.drones.push({ usuario: u, t: this.cfg.segundosDrone, ang: Math.random() * Math.PI * 2, cd: 0 });
        break;
      }
      case 'compartilhar':
        this.curar(5);
        break;
    }
  }

  // ---------- simulação ----------
  criarInimigo(tipo) {
    const base = TIPOS[tipo];
    const ang = Math.random() * Math.PI * 2;
    const velBase = 60 + this.onda * 7;
    const vida = tipo === 'chefe' ? base.vida + this.onda * 3 : base.vida + (tipo === 'tanque' ? Math.floor(this.onda / 4) : 0);
    this.inimigos.push({
      tipo, x: CX + Math.cos(ang) * R_SPAWN, y: CY + Math.sin(ang) * R_SPAWN,
      vida, max: vida, raio: base.raio, vel: velBase * base.vel, dano: base.dano, cor: base.cor, pontos: base.pontos,
      mirado: 0, rot: Math.random() * 6, hit: 0,
    });
    if (tipo === 'chefe') {
      this.m.anunciar({ titulo: 'CHEFÃO CHEGANDO!', sub: 'Todo mundo comentando AGORA!', cor: COR.vermelho, dur: 2.6 });
      this.m.som.tocar('grande');
    }
  }

  sortearTipo() {
    const r = Math.random();
    if (this.onda >= 3 && r < 0.12) return 'tanque';
    if (this.onda >= 2 && r < 0.35) return 'rapido';
    return 'normal';
  }

  avancarOnda() {
    this.onda++;
    this.tOnda = this.cfg.segundosPorOnda;
    this.recorde = Math.max(this.recorde, this.onda);
    this.m.anunciar({ titulo: `ONDA ${this.onda}`, sub: 'Os inimigos estão mais rápidos!', cor: COR.texto, dur: 2 });
    if (this.onda % 5 === 0) this.criarInimigo('chefe');
  }

  fimDeJogo() {
    this.fase = 'fim';
    this.tFim = this.cfg.intervaloSegundos;
    this.recorde = Math.max(this.recorde, this.onda);
    this.m.explodir(CX, CY, [COR.ciano, COR.destaque, '#fff'], 120, 1200);
    this.m.tremer(30);
    this.m.som.tocar('erro');
  }

  atualizar(dt) {
    this.tempo += dt;
    // efeitos que continuam mesmo no fim
    for (const o of this.ondasChoque) {
      o.r += 1400 * dt;
      for (const e of this.inimigos) {
        if (!e.morto && Math.hypot(e.x - CX, e.y - CY) < o.r && o.r <= o.max) {
          if (e.tipo === 'chefe') {
            e.vida -= 5;
            e.hit = 0.15;
            if (e.vida <= 0) this.matar(e, o.usuario);
          } else this.matar(e, o.usuario);
        }
      }
    }
    this.ondasChoque = this.ondasChoque.filter((o) => o.r < o.max + 80);
    for (const l of this.lasers) l.t -= dt;
    this.lasers = this.lasers.filter((l) => l.t > 0);

    if (this.fase === 'fim') {
      this.tFim -= dt;
      if (this.tFim <= 0) this.novaPartida();
      return;
    }

    // ondas
    this.tOnda -= dt;
    if (this.tOnda <= 0) this.avancarOnda();

    // surgimento de inimigos
    const taxa = 0.9 + this.onda * 0.3;
    this.acumSpawn += dt * taxa;
    while (this.acumSpawn >= 1) {
      this.acumSpawn -= 1;
      if (this.inimigos.length < 70) this.criarInimigo(this.sortearTipo());
    }

    // torreta automática (fraquinha, pra não morrer em 10s sem ninguém comentando)
    this.autoTiro -= dt;
    if (this.autoTiro <= 0 && this.inimigos.length) {
      this.autoTiro = 1.3;
      this.atirar(null, { cor: COR.suave });
    }

    // fila de rajadas
    for (const f of this.filaTiros) f.t -= dt;
    while (this.filaTiros.length && this.filaTiros[0].t <= 0) {
      const f = this.filaTiros.shift();
      this.atirar(f.usuario, { cor: f.cor });
    }

    // drones
    for (const d of this.drones) {
      d.t -= dt;
      d.ang += dt * 1.6;
      d.cd -= dt;
      const dx = CX + Math.cos(d.ang) * 170;
      const dy = CY + Math.sin(d.ang) * 170;
      if (d.cd <= 0 && this.inimigos.length) {
        d.cd = 0.55;
        this.atirar(d.usuario, { x: dx, y: dy, cor: COR.verde });
      }
    }
    this.drones = this.drones.filter((d) => d.t > 0);

    // movimento dos inimigos
    for (const e of this.inimigos) {
      const ang = Math.atan2(CY - e.y, CX - e.x);
      e.x += Math.cos(ang) * e.vel * dt;
      e.y += Math.sin(ang) * e.vel * dt;
      e.rot += dt * (e.tipo === 'rapido' ? 6 : 2);
      e.hit = Math.max(0, e.hit - dt);
      const raioEscudo = this.escudo > 0 ? R_NUCLEO + 60 : R_NUCLEO;
      if (Math.hypot(e.x - CX, e.y - CY) < raioEscudo + e.raio * 0.6) {
        e.morto = true;
        if (this.escudo > 0) {
          this.m.explodir(e.x, e.y, [COR.ciano, '#fff'], 12, 400);
        } else {
          this.vida -= e.dano;
          this.danoT = 0.3;
          this.m.explodir(e.x, e.y, [e.cor, COR.destaque], 20, 500);
          this.m.tremer(e.dano >= 10 ? 18 : 8);
          this.m.som.tocar('explosao');
        }
      }
    }

    // tiros
    for (const t of this.tiros) {
      t.vida -= dt;
      // tiro teleguiado leve: corrige a mira pro alvo
      if (t.alvo && !t.alvo.morto) {
        const ang = Math.atan2(t.alvo.y - t.y, t.alvo.x - t.x);
        t.vx = Math.cos(ang) * 1500;
        t.vy = Math.sin(ang) * 1500;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      for (const e of this.inimigos) {
        if (e.morto) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) < e.raio + 10) {
          t.vida = 0;
          e.vida -= t.dano;
          e.mirado = Math.max(0, e.mirado - t.dano);
          e.hit = 0.12;
          if (e.vida <= 0) this.matar(e, t.usuario);
          break;
        }
      }
      if (t.vida <= 0 && t.alvo && !t.alvo.morto) t.alvo.mirado = Math.max(0, t.alvo.mirado - t.dano);
    }
    this.tiros = this.tiros.filter((t) => t.vida > 0);
    this.inimigos = this.inimigos.filter((e) => !e.morto);

    this.escudo = Math.max(0, this.escudo - dt);
    this.danoT = Math.max(0, this.danoT - dt);
    if (this.vida <= 0) {
      this.vida = 0;
      this.fimDeJogo();
    }
  }

  // ---------- desenho ----------
  desenhar(ctx) {
    // arena
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    for (const r of [180, 320]) {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // lasers
    for (const l of this.lasers) {
      ctx.save();
      ctx.globalAlpha = l.t / 1.2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + this.m.t;
        ctx.strokeStyle = k % 2 ? COR.amarelo : '#fff';
        ctx.lineWidth = 22 * (l.t / 1.2);
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(a) * 1400, CY + Math.sin(a) * 1400);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ondas de choque
    for (const o of this.ondasChoque) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - o.r / (o.max + 80));
      ctx.strokeStyle = o.cor;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(CX, CY, o.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const e of this.inimigos) desenharInimigo(ctx, e);

    // tiros
    ctx.save();
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const t of this.tiros) {
      ctx.strokeStyle = t.cor;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - t.vx * 0.022, t.y - t.vy * 0.022);
      ctx.stroke();
    }
    ctx.restore();

    if (this.fase === 'jogando') this.desenharNucleo(ctx);

    // drones
    for (const d of this.drones) {
      const dx = CX + Math.cos(d.ang) * 170;
      const dy = CY + Math.sin(d.ang) * 170;
      ctx.fillStyle = COR.verde;
      desenharEstrela(ctx, dx, dy, 20, d.ang * 2);
      this.m.desenharAvatar(ctx, d.usuario, dx, dy - 42, 18, COR.verde);
    }

    this.desenharHud(ctx);
    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharNucleo(ctx) {
    const frac = this.vida / this.cfg.vidaNucleo;
    const cor = frac > 0.5 ? COR.ciano : frac > 0.25 ? COR.amarelo : COR.vermelho;
    const pulso = 1 + 0.04 * Math.sin(this.m.t * 4);
    ctx.save();
    ctx.translate(CX, CY);
    // anel girando
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, R_NUCLEO + 24, this.m.t * 2, this.m.t * 2 + Math.PI * 1.2);
    ctx.stroke();
    ctx.scale(pulso, pulso);
    const hex = (r) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    };
    ctx.translate(6, 6);
    hex(R_NUCLEO);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.translate(-6, -6);
    hex(R_NUCLEO);
    ctx.fillStyle = this.danoT > 0 ? '#fff' : cor;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    hex(R_NUCLEO * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.restore();
    if (this.escudo > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = COR.ciano;
      ctx.beginPath();
      ctx.arc(CX, CY, R_NUCLEO + 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([12, 8]);
      ctx.strokeStyle = COR.ciano;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
      etiqueta(ctx, `ESCUDO ${Math.ceil(this.escudo)}s`, CX, CY + R_NUCLEO + 92, { tam: 26, cor: COR.ciano });
    }
  }

  desenharHud(ctx) {
    const y = LAYOUT.jogo + 34;
    texto(ctx, `ONDA ${this.onda}`, 48, y, { tam: 44, alinhar: 'left', fonte: FONTE_TITULO, peso: 800, italico: true });
    texto(ctx, `PRÓXIMA EM ${Math.max(0, Math.ceil(this.tOnda))}s`, W - 48, y, { tam: 30, alinhar: 'right', fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1 });
    // vida
    const bw = 400;
    const bx = W / 2 - bw / 2;
    const frac = limitar(this.vida / this.cfg.vidaNucleo, 0, 1);
    bloco(ctx, bx, y - 24, bw, 48, { r: 8, cor: COR.superficie });
    ctx.fillStyle = frac > 0.5 ? COR.verde : frac > 0.25 ? COR.amarelo : COR.vermelho;
    ctx.fillRect(bx + 4, y - 20, (bw - 8) * frac, 40);
    texto(ctx, `NÚCLEO ${Math.ceil(this.vida)}/${this.cfg.vidaNucleo}`, W / 2, y + 1, { tam: 30, fonte: FONTE_TITULO, peso: 800, contorno: 5 });

    // energia (curtidas)
    const ey = 1200;
    const ef = limitar(this.energia / this.cfg.curtidasParaOndaDeChoque, 0, 1);
    bloco(ctx, 48, ey - 22, W - 96, 44, { r: 8, cor: COR.superficie });
    ctx.fillStyle = COR.ciano;
    ctx.fillRect(52, ey - 18, (W - 104) * ef, 36);
    texto(ctx, `CURTIDAS → ONDA DE CHOQUE  ${Math.floor(ef * 100)}%`, W / 2, ey + 1, { tam: 28, fonte: FONTE_TITULO, peso: 800, contorno: 5, espaco: 1 });

    const lista = [...this.abates.values()].sort((a, b) => b.valor - a.valor).map((a) => ({ usuario: a.usuario, valor: a.valor }));
    this.m.desenharRanking(ctx, 48, 1236, W - 96, 'MAIORES DEFENSORES', lista, { max: 5, sufixo: 'abates', cor: COR.ciano });
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 3, 0, 1));
    const top = [...this.abates.values()].sort((a, b) => b.valor - a.valor).slice(0, 3);
    ctx.save();
    ctx.fillStyle = `rgba(10, 11, 13, ${0.8 * limitar(t0 * 4, 0, 1)})`;
    ctx.fillRect(0, LAYOUT.jogo - 10, W, 1920);
    ctx.translate(W / 2, 800);
    ctx.scale(ent, ent);
    bloco(ctx, -470, -300, 940, 600, { r: 16, cor: COR.vermelho, sombra: 14 });
    texto(ctx, 'O NÚCLEO CAIU!', 0, -205, { tam: 110, fonte: FONTE_TITULO, peso: 800, italico: true });
    texto(ctx, `Resistimos até a onda ${this.onda}`, 0, -115, { tam: 46, peso: 700 });
    etiqueta(ctx, `RECORDE DA NOITE: ONDA ${this.recorde}`, 0, -50, { tam: 30 });
    if (top.length) {
      top.forEach((a, k) => {
        const x = (k - (top.length - 1) / 2) * 280;
        this.m.desenharAvatar(ctx, a.usuario, x, 70, 46, k === 0 ? COR.amarelo : null);
        texto(ctx, cortarNome(a.usuario.nome, 12), x, 148, { tam: 30, peso: 700, maxLarg: 260 });
        texto(ctx, `${formatarNumero(a.valor)} abates`, x, 190, { tam: 32, fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo });
      });
    } else {
      texto(ctx, 'Ninguém atirou dessa vez…', 0, 70, { tam: 44, peso: 700 });
      texto(ctx, 'Comenta qualquer coisa na próxima!', 0, 140, { tam: 36, peso: 600 });
    }
    ctx.restore();
  }

  status() {
    return {
      fase: this.fase,
      restante: this.fase === 'fim' ? Math.round(this.tFim) : Math.round(this.tOnda),
      placar: [
        { nome: 'Onda', pontos: this.onda },
        { nome: 'Vida do núcleo', pontos: Math.ceil(this.vida), sufixo: `/${this.cfg.vidaNucleo}` },
        { nome: 'Inimigos na tela', pontos: this.inimigos.length },
        { nome: 'Recorde (onda)', pontos: Math.max(this.recorde, this.onda) },
      ],
      ranking: [...this.abates.values()].sort((a, b) => b.valor - a.valor).slice(0, 5).map((a) => ({ nome: a.usuario.nome, valor: a.valor, extra: 'abates' })),
    };
  }
}

function desenharInimigo(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  ctx.fillStyle = e.hit > 0 ? '#fff' : e.cor;
  ctx.beginPath();
  if (e.tipo === 'tanque') {
    retArredondado(ctx, -e.raio, -e.raio, e.raio * 2, e.raio * 2, 10);
  } else if (e.tipo === 'rapido') {
    ctx.moveTo(0, -e.raio * 1.3);
    ctx.lineTo(e.raio, 0);
    ctx.lineTo(0, e.raio * 1.3);
    ctx.lineTo(-e.raio, 0);
    ctx.closePath();
  } else {
    const pontas = e.tipo === 'chefe' ? 14 : 8;
    for (let k = 0; k < pontas * 2; k++) {
      const r = k % 2 ? e.raio * 0.65 : e.raio;
      const a = (k / (pontas * 2)) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  // olhos (olhando pro núcleo)
  ctx.rotate(-e.rot);
  const ang = Math.atan2(CY - e.y, CX - e.x);
  const s = e.raio * 0.22;
  for (const lado of [-1, 1]) {
    const ox = Math.cos(ang + lado * 0.6) * e.raio * 0.35;
    const oy = Math.sin(ang + lado * 0.6) * e.raio * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ox, oy, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(ox + Math.cos(ang) * s * 0.4, oy + Math.sin(ang) * s * 0.4, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // barra de vida (tanque/chefe)
  if (e.max > 1) {
    const w = e.raio * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.raio - 20, w, 8);
    ctx.fillStyle = COR.verde;
    ctx.fillRect(e.x - w / 2, e.y - e.raio - 20, (w * Math.max(0, e.vida)) / e.max, 8);
  }
}
