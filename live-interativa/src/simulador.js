// Simulador de live: gera comentários, presentes, curtidas e seguidores falsos
// pra testar os jogos sem precisar estar ao vivo.

const NOMES = [
  'ana.souza', 'joaozinho_10', 'mari_lima', 'pedro.games', 'bia_santos', 'lucas_fut', 'carol.ofc',
  'rafa_br', 'gabi.mendes', 'thiago_xp', 'ju_oliveira', 'davi.zika', 'leticia_m', 'gui_play',
  'fernandinha', 'matheus.rj', 'lari_costa', 'vini_sp', 'duda.ramos', 'caio_mito', 'isa_bela',
  'felipe.pro', 'nanda_r', 'brunao_77', 'sofia.art', 'enzo_gamer', 'manu_rocha', 'diego.bh',
  'clara_vibes', 'henrique_x', 'yasmin.lo', 'arthur_mvp', 'lorena_s', 'kaua_top', 'helena.f',
  'samuel_go', 'alice.mel', 'murilo_br', 'livia_star', 'heitor_ace',
];

const CONVERSA = [
  'kkkkk', 'boa noite!', 'vamoooo', 'primeira vez aqui', 'que live top', 'bora bora',
  'manda salve', 'quem ta ganhando?', 'aaaa', 'eita', 'lindooo', 'de onde vc é?', 'salve salve',
  '🔥🔥🔥', 'top demais', 'to chegando agora', 'vai que dá',
];

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function sortearPeso(lista) {
  const total = lista.reduce((s, i) => s + (i.peso ?? 1), 0);
  let r = Math.random() * total;
  for (const item of lista) {
    r -= item.peso ?? 1;
    if (r <= 0) return item;
  }
  return lista[lista.length - 1];
}

function usuarioFalso(nome) {
  const n = nome || aleatorio(NOMES);
  return { id: 'sim_' + n, nome: n, avatar: null };
}

const INTERVALOS = {
  calmo: [700, 1800],
  movimentado: [150, 550],
  caotico: [30, 140],
};

export function criarSimulador({ emitir, obterStatusJogo, obterConfig }) {
  let timer = null;
  let cfg = { ativo: false, intensidade: 'movimentado' };
  // Cada usuário falso "torce" por uma opção fixa, pra simular comportamento real
  const preferencia = new Map();

  function presentesSimulador() {
    return (
      obterConfig().simulador?.presentes || [
        { nome: 'Rosa', diamantes: 1, peso: 60 },
        { nome: 'Coração', diamantes: 5, peso: 20 },
        { nome: 'Rosquinha', diamantes: 30, peso: 12 },
        { nome: 'Confete', diamantes: 100, peso: 6 },
        { nome: 'Leão', diamantes: 29999, peso: 0.4 },
      ]
    );
  }

  function comentarioDoJogo(usuario) {
    const status = obterStatusJogo();
    const palavras = status?.palavrasChave || [];
    if (!palavras.length || Math.random() < 0.15) return aleatorio(CONVERSA);

    // Quiz: parte da galera acerta, parte chuta
    if (status.jogo === 'quiz' && status.simDica) {
      return Math.random() < 0.45 ? status.simDica : aleatorio(palavras);
    }
    // Defesa: qualquer comentário atira, então manda conversa normal também
    if (status.jogo === 'defesa') return Math.random() < 0.5 ? aleatorio(CONVERSA) : aleatorio(palavras);

    let pref = preferencia.get(usuario.id);
    if (!pref || !palavras.includes(pref) || Math.random() < 0.03) {
      pref = aleatorio(palavras);
      preferencia.set(usuario.id, pref);
    }
    return pref;
  }

  function gerarEvento() {
    const usuario = usuarioFalso();
    const r = Math.random();
    if (r < 0.72) return { tipo: 'comentario', usuario, texto: comentarioDoJogo(usuario) };
    if (r < 0.87) return { tipo: 'curtida', usuario, curtidas: 1 + Math.floor(Math.random() * 25) };
    if (r < 0.955) {
      const p = sortearPeso(presentesSimulador());
      const quantidade = p.diamantes <= 5 && Math.random() < 0.4 ? 1 + Math.floor(Math.random() * 9) : 1;
      return { tipo: 'presente', usuario, presente: { nome: p.nome, diamantes: p.diamantes, quantidade, imagem: null } };
    }
    if (r < 0.985) return { tipo: 'seguir', usuario };
    return { tipo: 'compartilhar', usuario };
  }

  function loop() {
    if (!cfg.ativo) return;
    emitir(gerarEvento());
    const [min, max] = INTERVALOS[cfg.intensidade] || INTERVALOS.movimentado;
    timer = setTimeout(loop, min + Math.random() * (max - min));
  }

  return {
    configurar(novo) {
      cfg = { ...cfg, ...novo };
      clearTimeout(timer);
      if (cfg.ativo) loop();
    },
    // Evento disparado à mão pelo painel (botões do simulador)
    manual(ev) {
      const usuario = usuarioFalso(String(ev.usuario?.nome || ev.nome || '').trim().slice(0, 24) || undefined);
      switch (ev.tipo) {
        case 'comentario':
          emitir({ tipo: 'comentario', usuario, texto: String(ev.texto || '').slice(0, 150) });
          break;
        case 'presente': {
          const p = ev.presente || {};
          emitir({
            tipo: 'presente',
            usuario,
            presente: {
              nome: String(p.nome || 'Rosa'),
              diamantes: Math.max(1, Number(p.diamantes) || 1),
              quantidade: Math.max(1, Math.min(999, Number(p.quantidade) || 1)),
              imagem: null,
            },
          });
          break;
        }
        case 'curtida':
          emitir({ tipo: 'curtida', usuario, curtidas: Math.max(1, Math.min(500, Number(ev.curtidas) || 15)) });
          break;
        case 'seguir':
        case 'compartilhar':
        case 'entrou':
          emitir({ tipo: ev.tipo, usuario });
          break;
        case 'rajada': {
          // 20 eventos aleatórios de uma vez — pra ver a tela "lotada"
          for (let i = 0; i < 20; i++) setTimeout(() => emitir(gerarEvento()), i * 60);
          break;
        }
      }
    },
  };
}
