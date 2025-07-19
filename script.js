/*  - Captures mic audio, streams it to Azure via WebRTC          */
/*  - Receives live GPT‑4o‑transcribe events (delta / completed)  */
/*  - Updates the DOM in real‑time                                */

/* ---------- config values injected by env.js ------------------ */
const {
  SESSIONS_URL,     
  WEBRTC_URL,       
  DEPLOYMENT,       
  API_KEY,      
  VAD_SILENCE_MS  
} = window.APP_CONFIG;

/* ---------- grab DOM handles once ----------------------------- */
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const transcript = document.getElementById("transcript");
const log        = document.getElementById("log");

/* WebRTC objects (filled later) */
let pc;           // RTCPeerConnection
let dc;           // RTCDataChannel (JSON control traffic)
let stream;       // MediaStream from the mic

startBtn.onclick = startRTC;
stopBtn .onclick = stopRTC;


/*  1.   create session  →  build peer connection        */
/* ============================================================== */
async function startRTC() {
  /* basic UI state */
  startBtn.disabled = true;
  stopBtn.disabled  = false;
  transcript.textContent = "";
  log.textContent        = "";

  /* 1.1  Create a *transcription session* to get the bearer token */
  const sessRes = await fetch(SESSIONS_URL, {
    method: "POST",
    headers: { "api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      input_audio_format: "pcm16",
      /* prompt prevents Whisper‑style auto‑translation */
      input_audio_transcription: {
        model: DEPLOYMENT,
        prompt:
          "Return the transcript exactly as spoken in the original script. Do not translate."
        /* language omitted → auto‑detect */
      },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: VAD_SILENCE_MS   // e.g., 300 ms
      }
    })
  });

  if (!sessRes.ok) {
    logMsg(`❌ Session error ${sessRes.status}: ${await sessRes.text()}`);
    resetUI();
    return;
  }
  /* bearer token used for the upcoming SDP POST */
  const { client_secret: { value: token } } = await sessRes.json();
  logMsg("Session OK ✔︎");

  /* 1.2  Build RTCPeerConnection + DataChannel ------------------ */
  pc = new RTCPeerConnection();
  dc = pc.createDataChannel("control");          // small JSON payloads only

  /* Add microphone track (browser encodes Opus) */
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(stream.getAudioTracks()[0]);

  /* 1.3  SDP offer/answer via Azure ----------------------------- */
  await pc.setLocalDescription(await pc.createOffer());

  const sdpResp = await fetch(
    `${WEBRTC_URL}?intent=transcription&deployment=${DEPLOYMENT}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,         // from step 1.1
        "Content-Type": "application/sdp"
      },
      body: pc.localDescription.sdp
    }
  );

  if (!sdpResp.ok) {
    logMsg(`❌ SDP error ${sdpResp.status}: ${await sdpResp.text()}`);
    resetUI();
    return;
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await sdpResp.text() });

  /* 1.4  Wire DataChannel callbacks ----------------------------- */
  dc.onopen = () => {
    logMsg("DC open ✔︎");
    /* tell Azure we only tweak VAD/format now */
    dc.send(
      JSON.stringify({
        type: "transcription_session.update",
        session: {
          input_audio_format: "pcm16",
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: VAD_SILENCE_MS
          }
        }
      })
    );
  };

  dc.onmessage = (evt) => handleServerEvent(JSON.parse(evt.data));
  dc.onerror   = (e)   => logMsg(`❌ DC error: ${e.message}`);
  dc.onclose   = ()    => logMsg("DC closed");
}



/*  2.  Handle incoming server events                             */
/* ============================================================== */
function handleServerEvent(ev) {
  switch (ev.type) {
    case "conversation.item.input_audio_transcription.delta":
      transcript.textContent += ev.delta;          // provisional text
      break;

    case "conversation.item.input_audio_transcription.completed":
      if (ev.transcript)
        transcript.textContent += ev.transcript + "\n";  // final line break
      break;

    case "error":
      logMsg(`❌ Server: ${ev.error.message}`);
      break;
  }
  /* light console in the Debug log */
  logMsg(ev.type);
}





/*  3.  Tear‑down / reset                                         */
/* ============================================================== */
function stopRTC() {
  dc?.close();
  pc?.close();
  stream?.getTracks().forEach(t => t.stop());
  resetUI();
  logMsg("Stopped.");
}

/* helpers ------------------------------------------------------- */
function resetUI() {
  startBtn.disabled = false;
  stopBtn.disabled  = true;
}

function logMsg(msg) {
  log.textContent += `${new Date().toLocaleTimeString()}  ${msg}\n`;
}