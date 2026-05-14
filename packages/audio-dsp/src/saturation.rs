use crate::biquad::{Biquad, FilterType};

/// 2x oversampled tanh waveshaper with output compensation.
pub struct Saturation {
    #[allow(dead_code)]
    sample_rate: f64,
    drive: f64,  // linear multiplier
    mix: f64,    // 0-1 dry/wet
    compensation: f64,

    // 2x oversampling anti-alias filter (applied before downsampling)
    aa_filter: Biquad,
    // Interpolation state
    prev_sample: f64,
}

impl Saturation {
    pub fn new(sample_rate: f64) -> Self {
        let mut aa = Biquad::new();
        aa.set_params(FilterType::Lowpass, sample_rate * 0.45, 0.707, 0.0, sample_rate * 2.0);
        Self {
            sample_rate,
            drive: 1.0,
            mix: 0.0,
            compensation: 1.0,
            aa_filter: aa,
            prev_sample: 0.0,
        }
    }

    pub fn set_drive_db(&mut self, db: f64) {
        let db = db.clamp(0.0, 24.0);
        self.drive = 10.0_f64.powf(db / 20.0);
        // Output compensation: approximate inverse of tanh compression
        self.compensation = if self.drive > 1.0 { 1.0 / (self.drive * 0.7).tanh() * 0.7 } else { 1.0 };
    }

    pub fn set_mix(&mut self, mix: f64) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, input: f64) -> f64 {
        if self.mix < 1e-6 {
            return input;
        }

        let driven = input * self.drive;

        // 2x oversample: process interpolated midpoint and current sample
        let mid = (self.prev_sample * self.drive + driven) * 0.5;
        self.prev_sample = input;

        let shaped_mid = mid.tanh() * self.compensation;
        let shaped = driven.tanh() * self.compensation;

        // Anti-alias filter on the oversampled pair, keep every other sample
        self.aa_filter.process_sample(shaped_mid);
        let filtered = self.aa_filter.process_sample(shaped);

        // Dry/wet mix
        input * (1.0 - self.mix) + filtered * self.mix
    }
}
