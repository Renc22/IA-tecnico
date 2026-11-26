const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const MODELOS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash"
];

async function consultarGeminiConReintento(apiKey, prompt) {
  for (const modelo of MODELOS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
    const opciones = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    };

    for (let intento = 1; intento <= 2; intento++) {
      const r = await fetch(url, opciones);
      const data = await r.json();

      if (r.ok) {
        return { ok: true, status: 200, data };
      }

      const msg = data?.error?.message || "";
      const esTemporal =
        r.status === 429 ||
        r.status === 503 ||
        /high demand|overloaded|unavailable|quota/i.test(msg);

      if (!esTemporal) {
        return { ok: false, status: r.status, data };
      }

      if (intento < 2) {
        await new Promise(resolve => setTimeout(resolve, intento * 1500));
      }
    }
  }

  return {
    ok: false,
    status: 503,
    data: {
      error: {
        message: "Los modelos de Gemini están con alta demanda en este momento. Intenta de nuevo en unos segundos."
      }
    }
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: { message: "Falta GEMINI_API_KEY en Render" } });
    }

    const { pregunta, datos } = req.body || {};
    const contexto = Array.isArray(datos) && datos.length
      ? JSON.stringify(datos.slice(0, 5))
      : "No hay registros en Supabase para esa consulta.";

    const prompt = `Eres IA Técnico, asistente para técnicos de campo de POS.
Responde claro, corto y práctico, en español de Perú.
Usa SOLO los datos de Supabase. Si no hay datos, dilo y sugiere qué revisar.
DATOS SUPABASE (tabla soluciones): ${contexto}
PREGUNTA DEL TÉCNICO: ${pregunta}
Responde con: Entidad, Modelo POS, Error, Solución paso a paso, y Observaciones si hay.`;

    const resultado = await consultarGeminiConReintento(apiKey, prompt);
    if (!resultado.ok) {
      return res.status(resultado.status).json({
        error: { message: resultado.data?.error?.message || "Error al consultar Gemini" }
      });
    }

    return res.json(resultado.data);
  } catch (err) {
    return res.status(500).json({ error: { message: "Error servidor: " + err.message } });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
