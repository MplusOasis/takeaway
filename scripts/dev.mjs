import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'server', color: '\u001b[32m' },
  { name: 'client', color: '\u001b[36m' },
];

const children = targets.map(({ name, color }) => {
  const child = spawn(npmCmd, ['run', 'dev', '-w', name], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = `${color}[${name}]\u001b[0m `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code ?? 'null'}\n`);
  });
  return child;
});

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`\n  前端 http://localhost:5173   后端 http://localhost:5174/api/health\n`);
