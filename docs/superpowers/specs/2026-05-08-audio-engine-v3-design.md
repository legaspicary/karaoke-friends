# Audio Engine V3 — VST-Quality Vocal Processing

## Overview

Replace the V2 audio engine with a hybrid Rust/WASM + Web Audio architecture that delivers VST-quality vocal processing for browser-based karaoke. The core channel strip (EQ, compression, de-essing, saturation, limiting) runs as compiled Rust/WASM inside an AudioWorklet. Reverb uses real recorded impulse responses through Web Audio's ConvolverNode. Echo stays in Web Audio with upgraded feedback filtering.

**Quality priorities:** Reverb depth/character, vocal warmth/polish.
**Latency priority:** Optimize for output quality, not local monitoring latency.

## Signal Flow

```
Mic Input (MediaStreamSource)
    |
+--- WASM AudioWorklet (single processor) ---+
|  Parametric EQ (4-band)                     |
|  |                                          |
|  Compressor (look-ahead, RMS, soft-knee)    |
|  |                                          |
|  De-esser (sidechain on 4-8 kHz)            |
|  |                                          |
|  Saturation (2x oversampled, tube character) |
+--------------------------------------------- +
    |
Dry/Wet Split (GainNodes)
    +-- Dry -> dryGain
    +-- Wet -> PreDelay -> ConvolverNode (real IR) -> wetHPF -> wetLPF -> wetGain
    |
Sum -> Echo (DelayNode + feedback + filter) -> WASM Limiter WorkletNode
    |
processedMicGain -> MediaStreamDestination -> WebRTC
                 +-> monitorGain -> ctx.destination (headphones)
```

### Channel Configuration

Mono-in, stereo-out. The mic input and channel strip (EQ through saturation) process in mono. The reverb ConvolverNode outputs stereo (real IRs are stereo). The echo ping-pong mode produces stereo. The limiter and output path are stereo.

### WASM WorkletNode Topology

Two AudioWorkletNode instances share the same WASM module but run different configurations:

1. **Channel Strip WorkletNode** — runs EQ, compressor, de-esser, saturation (mono)
2. **Limiter WorkletNode** — runs brick-wall limiter with true-peak detection (stereo, positioned after reverb + echo)

Both instances are created from the same AudioWorkletProcessor class, configured via an initial message that selects which DSP blocks to activate.

### Why This Split

- **WASM handles:** EQ, compression, de-essing, saturation, limiting. These need sample-accurate control, sidechain routing, oversampling, or look-ahead that native Web Audio nodes cannot provide.
- **Web Audio handles:** Convolution reverb (ConvolverNode is excellent for IR playback), delay/echo (DelayNode works well), gain/routing (trivial), device I/O (MediaStream APIs).

The WASM worklets run on the audio render thread, not the main thread.

## WASM DSP Processing Blocks

### Parametric EQ (4-band)

Biquad filter cascade using Robert Bristow-Johnson's Audio EQ Cookbook coefficients.

| Band | Type | Range | Default | Purpose |
|------|------|-------|---------|---------|
| 1 | High-pass | 40-300 Hz | 80 Hz, 12dB/oct | Rumble removal |
| 2 | Bell (low-mid) | 200-2000 Hz, +/-12 dB | 350 Hz, +0 dB | Body/warmth |
| 3 | Bell (high-mid) | 2-10 kHz, +/-12 dB | 3.5 kHz, +0 dB | Presence/clarity |
| 4 | Low-pass | 8-20 kHz | 16 kHz, 12dB/oct | Air control |

Ships with vocal presets: Warm (male-focused), Bright (female-focused), Neutral (flat).

### Compressor

Full-featured dynamics processor replacing the native DynamicsCompressorNode.

- **Detection:** RMS with configurable window (10-100ms)
- **Look-ahead:** 5ms delay buffer
- **Soft knee:** Adjustable width (0-20 dB)
- **Attack:** 0.1-100ms
- **Release:** 10-1000ms
- **Ratio:** 1:1 to 20:1
- **Threshold:** -60 to 0 dB
- **Makeup gain:** Auto (compensates for gain reduction) or manual 0-24 dB
- **Sidechain filter:** Internal HPF to ignore low-frequency energy

Default: threshold -18 dB, ratio 3:1, knee 6 dB, attack 10ms, release 80ms, auto makeup.

### De-esser

Split-band sidechain compressor targeting sibilance.

- **Crossover:** Adjustable 3-10 kHz (default 6 kHz)
- **Detection:** Listens to high band only
- **Action:** Compresses high band when exceeding threshold
- **Range:** 0-12 dB maximum reduction
- **Default:** 6 kHz center, -20 dB threshold, 6 dB range

### Saturation

2x oversampled waveshaper for harmonic warmth.

- **Oversampling:** Process at 2x sample rate, low-pass filter back down (prevents aliasing)
- **Transfer function:** `tanh(drive * x)`
- **Drive:** 0-24 dB
- **Mix:** Parallel blend 0-100% (subtle at 10-20% adds presence)
- **Output compensation:** Auto-levels to match input loudness

### Output Limiter

Brick-wall protection before WebRTC.

- **Ceiling:** -1 dBFS (true peak via 4x oversampled detection)
- **Look-ahead:** 1ms
- **Release:** 50ms

## Reverb System — Real Impulse Responses

### Preset IRs

Ship 5 preset IRs (48 kHz stereo WAV, ~100-400 KB each, loaded on demand):

| Preset | Character | Decay | Use Case |
|--------|-----------|-------|----------|
| Small Room | Intimate, close | ~0.5s | Solo practice |
| Medium Hall | Spacious, natural | ~1.5s | Group karaoke |
| Large Hall | Cathedral, expansive | ~3.0s | Dramatic ballads |
| Plate | Smooth, bright, studio | ~1.8s | Pop/rock vocals |
| Spring | Vintage, distinctive | ~1.2s | Retro character |

IR sources: Open-source libraries (OpenAIR, EchoThief) — CC-licensed captures of real spaces.

### Reverb Controls

- **Preset selector:** Which IR to load
- **Pre-delay:** 0-100ms
- **Decay trim:** Re-renders the IR AudioBuffer in JavaScript with an exponential gain envelope applied, then reassigns to the ConvolverNode. Triggered when the user changes the decay setting (not real-time — takes ~10ms to re-render offline).
- **Dry/Wet mix:** 0-100%
- **Wet EQ:** HPF (50-400 Hz) and LPF (4-16 kHz) on wet return (Web Audio BiquadFilters)

## Echo System — Upgraded

Stays entirely in Web Audio (DelayNode + BiquadFilterNode feedback loop).

- **Filter in feedback path:** HPF + LPF inside the loop — each repeat progressively darkens
- **Tempo sync:** Optional BPM input, delay snaps to musical divisions (1/4, 1/8, dotted 1/8, triplet 1/8). Falls back to free ms if no BPM.
- **Feedback control:** Exposed 0-80% (V2 was hardcoded 40%)
- **Stereo ping-pong:** Alternates repeats L/R for width
- **Delay time:** 50-1000ms (free mode)

## Rust/WASM Project Structure

```
packages/audio-dsp/
  Cargo.toml              # Rust crate, cdylib target for WASM
  src/
    lib.rs                # WASM bindings (wasm-bindgen), DSP chain orchestrator
    eq.rs                 # 4-band parametric EQ
    compressor.rs         # RMS/peak compressor with look-ahead and soft knee
    deesser.rs            # Split-band sidechain de-esser
    saturation.rs         # 2x oversampled tanh waveshaper
    limiter.rs            # Brick-wall output limiter with true-peak detection
    utils.rs              # Ring buffers, interpolation, parameter smoothing
  tests/
    *.rs                  # Unit tests (run natively, no browser needed)
  build.sh                # wasm-pack build -> apps/web/public/dsp/
```

### Build Pipeline

```
Rust source -> wasm-pack build --target web -> .wasm + JS glue
                                                |
                            apps/web/public/dsp/audio_dsp_bg.wasm
                            apps/web/public/dsp/audio_dsp.js
```

### AudioWorklet Integration

```
apps/web/src/lib/audio/
  engine-v3.ts            # V3 engine: setup, routing, lifecycle
  worklet/
    dsp-processor.ts      # AudioWorkletProcessor: loads WASM, bridges samples
  effects/
    reverb-v3.ts          # IR loader + ConvolverNode + wet EQ + decay trim
    echo-v3.ts            # Upgraded delay with feedback filtering
  presets/
    vocal-presets.ts       # Named parameter sets for EQ/comp/saturation
    reverb-presets.ts      # IR metadata + wet EQ defaults per preset
  ir/                     # Impulse response WAV files (loaded on demand)
```

### WASM <-> AudioWorklet Data Flow

The AudioWorkletProcessor allocates a shared Float32Array buffer in WASM memory. Each `process()` call:

1. Copies input samples into the WASM buffer (128 samples per quantum at 48 kHz)
2. Calls `wasm.process(input_ptr, output_ptr, 128)`
3. Copies processed samples from WASM buffer to output

Parameter changes sent via `port.postMessage()` from main thread. All parameter changes use internal 5ms smoothing to prevent clicks.

## TypeScript API

```typescript
interface AudioEngineV3 {
  // Lifecycle
  init(stream: MediaStream): Promise<void>;
  dispose(): void;
  getOutputStream(): MediaStream;

  // Gain
  setMicGain(value: number): void;        // 0-2
  setProcessedGain(value: number): void;   // 0-2
  setMonitorEnabled(enabled: boolean): void;

  // EQ
  setEQPreset(preset: 'warm' | 'bright' | 'neutral' | 'custom'): void;
  setEQBand(band: 1|2|3|4, params: {frequency?: number; gain?: number; q?: number}): void;

  // Compressor
  setCompressor(params: Partial<CompressorParams>): void;
  getGainReduction(): number;

  // De-esser
  setDeesser(params: {threshold?: number; frequency?: number; range?: number}): void;

  // Saturation
  setSaturation(params: {drive?: number; mix?: number}): void;

  // Reverb
  setReverbPreset(preset: 'small-room'|'medium-hall'|'large-hall'|'plate'|'spring'): void;
  setReverbMix(amount: number): void;
  setReverbPreDelay(ms: number): void;
  setReverbDecay(amount: number): void;

  // Echo
  setEchoMix(amount: number): void;
  setEchoTime(ms: number): void;
  setEchoFeedback(amount: number): void;
  setEchoBPM(bpm: number | null): void;
  setEchoDivision(div: '1/4'|'1/8'|'dotted-1/8'|'triplet-1/8'): void;

  // Preset
  loadVocalPreset(preset: 'warm' | 'bright' | 'neutral'): void;
}
```

## UI Integration

### Simple Mode (default)

One-click vocal presets (Warm / Bright / Neutral) + reverb preset selector + reverb/echo mix sliders. Covers 90% of users.

### Advanced Mode (toggle)

Expands to show individual EQ bands, compressor controls, de-esser threshold, saturation drive. Gain reduction meter showing compressor activity.

### Engine Switching

V3 slots into the existing `useAudioEngine` hook alongside V1/V2. Fallback chain:

```
V3 (WASM) -> V2 (Web Audio enhanced) -> V1 (Web Audio basic)
```

If WASM fails to load or AudioWorklet is unsupported, falls back automatically.

## Vocal Presets

| Preset | EQ Character | Compression | Saturation |
|--------|-------------|-------------|------------|
| Warm | Boosted 250-400 Hz, gentle HPF at 60 Hz | Slow attack (25ms), medium ratio (3:1) | Drive 6 dB, mix 15% |
| Bright | Boosted 3-5 kHz, HPF at 100 Hz, slight LPF dip | Fast attack (5ms), higher ratio (4:1) | Drive 3 dB, mix 8% |
| Neutral | Flat (no boost/cut), HPF at 80 Hz | Gentle (threshold -18, ratio 2.5:1) | Off (drive 0, mix 0%) |

## Dependencies

- **Rust toolchain** + `wasm-pack` (build-time only)
- **wasm-bindgen** (Rust crate for WASM bindings)
- No runtime JS audio libraries — all DSP is custom Rust or native Web Audio
- IR files: ~2 MB total for 5 presets (loaded on demand, not bundled in initial JS)

## Browser Support

- **Required:** AudioWorklet + WebAssembly (Chrome 66+, Firefox 76+, Safari 14.1+)
- **Fallback:** V2 engine for older browsers
- **Not supported:** IE, pre-Chromium Edge
