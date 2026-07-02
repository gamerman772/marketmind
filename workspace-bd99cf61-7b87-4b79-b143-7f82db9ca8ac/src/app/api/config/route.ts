import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/config - get pipeline config
export async function GET() {
  let config = await db.pipelineConfig.findFirst();
  if (!config) {
    config = await db.pipelineConfig.create({
      data: {
        autoGenerate: false,
        intervalMinutes: 60,
        voiceName: 'alloy',
        voiceSpeed: 1.0,
        targetDuration: 60,
        niches: 'AI,artificial intelligence,machine learning,LLM,ChatGPT,OpenAI,Google AI,Anthropic,Midjourney,Stable Diffusion',
      },
    });
  }
  return NextResponse.json(config);
}

// PUT /api/config - update pipeline config
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const config = await db.pipelineConfig.findFirst();

  if (!config) {
    const newConfig = await db.pipelineConfig.create({ data: body });
    return NextResponse.json(newConfig);
  }

  const updated = await db.pipelineConfig.update({
    where: { id: config.id },
    data: body,
  });
  return NextResponse.json(updated);
}
