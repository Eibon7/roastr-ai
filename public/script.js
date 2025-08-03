const API_URL = "https://roastr-lhcp7seuh-eibon7s-projects.vercel.app/roast";
const API_KEY = "r0astr-2025-S3creT-K3y-92"; // ⚠ Solo para demo pública

document.getElementById("roastBtn").addEventListener("click", async () => {
  const comment = document.getElementById("comment").value.trim();
  const resultDiv = document.getElementById("result");

  if (!comment) {
    resultDiv.textContent = "❌ Escribe un comentario antes de lanzar el roast.";
    return;
  }

  resultDiv.textContent = "⏳ Preparando el roast...";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ message: comment })
    });

    const data = await res.json();
    resultDiv.textContent = data.roast || "⚠️ No se pudo generar el roast.";
  } catch (error) {
    resultDiv.textContent = "❌ Error al conectar con Roastr.ai";
  }
});
