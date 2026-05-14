/// One-pole exponential smoother for click-free parameter changes.
/// Default time constant: 5ms at 48kHz.

pub struct Smoother {
    current: f64,
    target: f64,
    coeff: f64,
}

impl Smoother {
    pub fn new(initial: f64, time_ms: f64, sample_rate: f64) -> Self {
        let samples = (time_ms / 1000.0) * sample_rate;
        let coeff = (-1.0 / samples).exp();
        Self { current: initial, target: initial, coeff }
    }

    pub fn set_target(&mut self, target: f64) {
        self.target = target;
    }

    pub fn next(&mut self) -> f64 {
        self.current = self.target + self.coeff * (self.current - self.target);
        self.current
    }

    pub fn is_settled(&self) -> bool {
        (self.current - self.target).abs() < 1e-6
    }
}
