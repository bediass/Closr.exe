// JOGO 3 — QUIZ AO VIVO
// Aparece uma pergunta com 4 alternativas. A galera comenta A, B, C ou D.
// Acertou = pontos (quanto mais rápido, mais pontos). Ranking na tela.
// Presente médio/grande = DICA (elimina uma alternativa errada) + pontos extras.
// Perguntas ficam em config/perguntas.json.

import {
  W, COR, LAYOUT, FONTE_TITULO, FONTE, texto, bloco, etiqueta, retArredondado, formatarNumero, normalizar,
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
const CORES_ALT = ['#3D7BFF', '#FF4D4D', '#FF8A3D', '#B26BFF'];
const Y0 = LAYOUT.jogo;

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
    this.yNotificacoes = 1678;
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
    if (this.fase === 'fim') return [`Nova rodada em ${Math.ceil(this.tFase)}s`];
    return ['Comente A, B, C ou D · quem responde primeiro ganha mais'];
  }

  legendaPresente(diamantes) {
    const pts = formatarNumero(diamantes * this.cfg.pontosPorDiamante);
    return this.m.faixa(diamantes) === 'pequeno' ? `+${pts} pts` : `Dica +${pts}`;
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
    this.m.flutuar(W / 2, this.yAlternativa(i) + 36, `DICA DE ${cortarNome(usuario.nome, 12).toUpperCase()}: NÃO É A ${LETRAS[i]}`, COR.amarelo, 44, 2);
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
    this.m.explodir(W / 2, y + 36, [COR.verde, '#fff', COR.amarelo], 30, 700);
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
    return Y0 + 330 + i * 88;
  }

  desenhar(ctx) {
    if (this.fase === 'fim') return this.desenharFim(ctx);
    const q = this.atual;
    const ent = easeOut(Math.min(1, this.tEntrada * 3));

    // linha de info + relógio
    texto(ctx, `PERGUNTA ${this.numero}/${this.cfg.perguntasPorRodada}`, 48, Y0 + 40, { tam: 34, alinhar: 'left', fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1 });
    if (q.categoria) texto(ctx, q.categoria.toUpperCase(), W - 48, Y0 + 40, { tam: 34, alinhar: 'right', fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1, maxLarg: 300 });
    if (this.fase === 'pergunta') desenharRelogio(ctx, W / 2, Y0 + 40, 42, this.tFase, this.cfg.tempoPergunta);
    else etiqueta(ctx, 'RESPOSTA', W / 2, Y0 + 40, { tam: 34, cor: COR.verde, corTexto: COR.tinta });

    // pergunta (cartão branco)
    ctx.save();
    ctx.globalAlpha = ent;
    ctx.translate(0, (1 - ent) * 30);
    bloco(ctx, 48, Y0 + 96, W - 96, 210, { r: 14, cor: COR.texto, sombra: 10 });
    let tam = 54;
    let ls = quebrarLinhas(ctx, q.pergunta, W - 180, tam);
    if (ls.length > 3) {
      tam = 42;
      ls = quebrarLinhas(ctx, q.pergunta, W - 180, tam);
    }
    const altura = ls.length * tam * 1.15;
    ls.slice(0, 4).forEach((l, k) => texto(ctx, l, W / 2, Y0 + 201 - altura / 2 + tam * 0.575 + k * tam * 1.15, { tam, peso: 700, cor: COR.tinta }));
    ctx.restore();

    // alternativas
    const total = Math.max(1, this.exibido.reduce((s, v) => s + v, 0));
    q.alternativas.forEach((alt, i) => {
      const y = this.yAlternativa(i);
      const x = 48;
      const w = W - 96;
      const h = 74;
      const e = easeOutBack(limitar(this.tEntrada * 3 - 0.3 - i * 0.12, 0, 1));
      const eliminada = this.eliminadas.has(i);
      const revel = this.fase === 'revelacao';
      const certa = i === q.correta;
      ctx.save();
      ctx.globalAlpha = eliminada ? 0.3 : revel && !certa ? 0.4 : 1;
      ctx.translate((1 - e) * -80, 0);
      bloco(ctx, x, y, w, h, { r: 10, cor: revel && certa ? COR.verde : COR.superficie });
      // barra de votos
      const frac = this.exibido[i] / total;
      if (frac > 0 && !(revel && certa)) {
        ctx.save();
        retArredondado(ctx, x, y, w, h, 10);
        ctx.clip();
        ctx.fillStyle = COR.superficie2;
        ctx.fillRect(x, y, w * frac, h);
        ctx.restore();
      }
      // letra
      ctx.fillStyle = revel && certa ? COR.tinta : CORES_ALT[i];
      retArredondado(ctx, x, y, 74, h, 10);
      ctx.fill();
      texto(ctx, LETRAS[i], x + 37, y + h / 2 + 1, { tam: 48, fonte: FONTE_TITULO, peso: 800, cor: '#fff' });
      texto(ctx, alt, x + 100, y + h / 2 + 1, { tam: 40, alinhar: 'left', peso: 700, cor: revel && certa ? COR.tinta : COR.texto, maxLarg: w - 250 });
      const qtd = Math.round(this.exibido[i]);
      if (qtd > 0 || revel) {
        texto(ctx, revel ? `${Math.round(frac * 100)}%` : String(qtd), x + w - 24, y + h / 2 + 1, {
          tam: 38, alinhar: 'right', fonte: FONTE_TITULO, peso: 800, cor: revel && certa ? COR.tinta : COR.suave,
        });
      }
      if (eliminada) {
        ctx.fillStyle = COR.vermelho;
        ctx.fillRect(x + 90, y + h / 2 - 3, w - 120, 6);
      }
      ctx.restore();
    });

    // rodapé da pergunta
    const yr = this.yAlternativa(q.alternativas.length - 1) + 74 + 38;
    if (this.fase === 'revelacao') {
      if (this.primeiro) {
        const str = `MAIS RÁPIDO: ${cortarNome(this.primeiro.nome, 16).toUpperCase()}  ·  ${this.acertaram.length} ACERTARAM`;
        texto(ctx, str, W / 2, yr, { tam: 34, fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo, espaco: 1, maxLarg: 980 });
      } else {
        texto(ctx, 'NINGUÉM ACERTOU ESSA!', W / 2, yr, { tam: 36, fonte: FONTE_TITULO, peso: 800, cor: COR.vermelho, espaco: 1 });
      }
    } else {
      texto(ctx, `${this.respostas.size} RESPONDERAM`, W / 2, yr, { tam: 32, fonte: FONTE_TITULO, peso: 800, cor: COR.suave, espaco: 1 });
    }

    // ranking compacto
    this.m.desenharRanking(ctx, 48, 1218, W - 96, 'RANKING DA RODADA', this.ranking().map((p) => ({ usuario: p.usuario, valor: p.valor })), { max: 5 });
  }

  desenharFim(ctx) {
    const t0 = this.cfg.intervaloSegundos - this.tFase;
    const ent = easeOutBack(limitar(t0 * 3, 0, 1));
    const top = this.ranking().slice(0, 3);
    ctx.save();
    ctx.translate(W / 2, 820);
    ctx.scale(ent, ent);
    bloco(ctx, -470, -320, 940, 640, { r: 16, cor: COR.texto, sombra: 14 });
    etiqueta(ctx, 'FIM DA RODADA', 0, -320, { tam: 36 });
    if (!top.length) {
      texto(ctx, 'Ninguém pontuou…', 0, -20, { tam: 60, peso: 700, cor: COR.tinta });
      texto(ctx, 'Na próxima é com você!', 0, 60, { tam: 40, peso: 600, cor: '#555' });
    } else {
      // pódio: 2º - 1º - 3º
      const posicoes = [
        { k: 1, x: -290, alt: 150 },
        { k: 0, x: 0, alt: 210 },
        { k: 2, x: 290, alt: 110 },
      ];
      const cores = [COR.amarelo, '#C9CED6', '#E0A060'];
      for (const p of posicoes) {
        const item = top[p.k];
        if (!item) continue;
        const base = 270;
        ctx.fillStyle = cores[p.k];
        ctx.fillRect(p.x - 125, base - p.alt, 250, p.alt);
        texto(ctx, `${p.k + 1}º`, p.x, base - p.alt + 48, { tam: 64, fonte: FONTE_TITULO, peso: 800, cor: COR.tinta });
        texto(ctx, `${formatarNumero(item.valor)} pts`, p.x, base - p.alt + 100, { tam: 32, fonte: FONTE_TITULO, peso: 800, cor: COR.tinta });
        this.m.desenharAvatar(ctx, item.usuario, p.x, base - p.alt - 110, p.k === 0 ? 58 : 48, COR.tinta);
        texto(ctx, cortarNome(item.usuario.nome, 12), p.x, base - p.alt - 30, { tam: 30, peso: 700, cor: COR.tinta, maxLarg: 260 });
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
