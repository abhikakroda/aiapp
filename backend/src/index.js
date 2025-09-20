const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

let fetchImpl = global.fetch;
if (!fetchImpl) {
  fetchImpl = require('node-fetch');
}
const fetch = (...args) => fetchImpl(...args);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!GEMINI_API_KEY) {
  console.warn('[startup] Missing GEMINI_API_KEY. Requests to Gemini will fail until it is provided.');
}

const allowedOrigins = CLIENT_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like curl or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[cors] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a messages array' });
  }

  const contents = messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const role = mapRole(message.role);
      const text = typeof message.content === 'string' ? message.content : '';

      if (!role || !text) {
        return null;
      }

      return {
        role,
        parts: [{ text }],
      };
    })
    .filter(Boolean);

  if (contents.length === 0) {
    return res.status(400).json({ error: 'No valid messages provided' });
  }

  try {
    const data = await callGeminiWithRetry(contents);
    const reply = extractReplyText(data);

    if (!reply) {
      return res.status(502).json({ error: 'Gemini API returned an empty response' });
    }

    return res.json({ reply });
  } catch (error) {
    if (error?.code === 'MODEL_OVERLOADED') {
      return res.status(503).json({ error: 'Gemini is overloaded right now. Please retry in a few seconds.' });
    }

    if (error?.status) {
      console.error('[gemini] API error:', error.message);
      return res.status(error.status).json({ error: error.message || 'Gemini API request failed' });
    }

    console.error('[gemini] Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[startup] Server listening on port ${PORT}`);
});

function mapRole(role = '') {
  const normalised = role.toLowerCase();
  if (normalised === 'user') return 'user';
  if (['assistant', 'model'].includes(normalised)) return 'model';
  if (['system', 'tool'].includes(normalised)) return 'system';
  return null;
}

async function callGeminiWithRetry(contents, { attempts = 3, initialDelayMs = 600 } = {}) {
  if (!GEMINI_API_KEY) {
    const missingKeyError = new Error('Missing GEMINI_API_KEY');
    missingKeyError.status = 500;
    throw missingKeyError;
  }

  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      const waitTime = initialDelayMs * attempt;
      await delay(waitTime);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contents }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error?.message || 'Gemini API request failed';
        const enrichedError = createGeminiError(message, response.status);

        if (enrichedError.code === 'MODEL_OVERLOADED' && attempt < attempts - 1) {
          lastError = enrichedError;
          continue;
        }

        throw enrichedError;
      }

      return data;
    } catch (error) {
      if (error?.code === 'MODEL_OVERLOADED' && attempt < attempts - 1) {
        lastError = error;
        continue;
      }

      if (error?.name === 'FetchError' && attempt < attempts - 1) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Gemini API request failed after retries');
}

function createGeminiError(message, status) {
  const normalisedMessage = (message || '').toLowerCase();
  const error = new Error(message || 'Gemini API request failed');
  error.status = status;

  if (status === 429 || status === 503 || normalisedMessage.includes('overloaded')) {
    error.code = 'MODEL_OVERLOADED';
  }

  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReplyText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;

  const parts = candidate.content?.parts || [];
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('').trim();
}

module.exports = app;
