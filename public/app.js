
const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem("sendiko_" + key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem("sendiko_" + key, JSON.stringify(value));
  }
};

let chat = store.get("chat", []);
let memories = store.get("memories", []);
let skills = store.get("skills", []);
let busy = false;

const defaultSettings = {
  provider: "openai",
  routeMode: "balanced",
  base: "https://api.openai.com/v1",
  model: "gpt-4o-mini"
};

let settings = store.get("settings", defaultSettings);

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function renderMessages() {
  const box = $("messages");
  if (!box) return;

  box.innerHTML = "";

  if (!chat.length) {
    chat.push({
      role: "assistant",
      content: "Halo, saya SENDIKO. Apa tugas pertama kita?"
    });
  }

  chat.forEach(m => {
    const row = document.createElement("div");
    row.className = "message " +
      (m.role === "user" ? "user" : "assistant");

    row.innerHTML =
      (m.role === "user" ? "" : "<div class='avatar'>S</div>") +
      `<div class="bubble">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>`;

    box.appendChild(row);
  });

  box.scrollTop = box.scrollHeight;
}

function addMessage(role, content) {
  chat.push({ role, content });
  store.set("chat", chat);
  renderMessages();
}

function renderMemories() {
  if (!$("memoryList")) return;

  $("memoryList").innerHTML = memories.length
    ? ""
    : '<div class="panel"><p>Belum ada catatan. Tambahkan informasi yang ingin diingat agent.</p></div>';

  memories.forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "memory-item";

    el.innerHTML =
      `<p>${escapeHtml(m)}</p><button aria-label="Hapus" data-delete-memory="${i}">×</button>`;

    $("memoryList").appendChild(el);
  });
}

function renderSkills() {
  if (!$("customSkills")) return;

  $("customSkills").innerHTML = "";

  skills.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "panel skill-card";

    el.innerHTML =
      `<div class="skill-icon">✧</div>
       <div style="flex:1">
       <b>${escapeHtml(s.name)}</b>
       <small>${escapeHtml(s.instruction)}</small>
       </div>
       <button class="text-button" data-delete-skill="${i}">Hapus</button>`;

    $("customSkills").appendChild(el);
  });
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active", v.id === "view-" + name)
  );

  document.querySelectorAll(".nav-item").forEach(v =>
    v.classList.toggle("active", v.dataset.view === name)
  );

  if (name === "memory") renderMemories();
  if (name === "skills") renderSkills();
}

document.querySelectorAll(".nav-item").forEach(b =>
  b.addEventListener("click", () => switchView(b.dataset.view))
);

document.querySelectorAll(".quick-card").forEach(b =>
  b.addEventListener("click", () => {
    $("prompt").value = b.dataset.prompt;
    $("prompt").focus();
  })
);

$("clearChat").addEventListener("click", () => {
  if (confirm("Bersihkan riwayat chat di browser ini?")) {
    chat = [];
    store.set("chat", chat);
    renderMessages();
  }
});

$("sendBtn").addEventListener("click", sendMessage);

$("prompt").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Membaca respons backend dengan aman
async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    const preview = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 250);

    throw new Error(
      "Backend tidak mengirim JSON. HTTP " +
      response.status +
      ". Tipe respons: " +
      contentType +
      ". Isi awal: " +
      (preview || "Kosong")
    );
  }

  if (!response.ok) {
    const detail = data.detail || data.error || data.message || "Backend gagal.";

    throw new Error(
      detail +
      (data.http_status ? " (HTTP " + data.http_status + ")" : "")
    );
  }

  return data;
}

async function sendMessage() {
  const text = $("prompt").value.trim();

  if (!text || busy) return;

  $("prompt").value = "";
  addMessage("user", text);

  busy = true;
  $("sendBtn").disabled = true;
  $("sendBtn").textContent = "…";

  const thinking = {
    role: "assistant",
    content: "Sedang memahami tugas dan menyusun langkah…"
  };

  chat.push(thinking);
  renderMessages();

  try {
    const response = await fetch(
      "/.netlify/functions/agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          messages: chat.filter(m => m !== thinking).slice(-18),
          memories,
          skills,
          settings
        })
      }
    );

    const data = await readResponse(response);

    chat = chat.filter(m => m !== thinking);

    addMessage("assistant", data.reply || "Selesai.");

    if (
      Array.isArray(data.memory_updates) &&
      data.memory_updates.length
    ) {
      memories = [...memories, ...data.memory_updates];
      store.set("memories", memories);
      renderMemories();
    }

  } catch (err) {
    chat = chat.filter(m => m !== thinking);

    addMessage(
      "assistant",
      "Belum bisa terhubung: " +
      err.message +
      "\n\nProvider yang dipilih: " +
      (settings.provider || "openai") +
      ". Periksa Netlify Functions dan pengaturan provider."
    );

  } finally {
    busy = false;
    $("sendBtn").disabled = false;
    $("sendBtn").textContent = "↑";
  }
}

// Memory lokal
$("addMemory").addEventListener("click", () => {
  const v = $("memoryInput").value.trim();

  if (!v) return;

  memories.push(v);
  store.set("memories", memories);

  $("memoryInput").value = "";
  renderMemories();
});

$("memoryList").addEventListener("click", e => {
  const b = e.target.closest("[data-delete-memory]");
  if (!b) return;

  memories.splice(Number(b.dataset.deleteMemory), 1);
  store.set("memories", memories);
  renderMemories();
});

$("clearMemory").addEventListener("click", () => {
  if (confirm("Hapus semua memory lokal?")) {
    memories = [];
    store.set("memories", memories);
    renderMemories();
  }
});

// Skills
$("addSkill").addEventListener("click", () => {
  const name = $("skillName").value.trim();
  const instruction = $("skillInstruction").value.trim();

  if (!name || !instruction) {
    toast("Isi nama dan instruksi skill.");
    return;
  }

  skills.push({ name, instruction });
  store.set("skills", skills);

  $("skillName").value = "";
  $("skillInstruction").value = "";

  renderSkills();
  toast("Skill disimpan.");
});

$("customSkills").addEventListener("click", e => {
  const b = e.target.closest("[data-delete-skill]");
  if (!b) return;

  skills.splice(Number(b.dataset.deleteSkill), 1);
  store.set("skills", skills);
  renderSkills();
});

// Pengaturan provider
$("apiBase").value = settings.base;
$("modelName").value = settings.model;
$("provider").value = settings.provider || "openai";
$("routeMode").value = settings.routeMode || "balanced";

$("saveSettings").addEventListener("click", () => {
  settings = {
    provider: $("provider").value,
    routeMode: $("routeMode").value,
    base: $("apiBase").value.trim().replace(/\/+$/, ""),
    model: $("modelName").value.trim()
  };

  store.set("settings", settings);

  $("settingsStatus").textContent =
    "Pengaturan model disimpan di browser.";

  toast("Pengaturan berhasil disimpan.");
});

// Pemeriksaan backend
$("checkBackend").addEventListener("click", async () => {
  const tag = $("backendStatus");
  tag.textContent = "MEMERIKSA…";

  try {
    const r = await fetch("/.netlify/functions/health", {
      headers: { "Accept": "application/json" }
    });

    const d = await readResponse(r);

    tag.textContent = d.ok ? "TERHUBUNG" : "BELUM SIAP";
    tag.className = "tag " + (d.ok ? "" : "muted");

  } catch (e) {
    tag.textContent = "TIDAK TERHUBUNG";
    tag.className = "tag muted";
  }
});

// V1.4 Cloud Memory: Supabase
const CLOUD_SQL = `create table if not exists public.memories (
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
note text not null,
created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

create policy "users read own memories"
on public.memories for select using (auth.uid() = user_id);

create policy "users insert own memories"
on public.memories for insert with check (auth.uid() = user_id);

create policy "users update own memories"
on public.memories for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users delete own memories"
on public.memories for delete using (auth.uid() = user_id);`;

let cloudSession = store.get("cloud_session", null);

let cloudConfig = store.get("cloud_config", {
  url: "",
  key: ""
});

const cUrl = $("supabaseUrl");
const cKey = $("supabaseKey");
const cEmail = $("cloudEmail");
const cPass = $("cloudPassword");
const cStatus = $("cloudStatus");

if (cUrl) {
  cUrl.value = cloudConfig.url || "";
  cKey.value = cloudConfig.key || "";
}

function cloudHeaders(extra = {}) {
  return {
    "apikey": cloudConfig.key,
    "Authorization": "Bearer " +
      (cloudSession?.access_token || cloudConfig.key),
    "Content-Type": "application/json",
    ...extra
  };
}

function cloudReady() {
  return !!(
    cloudConfig.url &&
    cloudConfig.key &&
    cloudSession?.access_token
  );
}

function cloudStatus(msg) {
  if (cStatus) cStatus.textContent = msg;
}

function saveCloudConfig() {
  cloudConfig = {
    url: (cUrl.value || "").trim().replace(/\/+$/, ""),
    key: (cKey.value || "").trim()
  };

  store.set("cloud_config", cloudConfig);
}

async function cloudAuth(mode) {
  saveCloudConfig();

  const email = cEmail.value.trim();
  const password = cPass.value;

  if (!cloudConfig.url || !cloudConfig.key || !email || !password) {
    cloudStatus("Isi URL, anon key, email, dan password terlebih dahulu.");
    return;
  }

  const endpoint = cloudConfig.url +
    "/auth/v1/" +
    (mode === "signup" ? "signup" : "token?grant_type=password");

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: cloudConfig.key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const d = await readResponse(r);

  if (mode === "signup" && !d.access_token) {
    cloudStatus(
      "Akun dibuat. Jika email confirmation aktif, verifikasi email lalu masuk."
    );
    return;
  }

  cloudSession = d;
  store.set("cloud_session", cloudSession);

  cloudStatus("Login berhasil. Menyinkronkan memory…");

  await syncCloud();
}

async function syncCloud() {
  saveCloudConfig();

  if (!cloudReady()) {
    cloudStatus("Cloud belum login. Konfigurasikan lalu masuk.");
    return;
  }

  const url = cloudConfig.url +
    "/rest/v1/memories?select=id,note,created_at&order=created_at.asc";

  const r = await fetch(url, {
    headers: cloudHeaders()
  });

  const d = await readResponse(r);

  const cloudNotes = d.map(x => String(x.note));
  const localNotes = memories.map(String);

  const missing = localNotes.filter(
    n => !cloudNotes.includes(n)
  );

  if (missing.length) {
    const ins = await fetch(
      cloudConfig.url + "/rest/v1/memories",
      {
        method: "POST",
        headers: cloudHeaders({
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(
          missing.map(note => ({ note }))
        )
      }
    );

    if (!ins.ok) {
      await readResponse(ins);
      throw Error("Gagal menyimpan memory lokal ke cloud.");
    }
  }

  memories = [...new Set([...cloudNotes, ...localNotes])];

  store.set("memories", memories);
  renderMemories();

  cloudStatus(
    "Sinkronisasi berhasil. " +
    memories.length +
    " catatan tersedia."
  );
}

if ($("cloudSignup")) {
  $("cloudSignup").addEventListener("click", async () => {
    try {
      await cloudAuth("signup");
    } catch (e) {
      cloudStatus(e.message);
    }
  });
}

if ($("cloudLogin")) {
  $("cloudLogin").addEventListener("click", async () => {
    try {
      await cloudAuth("login");
    } catch (e) {
      cloudStatus(e.message);
    }
  });
}

if ($("cloudSync")) {
  $("cloudSync").addEventListener("click", async () => {
    try {
      await syncCloud();
    } catch (e) {
      cloudStatus(e.message);
    }
  });
}

if ($("cloudLogout")) {
  $("cloudLogout").addEventListener("click", () => {
    cloudSession = null;
    store.set("cloud_session", null);
    cloudStatus("Keluar dari cloud. Memory lokal tidak dihapus.");
  });
}

if ($("copySql")) {
  $("copySql").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CLOUD_SQL);
      toast("SQL disalin.");
    } catch {
      cloudStatus(
        "Tidak dapat menyalin otomatis; buka petunjuk setup dan salin SQL."
      );
    }
  });
}

// Sinkronisasi memory baru ke cloud
$("addMemory").addEventListener("click", async () => {
  const note = $("memoryInput").value.trim();

  if (!note || !cloudReady()) return;

  try {
    const r = await fetch(
      cloudConfig.url + "/rest/v1/memories",
      {
        method: "POST",
        headers: cloudHeaders({
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({ note })
      }
    );

    if (!r.ok) {
      await readResponse(r);
      throw Error("Memory lokal tersimpan, tetapi cloud gagal.");
    }

    cloudStatus("Catatan baru juga tersimpan di cloud.");

  } catch (e) {
    cloudStatus(e.message);
  }
});

renderMessages();
renderMemories();
renderSkills();

// Self-development: evaluasi kemampuan
const selfCheck = $("runSelfCheck");

if (selfCheck) {
  selfCheck.addEventListener("click", () => {
    const result = $("selfCheckResult");

    const checks = [
      ["AI Hybrid", "Fondasi routing provider tersedia; API key dan kuota tetap perlu dikonfigurasi."],
      ["Memory", "Catatan tersimpan di browser perangkat ini; cloud memory dapat dikonfigurasi."],
      ["Skills", "Skill dasar dan skill pribadi tersedia; belum ada marketplace atau pembelajaran otomatis."],
      ["Riset web", "Belum terhubung ke mesin pencarian web pada build ini."],
      ["Produksi YouTube", "Belum tersedia pipeline rendering MP4 dan upload YouTube."],
      ["Self-update", "Belum ada akses aman untuk mengubah kode/deploy otomatis; perubahan harus disiapkan dan ditinjau."],
      ["Penjadwalan", "Belum ada worker terjadwal yang berjalan terus-menerus."]
    ];

    result.innerHTML =
      "<b>Hasil evaluasi awal</b>" +
      checks.map(([a, b]) =>
        `<div class="audit-row"><strong>${escapeHtml(a)}</strong><span>${escapeHtml(b)}</span></div>`
      ).join("") +
      '<p class="audit-foot">Prioritas disarankan: cloud memory → web research → YouTube production worker → approval-based updates.</p>';
  });
}

const makePlan = $("makeDevPlan");

if (makePlan) {
  makePlan.addEventListener("click", () => {
    if (!$("approveChanges").checked) {
      toast("Centang persetujuan untuk menyiapkan rencana perubahan.");
      return;
    }

    switchView("chat");

    $("prompt").value =
      "Buat rencana pengembangan AGENT SENDIKO berdasarkan evaluasi sistem. Urutkan prioritas, kebutuhan layanan/API, estimasi biaya relatif, risiko, cara pengujian, dan langkah rollback. Jangan mengubah kode atau melakukan deploy; tampilkan usulan untuk saya tinjau terlebih dahulu.";

    $("prompt").focus();

    toast("Rencana siap diminta. Belum ada perubahan yang diterapkan.");
  });
}
