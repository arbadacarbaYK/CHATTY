const express = require('express');
const { spawn } = require('child_process');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many TTS requests. Slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_TTS_CHARS = 2000;

function whichEspeak() {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', 'command -v espeak-ng || command -v espeak'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    proc.stdout.on('data', (d) => {
      out += d.toString();
    });
    proc.on('close', (code) => {
      resolve(code === 0 ? out.trim() : '');
    });
  });
}

let cachedBinary = null;

async function getEspeakBinary() {
  if (cachedBinary !== null) return cachedBinary;
  cachedBinary = await whichEspeak();
  return cachedBinary;
}

/** GET /tts/status — whether local espeak TTS is available */
router.get('/status', async (_req, res) => {
  const bin = await getEspeakBinary();
  res.json({
    available: Boolean(bin),
    engine: bin ? (bin.includes('espeak-ng') ? 'espeak-ng' : 'espeak') : null,
  });
});

/**
 * POST /tts { text }
 * Returns audio/wav synthesized locally with espeak-ng (Linux-friendly).
 */
router.post('/', ttsLimiter, async (req, res) => {
  const raw = req.body?.text;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ error: 'Missing text' });
  }

  const text = raw
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/[`*_#>[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TTS_CHARS);

  if (!text) {
    return res.status(400).json({ error: 'Empty text after cleanup' });
  }

  const bin = await getEspeakBinary();
  if (!bin) {
    return res.status(503).json({
      error:
        'Local TTS unavailable. Install espeak-ng (e.g. sudo apt install espeak-ng).',
    });
  }

  const args = ['-v', 'en', '-s', '155', '--stdout', text];
  const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const chunks = [];
  let stderr = '';
  proc.stdout.on('data', (c) => chunks.push(c));
  proc.stderr.on('data', (c) => {
    stderr += c.toString();
  });

  proc.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  proc.on('close', (code) => {
    if (res.headersSent) return;
    if (code !== 0 || chunks.length === 0) {
      return res.status(500).json({
        error: stderr.trim() || `espeak exited with code ${code}`,
      });
    }
    const wav = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  });
});

module.exports = router;
