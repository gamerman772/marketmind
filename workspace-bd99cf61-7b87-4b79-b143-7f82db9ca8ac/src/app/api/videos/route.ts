import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/videos - list all videos
export async function GET() {
  const videos = await db.video.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(videos);
}

// DELETE /api/video - delete a video
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await db.video.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// POST /api/videos/regenerate - regenerate a failed video
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { videoId, field } = body;

  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  // Reset to the appropriate stage
  const statusMap: Record<string, string> = {
    script: 'generating_script',
    voiceover: 'generating_voiceover',
    screenshots: 'capturing_screenshots',
    full: 'generating_script',
  };

  await db.video.update({
    where: { id: videoId },
    data: { status: statusMap[field] || 'generating_script', error: null },
  });

  return NextResponse.json({ success: true });
}
