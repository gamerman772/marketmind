'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Wand2, FolderOpen, Palette, Bot, Mic, Music, Sparkles, Layout, Download, Settings,
  Play, Pause, SkipBack, Volume2, VolumeX, Maximize, ChevronLeft, ChevronRight,
  Plus, Trash2, Copy, Undo2, Redo2, ZoomIn, ZoomOut, Image, Type, Film,
  Loader2, CheckCircle2, XCircle, AlertCircle, Send, GripVertical, Eye, EyeOff,
  ChevronDown, RotateCcw, Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Project, Scene, TimelineClip, TrackType,
  SIDEBAR_TOOLS, VOICE_OPTIONS, CAMERA_OPTIONS, TRANSITION_OPTIONS,
  TEXT_ANIMATIONS, TONE_OPTIONS, CATEGORY_OPTIONS,
  createEmptyScene, createDefaultProject,
} from '@/lib/ad-builder-types';

// ─── ICON MAP ──────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Wand2, FolderOpen, Palette, Bot, Mic, Music, Sparkles, Layout, Download, Settings,
};

// ─── TRACK CONFIG ──────────────────────────────────────────────────
const TRACKS: { type: TrackType; label: string; color: string; height: number }[] = [
  { type: 'image', label: 'Images', color: 'bg-violet-500/60', height: 56 },
  { type: 'video', label: 'Video', color: 'bg-blue-500/60', height: 56 },
  { type: 'text', label: 'Text', color: 'bg-amber-500/60', height: 40 },
  { type: 'voice', label: 'Voice', color: 'bg-emerald-500/60', height: 40 },
  { type: 'music', label: 'Music', color: 'bg-pink-500/60', height: 36 },
  { type: 'sfx', label: 'SFX', color: 'bg-orange-500/60', height: 36 },
];

const PIXELS_PER_SECOND = 60; // timeline scale

export default function AdBuilderPage() {
  // ─── STATE ───────────────────────────────────────────────────────
  const [project, setProject] = useState<Project>(createDefaultProject);
  const [activeTool, setActiveTool] = useState('generate');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSceneDialog, setShowSceneDialog] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [generatingVoiceSceneId, setGeneratingVoiceSceneId] = useState<string | null>(null);

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Total project duration
  const totalDuration = project.scenes.reduce((sum, s) => sum + s.duration, 0);

  // Selected scene
  const selectedScene = project.scenes.find(s => s.id === selectedSceneId) || null;

  // ─── UNDO/REDO ───────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(project))]);
    setRedoStack([]);
  }, [project]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, JSON.parse(JSON.stringify(project))]);
    setProject(prev);
    setUndoStack(u => u.slice(0, -1));
  }, [undoStack, project]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, JSON.parse(JSON.stringify(project))]);
    setProject(next);
    setRedoStack(r => r.slice(0, -1));
  }, [redoStack, project]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ─── PROJECT UPDATES ─────────────────────────────────────────────
  const updateProject = useCallback((updates: Partial<Project>) => {
    pushUndo();
    setProject(p => ({ ...p, ...updates, updatedAt: new Date().toISOString() }));
  }, [pushUndo]);

  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    pushUndo();
    setProject(p => ({
      ...p,
      scenes: p.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s),
      updatedAt: new Date().toISOString(),
    }));
  }, [pushUndo]);

  // ─── SCENE MANAGEMENT ────────────────────────────────────────────
  const addScene = useCallback(() => {
    pushUndo();
    setProject(p => {
      const newScene = createEmptyScene(p.scenes.length);
      return { ...p, scenes: [...p.scenes, newScene], updatedAt: new Date().toISOString() };
    });
  }, [pushUndo]);

  const duplicateScene = useCallback((sceneId: string) => {
    pushUndo();
    setProject(p => {
      const src = p.scenes.find(s => s.id === sceneId);
      if (!src) return p;
      const dup: Scene = { ...src, id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, imageUrl: src.imageUrl, voiceUrl: undefined };
      const idx = p.scenes.findIndex(s => s.id === sceneId);
      const scenes = [...p.scenes];
      scenes.splice(idx + 1, 0, dup);
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });
  }, [pushUndo]);

  const deleteScene = useCallback((sceneId: string) => {
    pushUndo();
    setProject(p => ({
      ...p,
      scenes: p.scenes.filter(s => s.id !== sceneId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedSceneId === sceneId) setSelectedSceneId(null);
  }, [pushUndo, selectedSceneId]);

  const moveScene = useCallback((sceneId: string, dir: -1 | 1) => {
    pushUndo();
    setProject(p => {
      const idx = p.scenes.findIndex(s => s.id === sceneId);
      if (idx < 0) return p;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.scenes.length) return p;
      const scenes = [...p.scenes];
      [scenes[idx], scenes[newIdx]] = [scenes[newIdx], scenes[idx]];
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });
  }, [pushUndo]);

  // ─── AI IMAGE GENERATION ─────────────────────────────────────────
  const generateImage = useCallback(async (sceneId: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imagePrompt) return;
    setGeneratingImageSceneId(sceneId);
    updateScene(sceneId, { imageGenerating: true });
    try {
      const res = await fetch('/api/ad-builder/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scene.imagePrompt, sceneId }),
      });
      const data = await res.json();
      if (data.success) {
        updateScene(sceneId, { imageUrl: data.imageUrl, imageGenerating: false });
        addLog(`Image generated for scene ${project.scenes.findIndex(s => s.id === sceneId) + 1}`);
      } else {
        updateScene(sceneId, { imageGenerating: false });
        addLog(`Image gen failed: ${data.error}`);
      }
    } catch (err: any) {
      updateScene(sceneId, { imageGenerating: false });
      addLog(`Image gen error: ${err.message}`);
    }
    setGeneratingImageSceneId(null);
  }, [project.scenes, updateScene, addLog]);

  // ─── AI VOICE GENERATION ─────────────────────────────────────────
  const generateVoice = useCallback(async (sceneId: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.voiceScript) return;
    setGeneratingVoiceSceneId(sceneId);
    updateScene(sceneId, { voiceGenerating: true });
    try {
      const res = await fetch('/api/ad-builder/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scene.voiceScript, sceneId, voice: 'jam', speed: scene.speed }),
      });
      const data = await res.json();
      if (data.success) {
        updateScene(sceneId, { voiceUrl: data.voiceUrl, voiceGenerating: false });
        addLog(`Voice generated for scene ${project.scenes.findIndex(s => s.id === sceneId) + 1}`);
      } else {
        updateScene(sceneId, { voiceGenerating: false });
        addLog(`Voice gen failed: ${data.error}`);
      }
    } catch (err: any) {
      updateScene(sceneId, { voiceGenerating: false });
      addLog(`Voice gen error: ${err.message}`);
    }
    setGeneratingVoiceSceneId(null);
  }, [project.scenes, updateScene, addLog]);

  // ─── AI GENERATE FULL AD ─────────────────────────────────────────
  const generateFullAd = useCallback(async () => {
    setAiLoading(true);
    addLog('AI generating full ad...');
    try {
      const res = await fetch('/api/ad-builder/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: project.product,
          category: project.category,
          targetAudience: project.targetAudience,
          keySellingPoint: project.keySellingPoint,
          brandColors: project.brandColors,
          visualStyle: project.visualStyle,
          tone: project.tone,
          targetDuration: project.targetDuration,
          aiFreedom: project.aiFreedom,
          creativeDirection: aiPrompt,
        }),
      });
      const data = await res.json();
      if (data.success && data.scenes) {
        pushUndo();
        setProject(p => ({ ...p, scenes: data.scenes, updatedAt: new Date().toISOString() }));
        addLog(`AI created ${data.scenes.length} scenes`);
        // Auto-select first scene
        setSelectedSceneId(data.scenes[0]?.id || null);
      } else {
        addLog(`AI generation failed: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`AI error: ${err.message}`);
    }
    setAiLoading(false);
  }, [project, aiPrompt, pushUndo, addLog]);

  // ─── EXPORT ──────────────────────────────────────────────────────
  const exportVideo = useCallback(async () => {
    setIsExporting(true);
    setExportStatus('Rendering scenes...');
    addLog('Starting export...');
    try {
      const res = await fetch('/api/ad-builder/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const data = await res.json();
      if (data.success) {
        setExportStatus('Complete!');
        addLog(`Export done: ${data.videoUrl}`);
        // Open the video
        window.open(data.videoUrl, '_blank');
      } else {
        setExportStatus(`Failed: ${data.error}`);
        addLog(`Export failed: ${data.error}`);
      }
    } catch (err: any) {
      setExportStatus(`Error: ${err.message}`);
      addLog(`Export error: ${err.message}`);
    }
    setIsExporting(false);
  }, [project, addLog]);

  // ─── PLAYBACK ────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setPlayheadTime(t => {
          if (t >= totalDuration) { setIsPlaying(false); return 0; }
          return t + 0.1;
        });
      }, 100);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, totalDuration]);

  // Current scene at playhead
  const currentSceneAtPlayhead = (() => {
    let t = 0;
    for (const scene of project.scenes) {
      if (playheadTime >= t && playheadTime < t + scene.duration) return scene;
      t += scene.duration;
    }
    return project.scenes[project.scenes.length - 1] || null;
  })();

  // ─── COMPUTE SCENE START TIMES ───────────────────────────────────
  const sceneStartTimes = project.scenes.reduce((acc, s, i) => {
    acc[s.id] = project.scenes.slice(0, i).reduce((sum, prev) => sum + prev.duration, 0);
    return acc;
  }, {} as Record<string, number>);

  // ─── NEW PROJECT DIALOG ──────────────────────────────────────────
  if (showNewProjectDialog) {
    return <NewProjectDialog onSubmit={(p) => { setProject({ ...createDefaultProject(), ...p }); setShowNewProjectDialog(false); addLog('New project created'); }} />;
  }

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#0c0c0f] text-zinc-100 overflow-hidden">
      {/* Top Bar */}
      <div className="h-11 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300 h-7 px-2" onClick={() => window.location.href = '/'}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-amber-500 flex items-center justify-center">
              <Wand2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold">MarketMind AI</span>
          </div>
          <Separator orientation="vertical" className="h-5 bg-zinc-800" />
          <Input
            value={project.name}
            onChange={e => updateProject({ name: e.target.value })}
            className="h-7 w-48 bg-transparent border-none text-sm font-medium text-zinc-300 focus-visible:ring-0 px-1"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={undo} disabled={undoStack.length === 0}>
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={redo} disabled={redoStack.length === 0}>
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-5 bg-zinc-800 mx-1" />
          <Button
            size="sm"
            className="h-7 px-4 bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-500 hover:to-amber-400 text-white text-xs font-semibold"
            onClick={exportVideo}
            disabled={isExporting || project.scenes.length === 0}
          >
            {isExporting ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> {exportStatus}</> : <><Download className="w-3 h-3 mr-1.5" /> Export</>}
          </Button>
        </div>
      </div>

      {/* Main Content: Sidebar | Preview+Timeline | Properties */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT SIDEBAR ──────────────────────────────────────── */}
        <div className="w-12 border-r border-zinc-800/60 bg-zinc-950/50 flex flex-col items-center py-2 gap-0.5 flex-shrink-0">
          {SIDEBAR_TOOLS.map(tool => {
            const Icon = ICON_MAP[tool.icon] || Settings;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-10 h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-[9px] ${
                  isActive ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50'
                }`}
                title={tool.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="leading-none">{tool.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* ─── LEFT TOOL PANEL ───────────────────────────────────── */}
        <div className="w-64 border-r border-zinc-800/60 bg-zinc-950/30 flex-shrink-0 overflow-hidden flex flex-col">
          <ToolPanel
            tool={activeTool}
            project={project}
            updateProject={updateProject}
            onGenerateAd={generateFullAd}
            aiLoading={aiLoading}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            logs={logs}
          />
        </div>

        {/* ─── CENTER: PREVIEW + TIMELINE ───────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview Window */}
          <div className="flex-1 flex items-center justify-center bg-[#08080a] p-4 min-h-0">
            <PreviewWindow
              project={project}
              currentScene={currentSceneAtPlayhead}
              playheadTime={playheadTime}
              sceneStartTimes={sceneStartTimes}
              isPlaying={isPlaying}
              isMuted={isMuted}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onStop={() => { setIsPlaying(false); setPlayheadTime(0); }}
              onMuteToggle={() => setIsMuted(!isMuted)}
              onSeek={setPlayheadTime}
            />
          </div>

          {/* Timeline */}
          <div className="h-[280px] border-t border-zinc-800/60 bg-zinc-950/50 flex-shrink-0 flex flex-col">
            {/* Timeline toolbar */}
            <div className="h-8 border-b border-zinc-800/40 flex items-center justify-between px-3 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <span className="text-[10px] text-zinc-600 w-10 text-center">{Math.round(timelineZoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setTimelineZoom(z => Math.min(3, z + 0.25))}>
                  <ZoomIn className="w-3 h-3" />
                </Button>
                <Separator orientation="vertical" className="h-4 bg-zinc-800 mx-1" />
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-500 hover:text-zinc-300" onClick={addScene}>
                  <Plus className="w-3 h-3 mr-1" /> Scene
                </Button>
                <span className="text-[10px] text-zinc-600">{project.scenes.length} scenes</span>
                <span className="text-[10px] text-zinc-600 ml-2">{totalDuration.toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-500" onClick={() => setPlayheadTime(0)}>
                  <SkipBack className="w-3 h-3 mr-1" /> Start
                </Button>
              </div>
            </div>

            {/* Timeline tracks */}
            <TimelineArea
              project={project}
              timelineZoom={timelineZoom}
              playheadTime={playheadTime}
              selectedSceneId={selectedSceneId}
              sceneStartTimes={sceneStartTimes}
              onSceneSelect={setSelectedSceneId}
              onSceneDurationChange={(id, dur) => updateScene(id, { duration: Math.max(1, dur) })}
            />
          </div>
        </div>

        {/* ─── RIGHT PROPERTIES PANEL ───────────────────────────── */}
        <div className="w-72 border-l border-zinc-800/60 bg-zinc-950/30 flex-shrink-0 overflow-hidden">
          <PropertiesPanel
            scene={selectedScene}
            onUpdate={(updates) => selectedSceneId && updateScene(selectedSceneId, updates)}
            onGenerateImage={() => selectedSceneId && generateImage(selectedSceneId)}
            onGenerateVoice={() => selectedSceneId && generateVoice(selectedSceneId)}
            generatingImage={generatingImageSceneId === selectedSceneId}
            generatingVoice={generatingVoiceSceneId === selectedSceneId}
            onDelete={() => selectedSceneId && deleteScene(selectedSceneId)}
            onDuplicate={() => selectedSceneId && duplicateScene(selectedSceneId)}
            onMoveUp={() => selectedSceneId && moveScene(selectedSceneId, -1)}
            onMoveDown={() => selectedSceneId && moveScene(selectedSceneId, 1)}
          />
        </div>
      </div>

      {/* Scene Edit Dialog */}
      <Dialog open={showSceneDialog} onOpenChange={setShowSceneDialog}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Edit Scene</DialogTitle>
            <DialogDescription className="text-zinc-500">Voice script and image prompt</DialogDescription>
          </DialogHeader>
          {editingScene && (
            <SceneEditForm
              scene={editingScene}
              onChange={(updates) => setEditingScene({ ...editingScene, ...updates })}
              onSave={() => {
                if (editingScene) updateScene(editingScene.id, editingScene);
                setShowSceneDialog(false);
              }}
              onGenerateImage={() => editingScene && generateImage(editingScene.id)}
              onGenerateVoice={() => editingScene && generateVoice(editingScene.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NEW PROJECT DIALOG ────────────────────────────────────────────
function NewProjectDialog({ onSubmit }: { onSubmit: (p: Partial<Project>) => void }) {
  const [product, setProduct] = useState('');
  const [category, setCategory] = useState('');
  const [audience, setAudience] = useState('');
  const [sellingPoint, setSellingPoint] = useState('');
  const [style, setStyle] = useState('');
  const [tone, setTone] = useState('Professional');
  const [duration, setDuration] = useState(20);
  const [colors, setColors] = useState('#7C3AED,#F59E0B');

  return (
    <div className="h-screen flex items-center justify-center bg-[#09090b]">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">MarketMind AI</h1>
          <p className="text-zinc-500 text-sm mt-1">Create a new ad project</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Product / Brand Name *</Label>
            <Input value={product} onChange={e => setProduct(e.target.value)} placeholder='e.g., "Notion AI", "Gymshark"' className="bg-zinc-800/50 border-zinc-700/50 h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {TONE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Target Audience</Label>
            <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g., Small business owners, Gen Z, Developers" className="bg-zinc-800/50 border-zinc-700/50 h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Key Selling Point</Label>
            <Input value={sellingPoint} onChange={e => setSellingPoint(e.target.value)} placeholder="e.g., Save 10 hours per week, 50% cheaper than competitors" className="bg-zinc-800/50 border-zinc-700/50 h-10" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Visual Style</Label>
              <Input value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g., dark luxury" className="bg-zinc-800/50 border-zinc-700/50 h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Duration (sec)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 20)} min={5} max={120} className="bg-zinc-800/50 border-zinc-700/50 h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Brand Colors</Label>
              <Input value={colors} onChange={e => setColors(e.target.value)} placeholder="#7C3AED,#F59E0B" className="bg-zinc-800/50 border-zinc-700/50 h-10" />
            </div>
          </div>

          <Button
            className="w-full h-10 bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-500 hover:to-amber-400 text-white font-semibold mt-2 disabled:opacity-40"
            disabled={!product.trim()}
            onClick={() => onSubmit({
              name: `${product} Ad`,
              product, category, targetAudience: audience,
              keySellingPoint: sellingPoint, visualStyle: style,
              tone, targetDuration: duration, brandColors: colors,
            })}
          >
            <Sparkles className="w-4 h-4 mr-2" /> Create Project
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TOOL PANEL ────────────────────────────────────────────────────
function ToolPanel({ tool, project, updateProject, onGenerateAd, aiLoading, aiPrompt, setAiPrompt, logs }: {
  tool: string; project: Project; updateProject: (u: Partial<Project>) => void;
  onGenerateAd: () => void; aiLoading: boolean; aiPrompt: string; setAiPrompt: (s: string) => void;
  logs: string[];
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-3">
        {tool === 'generate' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">AI Generate</h3>
            <p className="text-[11px] text-zinc-600">Describe the creative direction and AI will build the full ad.</p>
            <Textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder='e.g., "Make it cinematic and dramatic. Open with a close-up of the product, then show people using it."'
              className="bg-zinc-800/50 border-zinc-700/50 text-xs min-h-[100px] resize-none"
            />
            <Button
              className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-500"
              onClick={onGenerateAd}
              disabled={aiLoading || !project.product}
            >
              {aiLoading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3 mr-1.5" /> Generate Advertisement</>}
            </Button>
            <Separator className="bg-zinc-800/50" />
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Quick Generate</h3>
            {['Cinematic', 'Fast Paced', 'Minimal', 'Energetic', 'Luxury', 'Funny'].map(style => (
              <Button key={style} variant="ghost" size="sm" className="w-full justify-start text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 h-7 text-xs"
                onClick={() => { setAiPrompt(`Make it ${style.toLowerCase()}.`); }}
              >
                <Shuffle className="w-3 h-3 mr-2 text-zinc-600" /> {style}
              </Button>
            ))}
          </div>
        )}

        {tool === 'settings' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project Settings</h3>
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px]">AI Creative Freedom</Label>
              <Select value={project.aiFreedom} onValueChange={v => updateProject({ aiFreedom: v as any })}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="full">Full Creative — AI adds freely</SelectItem>
                  <SelectItem value="assisted">Assisted — AI enhances only</SelectItem>
                  <SelectItem value="strict">Strict — AI does exactly what you say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px]">Default Voice</Label>
              <Select value="jam" onValueChange={() => {}}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {VOICE_OPTIONS.map(v => <SelectItem key={v.value} value={v.value}>{v.label} — {v.desc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px]">Tone: {project.tone}</Label>
              <Select value={project.tone} onValueChange={v => updateProject({ tone: v })}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {TONE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {tool === 'assistant' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">AI Assistant</h3>
            <p className="text-[11px] text-zinc-600">Ask AI to modify your project. Select a scene first, then describe the change.</p>
            <Textarea
              placeholder='e.g., "Make scene 2 more dramatic", "Add a transition between scenes 1 and 2", "Rewrite the voice script to be more punchy"'
              className="bg-zinc-800/50 border-zinc-700/50 text-xs min-h-[80px] resize-none"
            />
            <Button className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-500" disabled>
              <Bot className="w-3 h-3 mr-1.5" /> Apply AI Edit
            </Button>
          </div>
        )}

        {tool === 'brand' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Brand Kit</h3>
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px]">Brand Colors</Label>
              <Input value={project.brandColors} onChange={e => updateProject({ brandColors: e.target.value })} placeholder="#7C3AED,#F59E0B" className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs" />
              <div className="flex gap-1 mt-1">
                {project.brandColors.split(',').map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded border border-zinc-700" style={{ backgroundColor: c.trim() }} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px]">Visual Style</Label>
              <Input value={project.visualStyle} onChange={e => updateProject({ visualStyle: e.target.value })} placeholder="e.g., dark luxury, neon" className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs" />
            </div>
          </div>
        )}

        {tool === 'export' && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Export</h3>
            <p className="text-[11px] text-zinc-600">Render all scenes into a final video. Uses the Export button in the top bar.</p>
            <div className="text-[11px] text-zinc-600 space-y-1">
              <p>Resolution: 1080 x 1920 (9:16)</p>
              <p>Format: MP4 (H.264)</p>
              <p>Scenes: {project.scenes.length}</p>
              <p>Duration: {project.scenes.reduce((s, sc) => s + sc.duration, 0).toFixed(1)}s</p>
            </div>
          </div>
        )}

        {(tool === 'voice' || tool === 'music' || tool === 'effects' || tool === 'templates' || tool === 'assets') && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{SIDEBAR_TOOLS.find(t => t.id === tool)?.label}</h3>
            <p className="text-[11px] text-zinc-600">
              {tool === 'voice' && 'Voice settings are per-scene. Select a scene and configure voice in the Properties panel.'}
              {tool === 'music' && 'Background music coming soon. Add music tracks to the timeline.'}
              {tool === 'effects' && 'Effects and transitions are configured per-scene in the Properties panel.'}
              {tool === 'templates' && 'Ad templates coming soon. Start from a pre-built structure.'}
              {tool === 'assets' && 'Project assets will appear here as you generate images and voiceovers.'}
            </p>
          </div>
        )}

        {/* Activity Log (always shown at bottom) */}
        <Separator className="bg-zinc-800/50" />
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Activity</h3>
          <div className="bg-black/30 rounded-lg p-2 max-h-[150px] overflow-y-auto font-mono text-[9px] leading-relaxed">
            {logs.length === 0 ? <p className="text-zinc-700">Waiting...</p> : logs.map((l, i) => <p key={i} className="text-zinc-600">{l}</p>)}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── PREVIEW WINDOW ────────────────────────────────────────────────
function PreviewWindow({ project, currentScene, playheadTime, sceneStartTimes, isPlaying, isMuted, onPlayPause, onStop, onMuteToggle, onSeek }: {
  project: Project; currentScene: Scene | null; playheadTime: number;
  sceneStartTimes: Record<string, number>; isPlaying: boolean; isMuted: boolean;
  onPlayPause: () => void; onStop: () => void; onMuteToggle: () => void; onSeek: (t: number) => void;
}) {
  const scene = currentScene || project.scenes[0];
  const totalDuration = project.scenes.reduce((s, sc) => s + sc.duration, 0);

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[260px]">
      {/* Video frame */}
      <div className="relative w-full aspect-[9/16] bg-[#0a0a0f] rounded-xl overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black/50">
        {scene?.imageUrl ? (
          <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Image className="w-8 h-8 text-zinc-800" />
            <p className="text-zinc-700 text-xs">No image</p>
            <p className="text-zinc-800 text-[10px]">Generate or upload in Properties</p>
          </div>
        )}
        {/* Overlay text */}
        {scene?.overlayText && (
          <div className="absolute inset-x-0 bottom-16 flex justify-center">
            <span className="text-white text-sm font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-center px-4">{scene.overlayText}</span>
          </div>
        )}
        {/* Gradients */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {/* Time badge */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-white text-[10px] font-medium">{playheadTime.toFixed(1)}s / {totalDuration.toFixed(1)}s</span>
        </div>
        {/* Camera badge */}
        {scene?.camera && scene.camera !== 'static' && (
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
            <span className="text-violet-300 text-[9px] font-medium">{scene.camera.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={onStop}>
          <SkipBack className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-zinc-800/50 text-white hover:text-white hover:bg-zinc-700/50 rounded-full" onClick={onPlayPause}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={onMuteToggle}>
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </Button>
        <span className="text-[10px] text-zinc-600 ml-2">{totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  );
}

// ─── TIMELINE AREA ─────────────────────────────────────────────────
function TimelineArea({ project, timelineZoom, playheadTime, selectedSceneId, sceneStartTimes, onSceneSelect, onSceneDurationChange }: {
  project: Project; timelineZoom: number; playheadTime: number;
  selectedSceneId: string | null; sceneStartTimes: Record<string, number>;
  onSceneSelect: (id: string | null) => void;
  onSceneDurationChange: (id: string, duration: number) => void;
}) {
  const totalDuration = project.scenes.reduce((s, sc) => s + sc.duration, 0);
  const pps = PIXELS_PER_SECOND * timelineZoom; // pixels per second
  const trackWidth = Math.max(800, totalDuration * pps + 100);
  const [resizingSceneId, setResizingSceneId] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartDur = useRef(0);

  const handleResizeStart = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    setResizingSceneId(sceneId);
    resizeStartX.current = e.clientX;
    resizeStartDur.current = project.scenes.find(s => s.id === sceneId)?.duration || 4;
  };

  useEffect(() => {
    if (!resizingSceneId) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      const newDur = Math.max(1, Math.round((resizeStartDur.current + dx / pps) * 2) / 2);
      onSceneDurationChange(resizingSceneId, newDur);
    };
    const handleUp = () => setResizingSceneId(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [resizingSceneId, pps, onSceneDurationChange]);

  return (
    <div className="flex-1 overflow-auto" ref={timelineRef}>
      <div className="relative min-h-full" style={{ width: trackWidth }}>
        {/* Time ruler */}
        <div className="h-6 border-b border-zinc-800/30 relative flex-shrink-0">
          {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: i * pps }}>
              <span className="text-[9px] text-zinc-600 mt-0.5">{i}s</span>
              <div className="w-px h-2 bg-zinc-800/50" />
            </div>
          ))}
          {/* Playhead */}
          <div className="absolute top-0 bottom-0 w-px bg-red-500 z-20" style={{ left: playheadTime * pps }}>
            <div className="w-2.5 h-2.5 bg-red-500 rounded-sm -ml-[4px] -mt-0.5" />
          </div>
        </div>

        {/* Tracks */}
        {TRACKS.filter(t => t.type === 'image' || t.type === 'voice' || t.type === 'text').map(track => (
          <div key={track.type} className="flex border-b border-zinc-800/20" style={{ height: track.height }}>
            {/* Track label */}
            <div className="w-16 flex-shrink-0 border-r border-zinc-800/30 flex items-center px-2">
              <span className="text-[9px] text-zinc-600 font-medium">{track.label}</span>
            </div>
            {/* Track content */}
            <div className="flex-1 relative py-1">
              {project.scenes.map((scene) => {
                const start = sceneStartTimes[scene.id] || 0;
                const isImageTrack = track.type === 'image';
                const isVoiceTrack = track.type === 'voice';
                const isTextTrack = track.type === 'text';

                if (isImageTrack) {
                  const isSelected = scene.id === selectedSceneId;
                  return (
                    <div key={scene.id} className="absolute top-1 bottom-1 group" style={{ left: start * pps, width: scene.duration * pps }}>
                      <div
                        onClick={() => onSceneSelect(scene.id)}
                        className={`h-full rounded-md cursor-pointer border transition-all flex items-center gap-1 px-2 overflow-hidden ${
                          isSelected
                            ? 'border-violet-400 bg-violet-500/20 shadow-sm shadow-violet-500/20'
                            : 'border-zinc-700/30 bg-zinc-800/40 hover:bg-zinc-800/60'
                        }`}
                      >
                        {scene.imageUrl ? (
                          <img src={scene.imageUrl} alt="" className="h-full w-10 object-cover rounded-sm flex-shrink-0" />
                        ) : (
                          <Image className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        )}
                        <span className="text-[9px] text-zinc-400 truncate">{scene.overlayText || `Scene ${scene.order + 1}`}</span>
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-violet-500/30 rounded-r-md hover:bg-violet-500/50 transition-opacity"
                        onMouseDown={e => handleResizeStart(e, scene.id)}
                      />
                    </div>
                  );
                }

                if (isVoiceTrack && scene.voiceScript) {
                  return (
                    <div key={scene.id} className="absolute top-1 bottom-1" style={{ left: start * pps, width: scene.duration * pps }}>
                      <div className={`h-full rounded-md border border-emerald-500/20 bg-emerald-500/10 flex items-center px-2 overflow-hidden cursor-pointer ${scene.id === selectedSceneId ? 'border-emerald-400' : ''}`}
                        onClick={() => onSceneSelect(scene.id)}
                      >
                        <Mic className="w-3 h-3 text-emerald-500/60 flex-shrink-0 mr-1" />
                        <span className="text-[9px] text-emerald-400/60 truncate">{scene.voiceScript.substring(0, 30)}...</span>
                      </div>
                    </div>
                  );
                }

                if (isTextTrack && scene.overlayText) {
                  return (
                    <div key={scene.id} className="absolute top-1 bottom-1" style={{ left: start * pps, width: scene.duration * pps }}>
                      <div className="h-full rounded-md border border-amber-500/20 bg-amber-500/10 flex items-center px-2 overflow-hidden cursor-pointer"
                        onClick={() => onSceneSelect(scene.id)}
                      >
                        <Type className="w-3 h-3 text-amber-500/60 flex-shrink-0 mr-1" />
                        <span className="text-[9px] text-amber-400/60 truncate">{scene.overlayText}</span>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROPERTIES PANEL ──────────────────────────────────────────────
function PropertiesPanel({ scene, onUpdate, onGenerateImage, onGenerateVoice, generatingImage, generatingVoice, onDelete, onDuplicate, onMoveUp, onMoveDown }: {
  scene: Scene | null; onUpdate: (u: Partial<Scene>) => void;
  onGenerateImage: () => void; onGenerateVoice: () => void;
  generatingImage: boolean; generatingVoice: boolean;
  onDelete: () => void; onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  if (!scene) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-zinc-700 text-xs text-center">Select a scene on the timeline to edit its properties</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-400">Scene {scene.order + 1}</h3>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300" onClick={onMoveUp}><ChevronLeft className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300" onClick={onMoveDown}><ChevronRight className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300" onClick={onDuplicate}><Copy className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600/60 hover:text-red-400" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </div>

        {/* Image Preview */}
        {scene.imageUrl ? (
          <div className="aspect-[9/16] rounded-lg overflow-hidden bg-zinc-800/30 border border-zinc-800/50">
            <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-[9/16] rounded-lg bg-zinc-800/20 border border-dashed border-zinc-700/30 flex flex-col items-center justify-center gap-2">
            <Image className="w-6 h-6 text-zinc-700" />
            <p className="text-zinc-700 text-[10px]">No image</p>
          </div>
        )}

        {/* Duration */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-zinc-500 text-[10px]">Duration</Label>
            <span className="text-[10px] text-zinc-400">{scene.duration}s</span>
          </div>
          <Slider value={[scene.duration]} min={1} max={15} step={0.5} onValueChange={([v]) => onUpdate({ duration: v })} className="py-1" />
        </div>

        <Separator className="bg-zinc-800/40" />

        {/* Image Prompt */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Image</Label>
          <Textarea
            value={scene.imagePrompt}
            onChange={e => onUpdate({ imagePrompt: e.target.value })}
            placeholder="Describe the cinematic image for this scene..."
            className="bg-zinc-800/50 border-zinc-700/50 text-[11px] min-h-[70px] resize-none"
          />
          <Button size="sm" className="w-full h-7 text-[10px] bg-violet-600 hover:bg-violet-500" onClick={onGenerateImage} disabled={generatingImage || !scene.imagePrompt}>
            {generatingImage ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3 mr-1" /> Generate Image</>}
          </Button>
        </div>

        <Separator className="bg-zinc-800/40" />

        {/* Voice Script */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Voice Script</Label>
          <Textarea
            value={scene.voiceScript}
            onChange={e => onUpdate({ voiceScript: e.target.value })}
            placeholder="What the voiceover says in this scene..."
            className="bg-zinc-800/50 border-zinc-700/50 text-[11px] min-h-[60px] resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500" onClick={onGenerateVoice} disabled={generatingVoice || !scene.voiceScript}>
              {generatingVoice ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Recording...</> : <><Mic className="w-3 h-3 mr-1" /> Generate Voice</>}
            </Button>
            {scene.voiceUrl && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Done</Badge>
            )}
          </div>
        </div>

        <Separator className="bg-zinc-800/40" />

        {/* Overlay Text */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Overlay Text</Label>
          <Input value={scene.overlayText} onChange={e => onUpdate({ overlayText: e.target.value })} placeholder="Big text on screen (max 8 words)" className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs" />
        </div>

        {/* Camera */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Camera Movement</Label>
          <Select value={scene.camera} onValueChange={v => onUpdate({ camera: v as any })}>
            <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {CAMERA_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Transition */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Transition Out</Label>
          <Select value={scene.transition} onValueChange={v => onUpdate({ transition: v as any })}>
            <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {TRANSITION_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Text Animation */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Text Animation</Label>
          <Select value={scene.textAnimation} onValueChange={v => onUpdate({ textAnimation: v as any })}>
            <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {TEXT_ANIMATIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Notes</Label>
          <Textarea value={scene.notes} onChange={e => onUpdate({ notes: e.target.value })} placeholder="Internal notes..." className="bg-zinc-800/50 border-zinc-700/50 text-[11px] min-h-[40px] resize-none" />
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── SCENE EDIT FORM (dialog) ──────────────────────────────────────
function SceneEditForm({ scene, onChange, onSave, onGenerateImage, onGenerateVoice }: {
  scene: Scene; onChange: (u: Partial<Scene>) => void; onSave: () => void;
  onGenerateImage: () => void; onGenerateVoice: () => void;
}) {
  return (
    <div className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Voice Script</Label>
        <Textarea value={scene.voiceScript} onChange={e => onChange({ voiceScript: e.target.value })} className="bg-zinc-800/50 border-zinc-700/50 text-sm min-h-[80px]" />
        <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400" onClick={onGenerateVoice}>
          <Mic className="w-3 h-3 mr-1" /> Generate Voice
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Image Prompt</Label>
        <Textarea value={scene.imagePrompt} onChange={e => onChange({ imagePrompt: e.target.value })} className="bg-zinc-800/50 border-zinc-700/50 text-sm min-h-[80px]" />
        <Button size="sm" variant="outline" className="h-7 text-xs border-violet-500/30 text-violet-400" onClick={onGenerateImage}>
          <Sparkles className="w-3 h-3 mr-1" /> Generate Image
        </Button>
      </div>
      <Button className="w-full" onClick={onSave}>Save</Button>
    </div>
  );
}