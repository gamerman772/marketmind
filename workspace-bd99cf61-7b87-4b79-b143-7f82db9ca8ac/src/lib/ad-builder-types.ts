// Ad Builder core types

export type CameraMove = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'static' | 'ken_burns';
export type TrackType = 'image' | 'voice' | 'text' | 'music' | 'sfx';
export type AIFreedom = 'full' | 'assisted' | 'strict';

export interface TimelineClip {
  id: string;
  sceneId: string;
  trackType: TrackType;
  startTime: number;   // seconds from start
  duration: number;    // seconds
  label: string;
}

export interface Scene {
  id: string;
  order: number;
  voiceScript: string;
  imagePrompt: string;
  imageUrl?: string;
  imageGenerating?: boolean;
  voiceUrl?: string;
  voiceGenerating?: boolean;
  overlayText: string;
  notes: string;
  duration: number;       // total scene duration in seconds
  camera: CameraMove;
  musicPrompt?: string;
  musicUrl?: string;
  sfxPrompt?: string;
  sfxUrl?: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textPosition: 'top' | 'center' | 'bottom';
  textAnimation: 'none' | 'fade_in' | 'slide_up' | 'typewriter' | 'pop';
  transition: 'none' | 'fade' | 'dissolve' | 'slide_left' | 'slide_right' | 'zoom_fade';
  volume: number;         // 0-1
  speed: number;          // voice speed
}

export interface Project {
  id: string;
  name: string;
  product: string;
  category: string;
  targetAudience: string;
  keySellingPoint: string;
  brandColors: string;    // comma separated hex colors
  visualStyle: string;
  tone: string;
  targetDuration: number; // seconds
  scenes: Scene[];
  clips: TimelineClip[];
  aiFreedom: AIFreedom;
  createdAt: string;
  updatedAt: string;
}

export interface ToolPanel {
  id: string;
  label: string;
  icon: string;
}

export const SIDEBAR_TOOLS: ToolPanel[] = [
  { id: 'generate', label: 'Generate', icon: 'Wand2' },
  { id: 'assets', label: 'Project Assets', icon: 'FolderOpen' },
  { id: 'brand', label: 'Brand Kit', icon: 'Palette' },
  { id: 'assistant', label: 'AI Assistant', icon: 'Bot' },
  { id: 'voice', label: 'Voice Library', icon: 'Mic' },
  { id: 'music', label: 'Music', icon: 'Music' },
  { id: 'effects', label: 'Effects', icon: 'Sparkles' },
  { id: 'templates', label: 'Templates', icon: 'Layout' },
  { id: 'export', label: 'Export', icon: 'Download' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

export const VOICE_OPTIONS = [
  { value: 'jam', label: 'Jam', desc: 'English, Natural' },
  { value: 'kazi', label: 'Kazi', desc: 'Standard' },
  { value: 'douji', label: 'Douji', desc: 'Expressive' },
  { value: 'luodo', label: 'Luodo', desc: 'Expressive' },
  { value: 'tongtong', label: 'Tongtong', desc: 'Warm' },
  { value: 'chuichui', label: 'Chuichui', desc: 'Cute' },
  { value: 'xiaochen', label: 'Xiaochen', desc: 'Professional' },
];

export const CAMERA_OPTIONS = [
  { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' },
  { value: 'pan_left', label: 'Pan Left' },
  { value: 'pan_right', label: 'Pan Right' },
  { value: 'ken_burns', label: 'Ken Burns' },
  { value: 'static', label: 'Static' },
];

export const TRANSITION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide_left', label: 'Slide Left' },
  { value: 'slide_right', label: 'Slide Right' },
  { value: 'zoom_fade', label: 'Zoom Fade' },
];

export const TEXT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade_in', label: 'Fade In' },
  { value: 'slide_up', label: 'Slide Up' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'pop', label: 'Pop' },
];

export const TONE_OPTIONS = [
  'Professional', 'Energetic', 'Luxury', 'Minimal', 'Funny',
  'Dramatic', 'Warm', 'Bold', 'Playful', 'Urgent',
];

export const CATEGORY_OPTIONS = [
  'SaaS / Software', 'E-commerce', 'Health & Wellness', 'Finance',
  'Education', 'Food & Beverage', 'Fashion', 'Tech Hardware',
  'Real Estate', 'Automotive', 'Entertainment', 'Other',
];

export function createEmptyScene(order: number): Scene {
  return {
    id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    order,
    voiceScript: '',
    imagePrompt: '',
    overlayText: '',
    notes: '',
    duration: 4,
    camera: 'zoom_in',
    fontFamily: 'Inter',
    fontSize: 38,
    textColor: '#FFFFFF',
    textPosition: 'bottom',
    textAnimation: 'fade_in',
    transition: 'fade',
    volume: 1.0,
    speed: 1.0,
  };
}

export function createDefaultProject(): Project {
  return {
    id: `proj_${Date.now()}`,
    name: 'Untitled Project',
    product: '',
    category: '',
    targetAudience: '',
    keySellingPoint: '',
    brandColors: '#7C3AED,#F59E0B',
    visualStyle: '',
    tone: 'Professional',
    targetDuration: 20,
    scenes: [createEmptyScene(0)],
    clips: [],
    aiFreedom: 'assisted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}