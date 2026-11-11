// Conexão com a live do TikTok.
// Usa a biblioteca NÃO-OFICIAL tiktok-live-connector. Ela pode parar de funcionar
// quando o TikTok muda algo — por isso tudo aqui é isolado nesse arquivo.
// Todo evento vira o formato padrão do sistema:
//   { tipo: 'comentario'|'presente'|'curtida'|'seguir'|'compartilhar'|'entrou',
//     usuario: { id, nome, avatar }, texto?, presente?: { nome, diamantes, quantidade, imagem }, curtidas? }

let TikTokLiveConnection = null;
let WebcastEvent = null;
let ControlEvent = null;

async function carregarBiblioteca() {
  if (TikTokLiveConnection) return true;
  try {
    const mod = await import('tiktok-live-connector');
    TikTokLiveConnection = mod.TikTokLiveConnection;
    WebcastEvent = mod.WebcastEvent;
    ControlEvent = mod.ControlEvent;
    return true;
  } catch (e) {
    console.error('[tiktok] Não consegui carregar tiktok-live-connector:', e.message);
    return false;
  }
}

function primeiraUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  return img.urlList?.[0] || img.url_list?.[0] || img.url?.[0] || img.urls?.[0] || null;
}

// Acha o texto do comentário em qualquer formato que a biblioteca mandar
let avisouSemTexto = 0;
export function textoDoComentario(d) {
  for (const k of ['comment', 'content', 'text', 'message']) {
    const v = d?.[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (v && typeof v === 'object') {
      const p = v.defaultPattern || v.default_pattern || v.text;
      if (typeof p === 'string' && p.trim()) return p;
    }
  }
  const p = d?.common?.displayText?.defaultPattern;
  if (typeof p === 'string' && p.trim() && !p.includes('{')) return p;
  // Não achou: mostra na janela preta quais campos vieram (só as 3 primeiras vezes)
  if (avisouSemTexto < 3) {
    avisouSemTexto++;
    const resumo = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (k === 'user' || k === 'common') continue;
      resumo[k] = typeof v === 'string' ? v.slice(0, 60) : Array.isArray(v) ? `[lista ${v.length}]` : typeof v;
    }
    console.log('[tiktok] comentário chegou sem texto. Campos recebidos:', JSON.stringify(resumo));
  }
  return '';
}

export function normalizarUsuario(u) {
  if (!u) return { id: 'anonimo', nome: 'anônimo', avatar: null };
  const id = u.uniqueId || u.displayId || u.specialId || u.userId || u.id || 'anonimo';
  const nome = u.nickname || u.uniqueId || u.displayId || String(id);
  const avatar =
    u.profilePictureUrl ||
    primeiraUrl(u.profilePicture) ||
    primeiraUrl(u.avatarThumb) ||
    primeiraUrl(u.avatarMedium) ||
    null;
  return { id: String(id), nome: String(nome).slice(0, 24), avatar };
}

export function criarConexaoTikTok({ emitir, aoMudarStatus, aoReceberPresentes = () => {} }) {
  let conexao = null;
  let usuarioAlvo = '';
  let chaveAlvo = '';
  let querConectado = false;
  let tentativas = 0;
  let timerReconexao = null;
  let ultimoErro = '';

  function status(s) {
    aoMudarStatus(s);
    if (s.mensagem) console.log(`[tiktok] ${s.status}: ${s.mensagem}`);
  }

  function limpar() {
    clearTimeout(timerReconexao);
    if (conexao) {
      try {
        conexao.removeAllListeners?.();
        conexao.disconnect?.();
      } catch {}
    }
    conexao = null;
  }

  function agendarReconexao(motivo) {
    if (!querConectado) return;
    tentativas++;
    const dicaChave = !chaveAlvo && tentativas >= 2
      ? ' DICA: crie uma chave grátis em eulerstream.com e cole no painel, isso costuma resolver.'
      : '';
    if (tentativas > 8) {
      status({ status: 'erro', mensagem: `Desisti depois de 8 tentativas. Último erro: ${motivo}.${dicaChave}` });
      querConectado = false;
      return;
    }
    const espera = Math.min(30, 5 * tentativas);
    status({ status: 'conectando', mensagem: `Não deu certo: ${motivo}. Tentando de novo em ${espera}s (tentativa ${tentativas}).${dicaChave}` });
    timerReconexao = setTimeout(abrir, espera * 1000);
  }

  // Quando falha, testa passo a passo pra dizer ONDE está o problema
  async function diagnosticar(c) {
    const comLimite = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('demorou demais')), 15000))]);
    const partes = [];
    try {
      const aoVivo = await comLimite(c.fetchIsLive());
      partes.push(aoVivo ? 'TikTok confirma que você está ao vivo ✓' : 'TikTok diz que você NÃO está ao vivo ✗');
    } catch (e) {
      partes.push(`não consegui perguntar ao TikTok se você está ao vivo (${e?.message || e})`);
    }
    try {
      const sala = await comLimite(c.fetchRoomId());
      partes.push(sala ? `sala da live encontrada (${sala}) ✓` : 'sala da live não encontrada ✗');
    } catch (e) {
      partes.push(`não achei a sala da live (${e?.message || e})`);
    }
    return partes.join(' · ');
  }

  async function abrir() {
    limpar();
    const ok = await carregarBiblioteca();
    if (!ok) {
      status({ status: 'erro', mensagem: 'Biblioteca do TikTok não instalada. Rode "npm install" na pasta live-interativa.' });
      return;
    }

    status({ status: 'conectando', usuario: usuarioAlvo, mensagem: `Conectando na live de @${usuarioAlvo}...` });

    // enableExtendedGiftInfo fica DESLIGADO: buscar a lista de presentes da sala exige o plano
    // pago (Business) do Euler Stream e derruba a conexão no plano grátis. Nome, valor e imagem
    // de cada presente já vêm no próprio evento de presente.
    const opcoes = { enableExtendedGiftInfo: false };
    if (chaveAlvo) opcoes.signApiKey = chaveAlvo;
    conexao = new TikTokLiveConnection(usuarioAlvo, opcoes);
    const c = conexao;

    c.on(WebcastEvent.CHAT, (d) => {
      // versões novas da biblioteca mandam o texto em 'content'; antigas em 'comment'
      emitir({ tipo: 'comentario', usuario: normalizarUsuario(d.user), texto: textoDoComentario(d) });
    });

    c.on(WebcastEvent.GIFT, (d) => {
      const giftType = d.giftDetails?.giftType ?? d.gift?.type ?? d.extendedGiftInfo?.type;
      // Presentes em sequência (tipo 1) disparam vários eventos; só conta quando a sequência termina
      if (Number(giftType) === 1 && !d.repeatEnd) return;
      const quantidade = Math.max(1, Number(d.repeatCount) || 1);
      const diamantes = Number(
        d.giftDetails?.diamondCount ?? d.gift?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? d.diamondCount ?? 1,
      );
      const nome = d.giftDetails?.giftName || d.gift?.name || d.extendedGiftInfo?.name || d.giftName || 'Presente';
      const imagem =
        d.giftPictureUrl ||
        primeiraUrl(d.giftDetails?.giftImage) ||
        primeiraUrl(d.gift?.image) ||
        primeiraUrl(d.gift?.icon) ||
        primeiraUrl(d.extendedGiftInfo?.image) ||
        null;
      emitir({
        tipo: 'presente',
        usuario: normalizarUsuario(d.user),
        presente: { nome, diamantes: diamantes || 1, quantidade, imagem },
      });
    });

    c.on(WebcastEvent.LIKE, (d) => {
      emitir({ tipo: 'curtida', usuario: normalizarUsuario(d.user), curtidas: Math.max(1, Number(d.likeCount ?? d.count) || 1) });
    });

    c.on(WebcastEvent.FOLLOW, (d) => emitir({ tipo: 'seguir', usuario: normalizarUsuario(d.user) }));
    c.on(WebcastEvent.SHARE, (d) => emitir({ tipo: 'compartilhar', usuario: normalizarUsuario(d.user) }));
    c.on(WebcastEvent.MEMBER, (d) => emitir({ tipo: 'entrou', usuario: normalizarUsuario(d.user) }));

    c.on(WebcastEvent.ROOM_USER, (d) => {
      aoMudarStatus({ espectadores: Number(d.viewerCount ?? d.total) || 0 });
    });

    c.on(WebcastEvent.STREAM_END, () => {
      querConectado = false;
      status({ status: 'desconectado', mensagem: 'A live terminou.' });
    });

    c.on(ControlEvent.DISCONNECTED, (info) => {
      if (conexao !== c) return;
      const cod = info?.code ? ` (código ${info.code}${info.reason ? ': ' + info.reason : ''})` : '';
      if (querConectado) agendarReconexao(`a conexão caiu${cod}${ultimoErro ? ' — ' + ultimoErro : ''}`);
      else status({ status: 'desconectado', mensagem: 'Desconectado.' });
    });

    c.on(ControlEvent.ERROR, (e) => {
      const info = [e?.info, e?.exception?.message].filter(Boolean).join(': ') || 'erro desconhecido';
      ultimoErro = info;
      console.error('[tiktok] erro:', info);
      if (e?.exception?.stack) console.error(e.exception.stack);
    });

    ultimoErro = '';
    try {
      const st = await c.connect();
      if (conexao !== c) return;
      tentativas = 0;
      // Lista de presentes da sala (com imagens) pra mostrar na legenda da tela
      try {
        const lista = c.availableGifts || st?.availableGifts || [];
        aoReceberPresentes(
          (Array.isArray(lista) ? lista : []).map((g) => ({
            id: g.id,
            nome: g.name,
            diamantes: g.diamond_count ?? g.diamondCount,
            imagem: primeiraUrl(g.image) || primeiraUrl(g.icon),
          })),
        );
      } catch {}
      status({
        status: 'conectado',
        mensagem: `Conectado na live de @${usuarioAlvo} (sala ${st?.roomId ?? '?'})`,
      });
    } catch (e) {
      if (conexao !== c) return;
      const nomeErro = e?.constructor?.name || '';
      let msg = e?.message || String(e);
      if (/Offline/i.test(nomeErro) || /offline|not live|isn't online/i.test(msg)) {
        msg = `@${usuarioAlvo} não está ao vivo agora. Abra a live primeiro e depois clique em Conectar.`;
        querConectado = false;
        status({ status: 'erro', mensagem: msg });
        return;
      }
      if (/room ?id/i.test(msg)) {
        // Não achou a sala: @ errado ou a pessoa não está ao vivo. Tentar de novo não adianta.
        querConectado = false;
        status({
          status: 'erro',
          mensagem: `Não achei a live de @${usuarioAlvo}. Confere se o @ está certo e se você já está AO VIVO, depois clique em Conectar de novo.`,
        });
        return;
      }
      console.error('[tiktok] falha ao conectar:', nomeErro, msg);
      if (e?.stack) console.error(e.stack);
      if (/rate.?limit|429/i.test(msg)) {
        msg = 'limite grátis do serviço de assinatura (Euler Stream) estourou — coloque uma chave grátis do eulerstream.com no painel';
      } else if (/business plan|premium/i.test(msg)) {
        msg = `o serviço de assinatura (Euler Stream) pediu plano pago pra uma função extra (${msg}). Me avise, isso dá pra contornar no código`;
      } else if (/sign|euler|401|403|api.?key|unauthori/i.test(msg)) {
        msg = `o serviço de assinatura (Euler Stream) recusou (${msg}) — coloque uma chave grátis do eulerstream.com no painel`;
      }
      // Na primeira falha, roda um diagnóstico pra mostrar onde travou
      if (tentativas === 0) {
        status({ status: 'conectando', mensagem: `Falhou (${msg}). Fazendo um diagnóstico rápido...` });
        const diag = await diagnosticar(c).catch(() => '');
        if (conexao !== c) return;
        if (diag) {
          msg = `${msg}. Diagnóstico: ${diag}`;
          console.log('[tiktok] diagnóstico:', diag);
        }
      }
      agendarReconexao(msg);
    }
  }

  return {
    conectar(usuario, apiKey) {
      usuarioAlvo = usuario;
      chaveAlvo = apiKey || '';
      querConectado = true;
      tentativas = 0;
      abrir();
    },
    desconectar() {
      querConectado = false;
      limpar();
      status({ status: 'desconectado', mensagem: 'Desconectado pelo painel.' });
    },
  };
}
