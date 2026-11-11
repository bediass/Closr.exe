// JOGO 4 — PROTEJA O NÚCLEO
// Inimigos vêm de todos os lados atrás do núcleo. QUALQUER comentário dispara um tiro.
// Curtidas enchem a energia → onda de choque. Seguir = drone ajudante.
// Presentes: bomba, laser, escudo. Se a vida do núcleo zerar, mostra o placar e recomeça.

import {
  W, COR, FONTE_TITULO, texto, painel, retArredondado, formatarNumero, limitar, aleatorio,
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
const CY = 860;
const R_NUCLEO = 70;
const R_SPAWN = 640;

const TIPOS = {
  normal: { vida: 1, raio: 26, vel: 1, dano: 5, cor: '#F43F5E', pontos: 1 },
  rapido: { vida: 1, raio: 20, vel: 1.8, dano: 3, cor: '#FB923C', pontos: 1 },
  tanque: { vida: 4, raio: 40, vel: 0.6, dano: 10, cor: '#A855F7', pontos: 3 },
  chefe: { vida: 30, raio: 74, vel: 0.35, dano: 35, cor: '#DC2626', pontos: 20 },
};

export default class Defesa {
  constructor(motor, cfg) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    this.titulo = 'PROTEJA O NÚCLEO';
    this.yNotificacoes = 1585;
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
    if (this.fase === 'fim') return [{ texto: `Nova partida em ${Math.ceil(this.tFim)}s`, cor: COR.ciano }];
    return [
      { texto: 'Comente QUALQUER COISA pra atirar', cor: COR.ouro },
      { texto: 'Curtida = energia  •  Seguir = drone  •  Presente = poder', cor: COR.suave },
    ];
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
    this.m.explodir(e.x, e.y, [e.cor, '#fff', COR.ouro], e.tipo === 'chefe' ? 80 : 14, e.tipo === 'chefe' ? 900 : 420, { grav: 200 });
    this.m.som.tocar('explosao');
    if (usuario) {
      this.creditar(usuario, e.pontos);
      if (e.tipo === 'chefe') {
        this.m.anunciar({ titulo: 'CHEFÃO DERROTADO!', sub: `Golpe final de ${cortarNome(usuario.nome, 16)}`, cor: COR.ouro, usuario });
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
          this.m.notificar('ONDA DE CHOQUE! (curtidas)', { cor: COR.ciano, usuario: u });
        }
        break;
      }
      case 'presente': {
        const total = ev.presente.diamantes * ev.presente.quantidade;
        const fx = this.m.faixa(total);
        if (fx === 'pequeno') {
          // rajada: 3 tiros por unidade de presente (máx 30)
          const n = Math.min(30, 3 * ev.presente.quantidade * Math.max(1, ev.presente.diamantes));
          for (let k = 0; k < n; k++) this.filaTiros.push({ usuario: u, cor: COR.destaque, t: k * 0.07 });
          this.m.notificar(`${cortarNome(u.nome, 14)}: RAJADA x${n}`, { cor: COR.destaque, usuario: u });
        } else if (fx === 'medio') {
          this.ondaDeChoque(u, 520, COR.destaque);
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
        this.m.notificar(`${cortarNome(u.nome, 14)} virou DRONE por ${this.cfg.segundosDrone}s!`, { cor: COR.verde, usuario: u });
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
      this.m.anunciar({ titulo: 'CHEFÃO CHEGANDO!', sub: 'Todo mundo comentando AGORA!', cor: COR.destaque, dur: 2.6 });
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
    this.m.anunciar({ titulo: `ONDA ${this.onda}`, sub: 'Os inimigos estão mais rápidos!', cor: COR.secundaria, dur: 2 });
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
      this.atirar(null, { cor: COR.secundaria });
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
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.18)';
    ctx.lineWidth = 3;
    for (const r of [170, 300, 430]) {
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
        ctx.strokeStyle = k % 2 ? COR.ciano : '#fff';
        ctx.lineWidth = 26 * (l.t / 1.2);
        ctx.shadowColor = COR.ciano;
        ctx.shadowBlur = 40;
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
      ctx.lineWidth = 18;
      ctx.shadowColor = o.cor;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(CX, CY, o.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // inimigos
    for (const e of this.inimigos) desenharInimigo(ctx, e);

    // tiros
    for (const t of this.tiros) {
      ctx.save();
      ctx.strokeStyle = t.cor;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.shadowColor = t.cor;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - t.vx * 0.025, t.y - t.vy * 0.025);
      ctx.stroke();
      ctx.restore();
    }

    // núcleo
    if (this.fase === 'jogando') this.desenharNucleo(ctx);

    // drones
    for (const d of this.drones) {
      const dx = CX + Math.cos(d.ang) * 170;
      const dy = CY + Math.sin(d.ang) * 170;
      ctx.save();
      ctx.fillStyle = COR.verde;
      ctx.shadowColor = COR.verde;
      ctx.shadowBlur = 20;
      desenharEstrela(ctx, dx, dy, 22, d.ang * 2);
      ctx.restore();
      this.m.desenharAvatar(ctx, d.usuario, dx, dy - 46, 20, COR.verde);
    }

    this.desenharHud(ctx);
    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharNucleo(ctx) {
    const frac = this.vida / this.cfg.vidaNucleo;
    const cor = frac > 0.5 ? COR.ciano : frac > 0.25 ? COR.ouro : COR.destaque;
    const pulso = 1 + 0.05 * Math.sin(this.m.t * 4);
    ctx.save();
    ctx.translate(CX, CY);
    // anéis girando
    ctx.strokeStyle = cor;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, R_NUCLEO + 26, this.m.t * 2, this.m.t * 2 + Math.PI * 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R_NUCLEO + 40, -this.m.t * 1.4, -this.m.t * 1.4 + Math.PI * 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // cristal hexagonal
    ctx.scale(pulso, pulso);
    ctx.shadowColor = cor;
    ctx.shadowBlur = 50;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + this.m.t * 0.3;
      ctx.lineTo(Math.cos(a) * R_NUCLEO, Math.sin(a) * R_NUCLEO);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, -20, 5, 0, 0, R_NUCLEO);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, cor);
    g.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = this.danoT > 0 ? COR.destaque : g;
    ctx.fill();
    ctx.restore();
    // escudo
    if (this.escudo > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.m.t * 8);
      ctx.fillStyle = COR.ciano;
      ctx.beginPath();
      ctx.arc(CX, CY, R_NUCLEO + 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = COR.ciano;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
      texto(ctx, `ESCUDO ${Math.ceil(this.escudo)}s`, CX, CY + R_NUCLEO + 90, { tam: 30, cor: COR.ciano });
    }
  }

  desenharHud(ctx) {
    // linha de status: onda | vida | próxima onda
    const y = 470;
    texto(ctx, `ONDA ${this.onda}`, 60, y + 4, { tam: 40, alinhar: 'left', fonte: FONTE_TITULO, peso: 400, cor: COR.secundaria });
    texto(ctx, `próxima em ${Math.max(0, Math.ceil(this.tOnda))}s`, W - 60, y + 4, { tam: 30, alinhar: 'right', cor: COR.suave });
    // vida
    const bw = 420;
    const bx = W / 2 - bw / 2;
    const frac = limitar(this.vida / this.cfg.vidaNucleo, 0, 1);
    painel(ctx, bx, y - 26, bw, 52, { r: 26, fundo: 'rgba(12,8,32,0.9)' });
    ctx.save();
    retArredondado(ctx, bx + 6, y - 20, (bw - 12) * frac, 40, 20);
    ctx.fillStyle = frac > 0.5 ? COR.verde : frac > 0.25 ? COR.ouro : COR.destaque;
    ctx.fill();
    ctx.restore();
    texto(ctx, `NÚCLEO ${Math.ceil(this.vida)}/${this.cfg.vidaNucleo}`, W / 2, y + 2, { tam: 28, contorno: 5 });

    // energia (curtidas)
    const ey = 1225;
    const ef = limitar(this.energia / this.cfg.curtidasParaOndaDeChoque, 0, 1);
    painel(ctx, 140, ey - 24, W - 280, 48, { r: 24, fundo: 'rgba(12,8,32,0.9)' });
    ctx.save();
    retArredondado(ctx, 146, ey - 18, (W - 292) * ef, 36, 18);
    ctx.fillStyle = COR.ciano;
    ctx.shadowColor = COR.ciano;
    ctx.shadowBlur = ef > 0.9 ? 30 : 0;
    ctx.fill();
    ctx.restore();
    texto(ctx, `ENERGIA DAS CURTIDAS ${Math.floor(ef * 100)}%`, W / 2, ey + 2, { tam: 26, contorno: 5 });

    // ranking de defensores
    const lista = [...this.abates.values()].sort((a, b) => b.valor - a.valor).map((a) => ({ usuario: a.usuario, valor: a.valor }));
    this.m.desenharRanking(ctx, 140, 1275, W - 280, 'MAIORES DEFENSORES', lista, { max: 3, sufixo: 'abates', cor: COR.ciano });
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 2.5, 0, 1));
    const top = [...this.abates.values()].sort((a, b) => b.valor - a.valor).slice(0, 3);
    ctx.save();
    ctx.fillStyle = `rgba(8, 6, 24, ${0.7 * limitar(t0 * 3, 0, 1)})`;
    ctx.fillRect(0, 0, W, 1920);
    ctx.translate(W / 2, 800);
    ctx.scale(ent, ent);
    painel(ctx, -480, -300, 960, 600, { r: 44, fundo: 'rgba(12, 8, 32, 0.95)', borda: COR.destaque, brilho: COR.destaque });
    texto(ctx, 'O NÚCLEO CAIU!', 0, -220, { tam: 72, fonte: FONTE_TITULO, peso: 400, cor: COR.destaque, brilho: COR.destaque });
    texto(ctx, `Resistimos até a ONDA ${this.onda}`, 0, -130, { tam: 48 });
    texto(ctx, `Recorde da noite: onda ${this.recorde}`, 0, -70, { tam: 34, cor: COR.ouro, contorno: 0 });
    if (top.length) texto(ctx, 'Heróis da defesa:', 0, 0, { tam: 34, cor: COR.suave, contorno: 0 });
    else {
      texto(ctx, 'Ninguém atirou dessa vez…', 0, 90, { tam: 44 });
      texto(ctx, 'Comenta qualquer coisa na próxima!', 0, 160, { tam: 36, cor: COR.ouro, contorno: 0 });
    }
    top.forEach((a, k) => {
      const x = (k - (top.length - 1) / 2) * 290;
      this.m.desenharAvatar(ctx, a.usuario, x, 100, 50, [COR.ouro, '#E2E8F0', '#F59E0B'][k]);
      texto(ctx, cortarNome(a.usuario.nome, 12), x, 180, { tam: 30, maxLarg: 270 });
      texto(ctx, `${formatarNumero(a.valor)} abates`, x, 220, { tam: 26, cor: COR.ciano, contorno: 0 });
    });
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
  ctx.shadowColor = e.cor;
  ctx.shadowBlur = 18;
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
  ctx.shadowBlur = 0;
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
    ctx.fillStyle = '#0B0820';
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
