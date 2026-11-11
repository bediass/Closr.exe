// Tela do jogo (é isso que vai pra live via OBS / TikTok LIVE Studio).
// Parâmetros de URL:
//   ?transparente=1  fundo transparente (pra colocar em cima da câmera)
//   ?som=0           sem som
//   ?guias=1         mostra as áreas que a interface do TikTok cobre
//   ?preview=1       usado pela prévia do painel (sem som, não manda placar)

import { Motor, W, H, COR, ZONA, FONTE_TITULO, texto, painel, easeOut, limitar } from './motor.js';
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
  if (ev.tipo === 'presente') motor.reagirPresente(ev);
  else if (ev.tipo === 'seguir') motor.notificar(`${ev.usuario.nome} começou a seguir!`, { cor: COR.verde, usuario: ev.usuario });
  else if (ev.tipo === 'compartilhar') motor.notificar(`${ev.usuario.nome} compartilhou a live!`, { cor: COR.ciano, usuario: ev.usuario });
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
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120B2E');
  g.addColorStop(0.5, COR.fundo);
  g.addColorStop(1, '#07060F');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // grade em perspectiva (estética retrô-futurista)
  ctx.save();
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.16)';
  ctx.lineWidth = 2;
  const desloc = (motor.t * 40) % 80;
  for (let y = 1000 + desloc; y < H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 40, 1000);
    ctx.lineTo(W / 2 + i * 260, H);
    ctx.stroke();
  }
  // brilho suave no topo
  const r = ctx.createRadialGradient(W / 2, 300, 50, W / 2, 300, 700);
  r.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
  r.addColorStop(1, 'rgba(124, 58, 237, 0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, 1100);
  ctx.restore();
}

function desenharCabecalho() {
  const y = ZONA.topo + 10;
  texto(ctx, jogo.titulo, W / 2, y + 42, {
    tam: 72, fonte: FONTE_TITULO, peso: 400, cor: COR.texto, brilho: COR.primaria, contorno: 10, maxLarg: 980,
  });
  const linhas = jogo.instrucoes?.() || [];
  let yy = y + 112;
  for (const l of linhas.slice(0, 2)) {
    const str = typeof l === 'string' ? l : l.texto;
    const cor = typeof l === 'string' ? COR.ouro : l.cor || COR.ouro;
    ctx.font = `700 36px "Chakra Petch"`;
    const larg = Math.min(1000, ctx.measureText(str).width + 60);
    painel(ctx, W / 2 - larg / 2, yy - 30, larg, 60, { r: 30, fundo: 'rgba(12, 8, 32, 0.85)', borda: cor });
    texto(ctx, str, W / 2, yy + 1, { tam: 36, cor, contorno: 0, maxLarg: 960 });
    yy += 72;
  }
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
    painel(ctx, W / 2 - 300, H - 140, 600, 70, { r: 35, fundo: 'rgba(244, 63, 94, 0.9)', borda: null });
    texto(ctx, 'Sem conexão com o servidor…', W / 2, H - 104, { tam: 30, contorno: 0 });
  }
  if (pausado) {
    ctx.fillStyle = 'rgba(8, 6, 24, 0.6)';
    ctx.fillRect(0, 0, W, H);
    texto(ctx, 'PAUSADO', W / 2, 760, { tam: 120, fonte: FONTE_TITULO, peso: 400, cor: COR.ouro, brilho: COR.ouro });
    texto(ctx, 'Já voltamos!', W / 2, 870, { tam: 48 });
  }
  const marca = config?.visual?.marcaDagua;
  if (marca) texto(ctx, marca, W / 2, ZONA.base + 140, { tam: 30, cor: 'rgba(248,250,252,0.6)', contorno: 4 });
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
    motor.desenharNotificacoes(ctx, W / 2, jogo.yNotificacoes ?? 1240);
    motor.desenharAlerta(ctx);
    motor.desenharFlash(ctx);
    ctx.restore();

    desenharAvisos();
    if (GUIAS) desenharGuias();
    if (transicao > 0) {
      ctx.fillStyle = `rgba(15, 15, 35, ${easeOut(transicao)})`;
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
  document.fonts.load('400 72px "Russo One"'),
  document.fonts.load('700 36px "Chakra Petch"'),
  document.fonts.load('600 36px "Chakra Petch"'),
  document.fonts.load('400 36px "Chakra Petch"'),
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
