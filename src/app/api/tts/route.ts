import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
};

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const REQUIRED_VOICE_NAME = 'Anjura';

const CACHE_DIR = path.join(process.cwd(), '.tts-cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let cachedVoiceId: string | null = process.env.ELEVENLABS_VOICE_ID || null;

async function resolveVoiceId(): Promise<string> {
  if (cachedVoiceId) {
    return cachedVoiceId;
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY || '',
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to fetch voices: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as { voices?: ElevenLabsVoice[] };
  const matched = payload.voices?.find(
    (voice) => voice.name.toLowerCase() === REQUIRED_VOICE_NAME.toLowerCase(),
  );

  if (!matched?.voice_id) {
    throw new Error(`ElevenLabs voice not found: ${REQUIRED_VOICE_NAME}`);
  }

  cachedVoiceId = matched.voice_id;
  return matched.voice_id;
}

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'Missing ELEVENLABS_API_KEY environment variable.' },
        { status: 500 },
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const hash = crypto
      .createHash('md5')
      .update(`${text}:${REQUIRED_VOICE_NAME}:${ELEVENLABS_MODEL_ID}`)
      .digest('hex');
    const filename = `${hash}.mp3`;
    const filePath = path.join(CACHE_DIR, filename);

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': fileBuffer.length.toString(),
          'X-Cache': 'HIT',
        },
      });
    }

    const voiceId = await resolveVoiceId();

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
        output_format: 'mp3_44100_128',
      }),
    });

    if (!ttsResponse.ok) {
      const details = await ttsResponse.text();
      return NextResponse.json(
        {
          error: 'ElevenLabs TTS generation failed',
          details,
        },
        { status: ttsResponse.status || 500 },
      );
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    fs.writeFileSync(filePath, audioBuffer);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'X-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error?.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
