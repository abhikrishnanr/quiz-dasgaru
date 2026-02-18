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
- `NEXT_PUBLIC_APP_NAME` - Optional display name for the frontend.

See `.env.example` for defaults.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run start` - Run production server
- `npm run lint` - Run ESLint
