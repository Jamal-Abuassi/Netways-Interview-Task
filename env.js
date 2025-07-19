window.APP_CONFIG = {
  /* Azure OpenAI endpoint (no trailing slash)*/
  RESOURCE_HOST: "<YOUR_RESOURCE_ENDPOINT>",

  /* Input your region either East US2 or Sweden Central */
  REGION_HOST: "<YOUR_REGION_HOST>",            

  /* Deployment name you gave the gpt‑4o‑transcribe model */
  DEPLOYMENT: "<YOUR_DEPLOYMENT_NAME>",        

  /* Azure KEY 1          */
  API_KEY: "<YOUR_API_KEY>",

  /* Server VAD: how long the mic must be silent (ms) before
     Azure closes the current speech */
  VAD_SILENCE_MS: 300



  // It means how long must the Mic be silent before the server decides the speech is finished.
  //Lower the value for faster captions, but words might be split.
  // Increase the value for higher accuracy, at the cost of millisecond difference
};

/* derived URLs to use the latest api version (leave unchanged) */
window.APP_CONFIG.SESSIONS_URL =
  `${window.APP_CONFIG.RESOURCE_HOST}/openai/realtimeapi/transcription_sessions` +
  `?api-version=2025-04-01-preview`;

window.APP_CONFIG.WEBRTC_URL =
  `https://${window.APP_CONFIG.REGION_HOST}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;