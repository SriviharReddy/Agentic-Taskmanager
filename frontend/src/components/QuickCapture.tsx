import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Image, 
  Link as LinkIcon, 
  Mic, 
  Sparkles, 
  Upload, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';
import { IngestResponse } from '../types';

interface QuickCaptureProps {
  onIngestSuccess: (response: IngestResponse) => void;
  onRefreshTasks: () => void;
}

type TabType = 'text' | 'image' | 'url' | 'voice';

export const QuickCapture: React.FC<QuickCaptureProps> = ({ onIngestSuccess, onRefreshTasks }) => {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle clipboard image paste directly anywhere on window
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                const b64 = reader.result as string;
                setImageBase64(b64);
                setImagePreview(b64);
                setActiveTab('image');
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Audio recording controls
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setStatusMsg({ type: 'error', text: 'Microphone access denied or unavailable.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current ?? undefined);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setImageBase64(b64);
        setImagePreview(b64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setStatusMsg(null);

    try {
      const payload: {
        text?: string;
        url?: string;
        image_base64?: string;
        audio_base64?: string;
      } = {};

      if (activeTab === 'text' && textContent.trim()) {
        payload.text = textContent.trim();
      } else if (activeTab === 'url' && urlContent.trim()) {
        payload.url = urlContent.trim();
      } else if (activeTab === 'image' && imageBase64) {
        payload.image_base64 = imageBase64;
      } else if (activeTab === 'voice' && audioBase64) {
        payload.audio_base64 = audioBase64;
      } else {
        setStatusMsg({ type: 'error', text: 'Please enter or attach content to extract tasks from.' });
        setIsLoading(false);
        return;
      }

      const res = await api.ingestContent(payload);
      onIngestSuccess(res);

      if (res.status === 'completed') {
        setStatusMsg({
          type: 'success',
          text: `Successfully extracted & created ${res.tasks_extracted.length} tasks!`,
        });
        // Clear inputs
        setTextContent('');
        setUrlContent('');
        setImageBase64(null);
        setImagePreview(null);
        setAudioBase64(null);
        onRefreshTasks();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3.5 shadow-sm">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
              activeTab === 'text'
                ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Text / Brain Dump</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
              activeTab === 'image'
                ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Image className="h-3.5 w-3.5" />
            <span>Screenshot</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
              activeTab === 'url'
                ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            <span>URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
              activeTab === 'voice'
                ? 'bg-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Voice Memo</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500 hidden sm:flex font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80"></span>
          <span>Gemini 3.7 Flash</span>
        </div>
      </div>

      {/* Input Bodies */}
      <form onSubmit={handleSubmit}>
        {activeTab === 'text' && (
          <div>
            <textarea
              rows={3}
              placeholder="Paste raw notes, unorganized thoughts, or task dumps: 'Ship the authentication fix by tomorrow 2pm, email Sarah the Figma link, review DB migration script...'"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition resize-none leading-relaxed"
            />
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-3">
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 p-2 max-h-48 flex items-center justify-center">
                <img src={imagePreview} alt="Screenshot preview" className="max-h-40 rounded object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setImageBase64(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-3 right-3 bg-zinc-900/90 hover:bg-rose-600 text-zinc-200 hover:text-white p-1 rounded-md border border-zinc-700 backdrop-blur-sm transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border border-dashed border-zinc-750 hover:border-zinc-600 rounded-lg p-6 bg-zinc-950/40 cursor-pointer transition group">
                <Upload className="h-6 w-6 text-zinc-500 group-hover:text-zinc-300 transition mb-2" />
                <span className="text-xs text-zinc-300 font-medium">
                  Click to upload screenshot, or paste directly with <kbd className="font-mono text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300">⌘V</kbd> / <kbd className="font-mono text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300">Ctrl+V</kbd>
                </span>
                <span className="text-[11px] text-zinc-500 mt-1">Supports PNG, JPG, WebP screenshots of Slack, Linear, email, whiteboards</span>
                <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
              </label>
            )}
          </div>
        )}

        {activeTab === 'url' && (
          <div>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="url"
                placeholder="Paste URL (e.g. GitHub issue, PR, Google Doc, Linear link)..."
                value={urlContent}
                onChange={(e) => setUrlContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition"
              />
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="flex flex-col items-center justify-center p-5 bg-zinc-950/50 rounded-lg border border-zinc-800/80 text-center space-y-3">
            {!audioBase64 ? (
              <>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/20'
                      : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <Mic className="h-5 w-5" />
                </button>
                <span className="text-xs text-zinc-300 font-medium">
                  {isRecording ? `Recording... (${formatSeconds(recordingDuration)}) — click to finish` : 'Click to record voice memo'}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-900 px-3.5 py-2 rounded-lg border border-zinc-800 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-zinc-200 font-medium">Voice note ready</span>
                <button
                  type="button"
                  onClick={() => setAudioBase64(null)}
                  className="text-zinc-400 hover:text-zinc-200 underline ml-2"
                >
                  Record again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Button & Status */}
        <div className="flex items-center justify-between mt-3 pt-1">
          {statusMsg ? (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${statusMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              <span>{statusMsg.text}</span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 hidden sm:block">
              Press <kbd className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400">⌘↵</kbd> to extract
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-zinc-700" />
                <span>Extract & Organize</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
