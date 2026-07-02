import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateAdScript,
  generateSceneImage,
  generateVoiceover,
} from '@/lib/pipeline';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const VIDEOS_DIR = path.join(process.cwd(), 'download', 'videos');
const DOWNLOAD_DIR = path.join(process.cwd(), 'download');

export async function GET() {
  const videos = await db.video.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const processing = videos.filter((v) =>
    ['generating_script', 'generating_images', 'generating_voiceover', 'assembling'].includes(v.status)
  ).length;
  const completed = videos.filter((v) => v.status === 'complete').length;
  const failed = videos.filter((v) => v.status === 'failed').length;

  return NextResponse.json({
    status: processing > 0 ? 'running' : 'idle',
    processing,
    completed,
    failed,
    total: videos.length,
    recentVideos: videos,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product, style, voiceName = 'jam', voiceSpeed = 1.0, category, audience, sellingPoint, tone, targetDuration } = body;

    if (!product || product.trim().length < 3) {
      return NextResponse.json({ success: false, error: 'Product/name is required' }, { status: 400 });
    }

    await mkdir(VIDEOS_DIR, { recursive: true });

    // Check if already processing
    const active = await db.video.findMany({
      where: { status: { in: ['generating_script', 'generating_images', 'generating_voiceover', 'assembling'] } },
    });
    if (active.length > 0) {
      return NextResponse.json({ success: false, error: 'Already generating an ad', currentVideo: active[0] });
    }

    const video = await db.video.create({
      data: {
        title: `Ad: ${product}`,
        hook: '',
        script: '',
        images: '[]',
        status: 'generating_script',
        sourceTitle: product,
      },
    });

    // Run pipeline in background (fire and forget)
    runPipeline(video.id, product, style, voiceName, voiceSpeed, category, audience, sellingPoint, tone, targetDuration).catch((err) => {
      console.error('[Pipeline] Fatal error:', err);
    });

    return NextResponse.json({ success: true, videoId: video.id, message: 'Ad generation started' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────

async function runPipeline(
  videoId: string,
  product: string,
  style: string | undefined,
  voiceName: string,
  voiceSpeed: number,
  category?: string,
  audience?: string,
  sellingPoint?: string,
  tone?: string,
  targetDuration?: number,
) {
  const workDir = path.join(VIDEOS_DIR, videoId);
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Generate script
    console.log(`[Pipeline] Step 1: Generating ad script for "${product}"`);
    const script = await generateAdScript(
      product,
      style || undefined,
      { category, audience, sellingPoint, tone, targetDuration: targetDuration ? parseInt(String(targetDuration)) : undefined }
    );
    console.log(`[Pipeline] Script: "${script.title}" — ${script.scenes.length} scenes, ${script.duration}s`);

    await db.video.update({
      where: { id: videoId },
      data: {
        title: script.title,
        hook: script.hook,
        script: script.script,
        duration: script.duration,
        status: 'generating_images',
      },
    });

    // 2. Generate AI images for each scene
    console.log(`[Pipeline] Step 2: Generating ${script.scenes.length} cinematic images`);
    const sceneImages: (string | null)[] = [];
    const imageUrls: { url: string }[] = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const imgPath = path.join(workDir, `scene_${i}.png`);
      const ok = await generateSceneImage(script.scenes[i].imagePrompt, imgPath);
      sceneImages.push(ok ? imgPath : null);
      if (ok) {
        imageUrls.push({ url: `/api/serve?file=${videoId}/scene_${i}.png` });
      }
      // Small delay to not hammer the API
      if (i < script.scenes.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const validImageCount = sceneImages.filter(Boolean).length;
    console.log(`[Pipeline] Generated ${validImageCount}/${script.scenes.length} images`);

    await db.video.update({
      where: { id: videoId },
      data: { images: JSON.stringify(imageUrls), status: 'generating_voiceover' },
    });

    // 3. Generate voiceover
    console.log(`[Pipeline] Step 3: Generating voiceover (voice=${voiceName})`);
    let voiceoverPath: string | null = null;
    let hasAudio = false;

    try {
      const audioBuffer = await generateVoiceover(script.script, voiceName, voiceSpeed);
      voiceoverPath = path.join(DOWNLOAD_DIR, `${videoId}_voiceover.mp3`);
      await writeFile(voiceoverPath, audioBuffer);
      hasAudio = true;
      console.log(`[Pipeline] Voiceover: ${audioBuffer.length} bytes`);
    } catch (err: any) {
      console.log(`[Pipeline] Voiceover failed: ${err.message} — continuing without audio`);
    }

    // 4. Assemble video
    console.log(`[Pipeline] Step 4: Assembling cinematic video`);
    await db.video.update({ where: { id: videoId }, data: { status: 'assembling' } });

    const outputPath = await assembleCinematicVideo(
      workDir, videoId, script, sceneImages, voiceoverPath
    );

    await db.video.update({
      where: { id: videoId },
      data: {
        videoPath: outputPath,
        videoUrl: `/api/serve?file=${videoId}.mp4`,
        voiceoverUrl: hasAudio ? `/api/serve?file=${videoId}_voiceover.mp3` : null,
        voiceoverPath: voiceoverPath,
        status: 'complete',
        duration: script.duration,
      },
    });

    console.log(`[Pipeline] Done: ${videoId}`);
  } catch (error: any) {
    console.error(`[Pipeline] Error: ${error.message}`);
    await db.video.update({
      where: { id: videoId },
      data: { status: 'failed', error: error.message },
    });
  }
}

// ─── CINEMATIC VIDEO ASSEMBLY ─────────────────────────────────────
// For each scene: zoompan on the AI image → create a .ts segment
// Then concat all segments + add audio

async function assembleCinematicVideo(
  workDir: string,
  videoId: string,
  script: { scenes: { text: string; imagePrompt: string; overlayText: string; duration: number; camera: string }[]; hook: string; duration: number },
  sceneImages: (string | null)[],
  voiceoverPath: string | null
): Promise<string> {
  const outputPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);
  const segments: string[] = [];
  const fps = 24; // 24fps to save memory with zoompan

  // Camera movement expressions — scale image down first to 720x1280, then zoompan to 1080x1920
  const cameraEffects: Record<string, string> = {
    zoom_in:  `scale=720:1280,zoompan=z='min(zoom+0.002,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={D}:s=1080x1920:fps=${fps}`,
    zoom_out: `scale=720:1280,zoompan=z='if(eq(on,1),1.5,max(zoom-0.002,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={D}:s=1080x1920:fps=${fps}`,
    pan_left:  `scale=720:1280,zoompan=z='1.3':x='if(eq(on,1),iw,iw-max(iw*(on-1)/{D},0))':y='(ih-ih/zoom)/2':d={D}:s=1080x1920:fps=${fps}`,
    pan_right: `scale=720:1280,zoompan=z='1.3':x='max(iw*(on-1)/{D},0)':y='(ih-ih/zoom)/2':d={D}:s=1080x1920:fps=${fps}`,
    static:    `scale=720:1280,zoompan=z='1.0':d={D}:s=1080x1920:fps=${fps}`,
  };

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const imgPath = sceneImages[i];

    if (!imgPath) {
      console.log(`[Assembly] Scene ${i}: no image, skipping`);
      continue;
    }

    const durationSec = Math.max(3, scene.duration || 4);
    const durationFrames = durationSec * fps;
    const segPath = path.join(workDir, `seg_${i}.ts`);

    // Pick camera effect
    const camType = cameraEffects[scene.camera] ? scene.camera : 'zoom_in';
    const baseFilter = cameraEffects[camType].replace(/{D}/g, String(durationFrames));

    // Text overlay (big impact text)
    const overlayText = (scene.overlayText || '').replace(/'/g, "'\\''").replace(/:/g, '\\:').substring(0, 40);
    const textFilter = overlayText
      ? `,drawtext=text='${overlayText}':fontsize=38:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-tw)/2:y=h*0.72-th/2:enable='between(t,0.3,${(durationSec - 0.5).toFixed(1)})'`
      : '';

    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-loop', '1',
        '-i', imgPath,
        '-vf', baseFilter + textFilter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-t', String(durationSec),
        '-an',
        '-f', 'mpegts',
        segPath,
      ], { timeout: 90000 });

      segments.push(segPath);
      console.log(`[Assembly] Scene ${i}: ${camType}, ${durationSec}s ✓`);
    } catch (err: any) {
      console.log(`[Assembly] Scene ${i} failed: ${err.message}`);
    }
  }

  if (segments.length === 0) {
    throw new Error('No video segments could be created');
  }

  console.log(`[Assembly] ${segments.length} segments ready, finalizing...`);

  // Concat segments + add audio
  if (segments.length === 1) {
    // Single segment
    if (voiceoverPath) {
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', segments[0],
        '-i', voiceoverPath,
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 60000 });
    } else {
      await execFileAsync('ffmpeg', [
        '-y', '-i', segments[0],
        '-c:v', 'copy',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 60000 });
    }
  } else {
    // Multiple segments — concat
    const concatContent = segments.map(s => `file '${s}'`).join('\n');
    const concatPath = path.join(workDir, 'concat.txt');
    await writeFile(concatPath, concatContent);

    if (voiceoverPath) {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-i', voiceoverPath,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 120000 });
    } else {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-an',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 120000 });
    }
  }

  // Cleanup temp segments
  for (const seg of segments) {
    try { await unlink(seg); } catch {}
  }
  try { await unlink(path.join(workDir, 'concat.txt')); } catch {}

  console.log(`[Assembly] Final video: ${outputPath}`);
  return outputPath;
}