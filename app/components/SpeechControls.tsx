"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Square, Volume2, VolumeX } from "lucide-react";

type Props = {
  text: string;
  className?: string;
  speakLabel?: string;
  stopLabel?: string;
};

export default function SpeechControls({
  text,
  className = "",
  speakLabel = "말하기",
  stopLabel = "중지",
}: Props) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const canUseSpeech = useMemo(() => {
    return typeof window !== "undefined" && !!window.speechSynthesis;
  }, []);

  const stopSpeak = useCallback(() => {
    if (!canUseSpeech) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [canUseSpeech]);

  const speak = useCallback(() => {
    if (!canUseSpeech) return;
    const t = (text ?? "").trim();
    if (!t) return;
    if (!voiceEnabled) setVoiceEnabled(true);
    if (volume <= 0) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "ko-KR";
    u.rate = 0.9;
    u.volume = Math.max(0, Math.min(1, volume));
    u.onstart = () => setIsSpeaking(true);
    u.onend = u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [canUseSpeech, text, voiceEnabled, volume]);

  useEffect(() => {
    return () => {
      stopSpeak();
    };
  }, [stopSpeak]);

  if (!text?.trim()) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={speak}
        disabled={isSpeaking}
        className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-200 hover:bg-slate-500 disabled:opacity-50 inline-flex items-center gap-1"
        aria-label={speakLabel}
        title={speakLabel}
      >
        <Volume2 className="w-3.5 h-3.5" />
        {speakLabel}
      </button>
      <button
        type="button"
        onClick={stopSpeak}
        className="text-xs px-2 py-1 rounded bg-slate-700/80 hover:bg-red-500/25 text-slate-300 hover:text-red-300 inline-flex items-center gap-1"
        aria-label={stopLabel}
        title={stopLabel}
      >
        <Square className="w-3.5 h-3.5" />
        {stopLabel}
      </button>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setVoiceEnabled((v) => !v)}
          className="p-1 rounded hover:bg-slate-700/60 transition"
          title={voiceEnabled ? "음성 끄기(무음)" : "음성 켜기"}
          aria-label={voiceEnabled ? "음성 끄기" : "음성 켜기"}
        >
          {voiceEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-slate-300" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          disabled={!voiceEnabled}
          className="w-20 h-1.5 accent-blue-500 bg-slate-600 rounded disabled:opacity-40"
          aria-label="음량"
        />
      </span>
    </div>
  );
}

