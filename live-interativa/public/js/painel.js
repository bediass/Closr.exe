// Painel de controle da live interativa

const JOGOS_INFO = {
  batalha: { nome: 'Batalha de Times', desc: 'Comentar o time = ponto. Presente vale muito. Rodadas de 3 min.' },
  corrida: { nome: 'Corrida de Bandeiras', desc: 'Comentar o país empurra. Presente = turbo. Primeiro a chegar vence.' },
  quiz: { nome: 'Quiz ao Vivo', desc: 'Pergunta com A/B/C/D. Mais rápido = mais pontos. Presente = dica.' },
  defesa: { nome: 'Proteja o Núcleo', desc: 'Qualquer comentário atira. Curtida = energia. Presente = poderes.' },
};

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const f of filhos) if (f != null) e.append(f);
  return e;
};

let ws = null;
let estado = null;
let config = null;
let perguntas = [];
let statusJogo = null;

function enviar(msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  else avisar('Sem conexão com o servidor. Ele está rodando?', 'erro');
}

function avisar(texto, tipo = 'info') {
  const a = el('div', { className: 'aviso', dataset: { tipo } }, texto);
  $('#avisos').append(a);
  setTimeout(() => a.remove(), 4500);
}

// ---------- conexão ----------
function conectar() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    pilula('#st-servidor', 'Servidor: ok', 'bom');
    ws.send(JSON.stringify({ t: 'ola', papel: 'painel' }));
  };
  ws.onclose = () => {
    pilula('#st-servidor', 'Servidor: desconectado', 'ruim');
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
        aplicarEstado(msg.estado);
        montarJogos(msg.jogos);
        montarPresentes();
        preencherConfig();
        $('#tk-usuario').value = config.tiktok?.usuario || '';
        if (msg.enderecos?.length) {
          $('#url-celular').value = `http://${msg.enderecos[0]}:${msg.porta || location.port || 3000}/overlay`;
          $('#campo-celular').hidden = false;
        }
        $('#tk-chave').value = config.tiktok?.eulerApiKey || '';
        break;
      case 'estado':
        aplicarEstado(msg.estado);
        break;
      case 'config':
        config = msg.config;
        perguntas = msg.perguntas || perguntas;
        montarPresentes();
        preencherConfig();
        break;
      case 'statusJogo':
        statusJogo = msg.status;
        desenharStatus();
        break;
      case 'evento':
        registrar(msg.evento);
        break;
      case 'aviso':
        avisar(msg.texto, msg.tipo);
        break;
    }
  };
}

function pilula(sel, texto, tom) {
  const p = $(sel);
  p.textContent = texto;
  p.dataset.tom = tom;
}

function aplicarEstado(e) {
  estado = e;
  // jogo selecionado
  const radio = document.querySelector(`input[name="jogo"][value="${e.jogo}"]`);
  if (radio) radio.checked = true;
  // tiktok
  const tk = e.tiktok || {};
  const tons = { conectado: 'bom', conectando: 'alerta', erro: 'ruim', desconectado: 'neutro' };
  const espect = tk.status === 'conectado' && tk.espectadores ? ` • ${tk.espectadores} assistindo` : '';
  pilula('#st-tiktok', `TikTok: ${tk.status || 'desconectado'}${espect}`, tons[tk.status] || 'neutro');
  if (tk.mensagem) $('#tk-mensagem').textContent = tk.mensagem;
  $('#tk-conectar').disabled = tk.status === 'conectando' || tk.status === 'conectado';
  // simulação
  const sim = e.autosim || {};
  $('#auto-sim').checked = !!sim.ativo;
  const r = document.querySelector(`input[name="intensidade"][value="${sim.intensidade}"]`);
  if (r) r.checked = true;
  const nomes = { calmo: 'calma', movimentado: 'movimentada', caotico: 'caótica' };
  pilula('#st-sim', sim.ativo ? `Simulação: ligada (${nomes[sim.intensidade] || sim.intensidade})` : 'Simulação: desligada', sim.ativo ? 'alerta' : 'neutro');
}

// ---------- jogos ----------
function montarJogos(lista) {
  const box = $('#lista-jogos');
  box.innerHTML = '';
  for (const id of lista) {
    const info = JOGOS_INFO[id] || { nome: id, desc: '' };
    const input = el('input', { type: 'radio', name: 'jogo', value: id, checked: estado?.jogo === id });
    input.addEventListener('change', () => {
      if (input.checked) {
        enviar({ t: 'setJogo', jogo: id });
        statusJogo = null;
        desenharStatus();
      }
    });
    box.append(el('label', { className: 'jogo' }, input, el('strong', {}, info.nome), el('span', {}, info.desc)));
  }
}

function desenharStatus() {
  const s = statusJogo;
  $('#placar-vazio').hidden = !!s;
  const info = $('#placar-info');
  const lista = $('#placar-lista');
  const rank = $('#ranking-lista');
  info.innerHTML = '';
  lista.innerHTML = '';
  rank.innerHTML = '';
  const acoes = $('#acoes-jogo');
  if (!s) {
    acoes.innerHTML = '';
    $('#chips-palavras').innerHTML = '';
    return;
  }

  // ações do jogo (só recria se mudou, pra não roubar foco/clique)
  const chaveAcoes = JSON.stringify(s.acoes || []);
  if (acoes.dataset.chave !== chaveAcoes) {
    acoes.dataset.chave = chaveAcoes;
    acoes.innerHTML = '';
    for (const a of s.acoes || []) {
      const b = el('button', { type: 'button', className: 'btn' }, a.rotulo);
      b.addEventListener('click', () => {
        // ações que apagam placar pedem confirmação
        if (/^(zerar|reiniciar)/.test(a.id) && !confirm(`${a.rotulo}? O placar atual será perdido.`)) return;
        enviar({ t: 'acaoJogo', acao: a.id });
      });
      acoes.append(b);
    }
  }
  const bp = $('#btn-pausar');
  bp.textContent = s.pausado ? 'Continuar' : 'Pausar';
  bp.setAttribute('aria-pressed', s.pausado ? 'true' : 'false');

  // chips de comentários rápidos
  const chips = $('#chips-palavras');
  const chaveChips = JSON.stringify(s.palavrasChave || []);
  if (chips.dataset.chave !== chaveChips) {
    chips.dataset.chave = chaveChips;
    chips.innerHTML = '';
    for (const p of s.palavrasChave || []) {
      const c = el('button', { type: 'button', className: 'chip' }, p);
      c.addEventListener('click', () => simular({ tipo: 'comentario', texto: p }));
      chips.append(c);
    }
  }

  const fases = { jogando: 'em andamento', correndo: 'correndo', fim: 'fim de rodada', pergunta: 'pergunta no ar', revelacao: 'mostrando resposta' };
  info.append(el('span', {}, 'Fase: ', el('b', {}, fases[s.fase] || s.fase || '—')));
  if (s.restante != null) info.append(el('span', {}, 'Tempo: ', el('b', {}, `${s.restante}s`)));
  if (s.preview) info.append(el('span', {}, '(dados da prévia)'));
  if (s.pergunta) info.append(el('span', { style: 'width:100%' }, 'Pergunta: ', el('b', {}, s.pergunta)));
  if (s.resposta) info.append(el('span', { className: 'resposta' }, `Resposta certa (só você vê): ${s.resposta}`));

  for (const p of s.placar || []) {
    lista.append(
      el('li', {},
        el('span', { className: 'cor', style: `background:${p.cor || 'transparent'}` }),
        el('span', {}, p.nome, p.vitorias != null ? el('small', {}, `${p.vitorias} vitória(s)`) : null),
        el('span', { className: 'val' }, `${Number(p.pontos).toLocaleString('pt-BR')}${p.sufixo || ''}`),
      ),
    );
  }
  (s.ranking || []).forEach((r, i) => {
    rank.append(
      el('li', {},
        el('span', { className: 'pos' }, String(i + 1)),
        el('span', {}, r.nome, r.extra ? el('small', {}, r.extra) : null),
        el('span', { className: 'val' }, Number(r.valor).toLocaleString('pt-BR')),
      ),
    );
  });
  if (!(s.ranking || []).length) rank.append(el('li', {}, el('span'), el('span', {}, 'Ninguém pontuou ainda'), el('span')));
}

// ---------- simulador ----------
function nomeSim() {
  return $('#sim-nome').value.trim();
}

function simular(evento) {
  enviar({ t: 'simular', evento: { ...evento, nome: nomeSim() } });
}

function montarPresentes() {
  const box = $('#botoes-presentes');
  box.innerHTML = '';
  const lista = config?.simulador?.presentes || [{ nome: 'Rosa', diamantes: 1 }];
  for (const p of lista) {
    const b = el('button', { type: 'button', className: 'btn' }, p.nome, el('small', {}, `${p.diamantes} ${p.diamantes === 1 ? 'diamante' : 'diamantes'}`));
    b.addEventListener('click', () =>
      simular({ tipo: 'presente', presente: { nome: p.nome, diamantes: p.diamantes, quantidade: Number($('#sim-qtd').value) || 1 } }),
    );
    box.append(b);
  }
}

$('#form-comentario').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#sim-texto').value.trim();
  if (!t) {
    $('#sim-texto').focus();
    return;
  }
  simular({ tipo: 'comentario', texto: t });
  $('#sim-texto').select();
});

document.querySelectorAll('[data-sim]').forEach((b) =>
  b.addEventListener('click', () => {
    const tipo = b.dataset.sim;
    simular(tipo === 'curtida' ? { tipo, curtidas: 15 } : { tipo });
  }),
);

$('#auto-sim').addEventListener('change', (e) => {
  const intensidade = document.querySelector('input[name="intensidade"]:checked')?.value || 'movimentado';
  enviar({ t: 'autosim', ativo: e.target.checked, intensidade });
});
document.querySelectorAll('input[name="intensidade"]').forEach((r) =>
  r.addEventListener('change', () => enviar({ t: 'autosim', ativo: $('#auto-sim').checked, intensidade: r.value })),
);

// ---------- comandos gerais ----------
$('#btn-pausar').addEventListener('click', () => enviar({ t: 'acaoJogo', acao: statusJogo?.pausado ? 'continuar' : 'pausar' }));
$('#btn-recarregar').addEventListener('click', () => {
  if (confirm('Reiniciar o jogo do zero? O placar atual (inclusive vitórias da noite) será perdido.')) enviar({ t: 'acaoJogo', acao: 'recarregar' });
});

// ---------- TikTok ----------
$('#form-tiktok').addEventListener('submit', (e) => {
  e.preventDefault();
  const usuario = $('#tk-usuario').value.trim();
  if (!usuario) {
    $('#tk-mensagem').textContent = 'Digite o @ da conta que está ao vivo.';
    $('#tk-usuario').focus();
    return;
  }
  enviar({ t: 'conectar', usuario, apiKey: $('#tk-chave').value.trim() });
});
$('#tk-desconectar').addEventListener('click', () => enviar({ t: 'desconectar' }));
$('#tk-mostrar').addEventListener('click', (e) => {
  const inp = $('#tk-chave');
  const mostrar = inp.type === 'password';
  inp.type = mostrar ? 'text' : 'password';
  e.target.textContent = mostrar ? 'Esconder' : 'Mostrar';
  e.target.setAttribute('aria-pressed', String(mostrar));
});

// ---------- links ----------
const urlOverlay = `${location.origin}/overlay`;
$('#url-overlay').value = urlOverlay;
$('#copiar-url').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(urlOverlay);
    avisar('Link copiado! Cole no OBS como "Navegador" (1080×1920).', 'ok');
  } catch {
    $('#url-overlay').select();
    avisar('Selecionei o link — aperte Ctrl+C pra copiar.');
  }
});

$('#copiar-celular').addEventListener('click', async () => {
  const url = $('#url-celular').value;
  try {
    await navigator.clipboard.writeText(url);
    avisar('Link copiado! Mande pro celular (WhatsApp pra você mesmo) e abra no navegador.', 'ok');
  } catch {
    $('#url-celular').select();
    avisar('Selecionei o link — aperte Ctrl+C pra copiar.');
  }
});

// ---------- configurações ----------
function preencherConfig() {
  // não sobrescreve se a pessoa estiver editando
  if (document.activeElement?.id !== 'cfg-json') $('#cfg-json').value = JSON.stringify(config, null, 2);
  if (document.activeElement?.id !== 'perg-json') $('#perg-json').value = JSON.stringify(perguntas, null, 2);
}
$('#salvar-config').addEventListener('click', () => {
  let cfg;
  let perg;
  try {
    cfg = JSON.parse($('#cfg-json').value);
  } catch (e) {
    avisar('config.json com erro de formatação: ' + e.message, 'erro');
    $('#cfg-json').focus();
    return;
  }
  try {
    perg = JSON.parse($('#perg-json').value);
  } catch (e) {
    avisar('perguntas.json com erro de formatação: ' + e.message, 'erro');
    $('#perg-json').focus();
    return;
  }
  enviar({ t: 'salvarConfig', config: cfg, perguntas: perg });
});

// ---------- log de eventos ----------
const NOMES_TIPO = { comentario: 'Comentou', presente: 'Presente', curtida: 'Curtiu', seguir: 'Seguiu', compartilhar: 'Compartilhou', entrou: 'Entrou' };
function registrar(ev) {
  const log = $('#log');
  let desc = '';
  if (ev.tipo === 'comentario') desc = `“${ev.texto}”`;
  else if (ev.tipo === 'presente') desc = `${ev.presente.nome} x${ev.presente.quantidade} (${ev.presente.diamantes * ev.presente.quantidade} diamantes)`;
  else if (ev.tipo === 'curtida') desc = `${ev.curtidas} curtidas`;
  const li = el('li', { dataset: { tipo: ev.tipo } },
    el('span', { className: 'tipo' }, NOMES_TIPO[ev.tipo] || ev.tipo),
    `${ev.usuario?.nome || '?'} ${desc}`,
    ev.simulado ? el('span', { className: 'sim' }, 'simulado') : null,
  );
  log.querySelector('.vazio')?.remove();
  log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
}

conectar();
