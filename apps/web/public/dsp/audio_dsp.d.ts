/* tslint:disable */
/* eslint-disable */

export class WasmDspProcessor {
    free(): void;
    [Symbol.dispose](): void;
    gain_reduction_db(): number;
    constructor(sample_rate: number, mode: string);
    process_block(input: Float32Array, output: Float32Array): void;
    set_comp_attack(ms: number): void;
    set_comp_knee(db: number): void;
    set_comp_ratio(r: number): void;
    set_comp_release(ms: number): void;
    set_comp_threshold(db: number): void;
    set_deesser_frequency(freq: number): void;
    set_deesser_range(db: number): void;
    set_deesser_threshold(db: number): void;
    set_eq_high_mid(freq: number, gain_db: number, q: number): void;
    set_eq_hpf(freq: number): void;
    set_eq_low_mid(freq: number, gain_db: number, q: number): void;
    set_eq_lpf(freq: number): void;
    set_limiter_ceiling(db: number): void;
    set_saturation_drive(db: number): void;
    set_saturation_mix(mix: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmdspprocessor_free: (a: number, b: number) => void;
    readonly wasmdspprocessor_gain_reduction_db: (a: number) => number;
    readonly wasmdspprocessor_new: (a: number, b: number, c: number) => number;
    readonly wasmdspprocessor_process_block: (a: number, b: number, c: number, d: number, e: number, f: any) => void;
    readonly wasmdspprocessor_set_comp_attack: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_comp_knee: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_comp_ratio: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_comp_release: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_comp_threshold: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_deesser_frequency: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_deesser_range: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_deesser_threshold: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_eq_high_mid: (a: number, b: number, c: number, d: number) => void;
    readonly wasmdspprocessor_set_eq_hpf: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_eq_low_mid: (a: number, b: number, c: number, d: number) => void;
    readonly wasmdspprocessor_set_eq_lpf: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_limiter_ceiling: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_saturation_drive: (a: number, b: number) => void;
    readonly wasmdspprocessor_set_saturation_mix: (a: number, b: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
