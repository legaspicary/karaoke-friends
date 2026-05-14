use crate::ring_buffer::RingBuffer;

/// Brick-wall look-ahead limiter with fast attack.
pub struct Limiter {
    ceiling: f64,     // linear
    lookahead: RingBuffer,
    release_coeff: f64,
    envelope: f64,
}

impl Limiter {
    pub fn new(sample_rate: f64) -> Self {
        let lookahead_samples = (0.001 * sample_rate) as usize; // 1ms
        // Buffer size = lookahead_samples + 1 so that read_delayed(len) gives
        // exactly lookahead_samples of delay (read_delayed(n) returns n-1 delay).
        Self {
            ceiling: 10.0_f64.powf(-1.0 / 20.0), // -1 dBFS
            lookahead: RingBuffer::new(lookahead_samples + 1),
            release_coeff: (-1.0 / (0.050 * sample_rate)).exp(), // 50ms
            envelope: 0.0,
        }
    }

    pub fn set_ceiling_db(&mut self, db: f64) {
        self.ceiling = 10.0_f64.powf(db.clamp(-12.0, 0.0) / 20.0);
    }

    pub fn process(&mut self, input: f64) -> f64 {
        let abs_input = input.abs();

        // Instant attack: if current sample exceeds ceiling, envelope jumps immediately
        if abs_input > self.envelope {
            self.envelope = abs_input;
        } else {
            self.envelope = abs_input + self.release_coeff * (self.envelope - abs_input);
        }

        self.lookahead.push(input);
        let delayed = self.lookahead.read_delayed(self.lookahead.len());

        if self.envelope > self.ceiling {
            delayed * (self.ceiling / self.envelope)
        } else {
            delayed
        }
    }
}
