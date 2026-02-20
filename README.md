# duk-ai-quiz-frontend

A minimal Next.js 15 (App Router) frontend scaffold for an AI quiz system.

## Tech stack

- Next.js 15.x
- TypeScript
- ESLint
- Tailwind CSS

## Routes

- `/admin`
- `/display`
- `/team`

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Define these in `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL` - Base URL for the quiz API.
- `NEXT_PUBLIC_DEFAULT_SESSION_ID` - Default session id for team and display flows.
- `ADMIN_SECRET` - Secret required for admin API routes.
- `NEXT_PUBLIC_GEMINI_API_KEY` - Gemini key used for text commentary generation.
- `NEXT_PUBLIC_GEMINI_API_KEY_2` - Optional Gemini fallback key.
- `ELEVENLABS_API_KEY` - ElevenLabs API key used for voice generation.
- `ELEVENLABS_BASE_URL` - Optional ElevenLabs API base URL override.
- `ELEVENLABS_VOICE_ID` - Voice id for generated host speech.
- `ELEVENLABS_MODEL_ID` - TTS model id (for example `eleven_flash_v2_5`).
- `ELEVENLABS_OUTPUT_FORMAT` - Audio format (for example `mp3_44100_128`).

See `.env.example` for defaults.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run start` - Run production server
- `npm run lint` - Run ESLint
