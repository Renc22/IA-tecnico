const SUPABASE_URL = "https://nlynbrrrybgufwmcjhmu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JtRhd51yYCWEEfHCs50Cjw_RSS-_kAu";

const TEXTO_BUSCANDO = "un momento";
const TITULO_INICIAL = "¿En qué te ayudo?";
const SUBTITULO_INICIAL = "Selecciona, escribe o envíame un audio";
const TITULO_PLANTILLAS = "Plantillas y Fotos";

const MENSAJES_ASISTENTE = {
  inicio: "Hola!",
  plantilla: "Elige una opción para buscar la info",
  contometro: "Revisa los datos para liquidación de Contómetro",
  ot: "Escribe el número de OT para continuar",
  carga: "Indica el comercio o modelo de POS para la carga",
  release: "Indica el comercio para revisar su Reléase",
  problema: "Describe la falla o error que presenta el POS",
  guia: "Indica el comercio o modelo de POS para la guía",
  buscando: "Buscando la información solicitada",
  respuesta: "Consulta completada"
};

const SALUDOS_ALEATORIOS = [
  "¡Hola! ¿Qué tal?",
  "¡Hey! ¿Todo bien por ahí?",
  "¡Qué tal! Por aquí ando",
  "¿Cómo va todo?",
  "Tienes tiempo libre eh!",
  "¡Hola! Soy Makybot!",
  "¿Quieres saber la hora?",
  "¿Todo bien en el trabajo?",
  "Soy la mejor IA",
  "Pronto es hora de comer",
  "¿Te ayudo?",
  "¿Qué cuentas?",
  "¿Ya aprendiste?",
  "No te cansas eh!",
  "Iré a jugar",
  "¡Hola! ¿Cómo va todo?"
];

const AVISOS_ALEATORIOS = [
  "Aquí estoy si necesitas revisar algo.",
  "Cuando quieras, elige una opción.",
  "Todo listo para continuar.",
  "Tengo todas las herramientas",
  "Aprendo muy rápido",
  "Confundido?",
  "¿Revisamos alguna OT o guía?"
];

const PROBABILIDAD_SALUDO = 0.22;

const chat = document.getElementById('chat');
const chatScroll = document.getElementById('chat-scroll');
const promptHint = document.getElementById('prompt-hint');
const audioBlockedNotice = document.getElementById('audio-blocked-notice');
const suggestionsGrid = document.getElementById('suggestions-grid');
const liquidacionPanel = document.getElementById('liquidacion-panel');
const otBox = document.getElementById('ot-box');
const welcomeHeading = document.getElementById('welcome-heading');
const welcomeSubtitle = document.getElementById('welcome-subtitle');
const assistantBubble = document.getElementById('assistant-bubble');
const assistantAvatarBtn = document.getElementById('assistant-avatar-btn');

let audioCheckTimer = null;
let ultimoMensajeAleatorio = "";

const ACCIONES_BOTONES = {
  carga: {
    texto: "Carga ",
    aviso: "Ejemplo: Carga A910 Ripley",
    mensajeAsistente: MENSAJES_ASISTENTE.carga
  },
  release: {
    texto: "Reléase ",
    aviso: "Ejemplo: Versión Lane7000 Saga",
    mensajeAsistente: MENSAJES_ASISTENTE.release
  },
  problema: {
    texto: "Problema ",
    aviso: "Ejemplo: Problema Código 89",
    mensajeAsistente: MENSAJES_ASISTENTE.problema
  },
  guia: {
    texto: "Guia ",
    aviso: "Guía Aruma P10",
    mensajeAsistente: MENSAJES_ASISTENTE.guia
  }
};

function setMensajeAsistente(texto) {
  if (!assistantBubble) return;

  assistantBubble.innerHTML = "";
  const spanTexto = document.createElement("span");
  spanTexto.className = "assistant-text-anim";
  spanTexto.textContent = texto;
  assistantBubble.appendChild(spanTexto);

  assistantBubble.classList.remove("message-anim");
  void assistantBubble.offsetWidth;
  assistantBubble.classList.add("message-anim");

  if (assistantAvatarBtn) {
    assistantAvatarBtn.classList.remove("speaking-anim");
    void assistantAvatarBtn.offsetWidth;
    assistantAvatarBtn.classList.add("speaking-anim");
  }
}


function elegirSinRepetir(lista) {
  if (!lista.length) return "";
  if (lista.length === 1) return lista[0];
  const candidatas = lista.filter(item => item !== ultimoMensajeAleatorio);
  const elegida = candidatas[Math.floor(Math.random() * candidatas.length)];
  ultimoMensajeAleatorio = elegida;
  return elegida;
}

function accionAleatoriaAsistente() {
  const debeSaludar = Math.random() < PROBABILIDAD_SALUDO;
  const mensaje = debeSaludar
    ? elegirSinRepetir(SALUDOS_ALEATORIOS)
    : elegirSinRepetir(AVISOS_ALEATORIOS);
  setMensajeAsistente(mensaje);
}

function asegurarBotonFlechaOT() {
  if (!otBox || document.getElementById('ot-search-btn')) return;
  const btnFlecha = document.createElement('button');
  btnFlecha.id = 'ot-search-btn';
  btnFlecha.type = 'button';
  btnFlecha.className = 'ot-search-btn';
  btnFlecha.title = 'Buscar por número de OT';
  btnFlecha.setAttribute('aria-label', 'Buscar por número de OT');
  btnFlecha.textContent = '→';
  btnFlecha.onclick = buscarPorOT;
  otBox.appendChild(btnFlecha);
}

function buscarPorOT() {
  const otInput = document.getElementById('ot-input');
  const valorOT = otInput ? otInput.value.trim() : "";
  ocultarAvisoIndicacion();
  ocultarAvisoAudioBloqueado();
  hablarUnMomento();

  if (!valorOT) {
    setMensajeAsistente(MENSAJES_ASISTENTE.ot);
    if (otInput) otInput.focus();
    return;
  }

  setMensajeAsistente(`Buscando OT ${valorOT}`);
}

function mostrarAvisoAudioBloqueado(mensaje = "El navegador bloqueó o no pudo reproducir el audio automáticamente.") {
  audioBlockedNotice.textContent = mensaje;
  audioBlockedNotice.style.display = "block";
}

function ocultarAvisoAudioBloqueado() {
  audioBlockedNotice.style.display = "none";
}

function mostrarAvisoIndicacion(textoAviso) {
  promptHint.textContent = textoAviso;
  promptHint.style.display = "block";
}

function ocultarAvisoIndicacion() {
  promptHint.style.display = "none";
  promptHint.textContent = "";
}

function mostrarSugerenciasPrincipales() {
  if (welcomeHeading) welcomeHeading.textContent = TITULO_INICIAL;
  if (welcomeSubtitle) {
    welcomeSubtitle.textContent = SUBTITULO_INICIAL;
    welcomeSubtitle.style.display = "block";
  }
  if (suggestionsGrid) {
    suggestionsGrid.style.display = "grid";
  }
  if (liquidacionPanel) {
    liquidacionPanel.style.display = "none";
  }
}

function abrirOpcionesPlantilla() {
  if (welcomeHeading) welcomeHeading.textContent = TITULO_PLANTILLAS;
  if (welcomeSubtitle) welcomeSubtitle.style.display = "none";
  if (suggestionsGrid) suggestionsGrid.style.display = "none";
  if (liquidacionPanel) liquidacionPanel.style.display = "flex";

  asegurarBotonFlechaOT();

  const otInput = document.getElementById('ot-input');
  if (otInput) otInput.focus();

  setMensajeAsistente(MENSAJES_ASISTENTE.plantilla);
}

function seleccionarContometro() {
  const otInput = document.getElementById('ot-input');
  if (otInput) otInput.focus();
  setMensajeAsistente(MENSAJES_ASISTENTE.contometro);
}

function actualizarMensajePorOT(valor) {
  const limpio = String(valor || "").trim();
  if (limpio) {
    setMensajeAsistente(`OT ingresada: ${limpio}`);
  } else {
    setMensajeAsistente(MENSAJES_ASISTENTE.ot);
  }
}

function ocultarBienvenida() {
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.style.display = 'none';
}

function limpiarChat() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  clearTimeout(audioCheckTimer);
  ocultarAvisoIndicacion();
  ocultarAvisoAudioBloqueado();
  mostrarSugerenciasPrincipales();

  const otInput = document.getElementById('ot-input');
  if (otInput) otInput.value = "";

  const filas = chat.querySelectorAll('.msg-row');
  filas.forEach(f => f.remove());
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.style.display = 'flex';

  setMensajeAsistente(MENSAJES_ASISTENTE.inicio);
}

function prepararBoton(clave) {
  const config = ACCIONES_BOTONES[clave];
  if (!config) return;

  mostrarSugerenciasPrincipales();

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  clearTimeout(audioCheckTimer);
  ocultarAvisoAudioBloqueado();

  mostrarAvisoIndicacion(config.aviso);
  setMensajeAsistente(config.mensajeAsistente);
}

function agregar(texto, tipo) {
  ocultarBienvenida();

  const row = document.createElement('div');
  row.className = 'msg-row ' + tipo;

  const wrap = document.createElement('div');
  wrap.className = 'msg-content-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = texto;
  wrap.appendChild(bubble);

  if (tipo === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const btnCopiar = document.createElement('button');
    btnCopiar.type = 'button';
    btnCopiar.className = 'action-btn';
    btnCopiar.textContent = '📋 Copiar';
    btnCopiar.onclick = () => {
      navigator.clipboard.writeText(texto);
      btnCopiar.textContent = '✓ Copiado';
      setTimeout(() => btnCopiar.textContent = '📋 Copiar', 1500);
    };

    actions.appendChild(btnCopiar);
    wrap.appendChild(actions);

    setMensajeAsistente(MENSAJES_ASISTENTE.respuesta);
  }

  row.appendChild(wrap);
  chat.appendChild(row);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return row;
}

function hablarUnMomento() {
  clearTimeout(audioCheckTimer);
  ocultarAvisoAudioBloqueado();

  if (!("speechSynthesis" in window)) {
    mostrarAvisoAudioBloqueado("Este navegador no soporta reproducción de audio.");
    return;
  }

  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(TEXTO_BUSCANDO);
  u.lang = 'es-PE';
  u.rate = 1;

  let inicioDetectado = false;

  u.onstart = () => {
    inicioDetectado = true;
    ocultarAvisoAudioBloqueado();
  };

  u.onerror = (e) => {
    if (!inicioDetectado) {
      const detalle = e?.error ? ` (${e.error})` : "";
      mostrarAvisoAudioBloqueado(`Audio bloqueado o no disponible${detalle}.`);
    }
  };

  try {
    speechSynthesis.speak(u);
  } catch (err) {
    mostrarAvisoAudioBloqueado("El navegador bloqueó la reproducción de audio.");
    return;
  }

  audioCheckTimer = setTimeout(() => {
    if (!inicioDetectado && !speechSynthesis.speaking && !speechSynthesis.pending) {
      mostrarAvisoAudioBloqueado("El navegador bloqueó o detuvo la reproducción de audio.");
    }
  }, 450);
}

window.addEventListener("DOMContentLoaded", () => {
  setMensajeAsistente(MENSAJES_ASISTENTE.inicio);
});
  
