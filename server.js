const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

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

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({
        error: { message: data?.error?.message || "Error al consultar Gemini" }
      });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: "Error servidor: " + err.message } });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
