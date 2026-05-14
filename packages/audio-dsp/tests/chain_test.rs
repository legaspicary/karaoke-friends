use audio_dsp::chain::{DspChain, ChainMode};

fn generate_sine(freq: f64, amplitude: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| amplitude * (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

fn rms(signal: &[f64]) -> f64 {
    (signal.iter().map(|s| s * s).sum::<f64>() / signal.len() as f64).sqrt()
}

#[test]
fn channel_strip_processes_full_chain() {
    let sr = 48000.0;
    let mut chain = DspChain::new(sr, ChainMode::ChannelStrip);

    let input = generate_sine(1000.0, 0.5, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| chain.process_sample(s)).collect();

    // Signal should come through (not silent)
    let out_rms = rms(&output[4800..]);
    assert!(out_rms > 0.01, "Chain output should not be silent, RMS = {:.4}", out_rms);

    // Signal should be somewhat similar in level (no extreme gain)
    let in_rms = rms(&input[4800..]);
    let ratio = out_rms / in_rms;
    assert!(ratio > 0.1 && ratio < 10.0, "Output level should be reasonable, ratio = {:.2}", ratio);
}

#[test]
fn limiter_mode_caps_output() {
    let sr = 48000.0;
    let mut chain = DspChain::new(sr, ChainMode::Limiter);

    let input = generate_sine(1000.0, 2.0, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| chain.process_sample(s)).collect();

    let ceiling = 10.0_f64.powf(-1.0 / 20.0);
    let max = output.iter().map(|s| s.abs()).fold(0.0_f64, f64::max);
    assert!(max <= ceiling + 0.01, "Limiter mode should cap output at ceiling");
}

#[test]
fn process_block_matches_sample_by_sample() {
    let sr = 48000.0;
    let mut chain1 = DspChain::new(sr, ChainMode::ChannelStrip);
    let mut chain2 = DspChain::new(sr, ChainMode::ChannelStrip);

    let input = generate_sine(440.0, 0.5, sr, 256);

    let sample_output: Vec<f64> = input.iter().map(|&s| chain1.process_sample(s)).collect();

    let mut block_output = vec![0.0_f64; 256];
    chain2.process_block(&input, &mut block_output);

    for (i, (a, b)) in sample_output.iter().zip(block_output.iter()).enumerate() {
        assert!((a - b).abs() < 1e-10, "Mismatch at sample {}: {:.6} vs {:.6}", i, a, b);
    }
}
