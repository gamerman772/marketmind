'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Play, CheckCircle2, XCircle, Loader2, Clock, Trash2, Download,
  Volume2, Film, Settings, Sparkles, BarChart3, Video, Wand2,
  Target, Megaphone, ChevronRight, Users, Lightbulb, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Types
interface VideoItem {
  id: string; title: string; hook: string; script: string;
  voiceoverUrl?: string; images: string; videoUrl?: string;
  status: string; sourceTitle?: string; error?: string;
  duration?: number; views: number; createdAt: string; updatedAt: string;
}

interface PipelineStatus {
  status: 'idle' | 'running'; processing: number; completed: number;
  failed: number; total: number; recentVideos: VideoItem[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-gray-400' },
  generating_script: { label: 'Writing Script', color: 'text-yellow-400' },
  generating_images: { label: 'Generating Scenes', color: 'text-orange-400' },
  generating_voiceover: { label: 'Recording Voice', color: 'text-purple-400' },
  capturing_screenshots: { label: 'Getting Screenshots', color: 'text-orange-400' },
  assembling: { label: 'Rendering', color: 'text-blue-400' },
  complete: { label: 'Complete', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
};

const TONES = ['Professional', 'Energetic', 'Luxury', 'Minimal', 'Funny', 'Dramatic', 'Warm', 'Bold'];
const CATEGORIES = ['SaaS / Software', 'E-commerce', 'Health & Wellness', 'Finance', 'Education', 'Food & Beverage', 'Fashion', 'Tech Hardware', 'Real Estate', 'Automotive', 'Entertainment', 'Other'];

export default function Home() {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [voiceName, setVoiceName] = useState('jam');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  // Product detail fields
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [audience, setAudience] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [tone, setTone] = useState('Professional');
  const [duration, setDuration] = useState('20');

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline');
      const data = await res.json();
      setPipelineStatus(data);
      setVideos(data.recentVideos || []);
      const activeVideo = (data.recentVideos || []).find((v: VideoItem) =>
        ['generating_script', 'generating_images', 'generating_voiceover', 'assembling'].includes(v.status)
      );
      if (activeVideo) {
        setIsGenerating(true);
        const map: Record<string, { pct: number; label: string }> = {
          generating_script: { pct: 15, label: 'Writing ad script...' },
          generating_images: { pct: 50, label: 'Generating cinematic scenes...' },
          generating_voiceover: { pct: 75, label: 'Recording voiceover...' },
          assembling: { pct: 90, label: 'Rendering final video...' },
          capturing_screenshots: { pct: 50, label: 'Getting screenshots...' },
        };
        const s = map[activeVideo.status];
        if (s) { setProgress(s.pct); setProgressLabel(s.label); }
      } else if (isGenerating) {
        setIsGenerating(false); setProgress(100); setProgressLabel('Done!');
      }
    } catch { /* silent */ }
  }, [isGenerating]);

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 4000);
    return () => clearInterval(i);
  }, [fetchStatus]);

  const generate = async () => {
    if (!productName.trim()) return;
    setLogs([]);
    addLog('Starting MarketMind AI...');
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: productName.trim(),
          style: visualStyle.trim() || undefined,
          voiceName, voiceSpeed,
          category, audience, sellingPoint, tone,
          targetDuration: parseInt(duration) || 20,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('Generation started...');
        setIsGenerating(true); setProgress(5); setProgressLabel('Initializing...');
      } else { addLog(`Failed: ${data.error}`); }
      fetchStatus();
    } catch (err: any) { addLog(`Error: ${err.message}`); }
  };

  const deleteVideo = async (id: string) => {
    await fetch(`/api/videos?id=${id}`, { method: 'DELETE' });
    fetchStatus();
  };

  const getFileUrl = (video: VideoItem, type: 'video' | 'voiceover') => {
    if (type === 'video') return `/api/serve?file=${video.id}.mp4`;
    return `/api/serve?file=${video.id}/voiceover.mp3`;
  };

  const parseImages = (json: string) => { try { return JSON.parse(json); } catch { return []; } };

  const filledFields = [productName, category, audience, sellingPoint, visualStyle].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Target className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">MarketMind AI</h1>
                <p className="text-[11px] text-zinc-500">AI Advertisement Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/ad-builder">
                <Button variant="outline" size="sm" className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 h-8 text-xs gap-1.5">
                  <Film className="w-3.5 h-3.5" /> Ad Builder
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
              <Badge variant="outline" className={
                pipelineStatus?.status === 'running'
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/5'
                  : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5'
              }>
                {pipelineStatus?.status === 'running'
                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating</>
                  : <><CheckCircle2 className="w-3 h-3 mr-1" /> Ready</>
                }
              </Badge>
              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Ads', value: pipelineStatus?.total || 0, color: 'text-violet-400' },
              { label: 'In Progress', value: pipelineStatus?.processing || 0, color: 'text-amber-400' },
              { label: 'Completed', value: pipelineStatus?.completed || 0, color: 'text-emerald-400' },
              { label: 'Failed', value: pipelineStatus?.failed || 0, color: 'text-red-400' },
            ].map((s) => (
              <Card key={s.label} className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-4">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Generate Section — Professional product form */}
          <Card className="bg-zinc-900/50 border-zinc-800/50 overflow-hidden">
            <AnimatePresence>
              {isGenerating && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
                  <div className="px-6 py-3 border-b border-zinc-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                        <span className="text-sm text-zinc-400">{progressLabel}</span>
                      </div>
                      <span className="text-xs text-zinc-600">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1 bg-zinc-800" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Quick Generate</h2>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Fill in details for a better ad — the more context, the better the result.</p>
                </div>
                <div className="text-[10px] text-zinc-600">{filledFields}/5 fields filled</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product name — full width on mobile, 2/3 on desktop */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Target className="w-3 h-3" /> Product / Brand Name <span className="text-violet-400">*</span>
                  </Label>
                  <Input
                    placeholder='e.g., "Notion AI", "Tesla Model S", "Gymshark Premium Collection"'
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    disabled={isGenerating}
                    className="bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Film className="w-3 h-3" /> Category
                  </Label>
                  <Select value={category} onValueChange={setCategory} disabled={isGenerating}>
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-10 text-white">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Tone
                  </Label>
                  <Select value={tone} onValueChange={setTone} disabled={isGenerating}>
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Target Audience
                  </Label>
                  <Input
                    placeholder="e.g., Small business owners, Gen Z, Developers, Parents"
                    value={audience}
                    onChange={e => setAudience(e.target.value)}
                    disabled={isGenerating}
                    className="bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Lightbulb className="w-3 h-3" /> Key Selling Point
                  </Label>
                  <Input
                    placeholder="e.g., Save 10 hours/week, 50% cheaper, #1 rated"
                    value={sellingPoint}
                    onChange={e => setSellingPoint(e.target.value)}
                    disabled={isGenerating}
                    className="bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Palette className="w-3 h-3" /> Visual Style
                  </Label>
                  <Input
                    placeholder='e.g., "dark luxury", "neon cyberpunk", "bright minimal"'
                    value={visualStyle}
                    onChange={e => setVisualStyle(e.target.value)}
                    disabled={isGenerating}
                    className="bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Duration (seconds)
                  </Label>
                  <Select value={duration} onValueChange={setDuration} disabled={isGenerating}>
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="15">15 seconds (Short)</SelectItem>
                      <SelectItem value="20">20 seconds (Standard)</SelectItem>
                      <SelectItem value="30">30 seconds (Extended)</SelectItem>
                      <SelectItem value="45">45 seconds (Long)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={generate}
                  disabled={isGenerating || !productName.trim()}
                  className="h-10 px-8 bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-500 hover:to-amber-400 text-white font-semibold shadow-lg shadow-violet-500/20 transition-all disabled:opacity-40"
                >
                  {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4 mr-2" /> Generate Ad</>}
                </Button>
                <Link href="/ad-builder">
                  <Button variant="outline" disabled={isGenerating} className="h-10 px-6 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 gap-2">
                    <Film className="w-4 h-4" /> Open Ad Builder
                  </Button>
                </Link>
              </div>

              {isGenerating && (
                <div className="flex items-center gap-6 pt-1 text-xs text-zinc-500">
                  {[
                    { label: 'Script', pct: 15 }, { label: 'AI Scenes', pct: 50 },
                    { label: 'Voice', pct: 75 }, { label: 'Render', pct: 90 },
                  ].map((step) => (
                    <div key={step.label} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${progress >= step.pct ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                      {step.label}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ad Library + Log */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <Video className="w-4 h-4" /> Ad Library
              </h2>
              {videos.length === 0 ? (
                <Card className="bg-zinc-900/50 border-zinc-800/50">
                  <CardContent className="p-16 text-center">
                    <Megaphone className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                    <p className="text-zinc-600 text-sm">No ads generated yet</p>
                    <p className="text-zinc-700 text-xs mt-1">Enter a product name above or open the Ad Builder</p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2 pr-4">
                    {videos.map((video, i) => {
                      const st = STATUS_MAP[video.status] || STATUS_MAP.draft;
                      const imgs = parseImages(video.images);
                      return (
                        <motion.div key={video.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                          <Card className="bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700/50 transition-all cursor-pointer" onClick={() => {}}>
                            <CardContent className="p-3.5">
                              <div className="flex gap-3">
                                <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-zinc-800/50">
                                  {imgs.length > 0 ? (
                                    <img src={imgs[0].url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : video.status === 'complete' ? (
                                    <div className="w-full h-full flex items-center justify-center"><Play className="w-5 h-5 text-zinc-700" /></div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-4 h-4 text-zinc-700 animate-spin" /></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-sm font-medium line-clamp-1">{video.title}</h3>
                                    <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                                  </div>
                                  {video.hook && <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1 italic">&quot;{video.hook}&quot;</p>}
                                  <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {video.duration ? `${video.duration}s` : '--'}</span>
                                    <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    {video.videoUrl && (
                                      <Button size="sm" variant="outline" className="border-zinc-700/50 text-zinc-400 h-6 text-[10px]"
                                        onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(video, 'video'), '_blank'); }}>
                                        <Download className="w-2.5 h-2.5 mr-1" /> MP4
                                      </Button>
                                    )}
                                    {video.voiceoverUrl && (
                                      <Button size="sm" variant="outline" className="border-zinc-700/50 text-zinc-400 h-6 text-[10px]"
                                        onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(video, 'voiceover'), '_blank'); }}>
                                        <Volume2 className="w-2.5 h-2.5 mr-1" /> Audio
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="text-red-400/50 hover:text-red-400 hover:bg-red-500/10 h-6 text-[10px] ml-auto"
                                      onClick={(e) => { e.stopPropagation(); deleteVideo(video.id); }}>
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="space-y-4">
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-zinc-500">Activity Log</CardTitle></CardHeader>
                <CardContent>
                  <div className="bg-black/30 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-[10px] leading-relaxed">
                    {logs.length === 0 ? <p className="text-zinc-700">Waiting...</p> : logs.map((log, i) => <p key={i} className="text-zinc-500">{log}</p>)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</DialogTitle>
            <DialogDescription>Voice and speed settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Voice</Label>
              <Select value={voiceName} onValueChange={setVoiceName}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="jam">Jam (English, Natural)</SelectItem>
                  <SelectItem value="kazi">Kazi (Standard)</SelectItem>
                  <SelectItem value="douji">Douji (Expressive)</SelectItem>
                  <SelectItem value="luodo">Luodo (Expressive)</SelectItem>
                  <SelectItem value="tongtong">Tongtong (Warm)</SelectItem>
                  <SelectItem value="chuichui">Chuichui (Cute)</SelectItem>
                  <SelectItem value="xiaochen">Xiaochen (Professional)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Speed: {voiceSpeed.toFixed(1)}x</Label>
              <Input type="range" min="0.7" max="1.5" step="0.1" value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))} className="accent-violet-500" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}