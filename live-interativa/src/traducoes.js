// Nomes de presentes: o TikTok manda em inglês, a tela mostra em português.
// Dá pra completar/ajustar em config.json → presentes.traducoes ({ "Rose": "Rosa", ... }).
// Os "apelidos" da legenda também viram tradução automaticamente.

const PADRAO = {
  'rose': 'Rosa',
  'tiktok': 'TikTok',
  'gg': 'GG',
  'finger heart': 'Coração',
  'heart me': 'Coração pra mim',
  'hand hearts': 'Mãos de coração',
  'love you': 'Te amo',
  'doughnut': 'Rosquinha',
  'donut': 'Rosquinha',
  'confetti': 'Confete',
  'perfume': 'Perfume',
  'ice cream cone': 'Casquinha de sorvete',
  'hat and mustache': 'Chapéu e bigode',
  'sunglasses': 'Óculos escuros',
  'swan': 'Cisne',
  'train': 'Trem',
  'rocket': 'Foguete',
  'sports car': 'Carro esportivo',
  'motorcycle': 'Moto',
  'money gun': 'Arma de dinheiro',
  'galaxy': 'Galáxia',
  'lion': 'Leão',
  'universe': 'Universo',
  'interstellar': 'Interestelar',
  'whale diving': 'Mergulho da baleia',
  'unicorn fantasy': 'Fantasia de unicórnio',
};

export function criarTradutorPresentes(obterConfig) {
  return function traduzir(nome) {
    if (!nome) return nome;
    const chave = String(nome).toLowerCase().trim();
    const cfg = obterConfig()?.presentes || {};
    // 1) traduções do config.json
    for (const [en, pt] of Object.entries(cfg.traducoes || {})) {
      if (en.toLowerCase().trim() === chave) return pt;
    }
    // 2) apelidos da legenda (ex.: "rose" → "Rosa")
    for (const item of cfg.legenda || []) {
      if ((item.apelidos || []).some((a) => String(a).toLowerCase().trim() === chave)) return item.nome;
    }
    // 3) lista padrão
    return PADRAO[chave] || nome;
  };
}
