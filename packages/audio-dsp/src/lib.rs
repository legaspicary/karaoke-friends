use wasm_bindgen::prelude::*;

pub mod biquad;
pub mod smoothing;
pub mod ring_buffer;
pub mod eq;
pub mod compressor;
pub mod deesser;
pub mod saturation;
pub mod limiter;
pub mod chain;

use chain::{DspChain, ChainMode};

#[wasm_bindgen]
pub struct WasmDspProcessor {
    chain: DspChain,
    #[allow(dead_code)]
    sample_rate: f64,
}

#[wasm_bindgen]
impl WasmDspProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f64, mode: &str) -> Self {
        let chain_mode = match mode {
            "limiter" => ChainMode::Limiter,
            _ => ChainMode::ChannelStrip,
        };
        Self { chain: DspChain::new(sample_rate, chain_mode), sample_rate }
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        for (i, &s) in input.iter().enumerate() {
            output[i] = self.chain.process_sample(s as f64) as f32;
        }
    }

    // EQ
    pub fn set_eq_hpf(&mut self, freq: f32) { self.chain.eq().set_hpf(freq as f64); }
    pub fn set_eq_low_mid(&mut self, freq: f32, gain_db: f32, q: f32) {
        self.chain.eq().set_low_mid(freq as f64, gain_db as f64, q as f64);
    }
    pub fn set_eq_high_mid(&mut self, freq: f32, gain_db: f32, q: f32) {
        self.chain.eq().set_high_mid(freq as f64, gain_db as f64, q as f64);
    }
    pub fn set_eq_lpf(&mut self, freq: f32) { self.chain.eq().set_lpf(freq as f64); }

    // Compressor
    pub fn set_comp_threshold(&mut self, db: f32) { self.chain.compressor().set_threshold(db as f64); }
    pub fn set_comp_ratio(&mut self, r: f32) { self.chain.compressor().set_ratio(r as f64); }
    pub fn set_comp_knee(&mut self, db: f32) { self.chain.compressor().set_knee(db as f64); }
    pub fn set_comp_attack(&mut self, ms: f32) { self.chain.compressor().set_attack_ms(ms as f64); }
    pub fn set_comp_release(&mut self, ms: f32) { self.chain.compressor().set_release_ms(ms as f64); }

    // De-esser
    pub fn set_deesser_threshold(&mut self, db: f32) { self.chain.deesser().set_threshold(db as f64); }
    pub fn set_deesser_frequency(&mut self, freq: f32) { self.chain.deesser().set_frequency(freq as f64); }
    pub fn set_deesser_range(&mut self, db: f32) { self.chain.deesser().set_range(db as f64); }

    // Saturation
    pub fn set_saturation_drive(&mut self, db: f32) { self.chain.saturation().set_drive_db(db as f64); }
    pub fn set_saturation_mix(&mut self, mix: f32) { self.chain.saturation().set_mix(mix as f64); }

    // Limiter
    pub fn set_limiter_ceiling(&mut self, db: f32) { self.chain.limiter().set_ceiling_db(db as f64); }

    // Metering
    pub fn gain_reduction_db(&self) -> f32 { self.chain.gain_reduction_db() as f32 }
}
