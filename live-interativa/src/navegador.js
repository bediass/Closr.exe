// Abre a tela do jogo num navegador separado (Edge no Windows), pronta pra captura:
// sem barra de endereço, sem abas, com som liberado.
//
// Formato: a live é em pé (9:16). Então:
//  - se existir um monitor em pé (retrato), abre em TELA CHEIA nele → formato e qualidade perfeitos;
//  - se não existir, abre numa JANELA em pé (9:16) da altura da tela → o LIVE Studio não corta nada.
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function candidatos(preferirChrome = false) {
  const env = process.env;
  if (process.platform === 'win32') {
    // Edge primeiro: o LIVE Studio lista UMA janela por programa. Se o painel estiver
    // aberto no Chrome e a tela do jogo também, a tela do jogo some da lista.
    const edge = [
      path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];
    const chrome = [
      path.join(env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    return preferirChrome ? [...chrome, ...edge] : [...edge, ...chrome];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

// Lista os monitores do Windows: [{ x, y, largura, altura, principal, util: {x,y,largura,altura} }]
function listarMonitores() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const script =
    'Add-Type -AssemblyName System.Windows.Forms; ' +
    '[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { ' +
    '[pscustomobject]@{ x=$_.Bounds.X; y=$_.Bounds.Y; largura=$_.Bounds.Width; altura=$_.Bounds.Height; principal=$_.Primary; ' +
    'ux=$_.WorkingArea.X; uy=$_.WorkingArea.Y; ul=$_.WorkingArea.Width; ua=$_.WorkingArea.Height } } | ConvertTo-Json -Compress';
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        let dados = JSON.parse(String(stdout).trim());
        if (!Array.isArray(dados)) dados = [dados];
        resolve(
          dados.map((m) => ({
            x: m.x, y: m.y, largura: m.largura, altura: m.altura, principal: !!m.principal,
            util: { x: m.ux, y: m.uy, largura: m.ul, altura: m.ua },
          })),
        );
      } catch {
        resolve([]);
      }
    });
  });
}

export async function abrirTelaDeCaptura(url, { preferirChrome = false, deitada = false } = {}) {
  const exe = candidatos(preferirChrome).find((p) => p && existsSync(p));
  if (!exe) return { ok: false, erro: 'Não achei o Microsoft Edge nem o Google Chrome instalados neste computador.' };

  const monitores = await listarMonitores();
  const emPe = monitores.find((m) => m.altura > m.largura);
  const principal = monitores.find((m) => m.principal) || monitores[0];

  const args = [`--app=${url}`];
  let modo;
  if (deitada) {
    // Jogo girado em tela cheia no monitor principal (deitado). Gira 90° no LIVE Studio.
    if (principal) args.push(`--window-position=${principal.x},${principal.y}`, `--window-size=${principal.largura},${principal.altura}`);
    args.push('--start-fullscreen');
    modo = 'tela-cheia-deitada';
  } else if (emPe) {
    // Tela cheia no monitor em pé
    args.push(`--window-position=${emPe.x},${emPe.y}`, `--window-size=${emPe.largura},${emPe.altura}`, '--start-fullscreen');
    modo = 'tela-cheia-monitor-em-pe';
  } else if (principal) {
    // Janela em pé 9:16, da altura útil da tela, encostada na direita
    const alt = principal.util.altura;
    const larg = Math.round(((alt - 32) * 9) / 16); // ~32px da barra de título
    const x = principal.util.x + principal.util.largura - larg;
    args.push(`--window-position=${x},${principal.util.y}`, `--window-size=${larg},${alt}`);
    modo = 'janela-em-pe';
  } else {
    // Não deu pra saber os monitores (Mac/Linux ou PowerShell bloqueado): janela em pé padrão
    args.push('--window-size=600,1100');
    modo = 'janela-em-pe';
  }

  // Perfil separado: garante que as opções valem mesmo com o navegador normal aberto,
  // e não mexe nas suas abas/contas.
  const perfil = path.join(os.homedir(), '.live-interativa', deitada ? 'navegador-deitada' : 'navegador-v2');
  mkdirSync(perfil, { recursive: true });
  args.push(
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
  );
  try {
    const p = spawn(exe, args, { detached: true, stdio: 'ignore' });
    p.unref();
    return { ok: true, navegador: path.basename(exe), modo, monitores: monitores.length };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
