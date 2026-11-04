(() => {
  "use strict";

  function buatNamaFile(teks) {
    return (teks || "hasil-sendiko")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "hasil-sendiko";
  }

  function simpanFile(teks) {
    if (!teks || !teks.trim()) {
      alert("Tidak ada isi yang bisa disimpan.");
      return;
    }

    const tanggal = new Date().toISOString().slice(0, 10);
    const nama = buatNamaFile(teks.slice(0, 60));

    const blob = new Blob(
      [teks],
      { type: "text/markdown;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${nama}-${tanggal}.md`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function pasangTombol() {
    const messages = document.getElementById("messages");
    if (!messages) return;

    messages.querySelectorAll(".message.assistant").forEach(pesan => {
      if (pesan.dataset.fileTools === "aktif") return;

      const bubble = pesan.querySelector(".bubble");
      if (!bubble) return;

      pesan.dataset.fileTools = "aktif";

      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.textContent = "⬇ Simpan sebagai File";
      tombol.style.cssText = `
        margin: 8px 0 8px 42px;
        padding: 9px 14px;
        border: 1px solid #c9a447;
        border-radius: 9px;
        background: #252525;
        color: #f0cf72;
        font-size: 12px;
        cursor: pointer;
      `;

      tombol.addEventListener("click", () => {
        simpanFile(bubble.innerText || bubble.textContent);
      });

      pesan.appendChild(tombol);
    });
  }

  function mulai() {
    const messages = document.getElementById("messages");
    if (!messages) return;

    pasangTombol();

    const observer = new MutationObserver(pasangTombol);
    observer.observe(messages, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulai);
  } else {
    mulai();
  }
})();
