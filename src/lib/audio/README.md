# Pipeline de grabaciones

Implementa `docs/ARCHITECTURE.md` §6. Todo el trabajo pesado de audio ocurre en el **navegador**; el servidor sólo
transcribe y genera texto, de a **un paso por request**.

## 1. Navegador (`src/lib/audio/`)

`prepareAudioChunks(file, { onProgress, signal })`:

1. `decodeAudioData` (Web Audio) → cubre MP3, M4A/AAC, WAV, WebM, OGG/Opus y la pista de audio de MP4/WebM.
   Si el navegador no puede decodificar (códec no soportado, archivo dañado) lanza `AudioPrepareError` con un mensaje útil.
2. Downmix a **mono** + resample a **16 kHz** con `OfflineAudioContext` (todo lo que Whisper necesita).
3. Codificación **MP3 32 kbps** con `@breezystack/lamejs` (`mp3-encode.ts`) dentro de un **Web Worker**
   (`compress.worker.ts`, creado con `new Worker(new URL(...), import.meta.url)`). Si el worker no puede crearse o falla
   (CSP, memoria), se reintenta en el hilo principal cediendo el hilo cada 32 bloques.
4. Particionado en chunks de **≤ 600 s** (`chunking.ts → planChunks`): reparte parejo para evitar un último chunk de
   pocos segundos; cada chunk conoce su `startSeconds`/`durationSeconds` exactos (muestras / 16 000).

Resultado típico: 1 h de clase ≈ **14 MB** (vs 100–200 MB del original). El uploader muestra "de X MB a Y MB".

## 2. Subida (`src/components/recordings/recording-uploader.tsx`)

- Inserta `class_recordings` (status `uploaded`, `chunks_total`, id generado en el cliente) con el browser client (RLS:
  docente del curso).
- Sube cada parte a `class-recordings/{recordingId}/chunk-{i}.mp3` y hace upsert de `recording_chunks`.
- Llama en bucle a `POST /api/recordings/{id}/step` (`pipeline.ts → runPipeline`): backoff exponencial ante 5xx/red,
  máximo 5 fallos seguidos, 4xx aborta. Realtime sobre `class_recordings` refleja el progreso aunque se recargue la página;
  desde la lista se puede **reanudar** un procesamiento pausado o fallido.

## 3. Servidor (`src/app/api/recordings/[recordingId]/step/route.ts`)

State machine idempotente (un paso por POST, < 60 s de trabajo):

| status | qué hace el paso | progress |
|---|---|---|
| `uploaded` / `transcribing` | transcribe **el primer chunk pendiente** (descarga de Storage → `transcribeChunk`) | 10 → 70 |
| `processing` | concatena segmentos (offset ya aplicado) en `transcripts` | 72 |
| `generating` | un sub-paso por request: `summary` → `cards` → `simplified_facil` → `simplified_intermedio` | 75 → 94 |
| `ready` | — | 100 |
| `error` | el siguiente POST reanuda desde el paso que falló (`current_step`) | — |

Errores: `status='error'`, `error_message`, entrada en `processing_log` `[{at, step, message}]`. 422 para errores no
reintentables (subida incompleta, audio sin voz).

## 4. Transcripción (`src/lib/ai/transcribe.ts`)

Primario: `openrouter.audio.transcriptions.create` (`MODELS.transcription`, `verbose_json`, `language: 'es'`).
Fallback automático si falla: chat completion a `MODELS.audio` con `input_audio` base64 pidiendo
`{segments:[{start,end,text}]}` validado con zod. El proveedor usado queda en `class_recordings.transcription_model`.

## 5. Generación (`src/lib/ai/generate.ts` + `prompts/`)

`generateSummary` / `generateCards` / `generateSimplified` con `chatJSON` (zod). Transcripciones > 60 000 caracteres
pasan por map-reduce (`condenseTranscript`: notas por tramo con `MODELS.fast`, luego consolidación).

## Límites

- **Whisper: 25 MB por archivo.** A 32 kbps, 10 min ≈ 2,4 MB, con margen amplio.
- Chunk ≤ 600 s para que transcripción + escritura entren cómodos en un request (Vercel `maxDuration` 300 s).
- Archivo original ≤ 2 GB (debe caber decodificado en memoria del navegador: ~115 MB por hora a 16 kHz mono float32,
  pero la decodificación intermedia usa la tasa original, p. ej. 48 kHz estéreo ≈ 1,3 GB/h; en celulares conviene subir
  audio, no video).
- El borrado de Storage se hace con el service role en una Server Action (no hay policy de delete para el bucket).
