// AudioWorkletProcessor for WASM DSP chain.
// Loaded via audioContext.audioWorklet.addModule('/dsp/dsp-processor.js')
// Runs in AudioWorklet scope — no DOM, no dynamic import().
// wasm-bindgen JS glue is inlined; TextEncoder/TextDecoder avoided
// since AudioWorkletGlobalScope may not expose them.

// ─── wasm-bindgen runtime (inlined from audio_dsp.js) ─────────

let wasm;
let WASM_VECTOR_LEN = 0;
let wasmReady = null;

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr, ptr + len);
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  const bytes = getUint8ArrayMemory0().subarray(ptr, ptr + len);
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passStringToWasm0(arg, malloc) {
  const len = arg.length;
  const ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  for (let i = 0; i < len; i++) mem[ptr + i] = arg.charCodeAt(i);
  WASM_VECTOR_LEN = len;
  return ptr;
}

function buildImportObject(importMeta) {
  const obj = {};
  for (const { module: mod, name, kind } of importMeta) {
    if (kind !== 'function') continue;
    if (!obj[mod]) obj[mod] = { __proto__: null };

    if (name.includes('copy_to_typed_array')) {
      obj[mod][name] = (ptr, len, target) => {
        new Uint8Array(target.buffer, target.byteOffset, target.byteLength)
          .set(getArrayU8FromWasm0(ptr, len));
      };
    } else if (name.includes('throw')) {
      obj[mod][name] = (ptr, len) => {
        throw new Error(getStringFromWasm0(ptr, len));
      };
    } else if (name.includes('init_externref_table')) {
      obj[mod][name] = () => {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
      };
    }
  }
  return obj;
}

async function initWasmModule(compiledModule) {
  const imports = buildImportObject(WebAssembly.Module.imports(compiledModule));
  const instance = await WebAssembly.instantiate(compiledModule, imports);
  wasm = instance.exports;
  cachedFloat32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
}

// ─── WasmDsp wrapper ──────────────────────────────────────────

class WasmDsp {
  constructor(sr, mode) {
    const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    this._ptr = wasm.wasmdspprocessor_new(sr, ptr0, len0);
  }

  process_block(input, output) {
    const ptr0 = passArrayF32ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.wasmdspprocessor_process_block(this._ptr, ptr0, len0, ptr1, len1, output);
  }

  gain_reduction_db() {
    return wasm.wasmdspprocessor_gain_reduction_db(this._ptr);
  }

  set_eq_hpf(freq) { wasm.wasmdspprocessor_set_eq_hpf(this._ptr, freq); }
  set_eq_low_mid(freq, gain, q) { wasm.wasmdspprocessor_set_eq_low_mid(this._ptr, freq, gain, q); }
  set_eq_high_mid(freq, gain, q) { wasm.wasmdspprocessor_set_eq_high_mid(this._ptr, freq, gain, q); }
  set_eq_lpf(freq) { wasm.wasmdspprocessor_set_eq_lpf(this._ptr, freq); }

  set_comp_threshold(db) { wasm.wasmdspprocessor_set_comp_threshold(this._ptr, db); }
  set_comp_ratio(r) { wasm.wasmdspprocessor_set_comp_ratio(this._ptr, r); }
  set_comp_knee(db) { wasm.wasmdspprocessor_set_comp_knee(this._ptr, db); }
  set_comp_attack(ms) { wasm.wasmdspprocessor_set_comp_attack(this._ptr, ms); }
  set_comp_release(ms) { wasm.wasmdspprocessor_set_comp_release(this._ptr, ms); }

  set_deesser_threshold(db) { wasm.wasmdspprocessor_set_deesser_threshold(this._ptr, db); }
  set_deesser_frequency(freq) { wasm.wasmdspprocessor_set_deesser_frequency(this._ptr, freq); }
  set_deesser_range(db) { wasm.wasmdspprocessor_set_deesser_range(this._ptr, db); }

  set_saturation_drive(db) { wasm.wasmdspprocessor_set_saturation_drive(this._ptr, db); }
  set_saturation_mix(mix) { wasm.wasmdspprocessor_set_saturation_mix(this._ptr, mix); }

  set_limiter_ceiling(db) { wasm.wasmdspprocessor_set_limiter_ceiling(this._ptr, db); }
}

// ─── AudioWorkletProcessor ────────────────────────────────────

class DspProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.mode = options.processorOptions?.mode || 'channel-strip';
    this.wasmModule = options.processorOptions?.wasmModule || null;
    this.processor = null;
    this.ready = false;
    this.bypass = false;
    this._diagPending = false;

    this.port.onmessage = (e) => this.handleMessage(e.data);
    this.initWasm();
  }

  async initWasm() {
    try {
      if (!wasmReady && this.wasmModule) {
        wasmReady = initWasmModule(this.wasmModule).catch((err) => {
          wasmReady = null;
          throw err;
        });
      }
      if (!wasmReady) throw new Error('No WASM module provided');
      await wasmReady;
      this.processor = new WasmDsp(sampleRate, this.mode === 'limiter' ? 'limiter' : 'channel-strip');
      this.ready = true;
      this.port.postMessage({ type: 'ready' });
    } catch (err) {
      this.port.postMessage({ type: 'error', message: err.message });
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'bypass':
        this.bypass = !!data.value;
        return;
      case 'diag':
        this._diagPending = true;
        return;
    }

    if (!this.processor) return;
    const p = this.processor;

    switch (data.type) {
      case 'eq-hpf': p.set_eq_hpf(data.freq); break;
      case 'eq-low-mid': p.set_eq_low_mid(data.freq, data.gain, data.q); break;
      case 'eq-high-mid': p.set_eq_high_mid(data.freq, data.gain, data.q); break;
      case 'eq-lpf': p.set_eq_lpf(data.freq); break;

      case 'comp-threshold': p.set_comp_threshold(data.value); break;
      case 'comp-ratio': p.set_comp_ratio(data.value); break;
      case 'comp-knee': p.set_comp_knee(data.value); break;
      case 'comp-attack': p.set_comp_attack(data.value); break;
      case 'comp-release': p.set_comp_release(data.value); break;

      case 'deesser-threshold': p.set_deesser_threshold(data.value); break;
      case 'deesser-frequency': p.set_deesser_frequency(data.value); break;
      case 'deesser-range': p.set_deesser_range(data.value); break;

      case 'saturation-drive': p.set_saturation_drive(data.value); break;
      case 'saturation-mix': p.set_saturation_mix(data.value); break;

      case 'limiter-ceiling': p.set_limiter_ceiling(data.value); break;

      case 'get-meters':
        this.port.postMessage({
          type: 'meters',
          gainReduction: p.gain_reduction_db(),
        });
        break;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const src = input[0];
    const dst = output[0];

    if (this.bypass || !this.ready || !this.processor) {
      dst.set(src);
      if (this._diagPending) {
        this._diagPending = false;
        this.port.postMessage({
          type: 'diag',
          mode: this.mode,
          bypass: true,
          ready: this.ready,
          inputRms: Math.sqrt(src.reduce((s, v) => s + v * v, 0) / src.length),
          outputRms: Math.sqrt(dst.reduce((s, v) => s + v * v, 0) / dst.length),
          inputSamples: Array.from(src.slice(0, 8)),
          outputSamples: Array.from(dst.slice(0, 8)),
        });
      }
      return true;
    }

    this.processor.process_block(src, dst);

    if (this._diagPending) {
      this._diagPending = false;
      this.port.postMessage({
        type: 'diag',
        mode: this.mode,
        bypass: false,
        ready: true,
        inputRms: Math.sqrt(src.reduce((s, v) => s + v * v, 0) / src.length),
        outputRms: Math.sqrt(dst.reduce((s, v) => s + v * v, 0) / dst.length),
        inputSamples: Array.from(src.slice(0, 8)),
        outputSamples: Array.from(dst.slice(0, 8)),
      });
    }

    return true;
  }
}

registerProcessor('dsp-processor', DspProcessor);
