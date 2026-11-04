
const cors = { "Content-Type": "application/json" };

const json = (statusCode, data) => ({
  statusCode,
  headers: cors,
  body: JSON.stringify(data)
});

function calculator(expression) {
  const s = String(expression || "").replace(/\s+/g, "");

  if (!s || s.length > 80 || !/^[0-9+\-*/().%]+$/.test(s)) {
    throw new Error("Ekspresi matematika tidak valid.");
  }

  const value = Function('"use strict"; return (' + s + ')')();

  if (!Number.isFinite(value)) {
    throw new Error("Hasil perhitungan tidak valid.");
  }

  return value;
}

const PROVIDERS = {
  openai: {
    base: "https://api.openai.com/v1",
    key: "OPENAI_API_KEY",
    models: {
      economy: "gpt-4o-mini",
      balanced: "gpt-4o-mini",
      power: "gpt-4.1"
    }
  },

  openrouter: {
    base: "https://openrouter.ai/api/v1",
    key: "OPENROUTER_API_KEY",
    models: {
      economy: "openai/gpt-4o-mini",
      balanced: "openai/gpt-4o-mini",
      power: "anthropic/claude-sonnet-4"
    }
  },

  groq: {
    base: "https://api.groq.com/openai/v1",
    key: "GROQ_API_KEY",
    models: {
      economy: "llama-3.1-8b-instant",
      balanced: "llama-3.3-70b-versatile",
      power: "llama-3.3-70b-versatile"
    }
  },

  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: "GEMINI_API_KEY",
    models: {
      economy: "gemini-3.8-flash",
      balanced: "gemini-3.8-flash",
      power: "gemini-3.8-flash"
    }
  }
};

const toolSchemas = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Mendapatkan waktu server saat ini dalam format ISO.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Menghitung ekspresi aritmetika sederhana.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string" }
        },
        required: ["expression"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Mengusulkan catatan untuk disimpan ke memory lokal pengguna.",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string" }
        },
        required: ["note"],
        additionalProperties: false
      }
    }
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const settings = body.settings || {};

    const providerName = String(
      settings.provider || "openai"
    ).toLowerCase();

    const routeMode = [
      "economy",
      "balanced",
      "power",
      "custom"
    ].includes(settings.routeMode)
      ? settings.routeMode
      : "balanced";

    let base;
    let keyName;
    let model;

    if (providerName === "custom") {
      base = String(settings.base || "").replace(/\/+$/, "");
      keyName = "CUSTOM_AI_API_KEY";
      model = String(settings.model || "");

      if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(base)) {
        return json(400, {
          error: "Base URL custom harus HTTPS."
        });
      }
    } else {
      const cfg = PROVIDERS[providerName];

      if (!cfg) {
        return json(400, {
          error: "Provider belum didukung: " + providerName
        });
      }

      base = cfg.base;
      keyName = cfg.key;

      model = routeMode === "custom"
        ? String(settings.model || cfg.models.balanced)
        : cfg.models[routeMode];
    }

    const apiKey = process.env[keyName];

    if (!apiKey) {
      return json(500, {
        error: `API key ${keyName} belum dipasang di Netlify.`
      });
    }

    if (!model) {
      return json(400, {
        error: "Nama model belum diisi."
      });
    }

    const memories = Array.isArray(body.memories)
      ? body.memories.slice(0, 30)
      : [];

    const skills = Array.isArray(body.skills)
      ? body.skills.slice(0, 20)
      : [];

    const system = `Kamu adalah AGENT SENDIKO, agen AI praktis untuk pengguna umum.
Jawab dalam Bahasa Indonesia kecuali diminta lain.
Pahami tujuan, buat rencana, gunakan tools yang tersedia, periksa hasil, lalu berikan ringkasan.
Jangan mengaku melakukan tindakan eksternal yang tidak benar-benar dilakukan.
Jika informasi kurang, tanyakan hal yang paling penting.
Memory pengguna:
${memories.map(x => "- " + String(x).slice(0, 500)).join("\n") || "(kosong)"}

Skills pengguna:
${skills.map(x => "- " + String(x.name).slice(0, 100) + ": " + String(x.instruction).slice(0, 700)).join("\n") || "(tidak ada)"}

Gunakan hanya tools yang tersedia. Jangan meminta password atau API key.`;

    const messages = [
      { role: "system", content: system },
      ...(Array.isArray(body.messages)
        ? body.messages.slice(-18)
        : [])
    ];

    const memoryUpdates = [];
    let finalText = "";

    for (let turn = 0; turn < 6; turn++) {
      const requestBody = {
        model,
        messages,
        temperature: 0.5
      };

      if (providerName !== "custom") {
        requestBody.tools = toolSchemas;
        requestBody.tool_choice = "auto";
      }

      const response = await fetch(
        base + "/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      // Baca respons sebagai teks dahulu agar error tidak hilang
      const rawText = await response.text();

      let data = {};

      try {
        data = JSON.parse(rawText);
      } catch {
        const safeText = rawText
          .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
          .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
          .slice(0, 1000);

        return json(502, {
          error: "Provider mengirim respons bukan JSON.",
          provider: providerName,
          http_status: response.status,
          detail: safeText || "Respons kosong."
        });
      }

      if (!response.ok) {
        let detail =
          data.error?.message ||
          data.error?.status ||
          data.message ||
          data.detail ||
          JSON.stringify(data);

        detail = String(detail)
          .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
          .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
          .slice(0, 1500);

        return json(response.status, {
          error: "Provider " + providerName + " gagal.",
          http_status: response.status,
          model,
          detail
        });
      }

      const msg = data.choices?.[0]?.message;

      if (!msg) {
        throw new Error(
          "Respons model kosong: " + JSON.stringify(data).slice(0, 500)
        );
      }

      messages.push(msg);

      if (!msg.tool_calls?.length) {
        finalText = msg.content || "Tugas selesai.";
        break;
      }

      for (const call of msg.tool_calls) {
        let args = {};

        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}

        let result;

        if (call.function.name === "get_current_time") {
          result = new Date().toISOString();
        } else if (call.function.name === "calculator") {
          result = String(calculator(args.expression));
        } else if (call.function.name === "save_memory") {
          const note = String(args.note || "").trim().slice(0, 500);

          if (note) memoryUpdates.push(note);

          result = note
            ? "Catatan akan disimpan pada memory browser setelah jawaban selesai."
            : "Catatan kosong.";
        } else {
          result = "Tool tidak dikenal.";
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: String(result)
        });
      }
    }

    if (!finalText) {
      finalText = "Batas langkah otomatis tercapai. Berikan instruksi lanjutan.";
    }

    return json(200, {
      reply: finalText,
      memory_updates: memoryUpdates,
      provider: providerName,
      model
    });

  } catch (err) {
    return json(500, {
      error: err.message || "Kesalahan internal."
    });
  }
};
