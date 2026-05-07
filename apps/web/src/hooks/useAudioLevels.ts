"use client";

import { useEffect, useRef, useState } from "react";

export function useAudioLevels(
  streams: Map<string, MediaStream | null>
): Map<string, number> {
  const [levels, setLevels] = useState<Map<string, number>>(() => new Map());
  const ctxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<
    Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>
  >(new Map());
  const rafRef = useRef(0);

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const { source } of analysersRef.current.values()) {
        source.disconnect();
      }
      analysersRef.current.clear();
      ctx.close();
    };
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const prev = analysersRef.current;
    const next = new Map<
      string,
      { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }
    >();

    for (const [id, stream] of streams) {
      if (!stream || stream.getAudioTracks().length === 0) continue;

      const existing = prev.get(id);
      if (existing) {
        next.set(id, existing);
        prev.delete(id);
      } else {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        next.set(id, { source, analyser });
      }
    }

    // Clean up removed entries
    for (const { source } of prev.values()) {
      source.disconnect();
    }

    analysersRef.current = next;
  }, [streams]);

  useEffect(() => {
    const data = new Uint8Array(128);

    function tick() {
      const result = new Map<string, number>();
      for (const [id, { analyser }] of analysersRef.current) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        result.set(id, sum / data.length / 255);
      }
      setLevels(result);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return levels;
}
