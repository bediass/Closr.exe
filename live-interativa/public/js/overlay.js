// Tela do jogo (é isso que vai pra live via OBS / TikTok LIVE Studio).
// Parâmetros de URL:
//   ?transparente=1  fundo transparente (pra colocar em cima da câmera)
//   ?som=0           sem som
//   ?guias=1         mostra as áreas que a interface do TikTok cobre
//   ?preview=1       usado pela prévia do painel (sem som, não manda placar)

import { Motor, W, H, COR, ZONA, LAYOUT, FONTE_TITULO, texto, bloco, easeOut, limitar } from './motor.js';
import Batalha from './jogos/batalha.js';
import Corrida from './jogos/corrida.js';
import Quiz from './jogos/quiz.js';
import Defesa from './jogos/defesa.js';

const JOGOS = { batalha: Batalha, corrida: Corrida, quiz: Quiz, defesa: Defesa };

const params = new URLSearchParams(location.search);
const PREVIEW = params.get('preview') === '1';
const GUIAS = params.get('guias') === '1';

const canvas = document.getElementById('tela');
const ctx = canvas.getContext('2d');

let config = null;
let perguntas = [];
let estado = null;
let motor = null;
let jogo = null;
let nomeJogo = null;
let pausado = false;
let conectado = false;
let transicao = 0; // efeito ao trocar de jogo
let imagensIniciais = {};

// ---------- tamanho da tela ----------
function ajustarTamanho() {
  const esc = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${W * esc}px`;
  canvas.style.height = `${H * esc}px`;
}
window.addEventListener('resize', ajustarTamanho);
ajustarTamanho();

function transparente() {
  return params.get('transparente') === '1' || (!params.has('transparente') && config?.visual?.fundoTransparente);
}

function somAtivo() {
  if (PREVIEW || params.get('som') === '0') return false;
  return config?.visual?.som !== false;
}

// ---------- jogos ----------
function criarJogo(nome) {
  const Classe = JOGOS[nome] || Batalha;
  if (!motor) {
    motor = new Motor(ctx, { som: somAtivo(), faixas: config?.presentes?.faixas });
    motor.imagensPresentes = imagensIniciais;
    pedirSomSeNecessario();
  }
  motor.faixas = config?.presentes?.faixas || motor.faixas;
  nomeJogo = nome;
  jogo = new Classe(motor, config?.[nome] || {}, { perguntas });
  transicao = 1;
  pausado = false;
  enviarStatus();
}

// Navegador comum bloqueia som até alguém clicar. No OBS isso não acontece.
function pedirSomSeNecessario() {
  if (!motor.som.ativo) return;
  const ac = motor.som.garantir();
  if (ac && ac.state === 'suspended') {
    const btn = document.getElementById('ativar-som');
    btn.hidden = false;
    btn.onclick = () => {
      ac.resume();
      btn.hidden = true;
    };
  }
}

// ---------- eventos da live ----------
function aoEvento(ev) {
  if (!jogo || pausado) return;
  if (ev.tipo === 'presente') {
    let efeito = '';
    try {
      efeito = jogo.legendaPresente?.(ev.presente.diamantes * ev.presente.quantidade) || '';
    } catch {}
    motor.reagirPresente(ev, efeito);
  } else if (ev.tipo === 'seguir') motor.notificar(`${ev.usuario.nome} seguiu`, { cor: COR.verde, usuario: ev.usuario });
  try {
    jogo.aoEvento(ev);
  } catch (e) {
    console.error('Erro no jogo ao tratar evento', e, ev);
  }
}

function aoAcao(acao, dados) {
  if (acao === 'pausar') pausado = true;
  else if (acao === 'continuar') pausado = false;
  else if (acao === 'recarregar') criarJogo(nomeJogo);
  else jogo?.aoAcao?.(acao, dados);
  enviarStatus();
}

// ---------- WebSocket ----------
let ws = null;
function conectar() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    conectado = true;
    ws.send(JSON.stringify({ t: 'ola', papel: 'overlay', preview: PREVIEW }));
  };
  ws.onclose = () => {
    conectado = false;
    setTimeout(conectar, 1500);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (m) => {
    let msg;
    try {
      msg = JSON.parse(m.data);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'init':
        imagensIniciais = msg.imagensPresentes || {};
        if (motor) motor.imagensPresentes = imagensIniciais;
        config = msg.config;
        perguntas = msg.perguntas || [];
        estado = msg.estado;
        document.documentElement.classList.toggle('transparente', !!transparente());
        document.body.classList.toggle('transparente', !!transparente());
        if (!jogo || nomeJogo !== estado.jogo) criarJogo(estado.jogo);
        break;
      case 'estado':
        estado = msg.estado;
        if (estado.jogo !== nomeJogo) criarJogo(estado.jogo);
        break;
      case 'config':
        config = msg.config;
        perguntas = msg.perguntas || perguntas;
        document.documentElement.classList.toggle('transparente', !!transparente());
        document.body.classList.toggle('transparente', !!transparente());
        if (motor) motor.som.ativo = somAtivo();
        criarJogo(nomeJogo || estado?.jogo || 'batalha');
        break;
      case 'evento':
        aoEvento(msg.evento);
        break;
      case 'imagensPresentes':
        imagensIniciais = msg.imagens || {};
        if (motor) motor.imagensPresentes = imagensIniciais;
        break;
      case 'acao':
        aoAcao(msg.acao, msg.dados);
        break;
    }
  };
}

function enviarStatus() {
  if (!ws || ws.readyState !== 1 || !jogo) return;
  let status = {};
  try {
    status = jogo.status?.() || {};
  } catch (e) {
    console.error(e);
  }
  ws.send(
    JSON.stringify({
      t: 'statusJogo',
      status: {
        jogo: nomeJogo,
        titulo: jogo.titulo,
        palavrasChave: jogo.palavrasChave?.() || [],
        acoes: jogo.acoes?.() || [],
        pausado,
        ...status,
      },
    }),
  );
}
setInterval(enviarStatus, 1000);

// ---------- desenho ----------
function desenharFundo() {
  if (transparente()) {
    ctx.clearRect(0, 0, W, H);
    // placa atrás do cabeçalho pra continuar legível em cima da câmera
    bloco(ctx, 20, ZONA.topo, W - 40, LAYOUT.jogo - ZONA.topo - 12, { r: 14, cor: 'rgba(18, 20, 23, 0.82)' });
    return;
  }
  // degradê preto
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1C1D21');
  g.addColorStop(0.5, '#101114');
  g.addColorStop(1, '#060607');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // grade em perspectiva andando (chão de arena)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 2;
  const horizonte = 1000;
  const desloc = (motor.t * 40) % 80;
  for (let y = horizonte + desloc; y < H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 40, horizonte);
    ctx.lineTo(W / 2 + i * 260, H);
    ctx.stroke();
  }
  // luz suave no topo
  const r = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 720);
  r.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  r.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, 1100);
  ctx.restore();
}

// Itens da legenda de presentes: os presentes configurados + o efeito no jogo atual
function itensLegenda() {
  const lista = config?.presentes?.legenda;
  if (!Array.isArray(lista) || !jogo?.legendaPresente) return [];
  return lista.slice(0, 4).map((p) => ({
    ...p,
    efeito: jogo.legendaPresente(Math.max(1, Number(p.diamantes) || 1)),
  }));
}

function desenharCabecalho() {
  texto(ctx, jogo.titulo, W / 2, LAYOUT.titulo, {
    tam: 84, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.texto, maxLarg: 1000, espaco: 1,
  });
  const linhas = jogo.instrucoes?.() || [];
  const l = linhas[0];
  if (l) {
    const str = typeof l === 'string' ? l : l.texto;
    texto(ctx, str.toUpperCase(), W / 2, LAYOUT.instrucao, { tam: 38, fonte: FONTE_TITULO, peso: 800, cor: COR.amarelo, maxLarg: 1000, espaco: 1 });
  }
  motor.desenharLegenda(ctx, itensLegenda());
}

function desenharGuias() {
  ctx.save();
  ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
  ctx.fillRect(0, 0, W, ZONA.topo);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
  ctx.fillRect(0, ZONA.meio, W, H - ZONA.meio);
  ctx.strokeStyle = COR.destaque;
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  ctx.strokeRect(0, ZONA.topo, W, ZONA.meio - ZONA.topo);
  ctx.restore();
  texto(ctx, 'Topo: nome/espectadores do TikTok', W / 2, ZONA.topo / 2, { tam: 30, cor: COR.destaque });
  texto(ctx, 'Daqui pra baixo: comentários do TikTok', W / 2, ZONA.meio + 30, { tam: 30, cor: COR.ouro });
}

function desenharAvisos() {
  if (!conectado) {
    bloco(ctx, W / 2 - 300, H - 140, 600, 70, { r: 10, cor: COR.vermelho });
    texto(ctx, 'Sem conexão com o servidor…', W / 2, H - 104, { tam: 30 });
  }
  if (pausado) {
    ctx.fillStyle = 'rgba(10, 11, 13, 0.75)';
    ctx.fillRect(0, 0, W, H);
    texto(ctx, 'PAUSADO', W / 2, 760, { tam: 150, fonte: FONTE_TITULO, peso: 800, italico: true, cor: COR.amarelo });
    texto(ctx, 'Já voltamos!', W / 2, 870, { tam: 48 });
  }
  const marca = config?.visual?.marcaDagua;
  if (marca) texto(ctx, marca, W / 2, ZONA.base + 140, { tam: 30, cor: 'rgba(255,255,255,0.6)', contorno: 4 });
}

let ultimo = performance.now();
function quadro(agora) {
  const dt = limitar((agora - ultimo) / 1000, 0, 0.05);
  ultimo = agora;
  if (motor && jogo) {
    motor.atualizar(dt);
    if (!pausado) jogo.atualizar(dt);
    transicao = Math.max(0, transicao - dt * 1.6);

    ctx.save();
    motor.aplicarTremor(ctx);
    desenharFundo();
    jogo.desenhar(ctx);
    desenharCabecalho();
    motor.desenharParticulas(ctx);
    motor.desenharFlutuantes(ctx);
    motor.desenharNotificacoes(ctx, W / 2, jogo.yNotificacoes ?? 1250);
    motor.desenharAlerta(ctx);
    motor.desenharFlash(ctx);
    ctx.restore();

    desenharAvisos();
    if (GUIAS) desenharGuias();
    if (transicao > 0) {
      ctx.fillStyle = `rgba(18, 20, 23, ${easeOut(transicao)})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = COR.fundo;
    ctx.fillRect(0, 0, W, H);
    texto(ctx, 'Conectando ao servidor…', W / 2, H / 2, { tam: 44 });
  }
  requestAnimationFrame(quadro);
}

// Espera as fontes antes de começar (canvas não troca a fonte sozinho depois)
Promise.all([
  document.fonts.load('800 72px "Barlow Condensed"'),
  document.fonts.load('italic 800 72px "Barlow Condensed"'),
  document.fonts.load('700 36px "Barlow"'),
  document.fonts.load('600 36px "Barlow"'),
])
  .catch(() => {})
  .finally(() => {
    conectar();
    requestAnimationFrame(quadro);
  });

// Atalho pra testes no navegador: window.__live.evento({...})
window.__live = {
  evento: (ev) => aoEvento({ simulado: true, ts: Date.now(), ...ev }),
  get jogo() {
    return jogo;
  },
};
