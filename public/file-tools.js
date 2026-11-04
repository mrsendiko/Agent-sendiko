(() => {
  "use strict";

  async function buatZIP(files, namaZIP = "proyek-sendiko.zip") {
    if (typeof JSZip === "undefined") {
      throw new Error("Mesin ZIP belum tersedia.");
    }

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("Belum ada file untuk dibuat ZIP.");
    }

    const zip = new JSZip();

    files.forEach((file) => {
      if (!file.name || typeof file.content !== "string") {
        throw new Error("Format file tidak valid.");
      }

      zip.file(file.name, file.content);
    });

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = namaZIP;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);

    return true;
  }

  window.SendikoProject = {
    buatZIP
  };
})();
