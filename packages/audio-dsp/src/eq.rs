use crate::biquad::{Biquad, FilterType};

/// 4-band parametric EQ: HPF, low-mid bell, high-mid bell, LPF.
pub struct ParametricEQ {
    hpf: Biquad,
    low_mid: Biquad,
    high_mid: Biquad,
    lpf: Biquad,
    sample_rate: f64,
}

impl ParametricEQ {
    pub fn new(sample_rate: f64) -> Self {
        let mut eq = Self {
            hpf: Biquad::new(),
            low_mid: Biquad::new(),
            high_mid: Biquad::new(),
            lpf: Biquad::new(),
            sample_rate,
        };
        eq.hpf.set_params(FilterType::Highpass, 80.0, 0.707, 0.0, sample_rate);
        eq.low_mid.set_params(FilterType::Peak, 350.0, 1.0, 0.0, sample_rate);
        eq.high_mid.set_params(FilterType::Peak, 3500.0, 1.0, 0.0, sample_rate);
        eq.lpf.set_params(FilterType::Lowpass, 16000.0, 0.707, 0.0, sample_rate);
        eq
    }

    pub fn set_hpf(&mut self, freq: f64) {
        self.hpf.set_params(FilterType::Highpass, freq.clamp(40.0, 300.0), 0.707, 0.0, self.sample_rate);
    }

    pub fn set_low_mid(&mut self, freq: f64, gain_db: f64, q: f64) {
        self.low_mid.set_params(FilterType::Peak, freq.clamp(200.0, 2000.0), q.clamp(0.1, 10.0), gain_db.clamp(-12.0, 12.0), self.sample_rate);
    }

    pub fn set_high_mid(&mut self, freq: f64, gain_db: f64, q: f64) {
        self.high_mid.set_params(FilterType::Peak, freq.clamp(2000.0, 10000.0), q.clamp(0.1, 10.0), gain_db.clamp(-12.0, 12.0), self.sample_rate);
    }

    pub fn set_lpf(&mut self, freq: f64) {
        self.lpf.set_params(FilterType::Lowpass, freq.clamp(8000.0, 20000.0), 0.707, 0.0, self.sample_rate);
    }

    pub fn process(&mut self, sample: f64) -> f64 {
        let s = self.hpf.process_sample(sample);
        let s = self.low_mid.process_sample(s);
        let s = self.high_mid.process_sample(s);
        self.lpf.process_sample(s)
    }

    pub fn reset(&mut self) {
        self.hpf.reset();
        self.low_mid.reset();
        self.high_mid.reset();
        self.lpf.reset();
    }
}
