import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Serve files from download/videos (including subdirectories like videoId/scene_0.png)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  // Allow alphanumeric, slashes, underscores, hyphens, dots (for subdirectory paths)
  if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(file)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // Prevent directory traversal
  const resolved = path.resolve(path.join(process.cwd(), 'download', 'videos', file));
  const videosDir = path.resolve(path.join(process.cwd(), 'download', 'videos'));
  if (!resolved.startsWith(videosDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const { statSync, readFileSync } = await import('fs');
    statSync(resolved);

    const buffer = readFileSync(resolved);
    const ext = file.split('.').pop();
    const contentTypes: Record<string, string> = {
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${file.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}