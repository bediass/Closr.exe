// JOGO 1 — BATALHA DE TIMES
// Comentar o nome do time entra no time. Cada comentário depois disso = ponto pro time.
// Curtidas, presentes, seguir e compartilhar também dão pontos.
// A rodada tem tempo; quem tiver mais pontos no fim vence. Depois recomeça sozinho.

import {
  W, COR, LAYOUT, FONTE_TITULO, texto, bloco, etiqueta, retArredondado, acharOpcao, formatarNumero,
  desenharRelogio, easeOutBack, limitar, escurecer, cortarNome, lerp,
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
    { nome: 'AZUL', cor: '#3D7BFF', palavras: ['azul', '1'] },
    { nome: 'VERMELHO', cor: '#FF4D4D', palavras: ['vermelho', '2'] },
  ],
};

const Y0 = LAYOUT.jogo; // topo da área do jogo

export default class Batalha {
  constructor(motor, cfg) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    if (!Array.isArray(this.cfg.times) || this.cfg.times.length < 2) this.cfg.times = PADRAO.times;
    this.cfg.times = this.cfg.times.slice(0, 4);
    this.titulo = 'BATALHA DE TIMES';
    this.vitorias = this.cfg.times.map(() => 0);
    this.yNotificacoes = 1240;
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
    return this.times.map((t) => String(t.palavras[0]).toLowerCase());
  }

  instrucoes() {
    if (this.fase === 'fim') return [`Nova rodada em ${Math.ceil(this.tFim)}s`];
    return [`Comente ${this.times.map((t) => t.nome).join(' ou ')} e ajude seu time`];
  }

  legendaPresente(diamantes) {
    return `+${formatarNumero(diamantes * this.cfg.pontosPorDiamante)} pts`;
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
  timeDo(usuario, txt) {
    const escolhido = txt ? acharOpcao(txt, this.times) : -1;
    if (escolhido >= 0 && !this.membro.has(usuario.id)) {
      this.membro.set(usuario.id, escolhido);
      this.times[escolhido].membros.add(usuario.id);
      this.times[escolhido].pulso = 1;
    }
    return this.membro.has(usuario.id) ? this.membro.get(usuario.id) : -1;
  }

  // Quem manda presente sem ter time vai pro time mais fraco
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
    if (mostrar && pts >= 10) {
      const c2 = this.layout()[i];
      this.m.flutuar(c2.x + c2.w / 2, c2.y + 40, `+${formatarNumero(pts)}`, COR.amarelo, 52);
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
        this.pontuar(i, u, pts, false);
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
        this.pontuar(i, u, total * this.cfg.pontosPorDiamante);
        const c = this.layout()[i];
        const fx = this.m.faixa(total);
        this.m.explodir(c.x + c.w / 2, c.y + c.h / 2, [this.times[i].cor, COR.amarelo, '#fff'], fx === 'pequeno' ? 14 : 50, fx === 'pequeno' ? 450 : 900);
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
      this.vencedor = -1;
    } else {
      this.vencedor = lideres[0];
      this.vitorias[this.vencedor]++;
      this.m.confete(200);
      this.m.som.tocar('vitoria');
    }
  }

  atualizar(dt) {
    for (const t of this.times) {
      t.exibido = lerp(t.exibido, t.pontos, Math.min(1, dt * 8));
      t.pulso = Math.max(0, t.pulso - dt * 4);
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
    const duasLinhas = n > 2;
    const h = duasLinhas ? 220 : 340;
    const w = 480;
    return this.times.map((_, i) => ({ x: 48 + (i % 2) * 504, y: Y0 + 110 + Math.floor(i / 2) * (h + 24), w, h }));
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

    if (this.fase === 'jogando') desenharRelogio(ctx, W / 2, Y0 + 42, 46, this.restante, this.cfg.duracaoSegundos);

    // cartões dos times: bloco de cor sólida
    this.times.forEach((t, i) => {
      const c = cards[i];
      const sobe = -6 * t.pulso;
      const compacto = c.h < 300;
      bloco(ctx, c.x, c.y + sobe, c.w, c.h, { r: 14, cor: t.cor, sombra: 10 });
      texto(ctx, t.nome, c.x + 28, c.y + sobe + 44, { tam: compacto ? 40 : 48, alinhar: 'left', fonte: FONTE_TITULO, peso: 800, italico: true, maxLarg: c.w - 200 });
      texto(ctx, `${t.membros.size} no time`, c.x + c.w - 24, c.y + sobe + 44, { tam: 26, alinhar: 'right', peso: 600, cor: 'rgba(255,255,255,0.8)' });
      texto(ctx, formatarNumero(t.exibido), c.x + c.w / 2, c.y + sobe + (compacto ? 128 : 170), { tam: compacto ? 104 : 150, fonte: FONTE_TITULO, peso: 800 });
      if (!compacto) {
        const top = this.topDoTime(i);
        const fy = c.y + sobe + c.h - 50;
        ctx.fillStyle = escurecer(t.cor, 0.3);
        ctx.fillRect(c.x, fy - 26, c.w, 4);
        if (top) {
          this.m.desenharAvatar(ctx, top.usuario, c.x + 50, fy + 6, 22);
          texto(ctx, `MVP  ${cortarNome(top.usuario.nome, 14)}`, c.x + 84, fy + 7, { tam: 28, alinhar: 'left', peso: 700, maxLarg: c.w - 110 });
        } else {
          texto(ctx, `Comente ${String(t.palavras[0]).toUpperCase()}`, c.x + c.w / 2, fy + 7, { tam: 28, peso: 700, cor: 'rgba(255,255,255,0.85)' });
        }
      }
      if (temLider && i === lider && this.fase === 'jogando') etiqueta(ctx, 'NA FRENTE', c.x + c.w / 2, c.y + sobe, { tam: 26 });
    });

    // barra de disputa
    const ultimo = cards[cards.length - 1];
    const by = ultimo.y + ultimo.h + 48;
    const bx = 48;
    const bw = W - 96;
    const bh = 52;
    ctx.save();
    retArredondado(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = COR.superficie;
    ctx.fill();
    ctx.clip();
    let x = bx;
    this.times.forEach((t) => {
      const frac = total > 0 ? t.exibido / total : 1 / this.times.length;
      const w = bw * frac;
      ctx.fillStyle = t.cor;
      ctx.fillRect(x, by, w + 1, bh);
      if (w > 110) texto(ctx, `${Math.round(frac * 100)}%`, x + w / 2, by + bh / 2 + 1, { tam: 34, fonte: FONTE_TITULO, peso: 800 });
      x += w;
      ctx.fillStyle = '#fff';
      if (x < bx + bw - 2) ctx.fillRect(x - 2, by, 4, bh);
    });
    ctx.restore();

    // placar da noite
    const placar = this.times.map((t, i) => `${t.nome} ${this.vitorias[i]}`).join('  ×  ');
    texto(ctx, `VITÓRIAS DA NOITE   ${placar}`, W / 2, by + bh + 46, { tam: 30, fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1, maxLarg: 1000 });

    if (this.fase === 'fim') this.desenharFim(ctx);
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFim;
    const ent = easeOutBack(limitar(t0 * 3, 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(10, 11, 13, ${0.8 * limitar(t0 * 4, 0, 1)})`;
    ctx.fillRect(0, LAYOUT.jogo - 10, W, 1920);
    ctx.translate(W / 2, 800);
    ctx.scale(ent, ent);
    if (this.vencedor >= 0) {
      const t = this.times[this.vencedor];
      bloco(ctx, -470, -290, 940, 580, { r: 16, cor: t.cor, sombra: 14 });
      etiqueta(ctx, 'VENCEDOR', 0, -290, { tam: 36 });
      texto(ctx, `TIME ${t.nome}`, 0, -190, { tam: 110, fonte: FONTE_TITULO, peso: 800, italico: true, maxLarg: 880 });
      texto(ctx, `${formatarNumero(t.pontos)} pontos`, 0, -100, { tam: 48, peso: 700 });
      const tops = [...this.contrib.values()].filter((c) => c.time === this.vencedor).sort((a, b) => b.valor - a.valor).slice(0, 3);
      if (tops.length) texto(ctx, 'QUEM CARREGOU O TIME', 0, -20, { tam: 30, fonte: FONTE_TITULO, peso: 800, cor: 'rgba(255,255,255,0.85)', espaco: 2 });
      tops.forEach((c, i) => {
        const x = (i - (tops.length - 1) / 2) * 290;
        bloco(ctx, x - 130, 20, 260, 230, { r: 12, cor: escurecer(t.cor, 0.35) });
        this.m.desenharAvatar(ctx, c.usuario, x, 90, 46, i === 0 ? COR.amarelo : null);
        texto(ctx, cortarNome(c.usuario.nome, 12), x, 166, { tam: 30, peso: 700, maxLarg: 240 });
        texto(ctx, `${formatarNumero(c.valor)} pts`, x, 210, { tam: 34, fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo });
      });
    } else {
      bloco(ctx, -420, -150, 840, 300, { r: 16, cor: COR.texto, sombra: 14 });
      texto(ctx, 'EMPATE!', 0, -30, { tam: 140, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.tinta });
      texto(ctx, 'Bora desempatar na próxima', 0, 80, { tam: 42, peso: 700, cor: COR.tinta });
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
