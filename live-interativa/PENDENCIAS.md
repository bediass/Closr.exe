# Pendências e decisões pra amanhã

O que ficou pronto, o que não consegui testar e o que depende de você.

## O que já está pronto e testado

- Servidor + painel + tela do jogo, com os **4 jogos** funcionando e trocando na hora
- **Simulador**: plateia automática (calma / movimentada / caótica) e eventos manuais
- Rodadas **automáticas** em todos os jogos (fim de rodada → placar → recomeça)
- Alertas de presente por tamanho (pequeno / médio / grande / lendário)
- Rodei os 4 jogos num navegador de verdade com a plateia simulada e tirei prints de
  cada fase (jogando, presente, fim de rodada). **Nenhum erro.**
- O painel passou pela revisão de boas práticas de interface (acessibilidade,
  formulários, celular) e funciona no celular sem rolagem lateral

## O que NÃO deu pra testar (precisa de você)

1. **Conexão com uma live de verdade.** Testei só o caminho de erro: com um @ que
   não existe, o painel mostra "Não achei a live de @…". O teste com live real tem
   que ser com você ao vivo.
   - Teste sugerido: abre uma live pelo celular, roda o sistema no PC, conecta com
     seu @ e pede pra um amigo comentar "azul" e mandar uma rosa.
   - Se o nome do presente ou o valor em diamantes vier estranho, me manda o que
     apareceu em "Eventos chegando" que eu ajusto (a biblioteca mudou o formato
     recentemente e eu tratei os dois formatos, mas sem live real não dá pra garantir).

2. **Live pelo PC.** Ainda falta confirmar se sua conta tem acesso
   (LIVE Studio no Windows ou chave de transmissão pro OBS). Sem isso, o jogo não
   chega na transmissão.

3. **Node.js no seu computador.** Precisa instalar uma vez (nodejs.org, versão
   LTS). Depois é dois cliques no `iniciar-windows.bat` ou `iniciar-mac.command`.

4. **Chave do Euler Stream (opcional).** A biblioteca do TikTok usa esse serviço
   externo. Sem chave funciona, mas tem limite. Se a conexão cair muito, crie uma
   conta grátis em eulerstream.com e cole a chave no painel. Não criei porque
   precisa do seu e-mail.

## Decisões suas

- **Visual:** o `identidade/design-guide.md` está vazio, então usei um tema neon
  escuro estilo game (roxo/rosa/ciano, fontes Russo One + Chakra Petch). Se quiser
  a cara da sua marca, me passa as cores/logo.
- **Nome do produto:** chamei de "Live Interativa" por enquanto.
- **Times/países/perguntas:** deixei AZUL x VERMELHO, 6 países (Brasil, Argentina,
  Portugal, México, EUA, Japão) e 55 perguntas de conhecimentos gerais. Se tiver um
  nicho (futebol, novela, anime…), dá pra trocar tudo.
- **Equilíbrio dos jogos:** pontos por presente, duração das rodadas e velocidade
  dos inimigos foram ajustados no simulador. Com plateia real pode precisar de
  ajuste fino, mas tudo muda em "Configurações avançadas", sem mexer em código.

## Regras do TikTok pra ficar de olho

- Live que parece "gravada/repetida" pode ser derrubada. Jogo reagindo à galera
  conta como interação, mas o ideal é você aparecer/falar de vez em quando (dá pra
  usar `?transparente=1` e colocar o jogo por cima da câmera).
- Não prometa prêmio em dinheiro nem "mande presente pra ganhar X". Isso pode
  violar as regras de presentes.

## Ideias pra próxima etapa (quando for vender)

- Rodar a lógica dos jogos no servidor, pra prévia e OBS mostrarem exatamente a
  mesma coisa e o jogo não zerar se a página recarregar. Hoje cada tela roda a sua
  cópia: na Defesa os inimigos podem aparecer em posições diferentes na prévia.
- Voz lendo o nome de quem mandou presente (TTS)
- Sons de verdade (hoje são bipes sintetizados)
- Sistema de licença por cliente, painel com login, várias contas ao mesmo tempo
- Mais jogos (roleta, adivinhe a palavra, pixel art coletivo)
- A biblioteca de conexão é não-oficial. Pra produto vendido, vale avaliar a API
  oficial do TikTok LIVE quando estiver disponível pra você.
