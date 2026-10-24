// Stands in for tools/tts/speak.py in tests: answers each JSON line with a tone a third of
// a second long per word, or a failure for a line that says "fail".
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

for await (const line of createInterface({ input: process.stdin })) {
  const req = JSON.parse(line);
  if (req.text.includes('fail')) {
    console.log(JSON.stringify({ ok: false, error: 'could not say it' }));
    continue;
  }
  const seconds = req.text.split(/\s+/).length / 3;
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=f=300:d=${seconds}`,
    '-ar',
    '24000',
    req.out,
  ]);
  console.log(JSON.stringify({ ok: true, out: req.out, seconds }));
}
