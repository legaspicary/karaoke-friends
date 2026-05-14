/// Fixed-size ring buffer for delay lines, look-ahead, and oversampling.

pub struct RingBuffer {
    data: Vec<f64>,
    write_pos: usize,
}

impl RingBuffer {
    pub fn new(size: usize) -> Self {
        Self { data: vec![0.0; size], write_pos: 0 }
    }

    pub fn push(&mut self, sample: f64) {
        self.data[self.write_pos] = sample;
        self.write_pos = (self.write_pos + 1) % self.data.len();
    }

    pub fn read_delayed(&self, delay_samples: usize) -> f64 {
        let len = self.data.len();
        let idx = (self.write_pos + len - delay_samples) % len;
        self.data[idx]
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }
}
