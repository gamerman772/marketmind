import ZAI from 'z-ai-web-dev-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';

const execFileAsync = promisify(execFile);

let zaiInstance: ZAI | null = null;

export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── AI IMAGE GENERATION ───────────────────────────────────────────
// Generates a cinematic AI image for an ad scene

export async function generateSceneImage(
  prompt: string,
  outputPath: string,
  size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' = '768x1344'
): Promise<boolean> {
  const zai = await getZAI();
  try {
    const response = await zai.images.generations.create({
      prompt,
      size,
    });

    const base64 = response.data?.[0]?.base64;
    if (!base64) {
      console.log(`[IMG] No base64 returned for: ${prompt.substring(0, 60)}`);
      return false;
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length < 5000) {
      console.log(`[IMG] Image too small (${buffer.length} bytes)`);
      return false;
    }

    await writeFile(outputPath, buffer);
    console.log(`[IMG] Generated: ${path.basename(outputPath)} (${buffer.length} bytes)`);
    return true;
  } catch (err: any) {
    console.log(`[IMG] Failed: ${err.message}`);
    return false;
  }
}

// ─── SCRIPT GENERATION ─────────────────────────────────────────────
// Generates an ad script with scene-by-scene image prompts

export interface Scene {
  text: string;           // what the voiceover says
  imagePrompt: string;    // detailed prompt for AI image generation
  overlayText: string;    // big text shown on screen (max 10 words)
  duration: number;       // seconds this scene lasts
  camera: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'static';
}

export async function generateAdScript(product: string, style?: string, context?: {
  category?: string; audience?: string; sellingPoint?: string; tone?: string; targetDuration?: number;
}): Promise<{
  hook: string;
  title: string;
  script: string;
  scenes: Scene[];
  duration: number;
}> {
  const zai = await getZAI();

  const systemPrompt = `You are an elite ad copywriter and creative director. You create CINEMATIC AI-generated video advertisements.

RULES:
1. Ads are 15-30 seconds. Every second matters.
2. Each scene gets a detailed AI image generation prompt that produces STUNNING cinematic visuals.
3. Image prompts must specify: cinematic lighting, camera angle, mood, style, colors.
4. The ad must have a clear hook → problem → solution → CTA structure.
5. Voiceover text should be short and punchy — max 2-3 sentences per scene.
6. Overlay text is the BIG text on screen — max 8 words, high impact.
7. Vary camera movements: zoom_in, zoom_out, pan_left, pan_right, static.

IMAGE PROMPT RULES (CRITICAL):
- Start with the scene description, then add cinematic qualifiers
- Always include: "cinematic", lighting style, color palette, camera angle
- Example: "Close-up of a sleek smartphone screen displaying AI chatbot, dramatic side lighting, dark background with blue accent glow, cinematic shallow depth of field, 8k quality"
- Example: "Wide aerial shot of modern office building at golden hour, warm orange and purple sky, cinematic widescreen composition, photorealistic"
- Each prompt must produce a DIFFERENT visual — vary angles, distances, lighting

OUTPUT FORMAT (valid JSON only):
{
  "hook": "First 2-3 words that grab attention",
  "title": "Ad title under 50 chars",
  "script": "Full voiceover text for the entire ad (15-30 seconds spoken)",
  "duration": 22,
  "scenes": [
    {
      "text": "What the voice says in this scene",
      "imagePrompt": "DETAILED cinematic image prompt with lighting, angle, mood, style",
      "overlayText": "BIG SCREEN TEXT",
      "duration": 4,
      "camera": "zoom_in"
    }
  ]
}`;

  const targetDur = context?.targetDuration || 20;
  const toneStr = context?.tone || 'Professional';
  const audienceStr = context?.audience || 'general consumers';
  const sellingStr = context?.sellingPoint || '';
  const catStr = context?.category || '';

  const contextBlock = [
    catStr ? `Industry: ${catStr}` : '',
    `Target audience: ${audienceStr}`,
    sellingStr ? `Key selling point: ${sellingStr}` : '',
    `Tone: ${toneStr}`,
    `Target duration: ${targetDur} seconds`,
    `Total scenes: ${Math.max(3, Math.min(8, Math.round(targetDur / 5)))}`,
  ].filter(Boolean).join('\n');

  const userPrompt = style
    ? `Create a cinematic AI video ad for: "${product}"\n\nVisual style: ${style}\n\n${contextBlock}\n\nMake it look like a premium brand commercial.`
    : `Create a cinematic AI video ad for: "${product}"\n\n${contextBlock}\n\nMake it look like a premium brand commercial. Stunning visuals, professional feel.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
  });

  const content = response.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse ad script JSON');
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  if (!parsed.scenes || parsed.scenes.length < 3) {
    throw new Error(`Too few scenes: ${parsed.scenes?.length || 0}`);
  }

  return parsed;
}

// ─── TTS VOICEOVER ─────────────────────────────────────────────────

function splitTextIntoChunks(text: string, maxLength = 900): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export async function generateVoiceover(
  text: string,
  voice: string = 'jam',
  speed: number = 1.0
): Promise<Buffer> {
  const zai = await getZAI();
  console.log(`[TTS] Starting: ${text.length} chars, voice=${voice}, speed=${speed}`);

  const validVoices = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'];
  if (!validVoices.includes(voice)) voice = 'jam';

  const chunks = text.length > 1024 ? splitTextIntoChunks(text) : [text];
  console.log(`[TTS] ${chunks.length} chunk(s)`);

  const allBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[TTS] Chunk ${i + 1}/${chunks.length}, attempt ${attempt}`);
        const response = await zai.audio.tts.create({
          input: chunks[i],
          voice,
          speed,
          response_format: 'mp3',
          stream: false,
        });

        const arrayBuffer = await (response as any).arrayBuffer();
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));

        if (buffer.length < 500) {
          console.log(`[TTS] Chunk ${i + 1} too small (${buffer.length} bytes)`);
          throw new Error('Audio too small');
        }

        allBuffers.push(buffer);
        console.log(`[TTS] Chunk ${i + 1} done: ${buffer.length} bytes`);
        break;
      } catch (err: any) {
        console.log(`[TTS] Chunk ${i + 1} attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    // Delay between chunks
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  if (allBuffers.length === 0) throw new Error('TTS produced no valid audio');
  return allBuffers.length === 1 ? allBuffers[0] : Buffer.concat(allBuffers);
}