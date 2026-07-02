import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const VIDEOS_DIR = path.join(process.cwd(), 'download', 'videos');

// Scene type matching the frontend
interface ExportScene {
  id: string;
  voiceScript: string;
  imagePrompt: string;
  imageUrl?: string;
  overlayText: string;
  duration: number;
  camera: string;
  transition: string;
  textAnimation: string;
  speed: number;
  volume: number;
}

export async function POST(req: NextRequest) {
  try {
    const { project } = await req.json();
    const scenes: ExportScene[] = project.scenes || [];

    if (scenes.length === 0) {
      return NextResponse.json({ success: false, error: 'No scenes to export' });
    }

    const exportId = `export_${Date.now()}`;
    const workDir = path.join(VIDEOS_DIR, exportId);
    await mkdir(workDir, { recursive: true });

    console.log(`[Export] Starting export ${exportId} with ${scenes.length} scenes`);

    // Step 1: Find scene images (they're in download/videos/{sceneId}/scene.png)
    const sceneImagePaths: (string | null)[] = [];
    const voicePaths: (string | null)[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sceneDir = path.join(VIDEOS_DIR, scenes[i].id);
      const imgPath = path.join(sceneDir, 'scene.png');
      const voicePath = path.join(sceneDir, 'voice.mp3');

      const { existsSync } = await import('fs');
      sceneImagePaths.push(existsSync(imgPath) ? imgPath : null);
      voicePaths.push(existsSync(voicePath) ? voicePath : null);
    }

    const scenesWithImages = sceneImagePaths.filter(Boolean).length;
    console.log(`[Export] ${scenesWithImages}/${scenes.length} scenes have images`);

    // Step 2: Generate video segments with zoompan
    const fps = 24;
    const segments: string[] = [];

    const cameraEffects: Record<string, string> = {
      zoom_in:  `scale=720:1280,zoompan=z='min(zoom+0.002,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={D}:s=1080x1920:fps=${fps}`,
      zoom_out: `scale=720:1280,zoompan=z='if(eq(on,1),1.5,max(zoom-0.002,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={D}:s=1080x1920:fps=${fps}`,
      pan_left:  `scale=720:1280,zoompan=z='1.3':x='if(eq(on,1),iw,iw-max(iw*(on-1)/{D},0))':y='(ih-ih/zoom)/2':d={D}:s=1080x1920:fps=${fps}`,
      pan_right: `scale=720:1280,zoompan=z='1.3':x='max(iw*(on-1)/{D},0)':y='(ih-ih/zoom)/2':d={D}:s=1080x1920:fps=${fps}`,
      ken_burns: `scale=720:1280,zoompan=z='min(zoom+0.001,1.3)':x='iw/4-(iw/zoom/4)+iw/8*(on/{D})':y='ih/2-(ih/zoom/2)':d={D}:s=1080x1920:fps=${fps}`,
      static:    `scale=720:1280,zoompan=z='1.0':d={D}:s=1080x1920:fps=${fps}`,
    };

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imgPath = sceneImagePaths[i];
      if (!imgPath) {
        console.log(`[Export] Scene ${i}: no image, creating color bg`);
        // Create a dark background segment
        const segPath = path.join(workDir, `seg_${i}.ts`);
        const dur = Math.max(2, scene.duration || 4);
        const frames = dur * fps;
        const overlayText = (scene.overlayText || '').replace(/'/g, "'\\''").replace(/:/g, '\\:').substring(0, 40);
        const textFilter = overlayText
          ? `,drawtext=text='${overlayText}':fontsize=38:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-tw)/2:y=h*0.72-th/2:enable='between(t,0.3,${(dur - 0.5).toFixed(1)})'`
          : '';

        try {
          await execFileAsync('ffmpeg', [
            '-y', '-f', 'lavfi', `-i`, `color=c=0x0a0a0f:s=1080x1920:d=${dur}:r=${fps}`,
            '-vf', `drawtext=text='Scene ${i + 1}':fontsize=24:fontcolor=white@0.3:x=(w-tw)/2:y=(h-th)/2${textFilter}`,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
            '-an', '-f', 'mpegts', segPath,
          ], { timeout: 30000 });
          segments.push(segPath);
        } catch (err: any) {
          console.log(`[Export] Scene ${i} bg failed: ${err.message}`);
        }
        continue;
      }

      const dur = Math.max(2, scene.duration || 4);
      const frames = dur * fps;
      const segPath = path.join(workDir, `seg_${i}.ts`);

      const camType = cameraEffects[scene.camera] ? scene.camera : 'zoom_in';
      const filter = cameraEffects[camType].replace(/{D}/g, String(frames));

      const overlayText = (scene.overlayText || '').replace(/'/g, "'\\''").replace(/:/g, '\\:').substring(0, 40);
      const textFilter = overlayText
        ? `,drawtext=text='${overlayText}':fontsize=38:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-tw)/2:y=h*0.72-th/2:enable='between(t,0.3,${(dur - 0.5).toFixed(1)})'`
        : '';

      try {
        await execFileAsync('ffmpeg', [
          '-y', '-loop', '1', '-i', imgPath,
          '-vf', filter + textFilter,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
          '-t', String(dur), '-an', '-f', 'mpegts', segPath,
        ], { timeout: 90000 });
        segments.push(segPath);
        console.log(`[Export] Scene ${i}: ${camType} ${dur}s ✓`);
      } catch (err: any) {
        console.log(`[Export] Scene ${i} failed: ${err.message}`);
      }
    }

    if (segments.length === 0) {
      return NextResponse.json({ success: false, error: 'No segments could be created' });
    }

    // Step 3: Concat segments
    console.log(`[Export] Concatenating ${segments.length} segments`);
    const outputPath = path.join(VIDEOS_DIR, `${exportId}.mp4`);

    if (segments.length === 1) {
      await execFileAsync('ffmpeg', [
        '-y', '-i', segments[0],
        '-c:v', 'copy', '-movflags', '+faststart', outputPath,
      ], { timeout: 30000 });
    } else {
      const concatContent = segments.map(s => `file '${s}'`).join('\n');
      const concatPath = path.join(workDir, 'concat.txt');
      await writeFile(concatPath, concatContent);
      await execFileAsync('ffmpeg', [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-an', '-movflags', '+faststart', outputPath,
      ], { timeout: 120000 });
    }

    // Step 4: Generate full voiceover and merge if any scenes have voice
    const scenesWithVoice = scenes.filter(s => s.voiceScript);
    if (scenesWithVoice.length > 0) {
      console.log(`[Export] Generating full voiceover for ${scenesWithVoice.length} scenes`);
      try {
        const { generateVoiceover } = await import('@/lib/pipeline');
        const fullScript = scenesWithVoice.map(s => s.voiceScript).join(' ');
        const audioBuffer = await generateVoiceover(fullScript, 'jam', 1.0);
        const voicePath = path.join(workDir, 'full_voice.mp3');
        await writeFile(voicePath, audioBuffer);

        // Merge audio with video
        const mergedPath = path.join(VIDEOS_DIR, `${exportId}_final.mp4`);
        await execFileAsync('ffmpeg', [
          '-y', '-i', outputPath, '-i', voicePath,
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
          '-shortest', '-movflags', '+faststart', mergedPath,
        ], { timeout: 60000 });

        // Replace output
        const { renameSync } = await import('fs');
        renameSync(mergedPath, outputPath);
        console.log(`[Export] Voiceover merged`);
      } catch (err: any) {
        console.log(`[Export] Voiceover failed: ${err.message}, exporting silent`);
      }
    }

    // Cleanup
    for (const seg of segments) {
      try { await unlink(seg); } catch {}
    }

    console.log(`[Export] Done: ${outputPath}`);
    return NextResponse.json({
      success: true,
      videoUrl: `/api/serve?file=${exportId}.mp4`,
    });
  } catch (error: any) {
    console.error(`[Export] Error: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}