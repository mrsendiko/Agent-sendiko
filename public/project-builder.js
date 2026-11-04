
(() => {
  "use strict";

  function validasi(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("Daftar file masih kosong.");
    }

    files.forEach(file => {
      if (
        !file ||
        typeof file.name !== "string" ||
        typeof file.content !== "string" ||
        !file.name.trim()
      ) {
        throw new Error("Ada file dengan format tidak valid.");
      }

      if (
        file.name.startsWith("/") ||
        file.name.includes("..") ||
        file.name.includes("\\")
      ) {
        throw new Error("Nama atau lokasi file tidak aman.");
      }
    });
  }

  async function buatProyek(files, nama = "proyek-sendiko.zip") {
    validasi(files);

    if (!window.SendikoProject) {
      throw new Error("Mesin ZIP SENDIKO belum tersedia.");
    }

    return window.SendikoProject.buatZIP(files, nama);
  }

  window.SendikoBuilder = {
    buatProyek,
    validasi
  };

})();
