// JOGO 1 — BATALHA DE TIMES
// Comentar o nome do time entra no time. Cada comentário depois disso = ponto pro time.
// Curtidas, presentes, seguir e compartilhar também dão pontos.
// A rodada tem tempo; quem tiver mais pontos no fim vence. Depois recomeça sozinho.

import {
  W, COR, FONTE_TITULO, texto, painel, retArredondado, acharOpcao, formatarNumero,
  desenharRelogio, easeOutBack, limitar, clarear, comAlfa, cortarNome, lerp,
} from '../motor.js';

const PADRAO = {
  duracaoSegundos: 180,
  intervaloSegundos: 12,
  pontosPorComentario: 1,
  curtidasPorPonto: 5,
  pontosPorDiamante: 10,
  pontosPorSeguir: 20,
  pontosPorCompartilhar: 10,
  times: [
    { nome: 'AZUL', cor: '#3B82F6', palavras: ['azul', '1'] },
    { nome: 'VERMELHO', cor: '#F43F5E', palavras: ['vermelho', '2'] },
  ],
};

export default class Batalha {
  constructor(motor, cfg) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    if (!Array.isArray(this.cfg.times) || this.cfg.times.length < 2) this.cfg.times = PADRAO.times;
    this.cfg.times = this.cfg.times.slice(0, 4);
    this.titulo = 'BATALHA DE TIMES';
    this.vitorias = this.cfg.times.map(() => 0);
    this.yNotificacoes = 1250;
    this.novaRodada();
  }

  novaRodada() {
    this.fase = 'jogando';
    this.restante = this.cfg.duracaoSegundos;
    this.times = this.cfg.times.map((t) => ({ ...t, pontos: 0, exibido: 0, pulso: 0, membros: new Set() }));
    this.membro = new Map(); // usuarioId -> índice do time
    this.contrib = new Map(); // usuarioId -> { usuario, valor, time }
    this.curtidasAcum = new Map();
    this.ultimoPonto = new Map();
    this.vencedor = null;
    this.tFim = 0;
  }

  palavrasChave() {
    return this.times.map((t) => normal(t.palavras[0]));
  }

  instrucoes() {
    if (this.fase === 'fim') return [{ texto: `Nova rodada em ${Math.ceil(this.tFim)}s — escolha seu time!`, cor: COR.ciano }];
    const nomes = this.times.map((t) => t.nome).join(' ou ');
    return [
      { texto: `Comente ${nomes} pra entrar no time`, cor: COR.ouro },
      { texto: 'Cada comentário = ponto  •  Presentes valem MUITO', cor: COR.suave },
    ];
  }

  acoes() {
    return [
      { id: 'reiniciar', rotulo: 'Nova rodada agora' },
      { id: 'encerrar', rotulo: 'Encerrar rodada' },
      { id: 'mais60', rotulo: '+1 minuto' },
      { id: 'zerarPlacar', rotulo: 'Zerar vitórias da noite' },
    ];
  }

  aoAcao(acao) {
    if (acao === 'reiniciar') this.novaRodada();
    else if (acao === 'encerrar' && this.fase === 'jogando') this.encerrar();
    else if (acao === 'mais60' && this.fase === 'jogando') this.restante += 60;
    else if (acao === 'zerarPlacar') this.vitorias = this.times.map(() => 0);
  }

  // ---------- regras ----------
  timeDo(usuario, texto) {
    const escolhido = texto ? acharOpcao(texto, this.times) : -1;
    if (escolhido >= 0 && !this.membro.has(usuario.id)) {
      this.membro.set(usuario.id, escolhido);
      this.times[escolhido].membros.add(usuario.id);
      this.times[escolhido].pulso = 1;
    }
    return this.membro.has(usuario.id) ? this.membro.get(usuario.id) : -1;
  }

  // Quem manda presente sem ter time vai pro time mais fraco (ajuda o equilíbrio)
  timeMaisFraco() {
    let idx = 0;
    this.times.forEach((t, i) => {
      if (t.pontos < this.times[idx].pontos) idx = i;
    });
    return idx;
  }

  pontuar(i, usuario, pts, mostrar = true) {
    if (i < 0 || pts <= 0) return;
    const t = this.times[i];
    t.pontos += pts;
    t.pulso = 1;
    const c = this.contrib.get(usuario.id) || { usuario, valor: 0, time: i };
    c.valor += pts;
    c.usuario = usuario;
    this.contrib.set(usuario.id, c);
    if (mostrar) {
      // números saem pelas laterais do placar pra não cobrir o valor
      const { x, y } = this.centroCard(i);
      const lado = Math.random() < 0.5 ? -1 : 1;
      this.m.flutuar(x + lado * (175 + Math.random() * 30), y + 10, `+${formatarNumero(pts)}`, clarear(t.cor, 0.5), pts >= 100 ? 48 : 36);
    }
  }

  aoEvento(ev) {
    if (this.fase !== 'jogando') return;
    const u = ev.usuario;
    switch (ev.tipo) {
      case 'comentario': {
        const i = this.timeDo(u, ev.texto);
        if (i < 0) return;
        const agora = performance.now();
        if (agora - (this.ultimoPonto.get(u.id) || 0) < 1200) return; // anti-spam
        this.ultimoPonto.set(u.id, agora);
        this.pontuar(i, u, this.cfg.pontosPorComentario);
        this.m.som.tocar('ponto');
        break;
      }
      case 'curtida': {
        const i = this.membro.get(u.id);
        if (i === undefined) return;
        const acum = (this.curtidasAcum.get(u.id) || 0) + ev.curtidas;
        const pts = Math.floor(acum / this.cfg.curtidasPorPonto);
        this.curtidasAcum.set(u.id, acum - pts * this.cfg.curtidasPorPonto);
        this.pontuar(i, u, pts, pts >= 3);
        break;
      }
      case 'presente': {
        let i = this.membro.get(u.id);
        if (i === undefined) {
          i = this.timeMaisFraco();
          this.membro.set(u.id, i);
          this.times[i].membros.add(u.id);
        }
        const total = ev.presente.diamantes * ev.presente.quantidade;
        const pts = total * this.cfg.pontosPorDiamante;
        this.pontuar(i, u, pts);
        const { x, y } = this.centroCard(i);
        const fx = this.m.faixa(total);
        this.m.explodir(x, y, [this.times[i].cor, COR.ouro, '#fff'], fx === 'pequeno' ? 18 : 60, fx === 'pequeno' ? 500 : 1000);
        if (fx === 'pequeno') this.m.notificar(`+${formatarNumero(pts)} pro time ${this.times[i].nome}`, { cor: this.times[i].cor, usuario: u });
        break;
      }
      case 'seguir': {
        const i = this.membro.get(u.id) ?? this.timeMaisFraco();
        this.pontuar(i, u, this.cfg.pontosPorSeguir);
        break;
      }
      case 'compartilhar': {
        const i = this.membro.get(u.id) ?? this.timeMaisFraco();
        this.pontuar(i, u, this.cfg.pontosPorCompartilhar);
        break;
      }
    }
  }

  encerrar() {
    this.fase = 'fim';
    this.tFim = this.cfg.intervaloSegundos;
    const max = Math.max(...this.times.map((t) => t.pontos));
    const lideres = this.times.map((t, i) => (t.pontos === max ? i : -1)).filter((i) => i >= 0);
    if (max === 0 || lideres.length > 1) {
      this.vencedor = -1; // empate
      this.m.anunciar({ titulo: 'EMPATE!', sub: 'Ninguém levou essa. Próxima rodada!', cor: COR.ciano, dur: 3 });
    } else {
      this.vencedor = lideres[0];
      this.vitorias[this.vencedor]++;
      this.m.confete(220);
      this.m.som.tocar('vitoria');
    }
  }

  atualizar(dt) {
    for (const t of this.times) {
      t.exibido = lerp(t.exibido, t.pontos, Math.min(1, dt * 8));
      t.pulso = Math.max(0, t.pulso - dt * 3);
    }
    if (this.fase === 'jogando') {
      const antes = Math.ceil(this.restante);
      this.restante -= dt;
      if (this.restante <= 10 && Math.ceil(this.restante) !== antes) this.m.som.tocar('tick');
      if (this.restante <= 0) this.encerrar();
    } else {
      this.tFim -= dt;
      if (this.tFim <= 0) this.novaRodada();
    }
  }

  // ---------- desenho ----------
  layout() {
    const n = this.times.length;
    const linhas = n <= 2 ? 1 : 2;
    const h = linhas === 1 ? 330 : 230;
    const w = 480;
    return this.times.map((_, i) => {
      const col = i % 2;
      const lin = Math.floor(i / 2);
      return { x: 40 + col * 520, y: 590 + lin * (h + 24), w, h };
    });
  }

  centroCard(i) {
    const c = this.layout()[i];
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  }

  topDoTime(i) {
    let melhor = null;
    for (const c of this.contrib.values()) if (c.time === i && (!melhor || c.valor > melhor.valor)) melhor = c;
    return melhor;
  }

  desenhar(ctx) {
    const cards = this.layout();
    const total = this.times.reduce((s, t) => s + t.exibido, 0);
    const lider = this.times.reduce((b, t, i) => (t.pontos > this.times[b].pontos ? i : b), 0);
    const temLider = this.times.some((t) => t.pontos > 0) && this.times.filter((t) => t.pontos === this.times[lider].pontos).length === 1;

    // relógio
    if (this.fase === 'jogando') desenharRelogio(ctx, W / 2, 510, 62, this.restante, this.cfg.duracaoSegundos);

    // cartões dos times
    this.times.forEach((t, i) => {
      const c = cards[i];
      const esc = 1 + 0.04 * t.pulso;
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.scale(esc, esc);
      ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
      const brilho = temLider && i === lider ? t.cor : null;
      painel(ctx, c.x, c.y, c.w, c.h, { r: 32, fundo: comAlfa(t.cor, 0.18), borda: t.cor, brilho });
      const compacto = c.h < 300;
      texto(ctx, t.nome, c.x + c.w / 2, c.y + (compacto ? 44 : 56), { tam: compacto ? 44 : 54, fonte: FONTE_TITULO, peso: 400, cor: clarear(t.cor, 0.35), maxLarg: c.w - 40 });
      texto(ctx, formatarNumero(t.exibido), c.x + c.w / 2, c.y + (compacto ? 116 : 150), { tam: compacto ? 76 : 104, fonte: FONTE_TITULO, peso: 400, cor: COR.texto, brilho: t.cor });
      texto(ctx, `${t.membros.size} no time`, c.x + c.w / 2, c.y + (compacto ? 170 : 222), { tam: 30, cor: COR.suave, contorno: 0 });
      if (!compacto) {
        const top = this.topDoTime(i);
        if (top) {
          this.m.desenharAvatar(ctx, top.usuario, c.x + 62, c.y + c.h - 46, 26, COR.ouro);
          texto(ctx, `MVP ${cortarNome(top.usuario.nome, 12)}`, c.x + 100, c.y + c.h - 44, { tam: 28, alinhar: 'left', cor: COR.ouro, contorno: 0, maxLarg: c.w - 130 });
        }
      }
      if (temLider && i === lider && this.fase === 'jogando') {
        painel(ctx, c.x + c.w / 2 - 90, c.y - 22, 180, 44, { r: 22, fundo: COR.ouro, borda: null });
        texto(ctx, 'NA FRENTE', c.x + c.w / 2, c.y, { tam: 26, cor: '#1a1206', contorno: 0 });
      }
      ctx.restore();
    });

    // barra de cabo de guerra
    const ultimo = cards[cards.length - 1];
    const by = ultimo.y + ultimo.h + 44;
    const bx = 40;
    const bw = W - 80;
    const bh = 64;
    ctx.save();
    retArredondado(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.clip();
    let x = bx;
    this.times.forEach((t) => {
      const frac = total > 0 ? t.exibido / total : 1 / this.times.length;
      const w = bw * frac;
      const g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, clarear(t.cor, 0.25));
      g.addColorStop(1, t.cor);
      ctx.fillStyle = g;
      ctx.fillRect(x, by, w + 1, bh);
      if (w > 120) texto(ctx, `${Math.round(frac * 100)}%`, x + w / 2, by + bh / 2 + 2, { tam: 34, contorno: 4 });
      x += w;
    });
    ctx.restore();
    // faísca na divisa (só com 2 times)
    if (this.times.length === 2 && total > 0) {
      const sx = bx + (bw * this.times[0].exibido) / total;
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, by + bh / 2, 14 + 4 * Math.sin(this.m.t * 12), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.3) this.m.explodir(sx, by + bh / 2, ['#fff', COR.ouro], 1, 300, { grav: 600, tam: [3, 6], vida: [0.2, 0.5] });
    }

    // placar da noite
    const py = by + bh + 50;
    const placar = this.times.map((t, i) => `${t.nome} ${this.vitorias[i]}`).join('   •   ');
    texto(ctx, `VITÓRIAS DA NOITE:  ${placar}`, W / 2, py, { tam: 30, cor: COR.suave, contorno: 0, maxLarg: 1000 });

    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 2.5, 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(8, 6, 24, ${0.75 * limitar(t0 * 3, 0, 1)})`;
    ctx.fillRect(0, 0, W, 1920);
    ctx.translate(W / 2, 760);
    ctx.scale(ent, ent);
    if (this.vencedor >= 0) {
      const t = this.times[this.vencedor];
      painel(ctx, -480, -300, 960, 600, { r: 44, fundo: 'rgba(12, 8, 32, 0.95)', borda: t.cor, brilho: t.cor });
      texto(ctx, 'VENCEDOR', 0, -220, { tam: 50, cor: COR.ouro, fonte: FONTE_TITULO, peso: 400 });
      texto(ctx, `TIME ${t.nome}`, 0, -130, { tam: 92, fonte: FONTE_TITULO, peso: 400, cor: clarear(t.cor, 0.3), brilho: t.cor, maxLarg: 900 });
      texto(ctx, `${formatarNumero(t.pontos)} pontos`, 0, -40, { tam: 48 });
      // top 3 do time vencedor
      const tops = [...this.contrib.values()].filter((c) => c.time === this.vencedor).sort((a, b) => b.valor - a.valor).slice(0, 3);
      texto(ctx, tops.length ? 'Quem carregou o time:' : '', 0, 40, { tam: 34, cor: COR.suave, contorno: 0 });
      tops.forEach((c, i) => {
        const x = (i - (tops.length - 1) / 2) * 290;
        this.m.desenharAvatar(ctx, c.usuario, x, 140, 52, [COR.ouro, '#E2E8F0', '#F59E0B'][i]);
        texto(ctx, cortarNome(c.usuario.nome, 12), x, 222, { tam: 30, maxLarg: 270 });
        texto(ctx, `${formatarNumero(c.valor)} pts`, x, 262, { tam: 28, cor: COR.ouro, contorno: 0 });
      });
    } else {
      painel(ctx, -420, -160, 840, 320, { r: 44, fundo: 'rgba(12, 8, 32, 0.95)', borda: COR.ciano });
      texto(ctx, 'EMPATE!', 0, -40, { tam: 110, fonte: FONTE_TITULO, peso: 400, cor: COR.ciano, brilho: COR.ciano });
      texto(ctx, 'Bora desempatar na próxima', 0, 70, { tam: 42 });
    }
    ctx.restore();
  }

  status() {
    return {
      fase: this.fase,
      restante: Math.max(0, Math.round(this.fase === 'jogando' ? this.restante : this.tFim)),
      placar: this.times.map((t, i) => ({ nome: t.nome, cor: t.cor, pontos: Math.round(t.pontos), membros: t.membros.size, vitorias: this.vitorias[i] })),
      ranking: [...this.contrib.values()].sort((a, b) => b.valor - a.valor).slice(0, 5).map((c) => ({ nome: c.usuario.nome, valor: c.valor, extra: this.times[c.time]?.nome })),
    };
  }
}

function normal(s) {
  return String(s || '').toLowerCase();
}
