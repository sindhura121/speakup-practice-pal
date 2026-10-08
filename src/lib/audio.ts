// Browser-only audio capture → 16 kHz mono WAV, plus pause metrics and transcription client.
import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";
import type { AudioMetrics } from "@/lib/ai/types";

const TARGET_RATE = 16000;

function downsample(chunks: Float32Array[], from: number): Float32Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    merged.set(c, o);
    o += c.length;
  }
  if (from === TARGET_RATE) return merged;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const tag = (off: number, s: string) => [...s].forEach((ch, i) => v.setUint8(off + i, ch.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (const x of samples) {
    const s = Math.max(-1, Math.min(1, x));
    v.setInt16(off, s * (s < 0 ? 32768 : 32767), true);
    off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Computes voiced time and long pauses using 50 ms RMS frames with an adaptive threshold. */
function pauseMetrics(samples: Float32Array, rate: number) {
  const frame = Math.floor(rate * 0.05);
  const rms: number[] = [];
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += samples[j] * samples[j];
    rms.push(Math.sqrt(s / frame));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const peak = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const thr = Math.max(0.01, noise + (peak - noise) * 0.15);
  let voiced = 0, run = 0, longPauses = 0, longest = 0, started = false;
  for (const r of rms) {
    if (r >= thr) {
      if (started && run * 0.05 >= 2) {
        longPauses++;
        longest = Math.max(longest, run * 0.05);
      }
      started = true;
      run = 0;
      voiced++;
    } else run++;
  }
  return { speakingSec: Math.round(voiced * 0.05), longPauses, longestPauseSec: Math.round(longest * 10) / 10 };
}

export type Recording = { file: File; url: string; durationSec: number; speakingSec: number; longPauses: number; longestPauseSec: number };

export async function startRecording(onLevel?: (level: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(d));
    if (onLevel) {
      let s = 0;
      for (let i = 0; i < d.length; i += 8) s += d[i] * d[i];
      onLevel(Math.min(1, Math.sqrt(s / (d.length / 8)) * 6));
    }
  };
  source.connect(node);
  node.connect(ctx.destination);
  let stopped = false;
  return {
    async stop(): Promise<Recording> {
      if (stopped) throw new Error("Already stopped");
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect();
      source.disconnect();
      node.onaudioprocess = null;
      const samples = downsample(chunks, ctx.sampleRate);
      await ctx.close();
      const blob = encodeWav(samples, TARGET_RATE);
      if (blob.size < 4096) throw new Error("Recording was empty — please try again.");
      const m = pauseMetrics(samples, TARGET_RATE);
      return {
        file: new File([blob], "speech.wav", { type: "audio/wav" }),
        url: URL.createObjectURL(blob),
        durationSec: Math.round(samples.length / TARGET_RATE),
        ...m,
      };
    },
    cancel() {
      if (stopped) return;
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect();
      void ctx.close();
    },
  };
}

export async function transcribe(file: File, onDelta?: (text: string) => void): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
    body: form,
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok || ct.includes("application/json")) {
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Transcription failed");
    return j.text ?? "";
  }
  let text = "";
  let final: string | null = null;
  let err: string | null = null;
  const parser = createParser({
    onEvent(ev) {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "transcript.text.delta") {
          text += d.delta ?? "";
          onDelta?.(text);
        } else if (d.type === "transcript.text.done") final = d.text ?? text;
        else if (d.type === "error") err = d.error?.message ?? "Transcription failed";
      } catch {
        /* partial */
      }
    },
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(dec.decode(value, { stream: true }));
  }
  if (err) throw new Error(err);
  return (final ?? text).trim();
}

export function buildMetrics(rec: Pick<Recording, "durationSec" | "speakingSec" | "longPauses" | "longestPauseSec">, transcript: string): AudioMetrics {
  const wordCount = (transcript.match(/[A-Za-z']+/g) ?? []).length;
  const mins = Math.max(rec.speakingSec || rec.durationSec, 1) / 60;
  return { durationSec: rec.durationSec, speakingSec: rec.speakingSec, longPauses: rec.longPauses, longestPauseSec: rec.longestPauseSec, wordCount, wpm: Math.round(wordCount / mins) };
}

export async function uploadRecording(userId: string, file: File) {
  const path = `${userId}/${crypto.randomUUID()}.wav`;
  const { error } = await supabase.storage.from("recordings").upload(path, file, { contentType: "audio/wav" });
  return error ? null : path;
}

export async function recordingUrl(path: string) {
  const { data } = await supabase.storage.from("recordings").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Fallback: browser speech with per-personality variation. */
function speakFallback(text: string, personality: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onEnd?.();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const hash = [...personality].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (voices.length) u.voice = voices[hash % voices.length];
  u.rate = personality === "aggressive" ? 1.12 : personality === "calm" || personality === "quiet" ? 0.92 : 1;
  u.pitch = 0.85 + (hash % 5) * 0.08;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let speakGen = 0;

/** Stops any AI voice currently playing. */
export function stopSpeaking() {
  speakGen++;
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  currentSource = null;
  window.speechSynthesis?.cancel();
}

/**
 * Speaks AI lines aloud with a clear, natural AI voice (24 kHz PCM over SSE).
 * Falls back to the browser voice when the AI voice is unavailable.
 */
export async function speak(text: string, personality = "", onEnd?: () => void) {
  if (typeof window === "undefined") return onEnd?.();
  stopSpeaking();
  const gen = speakGen;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("no session");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ text, personality }),
    });
    if (!res.ok || !res.body) throw new Error("tts failed");

    // Collect base64 PCM deltas from the SSE stream.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const chunks: Uint8Array[] = [];
    let failed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const ev of events) {
        const line = ev.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const d = JSON.parse(payload);
          if (d.type === "speech.audio.delta" && d.audio) {
            const bin = atob(d.audio);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            chunks.push(bytes);
          } else if (d.type === "error" || d.type === "speech.error") {
            failed = true;
          }
        } catch {
          /* partial event */
        }
      }
    }
    if (failed || !chunks.length) throw new Error("no audio");

    // Merge into one 16-bit LE mono PCM buffer at 24 kHz.
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const pcm = new Uint8Array(total - (total % 2));
    let off = 0;
    for (const c of chunks) {
      pcm.set(c, off);
      off += c.length;
    }
    if (gen !== speakGen) return onEnd?.();
    const samples = new Int16Array(pcm.buffer, 0, pcm.length / 2);
    audioCtx ??= new AudioContext({ sampleRate: 24000 });
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const buffer = audioCtx.createBuffer(1, samples.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    currentSource = src;
    src.onended = () => {
      if (currentSource === src) currentSource = null;
      onEnd?.();
    };
    src.start();
  } catch {
    if (gen !== speakGen) return onEnd?.();
    speakFallback(text, personality, onEnd);
  }
}
