import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const TEXT_MODEL = 'gemini-2.5-flash';

export async function POST(request: Request) {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Server AI key not configured.' }, { status: 500 });
  }

  const body = (await request.json()) as {
    prompt?: string;
    teamName?: string;
    isCorrect?: boolean;
    points?: number;
  };

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  try {
    const client = new GoogleGenAI({ apiKey: key });
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) {
      return NextResponse.json({ error: 'Empty commentary response.' }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json({ error: 'Commentary request failed.', details: String(error) }, { status: 500 });
  }
}
