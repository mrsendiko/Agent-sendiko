(() => {
  "use strict";

  async function buatZIP(files, namaZIP) {
    if (typeof JSZip === "undefined") {
      alert("Mesin ZIP belum tersedia.");
      return;
    }

    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file.name, file.content);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = namaZIP || "proyek-sendiko.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function pasangTombol() {
    if (document.getElementById("sendikoZipTest")) return;

    const area = document.querySelector(".composer-wrap");
    if (!area) return;

    const tombol = document.createElement("button");
    tombol.id = "sendikoZipTest";
    tombol.textContent = "📦 Tes Pembuat ZIP";
    tombol.className = "secondary-btn";
    tombol.style.marginTop = "10px";

    tombol.onclick = async () => {
      try {
        await buatZIP([
          {
            name: "README.md",
            content: "# Proyek Perdana Sendiko\n\nZIP berhasil dibuat."
          },
          {
            name: "index.html",
            content: "<h1>Halo dari SENDIKO</h1>"
          }
        ], "proyek-perdana-sendiko.zip");
      } catch (error) {
        alert("Gagal membuat ZIP: " + error.message);
      }
    };

    area.appendChild(tombol);
  }

  window.SendikoProject = { buatZIP };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pasangTombol);
  } else {
    pasangTombol();
  }
})();
