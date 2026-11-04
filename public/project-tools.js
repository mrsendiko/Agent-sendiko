(() => {
  "use strict";

  async function buatZIP(files, namaZIP = "proyek-sendiko.zip") {
    if (!Array.isArray(files) || files.length === 0) {
      alert("Belum ada file proyek.");
      return;
    }

    if (typeof JSZip === "undefined") {
      alert("Mesin ZIP belum terpasang.");
      return;
    }

    const zip = new JSZip();

    files.forEach(file => {
      if (file.name && typeof file.content === "string") {
        zip.file(file.name, file.content);
      }
    });

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = namaZIP;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.SendikoProject = {
    buatZIP
  };
})();
