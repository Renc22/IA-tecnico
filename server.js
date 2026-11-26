const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static('.'));

app.post('/api/chat', async (req, res) => {
  const { pregunta, datos } = req.body;
  const prompt = `Eres IA Técnico, asistente para técnicos de campo de POS. Responde claro, corto y práctico, en español de Perú. Usa SOLO los datos de Supabase. Si no hay datos, dilo.
DATOS: ${JSON.stringify(datos)}
PREGUNTA: ${pregunta}
Responde con: Entidad, Modelo POS, Error, Solución paso a paso, y Observaciones.`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await r.json();
  res.json(data);
});

app.listen(process.env.PORT || 10000, () => console.log("Servidor listo"));
