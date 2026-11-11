// JOGO 3 — QUIZ AO VIVO
// Aparece uma pergunta com 4 alternativas. A galera comenta A, B, C ou D.
// Acertou = pontos (quanto mais rápido, mais pontos). Ranking na tela.
// Presente médio/grande = DICA (elimina uma alternativa errada) + pontos extras.
// Perguntas ficam em config/perguntas.json.

import {
  W, COR, FONTE_TITULO, FONTE, texto, painel, retArredondado, formatarNumero, normalizar,
  desenharRelogio, easeOutBack, easeOut, limitar, cortarNome, lerp,
} from '../motor.js';

const PADRAO = {
  tempoPergunta: 20,
  tempoRevelacao: 7,
  pontosAcerto: 100,
  bonusVelocidade: 100,
  pontosPorDiamante: 10,
  pontosPorSeguir: 50,
  perguntasPorRodada: 10,
  intervaloSegundos: 12,
};

const LETRAS = ['A', 'B', 'C', 'D'];
const CORES_ALT = ['#3B82F6', '#F43F5E', '#FBBF24', '#22C55E'];

const RESERVA = [
  { pergunta: 'Qual é a capital do Brasil?', alternativas: ['São Paulo', 'Brasília', 'Rio de Janeiro', 'Salvador'], correta: 1, categoria: 'Geografia' },
  { pergunta: 'Quantos lados tem um hexágono?', alternativas: ['5', '6', '7', '8'], correta: 1, categoria: 'Matemática' },
];

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default class Quiz {
  constructor(motor, cfg, { perguntas } = {}) {
    this.m = motor;
    this.cfg = { ...PADRAO, ...cfg };
    this.banco = (Array.isArray(perguntas) ? perguntas : []).filter(
      (p) => p && p.pergunta && Array.isArray(p.alternativas) && p.alternativas.length >= 2 && p.alternativas.length <= 4 && Number.isInteger(p.correta) && p.correta >= 0 && p.correta < p.alternativas.length,
    );
    if (!this.banco.length) this.banco = RESERVA;
    this.titulo = 'QUIZ AO VIVO';
    this.yNotificacoes = 1570;
    this.baralho = [];
    this.novaRodada();
  }

  novaRodada() {
    this.pontos = new Map(); // usuarioId -> { usuario, valor, acertos }
    this.numero = 0;
    this.proxima();
  }

  sortearPergunta() {
    if (!this.baralho.length) this.baralho = embaralhar(this.banco.map((_, i) => i));
    const p = this.banco[this.baralho.pop()];
    // embaralha as alternativas pra letra certa variar
    const ordem = embaralhar(p.alternativas.map((_, i) => i));
    return {
      pergunta: p.pergunta,
      categoria: p.categoria || '',
      alternativas: ordem.map((i) => p.alternativas[i]),
      correta: ordem.indexOf(p.correta),
    };
  }

  proxima() {
    if (this.numero >= this.cfg.perguntasPorRodada) {
      this.fase = 'fim';
      this.tFase = this.cfg.intervaloSegundos;
      this.m.confete(200);
      this.m.som.tocar('vitoria');
      return;
    }
    this.numero++;
    this.atual = this.sortearPergunta();
    this.fase = 'pergunta';
    this.tFase = this.cfg.tempoPergunta;
    this.respostas = new Map(); // usuarioId -> índice
    this.contagem = this.atual.alternativas.map(() => 0);
    this.exibido = this.atual.alternativas.map(() => 0);
    this.eliminadas = new Set();
    this.primeiro = null;
    this.acertaram = [];
    this.tEntrada = 0;
  }

  palavrasChave() {
    return this.atual ? LETRAS.slice(0, this.atual.alternativas.length).filter((_, i) => !this.eliminadas.has(i)) : LETRAS;
  }

  instrucoes() {
    if (this.fase === 'fim') return [{ texto: `Nova rodada em ${Math.ceil(this.tFase)}s`, cor: COR.ciano }];
    return [
      { texto: 'Comente A, B, C ou D', cor: COR.ouro },
      { texto: 'Mais rápido = mais pontos  •  Presente = DICA', cor: COR.suave },
    ];
  }

  acoes() {
    return [
      { id: 'pular', rotulo: 'Pular pergunta' },
      { id: 'revelar', rotulo: 'Revelar resposta agora' },
      { id: 'reiniciar', rotulo: 'Nova rodada (zera pontos)' },
    ];
  }

  aoAcao(acao) {
    if (acao === 'reiniciar') this.novaRodada();
    else if (acao === 'pular' && this.fase !== 'fim') {
      this.numero--;
      this.proxima();
    } else if (acao === 'revelar' && this.fase === 'pergunta') this.revelar();
  }

  lerResposta(txt) {
    const n = normalizar(txt).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const max = this.atual.alternativas.length;
    let m = n.match(/^(?:letra |alternativa |opcao |e |eh |resposta )?([a-d])$/);
    if (m) {
      const i = m[1].charCodeAt(0) - 97;
      return i < max ? i : -1;
    }
    // escreveu a resposta por extenso
    return this.atual.alternativas.findIndex((a) => normalizar(a).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() === n);
  }

  somar(usuario, pts, acerto = false) {
    const p = this.pontos.get(usuario.id) || { usuario, valor: 0, acertos: 0 };
    p.valor += pts;
    p.usuario = usuario;
    if (acerto) p.acertos++;
    this.pontos.set(usuario.id, p);
  }

  aoEvento(ev) {
    if (this.fase === 'fim') return;
    const u = ev.usuario;
    switch (ev.tipo) {
      case 'comentario': {
        if (this.fase !== 'pergunta' || this.respostas.has(u.id)) return;
        const i = this.lerResposta(ev.texto);
        if (i < 0 || this.eliminadas.has(i)) return;
        this.respostas.set(u.id, { i, restante: this.tFase, usuario: u });
        this.contagem[i]++;
        this.m.som.tocar('ponto');
        break;
      }
      case 'presente': {
        const total = ev.presente.diamantes * ev.presente.quantidade;
        const pts = total * this.cfg.pontosPorDiamante;
        this.somar(u, pts);
        const fx = this.m.faixa(total);
        if (fx === 'pequeno') this.m.notificar(`${cortarNome(u.nome, 14)} ganhou +${formatarNumero(pts)} pts`, { cor: COR.destaque, usuario: u });
        if (fx !== 'pequeno' && this.fase === 'pergunta') this.dica(u);
        break;
      }
      case 'seguir':
        this.somar(u, this.cfg.pontosPorSeguir);
        break;
    }
  }

  // Elimina uma alternativa errada (deixa pelo menos 2 na tela)
  dica(usuario) {
    const restantes = this.atual.alternativas.map((_, i) => i).filter((i) => i !== this.atual.correta && !this.eliminadas.has(i));
    if (this.atual.alternativas.length - this.eliminadas.size <= 2 || !restantes.length) return;
    const i = restantes[Math.floor(Math.random() * restantes.length)];
    this.eliminadas.add(i);
    // quem tinha respondido a eliminada pode responder de novo
    for (const [id, r] of this.respostas) if (r.i === i) { this.respostas.delete(id); this.contagem[i]--; }
    this.m.flutuar(W / 2, 900, `DICA de ${cortarNome(usuario.nome, 12)}: não é a ${LETRAS[i]}!`, COR.ouro, 44, 2);
    this.m.som.tocar('erro');
  }

  revelar() {
    this.fase = 'revelacao';
    this.tFase = this.cfg.tempoRevelacao;
    const certos = [...this.respostas.values()].filter((r) => r.i === this.atual.correta).sort((a, b) => b.restante - a.restante);
    certos.forEach((r) => {
      const pts = Math.round(this.cfg.pontosAcerto + this.cfg.bonusVelocidade * limitar(r.restante / this.cfg.tempoPergunta, 0, 1));
      this.somar(r.usuario, pts, true);
    });
    this.acertaram = certos;
    this.primeiro = certos[0]?.usuario || null;
    this.m.som.tocar(certos.length ? 'certo' : 'erro');
    const y = this.yAlternativa(this.atual.correta);
    this.m.explodir(W / 2, y + 37, [COR.verde, '#fff', COR.ouro], 40, 800);
  }

  atualizar(dt) {
    this.tEntrada += dt;
    if (this.atual) this.exibido = this.exibido.map((v, i) => lerp(v, this.contagem[i] || 0, Math.min(1, dt * 6)));
    const antes = Math.ceil(this.tFase);
    this.tFase -= dt;
    if (this.fase === 'pergunta') {
      if (this.tFase <= 5 && Math.ceil(this.tFase) !== antes) this.m.som.tocar('tick');
      if (this.tFase <= 0) this.revelar();
    } else if (this.fase === 'revelacao') {
      if (this.tFase <= 0) this.proxima();
    } else if (this.fase === 'fim') {
      if (this.tFase <= 0) this.novaRodada();
    }
  }

  ranking() {
    return [...this.pontos.values()].sort((a, b) => b.valor - a.valor);
  }

  yAlternativa(i) {
    return 840 + i * 84;
  }

  desenhar(ctx) {
    if (this.fase === 'fim') return this.desenharFim(ctx);
    const q = this.atual;
    const ent = easeOut(Math.min(1, this.tEntrada * 3));

    // linha de info + relógio
    texto(ctx, `PERGUNTA ${this.numero}/${this.cfg.perguntasPorRodada}`, 60, 498, { tam: 32, alinhar: 'left', cor: COR.suave, fonte: FONTE_TITULO, peso: 400, contorno: 0 });
    if (q.categoria) texto(ctx, q.categoria.toUpperCase(), W - 60, 498, { tam: 30, alinhar: 'right', cor: COR.ciano, contorno: 0, maxLarg: 320 });
    if (this.fase === 'pergunta') desenharRelogio(ctx, W / 2, 500, 54, this.tFase, this.cfg.tempoPergunta);
    else texto(ctx, 'RESPOSTA', W / 2, 500, { tam: 40, fonte: FONTE_TITULO, peso: 400, cor: COR.verde, brilho: COR.verde });

    // pergunta
    ctx.save();
    ctx.globalAlpha = ent;
    ctx.translate(0, (1 - ent) * 40);
    painel(ctx, 40, 576, W - 80, 236, { r: 32, fundo: 'rgba(20, 14, 52, 0.92)', borda: COR.secundaria, brilho: COR.primaria });
    const linhas = quebrarLinhas(ctx, q.pergunta, W - 160, 52);
    const tam = linhas.length > 3 ? 42 : 52;
    const ls = linhas.length > 3 ? quebrarLinhas(ctx, q.pergunta, W - 160, 42) : linhas;
    const altura = ls.length * tam * 1.18;
    ls.slice(0, 4).forEach((l, k) => texto(ctx, l, W / 2, 694 - altura / 2 + tam * 0.59 + k * tam * 1.18, { tam, contorno: 0 }));
    ctx.restore();

    // alternativas
    const total = Math.max(1, this.exibido.reduce((s, v) => s + v, 0));
    q.alternativas.forEach((alt, i) => {
      const y = this.yAlternativa(i);
      const x = 40;
      const w = W - 80;
      const h = 72;
      const e = easeOutBack(limitar(this.tEntrada * 3 - 0.3 - i * 0.12, 0, 1));
      const eliminada = this.eliminadas.has(i);
      const revel = this.fase === 'revelacao';
      const certa = i === q.correta;
      ctx.save();
      ctx.globalAlpha = eliminada ? 0.25 : revel && !certa ? 0.45 : 1;
      ctx.translate(W / 2, y + h / 2);
      ctx.scale(e, e);
      ctx.translate(-W / 2, -(y + h / 2));
      const corBorda = revel && certa ? COR.verde : CORES_ALT[i];
      painel(ctx, x, y, w, h, { r: 22, fundo: 'rgba(12, 8, 32, 0.9)', borda: corBorda, brilho: revel && certa ? COR.verde : null });
      // barra de votos
      const frac = this.exibido[i] / total;
      if (frac > 0) {
        ctx.save();
        retArredondado(ctx, x, y, w, h, 22);
        ctx.clip();
        ctx.fillStyle = revel && certa ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y, w * frac, h);
        ctx.restore();
      }
      // letra
      retArredondado(ctx, x + 10, y + 10, 52, 52, 14);
      ctx.fillStyle = CORES_ALT[i];
      ctx.fill();
      texto(ctx, LETRAS[i], x + 36, y + 38, { tam: 36, fonte: FONTE_TITULO, peso: 400, cor: '#0B0820', contorno: 0 });
      texto(ctx, alt, x + 84, y + 38, { tam: 38, alinhar: 'left', contorno: 0, maxLarg: w - 230, fonte: FONTE, peso: 600 });
      const qtd = Math.round(this.exibido[i]);
      if (qtd > 0 || revel) texto(ctx, revel ? `${Math.round(frac * 100)}%` : String(qtd), x + w - 24, y + 38, { tam: 32, alinhar: 'right', cor: COR.suave, contorno: 0 });
      if (eliminada) {
        ctx.strokeStyle = COR.destaque;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + h / 2);
        ctx.lineTo(x + w - 20, y + h / 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // rodapé da pergunta
    const yr = this.yAlternativa(q.alternativas.length - 1) + 110;
    if (this.fase === 'revelacao') {
      if (this.primeiro) {
        this.m.desenharAvatar(ctx, this.primeiro, W / 2 - 300, yr, 30, COR.ouro);
        texto(ctx, `Mais rápido: ${cortarNome(this.primeiro.nome, 16)}  (${this.acertaram.length} acertaram)`, W / 2 - 256, yr + 2, { tam: 34, alinhar: 'left', cor: COR.ouro, maxLarg: 760 });
      } else {
        texto(ctx, 'Ninguém acertou essa!', W / 2, yr, { tam: 36, cor: COR.destaque });
      }
    } else {
      texto(ctx, `${this.respostas.size} responderam`, W / 2, yr, { tam: 32, cor: COR.suave, contorno: 0 });
    }

    // ranking (top 3, abaixo da área principal)
    this.m.desenharRanking(ctx, 140, 1240, W - 280, 'RANKING DA RODADA', this.ranking().map((p) => ({ usuario: p.usuario, valor: p.valor })), { max: 3 });
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFase;
    const ent = easeOutBack(limitar(t0 * 2.5, 0, 1));
    const top = this.ranking().slice(0, 3);
    ctx.save();
    ctx.translate(W / 2, 800);
    ctx.scale(ent, ent);
    painel(ctx, -480, -310, 960, 640, { r: 44, fundo: 'rgba(12, 8, 32, 0.95)', borda: COR.ouro, brilho: COR.ouro });
    texto(ctx, 'FIM DA RODADA', 0, -250, { tam: 48, fonte: FONTE_TITULO, peso: 400, cor: COR.ouro });
    if (!top.length) {
      texto(ctx, 'Ninguém pontuou…', 0, 0, { tam: 56 });
      texto(ctx, 'Na próxima é com você!', 0, 80, { tam: 40, cor: COR.suave });
    } else {
      // pódio: 2º - 1º - 3º
      const posicoes = [
        { k: 1, x: -290, alt: 140 },
        { k: 0, x: 0, alt: 200 },
        { k: 2, x: 290, alt: 100 },
      ];
      const cores = [COR.ouro, '#E2E8F0', '#F59E0B'];
      for (const p of posicoes) {
        const item = top[p.k];
        if (!item) continue;
        const base = 260;
        retArredondado(ctx, p.x - 120, base - p.alt, 240, p.alt, 16);
        ctx.fillStyle = 'rgba(124, 58, 237, 0.45)';
        ctx.fill();
        texto(ctx, `${p.k + 1}º`, p.x, base - p.alt + 40, { tam: 56, fonte: FONTE_TITULO, peso: 400, cor: cores[p.k] });
        this.m.desenharAvatar(ctx, item.usuario, p.x, base - p.alt - 120, p.k === 0 ? 70 : 56, cores[p.k]);
        texto(ctx, cortarNome(item.usuario.nome, 12), p.x, base - p.alt - 30, { tam: 32, maxLarg: 270 });
        texto(ctx, `${formatarNumero(item.valor)} pts`, p.x, base - p.alt + 88, { tam: 26, cor: COR.ouro, contorno: 0 });
      }
    }
    ctx.restore();
  }

  status() {
    return {
      fase: this.fase,
      restante: Math.max(0, Math.round(this.tFase)),
      pergunta: this.atual ? `${this.numero}/${this.cfg.perguntasPorRodada} — ${this.atual.pergunta}` : '',
      resposta: this.atual ? `${LETRAS[this.atual.correta]}) ${this.atual.alternativas[this.atual.correta]}` : '',
      simDica: this.fase === 'pergunta' && this.atual ? LETRAS[this.atual.correta].toLowerCase() : null,
      ranking: this.ranking().slice(0, 5).map((p) => ({ nome: p.usuario.nome, valor: p.valor, extra: `${p.acertos} acertos` })),
    };
  }
}

function quebrarLinhas(ctx, str, maxW, tam) {
  ctx.save();
  ctx.font = `700 ${tam}px ${FONTE}`;
  const palavras = String(str).split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (ctx.measureText(teste).width > maxW && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  ctx.restore();
  return linhas;
}
