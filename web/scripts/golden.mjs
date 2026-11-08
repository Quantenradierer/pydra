// Regenerates src/robot/py/golden.json: runs every golden snippet in CPython.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { GOLDEN } from '../src/robot/py/golden-snippets.ts';

const all = Object.values(GOLDEN).flat();
const out = execFileSync('python3', ['-I', new URL('./golden-runner.py', import.meta.url).pathname], { input: JSON.stringify(all), encoding: 'utf8' });
const results = JSON.parse(out);
const golden = Object.fromEntries(all.map((code, i) => [code, results[i]]));
writeFileSync(new URL('../src/robot/py/golden.json', import.meta.url), JSON.stringify(golden, null, 1) + '\n');
console.log(`${all.length} snippets, python ${execFileSync('python3', ['--version'], { encoding: 'utf8' }).trim()}`);
