import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/pipeline';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';

const VIDEOS_DIR = path.join(process.cwd(), 'download', 'videos');

function splitText(text: string, max = 900): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length <= max) { current += s; }
    else { if (current) chunks.push(current.trim()); current = s; }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text, sceneId, voice = 'jam', speed = 1.0 } = await req.json();
    if (!text || !sceneId) {
      return NextResponse.json({ success: false, error: 'Missing text or sceneId' }, { status: 400 });
    }

    await mkdir(VIDEOS_DIR, { recursive: true });
    const zai = await getZAI();

    const validVoices = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'];
    const v = validVoices.includes(voice) ? voice : 'jam';

    const chunks = text.length > 1024 ? splitText(text) : [text];
    const allBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const response = await zai.audio.tts.create({
        input: chunks[i], voice: v, speed,
        response_format: 'mp3', stream: false,
      });
      const arrayBuffer = await (response as any).arrayBuffer();
      const buffer = Buffer.from(new Uint8Array(arrayBuffer));
      if (buffer.length > 500) allBuffers.push(buffer);
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    if (allBuffers.length === 0) {
      return NextResponse.json({ success: false, error: 'TTS produced no audio' });
    }

    const voicePath = path.join(VIDEOS_DIR, sceneId, 'voice.mp3');
    await mkdir(path.dirname(voicePath), { recursive: true });
    await writeFile(voicePath, Buffer.concat(allBuffers));

    return NextResponse.json({
      success: true,
      voiceUrl: `/api/serve?file=${sceneId}/voice.mp3`,
      size: Buffer.concat(allBuffers).length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}