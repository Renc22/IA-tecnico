const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const MODELOS_OPENROUTER = [
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free"
];

async function consultarOpenRouter(apiKey, systemPrompt, userPrompt) {
  for (const modelo of MODELOS_OPENROUTER) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://ia-tecnico-2.onrender.com",
        "X-Title": "IA Tecnico POS"
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    const data = await r.json();

    if (r.ok && data?.choices?.[0]?.message?.content) {
      return {
        ok: true,
        status: 200,
        texto: data.choices[0].message.content
      };
    }

    const msg = data?.error?.message || "";
    const reintentable =
      r.status === 429 ||
      r.status === 502 ||
      r.status === 503 ||
      /rate|overloaded|unavailable|capacity|busy/i.test(msg);

    if (!reintentable) {
      return {
        ok: false,
        status: r.status || 500,
        mensaje: msg || "Error al consultar OpenRouter"
      };
    }
  }

  return {
    ok: false,
    status: 503,
    mensaje: "Los modelos gratuitos de OpenRouter están saturados ahora mismo. Intenta en unos segundos."
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: { message: "Falta OPENROUTER_API_KEY en Render" } });
    }

    const { pregunta, datos } = req.body || {};
    const contexto = Array.isArray(datos) && datos.length
      ? JSON.stringify(datos.slice(0, 5))
      : "No hay registros en Supabase para esa consulta.";

    const systemPrompt = `Eres IA Técnico, asistente para técnicos de campo de POS en Perú.
Responde claro, corto y práctico, en español de Perú.
Usa SOLO los datos de Supabase. Si no hay datos, dilo y sugiere qué revisar.
Responde con: Entidad, Modelo POS, Error, Solución paso a paso, y Observaciones si hay.`;

    const userPrompt = `DATOS SUPABASE (tabla soluciones): ${contexto}
PREGUNTA DEL TÉCNICO: ${pregunta}`;

    const resultado = await consultarOpenRouter(apiKey, systemPrompt, userPrompt);

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        error: { message: resultado.mensaje }
      });
    }

    // Mantiene la misma estructura que espera index.html
    return res.json({
      candidates: [{ content: { parts: [{ text: resultado.texto }] } }]
    });
  } catch (err) {
    return res.status(500).json({ error: { message: "Error servidor: " + err.message } });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
    
