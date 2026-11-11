// Abre a tela do jogo num Chrome (ou Edge) separado, em tela cheia, pronto pra captura:
// sem barra de endereço, sem abas, com som liberado (sem precisar clicar).
import { spawn } from 'node:child_process';
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

export function abrirTelaDeCaptura(url, { preferirChrome = false } = {}) {
  const exe = candidatos(preferirChrome).find((p) => p && existsSync(p));
  if (!exe) return { ok: false, erro: 'Não achei o Google Chrome nem o Edge instalados neste computador.' };
  // Perfil separado: garante que as opções valem mesmo com o Chrome normal já aberto
  const perfil = path.join(os.homedir(), '.live-interativa', 'navegador');
  mkdirSync(perfil, { recursive: true });
  const args = [
    `--app=${url}`,
    '--start-fullscreen',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
  ];
  try {
    const p = spawn(exe, args, { detached: true, stdio: 'ignore' });
    p.unref();
    return { ok: true, navegador: path.basename(exe) };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
