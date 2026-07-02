import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/pipeline';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const VIDEOS_DIR = path.join(process.cwd(), 'download', 'videos');

export async function POST(req: NextRequest) {
  try {
    const { prompt, sceneId } = await req.json();
    if (!prompt || !sceneId) {
      return NextResponse.json({ success: false, error: 'Missing prompt or sceneId' }, { status: 400 });
    }

    await mkdir(VIDEOS_DIR, { recursive: true });
    const zai = await getZAI();

    const response = await zai.images.generations.create({
      prompt: `Cinematic advertisement frame: ${prompt}. Cinematic lighting, photorealistic, 8k quality, professional commercial photography`,
      size: '768x1344',
    });

    const base64 = response.data?.[0]?.base64;
    if (!base64) {
      return NextResponse.json({ success: false, error: 'No image returned' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const imgPath = path.join(VIDEOS_DIR, sceneId, 'scene.png');
    await mkdir(path.dirname(imgPath), { recursive: true });
    await writeFile(imgPath, buffer);

    return NextResponse.json({
      success: true,
      imageUrl: `/api/serve?file=${sceneId}/scene.png`,
      size: buffer.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}