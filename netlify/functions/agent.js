
const sendJSON = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(data)
});

const PROVIDERS = {
  gemini: {
    key: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-3.8-flash"
  },
  groq: {
    key: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-20b"
  },
  openai: {
    key: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini"
  },
  openrouter: {
    key: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/free"
  }
};

const PRIORITY = [
  "gemini",
  "groq",
  "openai",
  "openrouter"
];

async function callAI(provider, messages) {
  const cfg = PROVIDERS[provider];
  const key = process.env[cfg.key];

  if (!key) {
    throw new Error("API key " + cfg.key + " tidak ditemukan");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(cfg.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        ...(provider === "openrouter" ? {
          "HTTP-Referer": "https://creative-fox-6c5ff8.netlify.app",
          "X-Title": "AGENT SENDIKO"
        } : {})
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: 600,
        stream: false
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Respons provider bukan JSON");
    }

    if (!response.ok) {
      throw new Error(
        data.error?.message || "HTTP " + response.status
      );
    }

    const content = data.choices?.[0]?.message?.content;

    const reply = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map(x => x.text || "").join("")
        : "";

    if (!reply.trim()) {
      throw new Error("Provider tidak mengirim jawaban");
    }

    return {
      reply,
      model: data.model || cfg.model
    };

  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return sendJSON(405, {
      error: "Gunakan metode POST"
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const settings = body.settings || {};

    const selected = String(
      settings.provider || "gemini"
    ).toLowerCase();

    const memories = Array.isArray(body.memories)
      ? body.memories.slice(-10)
      : [];

    const skills = Array.isArray(body.skills)
      ? body.skills.slice(0, 10)
      : [];

    const systemPrompt = `
Kamu adalah AGENT SENDIKO, asisten AI digital.

Gunakan Bahasa Indonesia kecuali diminta bahasa lain.
Jawab dengan jelas, ramah, dan praktis.
Bantu pengguna menyelesaikan pekerjaan secara bertahap.
Jangan mengaku melakukan tindakan yang belum dilakukan.
Jangan pernah meminta API key atau password.

MEMORY:
${memories.map(x => String(x).slice(0, 300)).join("\n")}

SKILL:
${skills.map(x =>
  String(x.name || "").slice(0, 80) +
  ": " +
  String(x.instruction || "").slice(0, 400)
).join("\n")}
`;

    const history = Array.isArray(body.messages)
      ? body.messages.slice(-10)
      : [];

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history
        .filter(m =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string"
        )
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 3000)
        }))
    ];

    const order = [
      ...(PROVIDERS[selected] ? [selected] : []),
      ...PRIORITY.filter(p => p !== selected)
    ];

    const failures = [];

    for (const provider of order) {
      try {
        const result = await callAI(provider, messages);

        return sendJSON(200, {
          reply: result.reply,
          memory_updates: [],
          provider,
          model: result.model,
          fallback_used: provider !== selected,
          attempts: failures
        });

      } catch (error) {
        failures.push({
          provider,
          error: error.name === "AbortError"
            ? "Respons melewati batas waktu"
            : String(error.message).slice(0, 180)
        });
      }
    }

    const detail = failures
      .map(x => x.provider + ": " + x.error)
      .join(" | ");

    return sendJSON(502, {
      error: "Semua provider gagal. " + detail,
      attempts: failures
    });

  } catch (error) {
    return sendJSON(500, {
      error: error.message || "Kesalahan backend AGENT SENDIKO"
    });
  }
};
