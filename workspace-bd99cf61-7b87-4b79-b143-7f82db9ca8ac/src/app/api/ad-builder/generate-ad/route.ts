import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/pipeline';
import type { Scene } from '@/lib/ad-builder-types';

export async function POST(req: NextRequest) {
  try {
    const {
      product, category, targetAudience, keySellingPoint,
      brandColors, visualStyle, tone, targetDuration, aiFreedom, creativeDirection,
    } = await req.json();

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product is required' }, { status: 400 });
    }

    const zai = await getZAI();

    const freedomNote = aiFreedom === 'full'
      ? 'Add creative transitions, varied camera angles, and dynamic pacing. Be bold.'
      : aiFreedom === 'strict'
      ? 'Follow the structure exactly. No extra creative additions.'
      : 'Follow the structure but enhance quality where appropriate.';

    const systemPrompt = `You are an elite ad creative director building a video advertisement. Generate ${Math.max(3, Math.min(8, Math.round(targetDuration / 5)))} scenes.

RULES:
- Each scene needs: voiceScript (narration), imagePrompt (cinematic AI image), overlayText (max 8 words big text on screen)
- Vary camera movements: zoom_in, zoom_out, pan_left, pan_right, ken_burns, static
- Vary transitions: fade, dissolve, slide_left, slide_right, zoom_fade
- Image prompts must be CINEMATIC and DETAILED: include lighting, angle, mood, colors
- Voice script per scene: 1-3 sentences max
- Total spoken time should be ~${targetDuration} seconds
- Product: ${product}
- Category: ${category || 'general'}
- Audience: ${targetAudience || 'general consumers'}
- Key selling point: ${keySellingPoint || 'general benefits'}
- Brand colors: ${brandColors || 'violet and amber'}
- Visual style: ${visualStyle || 'cinematic professional'}
- Tone: ${tone || 'Professional'}
- ${freedomNote}
${creativeDirection ? `Creative direction from user: "${creativeDirection}"` : ''}

OUTPUT: valid JSON array of scenes:
[
  {
    "voiceScript": "What the voice says",
    "imagePrompt": "Detailed cinematic image prompt with lighting, angle, mood",
    "overlayText": "BIG TEXT",
    "duration": 4,
    "camera": "zoom_in",
    "transition": "fade",
    "textAnimation": "fade_in"
  }
]`;

    const response = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create ${Math.max(3, Math.min(8, Math.round(targetDuration / 5)))} scenes for a ${targetDuration}s ad about "${product}". ${creativeDirection || ''}` },
      ],
      temperature: 0.85,
    });

    const content = response.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse scenes JSON');

    const rawScenes = JSON.parse(jsonMatch[0]);
    const scenes: Scene[] = rawScenes.map((s: any, i: number) => ({
      id: `scene_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      order: i,
      voiceScript: s.voiceScript || '',
      imagePrompt: s.imagePrompt || '',
      overlayText: s.overlayText || '',
      notes: '',
      duration: Math.max(2, s.duration || 4),
      camera: s.camera || 'zoom_in',
      transition: s.transition || 'fade',
      textAnimation: s.textAnimation || 'fade_in',
      fontFamily: 'Inter',
      fontSize: 38,
      textColor: '#FFFFFF',
      textPosition: 'bottom' as const,
      volume: 1.0,
      speed: 1.0,
    }));

    return NextResponse.json({ success: true, scenes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}