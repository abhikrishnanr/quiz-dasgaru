import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    const { questionText } = (await request.json()) as { questionText?: string };
    if (!questionText?.trim()) {
      return NextResponse.json({ message: 'questionText is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ message: 'GEMINI_API_KEY is not configured on server' }, { status: 500 });
    }

    const genAi = new GoogleGenAI({ apiKey });
    const prompt = `Answer the following quiz question in 2 to 5 lines, plain text only, no markdown, no heavy bullets. If uncertain, say so briefly.\n\nQuestion: ${questionText}`;

    const response = await genAi.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    const answerText = response.text?.trim() || 'I am not fully sure, but I could not generate a reliable answer right now.';
    return NextResponse.json({ answerText });
  } catch (error: any) {
    console.error('[ASK_AI] Failed to generate answer:', error?.message || error);
    return NextResponse.json({ message: 'Failed to generate ask-ai answer' }, { status: 500 });
  }
}
