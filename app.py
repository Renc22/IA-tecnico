import os, json, requests
from flask import Flask, request, jsonify
from gtts import gTTS
import google.generativeai as genai

app = Flask(__name__)

# --- CLAVES DE RENDER ---
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

TECNICO = "51972268717"  # Tu numero personal

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

HEADERS_SUPABASE = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def enviar_whatsapp_texto(to, texto):
    url = f"https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages"
    payload = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": texto}}
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}", "Content-Type": "application/json"}
    requests.post(url, json=payload, headers=headers)

def enviar_whatsapp_audio(to, texto_respuesta):
    # 1. Texto a audio con gTTS
    tts = gTTS(text=texto_respuesta, lang='es')
    tts.save("/tmp/respuesta.mp3")
    # 2. Subir audio a WhatsApp
    url_media = f"https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    with open("/tmp/respuesta.mp3", "rb") as f:
        files = {"file": ("respuesta.mp3", f, "audio/mpeg"), "messaging_product": (None, "whatsapp")}
        r = requests.post(url_media, headers=headers, files=files).json()
    media_id = r.get("id")
    # 3. Enviar audio
    url = f"https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages"
    payload = {"messaging_product": "whatsapp", "to": to, "type": "audio", "audio": {"id": media_id}}
    requests.post(url, json=payload, headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}", "Content-Type": "application/json"})

def buscar_soluciones(texto):
    # Busca en tu tabla soluciones por error o modelo_pos
    url = f"{SUPABASE_URL}/rest/v1/soluciones?select=*&or=(error.ilike.*{texto}*,modelo_pos.ilike.*{texto}*,solucion.ilike.*{texto}*)&limit=5"
    r = requests.get(url, headers=HEADERS_SUPABASE)
    return r.json() if r.status_code == 200 else []

def guardar_solucion(datos):
    url = f"{SUPABASE_URL}/rest/v1/soluciones"
    r = requests.post(url, json=datos, headers=HEADERS_SUPABASE)
    return r.status_code in [200, 201]

@app.route("/webhook", methods=["GET"])
def verificar():
    if request.args.get("hub.verify_token") == VERIFY_TOKEN:
        return request.args.get("hub.challenge")
    return "Error", 403

@app.route("/webhook", methods=["POST"])
def recibir():
    data = request.get_json()
    try:
        msg = data["entry"][0]["changes"][0]["value"]["messages"][0]
        from_num = msg["from"]
        # Solo texto por ahora, audio lo vemos en paso 2
        if msg["type"] == "text":
            texto = msg["text"]["body"]
        elif msg["type"] == "audio":
            enviar_whatsapp_texto(from_num, "Recibí tu audio, estoy transcribiendo... por ahora mándame texto y te respondo con audio.")
            return jsonify({"status": "ok"}), 200
        else:
            return jsonify({"status": "ok"}), 200

        # --- SI ERES TU: GUARDAR ---
        if from_num == TECNICO:
            prompt = f"""Eres extractor. Del texto del técnico, extrae JSON para tabla soluciones con estos campos: entidad, cobertura, despliegue, error, solucion, modelo_pos, usa_wifi, usa_chip, telco_1, telco_2, app_tercera, release_app_tercera, release_pos, comercio, observaciones. Si falta un campo, pon null. Solo responde JSON, sin texto extra. Texto: {texto}"""
            resp = model.generate_content(prompt)
            txt = resp.text.replace("```json", "").replace("```", "").strip()
            datos = json.loads(txt)
            datos["fecha"] = "now()"
            if guardar_solucion(datos):
                enviar_whatsapp_audio(from_num, f"Guardado. Modelo {datos.get('modelo_pos')} error {datos.get('error')} solución {datos.get('solucion')}")
            else:
                enviar_whatsapp_texto(from_num, "Error al guardar, revisa Supabase.")
        # --- SI ES CLIENTE: CONSULTAR ---
        else:
            resultados = buscar_soluciones(texto)
            if not resultados:
                enviar_whatsapp_audio(from_num, "No tengo registrada esa falla aún, lo consulto con el técnico y te aviso.")
            else:
                contexto = str(resultados)
                prompt = f"""Eres técnico POS. Con este contexto de soluciones reales: {contexto}, responde al cliente que dijo: {texto}. Responde corto, claro, paso a paso, en español peruano. Si es error de POS, da la solución guardada."""
                resp = model.generate_content(prompt)
                enviar_whatsapp_audio(from_num, resp.text[:800])
    except Exception as e:
        print("Error:", e)
    return jsonify({"status": "ok"}), 200

@app.route("/", methods=["GET"])
def home():
    return "Bot POS Activo"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
