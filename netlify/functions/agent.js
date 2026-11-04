
const json = (statusCode, data) => ({
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
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash"
  },
  groq: {
    key: "GROQ_API_KEY",
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile"
  },
  openai: {
    key: "OPENAI_API_KEY",
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  openrouter: {
    key: "OPENROUTER_API_KEY",
    base: "https://openrouter.ai/api/v1",
    model: "openrouter/free"
  }
};

const PRIORITY = ["gemini", "groq", "openai", "openrouter"];

async function askProvider(name, messages, modelOverride) {
  const cfg = PROVIDERS[name];
  const apiKey = process.env[cfg.key];

  if (!apiKey) {
    throw new Error("API key " + cfg.key + " belum tersedia.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(cfg.base + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        ...(name === "openrouter" ? {
          "HTTP-Referer": "https://creative-fox-6c5ff8.netlify.app",
          "X-Title": "AGENT SENDIKO"
        } : {})
      },
      body: JSON.stringify({
        model: modelOverride || cfg.model,
        messages,
        temperature: 0.5,
        max_tokens: 1200,
        stream: false
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Respons provider bukan JSON.");
    }

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "HTTP " + response.status
      );
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== "string") {
      throw new Error("Provider tidak memberikan jawaban.");
    }

    return {
      reply,
      model: data.model || modelOverride || cfg.model
    };

  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Gunakan metode POST." });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const settings = body.settings || {};

    const selected = String(
      settings.provider || "gemini"
    ).toLowerCase();

    const memories = Array.isArray(body.memories)
      ? body.memories.slice(0, 30)
      : [];

    const skills = Array.isArray(body.skills)
      ? body.skills.slice(0, 20)
      : [];

    const system = `
Kamu adalah AGENT SENDIKO, asisten AI dan agen kerja digital.

Jawab dalam Bahasa Indonesia kecuali pengguna meminta bahasa lain.

Pahami tujuan pengguna, susun langkah, berikan hasil yang praktis,
dan jangan mengaku telah melakukan tindakan yang belum dilakukan.

Jika tugas membutuhkan informasi tambahan, tanyakan hal yang paling penting.

MEMORY PENGGUNA:
${memories.map(x => "- " + String(x).slice(0, 500)).join("\n") || "(kosong)"}

SKILL PENGGUNA:
${skills.map(x =>
  "- " + String(x.name).slice(0, 100) +
  ": " + String(x.instruction).slice(0, 700)
).join("\n") || "(kosong)"}

Jangan meminta password atau API key pengguna.
Jangan mengarang hasil pekerjaan atau tindakan eksternal.
`;

    const history = Array.isArray(body.messages)
      ? body.messages.slice(-18)
      : [];

    const messages = [
      { role: "system", content: system },
      ...history
        .filter(m =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string"
        )
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 12000)
        }))
    ];

    let order = PRIORITY.slice();

    // Provider yang dipilih pengguna dicoba terlebih dahulu.
    if (PROVIDERS[selected]) {
      order = [
        selected,
        ...PRIORITY.filter(p => p !== selected)
      ];
    }

    const attempts = [];

    for (const name of order) {
      try {
        const result = await askProvider(
          name,
          messages,
          settings.routeMode === "custom" &&
          name === selected
            ? settings.model
            : null
        );

        return json(200, {
          reply: result.reply,
          memory_updates: [],
          provider: name,
          model: result.model,
          fallback_used: name !== selected,
          attempts
        });

      } catch (error) {
        const reason = error.name === "AbortError"
          ? "Waktu respons habis"
          : error.message;

        attempts.push({
          provider: name,
          error: String(reason).slice(0, 250)
        });
      }
    }

    return json(502, {
      error: "Semua provider gagal memberikan jawaban. Periksa API key, model, dan batas penggunaan.",
      attempts
    });

  } catch (error) {
    return json(500, {
      error: error.message || "Kesalahan internal AGENT SENDIKO."
    });
  }
};
