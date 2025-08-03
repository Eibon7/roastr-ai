document.getElementById("sendBtn").addEventListener("click", async () => {
  const message = document.getElementById("message").value.trim();
  const resultDiv = document.getElementById("result");
  const loadingDiv = document.getElementById("loading");

  if (!message) {
    alert("Por favor, escribe un mensaje.");
    return;
  }

  resultDiv.innerHTML = "";
  loadingDiv.style.display = "block";

  try {
    const response = await fetch("/roast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Si pusiste API key en el backend, añade aquí:
        //"x-api-key": "r0astr-2025-!S3creT-K3y#92"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    loadingDiv.style.display = "none";

    if (data.roast) {
      resultDiv.innerHTML = `<strong>🔥 Roast generado:</strong> ${data.roast}`;
    } else {
      resultDiv.innerHTML = `<span style="color:red;">Error: ${data.error || "No se pudo generar el roast"}</span>`;
    }
  } catch (error) {
    loadingDiv.style.display = "none";
    resultDiv.innerHTML = `<span style="color:red;">Error de conexión</span>`;
  }
});
