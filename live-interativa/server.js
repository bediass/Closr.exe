// Live Interativa — servidor central
// - Serve o painel (/painel) e a tela do jogo (/overlay)
// - Conecta na live do TikTok (biblioteca não-oficial tiktok-live-connector)
// - Simula eventos (comentários, presentes, curtidas) pra testar sem estar ao vivo
// - Repassa tudo em tempo real via WebSocket

import express from 'express';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import { criarSimulador } from './src/simulador.js';
import { criarConexaoTikTok } from './src/tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config', 'config.json');
const PERGUNTAS_PATH = path.join(__dirname, 'config', 'perguntas.json');

function lerJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Dados da conta do TikTok (seu @ e chave) ficam num arquivo local que NÃO vai pro GitHub
const TIKTOK_LOCAL_PATH = path.join(__dirname, 'config', 'tiktok.local.json');

let config = lerJSON(CONFIG_PATH);
if (existsSync(TIKTOK_LOCAL_PATH)) {
  try {
    config.tiktok = { ...(config.tiktok || {}), ...lerJSON(TIKTOK_LOCAL_PATH) };
  } catch {}
}
let perguntas = existsSync(PERGUNTAS_PATH) ? lerJSON(PERGUNTAS_PATH) : [];

const JOGOS = ['batalha', 'corrida', 'quiz', 'defesa'];

const estado = {
  jogo: JOGOS.includes(config.jogoInicial) ? config.jogoInicial : 'batalha',
  tiktok: { status: 'desconectado', usuario: config.tiktok?.usuario || '', mensagem: '', espectadores: 0 },
  autosim: { ativo: false, intensidade: 'movimentado' },
};

// Imagens dos presentes do TikTok (nome/id -> url). São preenchidas quando o sistema
// conecta numa live de verdade e ficam guardadas no computador pra usar depois, até no simulador.
const IMAGENS_PATH = path.join(__dirname, 'config', 'presentes-imagens.local.json');
let imagensPresentes = {};
if (existsSync(IMAGENS_PATH)) {
  try {
    imagensPresentes = lerJSON(IMAGENS_PATH);
  } catch {}
}
let timerSalvarImagens = null;
function registrarImagensPresentes(lista) {
  let mudou = false;
  for (const g of lista) {
    if (!g?.imagem) continue;
    for (const chave of [g.nome, g.id].filter(Boolean)) {
      const k = String(chave).toLowerCase().trim();
      if (imagensPresentes[k] !== g.imagem) {
        imagensPresentes[k] = g.imagem;
        mudou = true;
      }
    }
  }
  if (!mudou) return;
  broadcast({ t: 'imagensPresentes', imagens: imagensPresentes });
  clearTimeout(timerSalvarImagens);
  timerSalvarImagens = setTimeout(() => {
    try {
      writeFileSync(IMAGENS_PATH, JSON.stringify(imagensPresentes, null, 2));
    } catch {}
  }, 2000);
}

// Último status enviado por cada tela de jogo (pra mostrar placar no painel)
let ultimoStatus = null;
let ultimoStatusPreview = null;

// Endereços deste computador na rede local (pra abrir a tela do jogo no celular, no mesmo Wi-Fi)
function enderecosRede() {
  const lista = [];
  for (const [nome, ifs] of Object.entries(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      if (/^169\.254\./.test(i.address)) continue; // endereço automático sem rede
      if (/vEthernet|VirtualBox|VMware|WSL|docker|Hyper-V/i.test(nome)) continue;
      lista.push(i.address);
    }
  }
  return lista;
}

// ---------- HTTP ----------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (_req, res) => res.redirect('/painel'));
app.get('/api/config', (_req, res) => res.json({ config, perguntas }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function enviar(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg, filtro) {
  const txt = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState !== 1) continue;
    if (filtro && !filtro(ws)) continue;
    ws.send(txt);
  }
}
const paraPaineis = (msg) => broadcast(msg, (ws) => ws.papel === 'painel');
const paraOverlays = (msg) => broadcast(msg, (ws) => ws.papel === 'overlay');

function publicarEstado() {
  broadcast({ t: 'estado', estado });
}

// ---------- Eventos ----------
let contadorEventos = 0;
function emitirEvento(ev) {
  const evento = { id: ++contadorEventos, ts: Date.now(), simulado: false, ...ev };
  broadcast({ t: 'evento', evento });
}

// ---------- Simulador ----------
const simulador = criarSimulador({
  emitir: (ev) => emitirEvento({ ...ev, simulado: true }),
  obterStatusJogo: () => ultimoStatus?.status || ultimoStatusPreview?.status || null,
  obterConfig: () => config,
});

// ---------- TikTok ----------
const tiktok = criarConexaoTikTok({
  emitir: (ev) => {
    if (ev.tipo === 'presente' && ev.presente?.imagem) registrarImagensPresentes([ev.presente]);
    emitirEvento(ev);
  },
  aoReceberPresentes: (lista) => registrarImagensPresentes(lista),
  aoMudarStatus: (s) => {
    Object.assign(estado.tiktok, s);
    publicarEstado();
  },
});

// ---------- WebSocket ----------
wss.on('connection', (ws) => {
  ws.papel = 'desconhecido';

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.t) {
      case 'ola': {
        ws.papel = msg.papel === 'painel' ? 'painel' : 'overlay';
        ws.preview = !!msg.preview;
        enviar(ws, { t: 'init', estado, config, perguntas, jogos: JOGOS, imagensPresentes, enderecos: enderecosRede(), porta: PORTA });
        if (ws.papel === 'painel' && (ultimoStatus || ultimoStatusPreview)) {
          enviar(ws, { t: 'statusJogo', ...(ultimoStatus || ultimoStatusPreview) });
        }
        break;
      }

      // ---- vindo das telas de jogo ----
      case 'statusJogo': {
        const pacote = { status: msg.status, preview: !!ws.preview, ts: Date.now() };
        if (ws.preview) ultimoStatusPreview = pacote;
        else ultimoStatus = pacote;
        // O painel prefere o status da tela "de verdade" (OBS); cai pra prévia se não houver
        const usar = ultimoStatus && Date.now() - ultimoStatus.ts < 5000 ? ultimoStatus : pacote;
        if (usar === pacote) paraPaineis({ t: 'statusJogo', ...pacote });
        break;
      }

      // ---- vindo do painel ----
      case 'setJogo': {
        if (JOGOS.includes(msg.jogo)) {
          estado.jogo = msg.jogo;
          ultimoStatus = null;
          ultimoStatusPreview = null;
          publicarEstado();
        }
        break;
      }
      case 'acaoJogo': {
        paraOverlays({ t: 'acao', acao: msg.acao, dados: msg.dados || null });
        break;
      }
      case 'simular': {
        if (msg.evento && typeof msg.evento === 'object') simulador.manual(msg.evento);
        break;
      }
      case 'autosim': {
        estado.autosim.ativo = !!msg.ativo;
        if (msg.intensidade) estado.autosim.intensidade = msg.intensidade;
        simulador.configurar(estado.autosim);
        publicarEstado();
        break;
      }
      case 'conectar': {
        const usuario = String(msg.usuario || '').trim().replace(/^@/, '');
        const apiKey = String(msg.apiKey ?? config.tiktok?.eulerApiKey ?? '').trim();
        if (!usuario) {
          Object.assign(estado.tiktok, { status: 'erro', mensagem: 'Digite o @ da conta que vai fazer a live.' });
          publicarEstado();
          break;
        }
        config.tiktok = { ...(config.tiktok || {}), usuario, eulerApiKey: apiKey };
        salvarConfig();
        tiktok.conectar(usuario, apiKey);
        break;
      }
      case 'desconectar': {
        tiktok.desconectar();
        break;
      }
      case 'salvarConfig': {
        try {
          const novo = typeof msg.config === 'string' ? JSON.parse(msg.config) : msg.config;
          if (!novo || typeof novo !== 'object') throw new Error('Configuração vazia');
          config = novo;
          if (msg.perguntas !== undefined) {
            const p = typeof msg.perguntas === 'string' ? JSON.parse(msg.perguntas) : msg.perguntas;
            if (!Array.isArray(p)) throw new Error('perguntas.json precisa ser uma lista [ ... ]');
            perguntas = p;
            writeFileSync(PERGUNTAS_PATH, JSON.stringify(perguntas, null, 2));
          }
          salvarConfig();
          broadcast({ t: 'config', config, perguntas });
          enviar(ws, { t: 'aviso', tipo: 'ok', texto: 'Configuração salva. Os jogos foram reiniciados com as novas regras.' });
        } catch (e) {
          enviar(ws, { t: 'aviso', tipo: 'erro', texto: 'Não salvei: ' + e.message });
        }
        break;
      }
    }
  });
});

function salvarConfig() {
  const { tiktok, ...resto } = config;
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...resto, tiktok: { usuario: '', eulerApiKey: '' } }, null, 2));
  writeFileSync(TIKTOK_LOCAL_PATH, JSON.stringify({ usuario: tiktok?.usuario || '', eulerApiKey: tiktok?.eulerApiKey || '' }, null, 2));
}

// Mantém conexões vivas (OBS às vezes derruba sockets ociosos)
setInterval(() => broadcast({ t: 'ping' }), 20000);

const PORTA = Number(process.env.PORT || config.porta || 3000);
server.listen(PORTA, () => {
  const base = `http://localhost:${PORTA}`;
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║          LIVE INTERATIVA — rodando           ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`  Painel de controle:  ${base}/painel`);
  console.log(`  Tela do jogo (OBS):  ${base}/overlay`);
  for (const ip of enderecosRede()) console.log(`  No celular (mesmo Wi-Fi): http://${ip}:${PORTA}/overlay`);
  console.log('  Pra parar: Ctrl + C');
  console.log('');
});
