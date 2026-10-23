import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const python = process.env.TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const tools = resolve(root, 'node_modules/.tmp/backup-tools');
function run(args) {
  const result = spawnSync(python, args, { cwd: root, stdio: 'inherit', timeout: 180000 });
  if (result.status !== 0) throw new Error(`Backup validation failed: ${result.error ?? result.status}`);
}
run(['ops/backup/install_age.py', tools]);
run(['ops/backup/test_backup.py', '--tools', tools, ...process.argv.slice(2)]);
