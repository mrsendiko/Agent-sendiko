
"use strict";

function hitung(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("Perintah hitung kosong.");
  }

  if (input.length > 200) {
    throw new Error("Perhitungan terlalu panjang.");
  }

  const ekspresi = input.replace(/\s+/g, "");

  if (!/^[0-9+\-*/().%]+$/.test(ekspresi)) {
    throw new Error("Ekspresi mengandung karakter yang tidak diizinkan.");
  }

  if (!/[0-9]/.test(ekspresi)) {
    throw new Error("Ekspresi tidak memiliki angka.");
  }

  const tokens = ekspresi.match(
    /(?:\d+(?:\.\d*)?|\.\d+|[+\-*/%()])/g
  );

  if (!tokens || tokens.join("") !== ekspresi) {
    throw new Error("Format perhitungan tidak valid.");
  }

  const hasil = Function(
    '"use strict"; return (' + ekspresi + ')'
  )();

  if (!Number.isFinite(hasil)) {
    throw new Error("Hasil perhitungan tidak valid.");
  }

  return hasil;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Metode tidak diizinkan." })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const hasil = hitung(body.ekspresi);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sukses: true, hasil })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sukses: false,
        error: error.message
      })
    };
  }
};
