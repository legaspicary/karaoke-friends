use crate::eq::ParametricEQ;
use crate::compressor::Compressor;
use crate::deesser::DeEsser;
use crate::saturation::Saturation;
use crate::limiter::Limiter;

#[derive(Clone, Copy, PartialEq)]
pub enum ChainMode {
    ChannelStrip,  // EQ → Compressor → De-esser → Saturation
    Limiter,       // Limiter only
}

pub struct DspChain {
    mode: ChainMode,
    eq: ParametricEQ,
    compressor: Compressor,
    deesser: DeEsser,
    saturation: Saturation,
    limiter: Limiter,
}

impl DspChain {
    pub fn new(sample_rate: f64, mode: ChainMode) -> Self {
        Self {
            mode,
            eq: ParametricEQ::new(sample_rate),
            compressor: Compressor::new(sample_rate),
            deesser: DeEsser::new(sample_rate),
            saturation: Saturation::new(sample_rate),
            limiter: Limiter::new(sample_rate),
        }
    }

    pub fn process_sample(&mut self, input: f64) -> f64 {
        match self.mode {
            ChainMode::ChannelStrip => {
                let s = self.eq.process(input);
                let s = self.compressor.process(s);
                let s = self.deesser.process(s);
                self.saturation.process(s)
            }
            ChainMode::Limiter => {
                self.limiter.process(input)
            }
        }
    }

    pub fn process_block(&mut self, input: &[f64], output: &mut [f64]) {
        for (i, &s) in input.iter().enumerate() {
            output[i] = self.process_sample(s);
        }
    }

    // Parameter setters — delegate to the appropriate module
    pub fn eq(&mut self) -> &mut ParametricEQ { &mut self.eq }
    pub fn compressor(&mut self) -> &mut Compressor { &mut self.compressor }
    pub fn deesser(&mut self) -> &mut DeEsser { &mut self.deesser }
    pub fn saturation(&mut self) -> &mut Saturation { &mut self.saturation }
    pub fn limiter(&mut self) -> &mut Limiter { &mut self.limiter }

    pub fn gain_reduction_db(&self) -> f64 { self.compressor.gain_reduction_db() }
}
