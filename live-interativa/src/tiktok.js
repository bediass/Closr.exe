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

export function criarConexaoTikTok({ emitir, aoMudarStatus }) {
  let conexao = null;
  let usuarioAlvo = '';
  let chaveAlvo = '';
  let querConectado = false;
  let tentativas = 0;
  let timerReconexao = null;

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

  function agendarReconexao() {
    if (!querConectado) return;
    tentativas++;
    if (tentativas > 20) {
      status({ status: 'erro', mensagem: 'Desisti de reconectar depois de 20 tentativas. Clique em Conectar de novo.' });
      querConectado = false;
      return;
    }
    const espera = Math.min(30, 5 * tentativas);
    status({ status: 'conectando', mensagem: `Conexão caiu. Tentando de novo em ${espera}s (tentativa ${tentativas})...` });
    timerReconexao = setTimeout(abrir, espera * 1000);
  }

  async function abrir() {
    limpar();
    const ok = await carregarBiblioteca();
    if (!ok) {
      status({ status: 'erro', mensagem: 'Biblioteca do TikTok não instalada. Rode "npm install" na pasta live-interativa.' });
      return;
    }

    status({ status: 'conectando', usuario: usuarioAlvo, mensagem: `Conectando na live de @${usuarioAlvo}...` });

    const opcoes = { enableExtendedGiftInfo: true };
    if (chaveAlvo) opcoes.signApiKey = chaveAlvo;
    conexao = new TikTokLiveConnection(usuarioAlvo, opcoes);
    const c = conexao;

    c.on(WebcastEvent.CHAT, (d) => {
      emitir({ tipo: 'comentario', usuario: normalizarUsuario(d.user), texto: String(d.comment || '') });
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
      emitir({ tipo: 'curtida', usuario: normalizarUsuario(d.user), curtidas: Math.max(1, Number(d.likeCount) || 1) });
    });

    c.on(WebcastEvent.FOLLOW, (d) => emitir({ tipo: 'seguir', usuario: normalizarUsuario(d.user) }));
    c.on(WebcastEvent.SHARE, (d) => emitir({ tipo: 'compartilhar', usuario: normalizarUsuario(d.user) }));
    c.on(WebcastEvent.MEMBER, (d) => emitir({ tipo: 'entrou', usuario: normalizarUsuario(d.user) }));

    c.on(WebcastEvent.ROOM_USER, (d) => {
      aoMudarStatus({ espectadores: Number(d.viewerCount) || 0 });
    });

    c.on(WebcastEvent.STREAM_END, () => {
      querConectado = false;
      status({ status: 'desconectado', mensagem: 'A live terminou.' });
    });

    c.on(ControlEvent.DISCONNECTED, () => {
      if (conexao !== c) return;
      if (querConectado) agendarReconexao();
      else status({ status: 'desconectado', mensagem: 'Desconectado.' });
    });

    c.on(ControlEvent.ERROR, (e) => {
      const info = e?.info || e?.exception?.message || 'erro desconhecido';
      console.error('[tiktok] erro:', info);
    });

    try {
      const st = await c.connect();
      if (conexao !== c) return;
      tentativas = 0;
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
      if (/rate.?limit|429/i.test(msg)) {
        msg = 'Limite do servidor de assinatura (Euler Stream) atingido. Coloque uma chave de API grátis do eulerstream.com no painel.';
      }
      status({ status: 'erro', mensagem: 'Falha ao conectar: ' + msg });
      agendarReconexao();
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
