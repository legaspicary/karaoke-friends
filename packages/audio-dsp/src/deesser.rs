use crate::biquad::{Biquad, FilterType};

/// Split-band de-esser. Detects energy in a high-frequency band
/// and applies gain reduction only to that band.
pub struct DeEsser {
    sample_rate: f64,
    threshold: f64,  // dB
    range: f64,      // max dB reduction
    frequency: f64,

    // Sidechain: bandpass detector
    detect_hpf: Biquad,
    detect_lpf: Biquad,

    // Split: high band to compress
    split_hpf: Biquad,
    // Reconstruct: low band pass-through
    split_lpf: Biquad,

    envelope: f64,
    attack_coeff: f64,
    release_coeff: f64,
}

impl DeEsser {
    pub fn new(sample_rate: f64) -> Self {
        let mut de = Self {
            sample_rate,
            threshold: -20.0,
            range: 6.0,
            frequency: 6000.0,
            detect_hpf: Biquad::new(),
            detect_lpf: Biquad::new(),
            split_hpf: Biquad::new(),
            split_lpf: Biquad::new(),
            envelope: 0.0,
            attack_coeff: (-1.0 / (0.001 * sample_rate)).exp(),   // 1ms
            release_coeff: (-1.0 / (0.020 * sample_rate)).exp(),  // 20ms
        };
        de.update_filters();
        de
    }

    pub fn set_frequency(&mut self, freq: f64) {
        self.frequency = freq.clamp(3000.0, 10000.0);
        self.update_filters();
    }

    pub fn set_threshold(&mut self, db: f64) { self.threshold = db.clamp(-40.0, 0.0); }
    pub fn set_range(&mut self, db: f64) { self.range = db.clamp(0.0, 12.0); }

    fn update_filters(&mut self) {
        let low = self.frequency * 0.7;
        let high = self.frequency * 1.4;
        self.detect_hpf.set_params(FilterType::Highpass, low, 0.707, 0.0, self.sample_rate);
        self.detect_lpf.set_params(FilterType::Lowpass, high, 0.707, 0.0, self.sample_rate);
        self.split_hpf.set_params(FilterType::Highpass, low, 0.707, 0.0, self.sample_rate);
        self.split_lpf.set_params(FilterType::Lowpass, low, 0.707, 0.0, self.sample_rate);
    }

    pub fn process(&mut self, input: f64) -> f64 {
        // Detect sibilance energy
        let detect = self.detect_lpf.process_sample(self.detect_hpf.process_sample(input));
        let detect_level = detect.abs();

        // Envelope follower
        let coeff = if detect_level > self.envelope { self.attack_coeff } else { self.release_coeff };
        self.envelope = detect_level + coeff * (self.envelope - detect_level);

        let env_db = if self.envelope > 1e-10 { 20.0 * self.envelope.log10() } else { -100.0 };
        let over = env_db - self.threshold;

        if over <= 0.0 {
            return input;
        }

        // Calculate reduction (capped at range)
        let reduction_db = over.min(self.range);
        let gain = 10.0_f64.powf(-reduction_db / 20.0);

        // Split bands, attenuate high, sum
        let low_band = self.split_lpf.process_sample(input);
        let high_band = self.split_hpf.process_sample(input);
        low_band + high_band * gain
    }
}
