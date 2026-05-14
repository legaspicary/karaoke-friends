export type DspMode = "channel-strip" | "limiter";

export interface DspWorkletNode {
  node: AudioWorkletNode;
  ready: Promise<void>;
  setParam(type: string, params: Record<string, number>): void;
  requestMeters(): Promise<{ gainReduction: number }>;
  setBypass(enabled: boolean): void;
  dispose(): void;
}

let workletRegistered = false;
let wasmModule: WebAssembly.Module | null = null;

export async function createDspNode(
  ctx: AudioContext,
  mode: DspMode
): Promise<DspWorkletNode> {
  if (!workletRegistered) {
    const [, mod] = await Promise.all([
      ctx.audioWorklet.addModule("/dsp/dsp-processor.js"),
      WebAssembly.compileStreaming(fetch("/dsp/audio_dsp_bg.wasm")),
    ]);
    wasmModule = mod;
    workletRegistered = true;
  }

  const node = new AudioWorkletNode(ctx, "dsp-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { mode, wasmModule },
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WASM init timeout")), 10000);
    node.port.onmessage = (e) => {
      if (e.data.type === "ready") {
        clearTimeout(timeout);
        resolve();
      } else if (e.data.type === "error") {
        clearTimeout(timeout);
        reject(new Error(e.data.message));
      }
    };
  });

  function setParam(type: string, params: Record<string, number>): void {
    node.port.postMessage({ type, ...params });
  }

  function requestMeters(): Promise<{ gainReduction: number }> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === "meters") {
          node.port.removeEventListener("message", handler);
          resolve({ gainReduction: e.data.gainReduction });
        }
      };
      node.port.addEventListener("message", handler);
      node.port.postMessage({ type: "get-meters" });
    });
  }

  function setBypass(enabled: boolean): void {
    node.port.postMessage({ type: "bypass", value: enabled });
  }

  function dispose(): void {
    node.disconnect();
    node.port.close();
  }

  return { node, ready, setParam, requestMeters, setBypass, dispose };
}
