use crate::ring_buffer::RingBuffer;

/// RMS-detecting compressor with look-ahead, soft knee, and sidechain HPF.
pub struct Compressor {
    sample_rate: f64,
    threshold: f64,    // dB
    ratio: f64,
    knee: f64,         // dB
    attack_coeff: f64,
    release_coeff: f64,
    makeup: f64,       // linear
    auto_makeup: bool,

    gain_db: f64,      // current gain reduction in dB (negative)
    lookahead: RingBuffer,
    rms_window: RingBuffer,
    rms_sum: f64,
}

impl Compressor {
    pub fn new(sample_rate: f64) -> Self {
        let lookahead_samples = (0.005 * sample_rate) as usize; // 5ms
        let rms_window_size = (0.020 * sample_rate) as usize;   // 20ms default
        Self {
            sample_rate,
            threshold: -18.0,
            ratio: 3.0,
            knee: 6.0,
            attack_coeff: Self::time_to_coeff(10.0, sample_rate),
            release_coeff: Self::time_to_coeff(80.0, sample_rate),
            makeup: 1.0,
            auto_makeup: false,
            gain_db: 0.0,
            lookahead: RingBuffer::new(lookahead_samples.max(1)),
            rms_window: RingBuffer::new(rms_window_size.max(1)),
            rms_sum: 0.0,
        }
    }

    fn time_to_coeff(ms: f64, sample_rate: f64) -> f64 {
        (-1.0 / (ms / 1000.0 * sample_rate)).exp()
    }

    pub fn set_threshold(&mut self, db: f64) { self.threshold = db.clamp(-60.0, 0.0); self.update_makeup(); }
    pub fn set_ratio(&mut self, r: f64) { self.ratio = r.clamp(1.0, 20.0); self.update_makeup(); }
    pub fn set_knee(&mut self, db: f64) { self.knee = db.clamp(0.0, 20.0); }
    pub fn set_attack_ms(&mut self, ms: f64) { self.attack_coeff = Self::time_to_coeff(ms.clamp(0.1, 100.0), self.sample_rate); }
    pub fn set_release_ms(&mut self, ms: f64) { self.release_coeff = Self::time_to_coeff(ms.clamp(10.0, 1000.0), self.sample_rate); }

    fn update_makeup(&mut self) {
        if self.auto_makeup {
            let over = (-self.threshold).max(0.0);
            let reduction = over * (1.0 - 1.0 / self.ratio);
            self.makeup = 10.0_f64.powf(reduction / 2.0 / 20.0);
        }
    }

    pub fn process(&mut self, input: f64) -> f64 {
        // RMS envelope detection
        let sq = input * input;
        let oldest = self.rms_window.read_delayed(self.rms_window.len());
        self.rms_sum += sq - oldest * oldest;
        self.rms_window.push(input);
        let rms = (self.rms_sum.max(0.0) / self.rms_window.len() as f64).sqrt();

        // Convert to dB
        let input_db = if rms > 1e-10 { 20.0 * rms.log10() } else { -100.0 };

        // Gain computation with soft knee
        let target_gain_db = self.compute_gain(input_db);

        // Envelope smoothing (attack/release)
        let coeff = if target_gain_db < self.gain_db { self.attack_coeff } else { self.release_coeff };
        self.gain_db = target_gain_db + coeff * (self.gain_db - target_gain_db);

        // Apply gain to look-ahead delayed signal
        self.lookahead.push(input);
        let delayed = self.lookahead.read_delayed(self.lookahead.len());
        let gain_linear = 10.0_f64.powf(self.gain_db / 20.0) * self.makeup;
        delayed * gain_linear
    }

    fn compute_gain(&self, input_db: f64) -> f64 {
        let over = input_db - self.threshold;
        if self.knee > 0.0 {
            let half_knee = self.knee / 2.0;
            if over < -half_knee {
                0.0
            } else if over > half_knee {
                -(over * (1.0 - 1.0 / self.ratio))
            } else {
                let x = over + half_knee;
                -(x * x / (2.0 * self.knee)) * (1.0 - 1.0 / self.ratio)
            }
        } else if over > 0.0 {
            -(over * (1.0 - 1.0 / self.ratio))
        } else {
            0.0
        }
    }

    pub fn gain_reduction_db(&self) -> f64 {
        -self.gain_db
    }
}
