use audio_dsp::limiter::Limiter;

fn generate_sine(freq: f64, amplitude: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| amplitude * (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

#[test]
fn output_never_exceeds_ceiling() {
    let sr = 48000.0;
    let mut lim = Limiter::new(sr);
    lim.set_ceiling_db(-1.0);

    // +6 dBFS signal — way over ceiling
    let input = generate_sine(1000.0, 2.0, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| lim.process(s)).collect();

    let ceiling_linear = 10.0_f64.powf(-1.0 / 20.0); // ~0.891
    let max = output.iter().map(|s| s.abs()).fold(0.0_f64, f64::max);
    assert!(max <= ceiling_linear + 0.01, "Output exceeded ceiling: peak {:.4} > ceiling {:.4}", max, ceiling_linear);
}

#[test]
fn quiet_signal_passes_through() {
    let sr = 48000.0;
    let mut lim = Limiter::new(sr);
    lim.set_ceiling_db(-1.0);

    // -20 dBFS signal
    let amplitude = 10.0_f64.powf(-20.0 / 20.0);
    let input = generate_sine(1000.0, amplitude, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| lim.process(s)).collect();

    let diff: f64 = input.iter().zip(output.iter())
        .skip(480) // skip look-ahead delay
        .map(|(a, b)| (a - b).abs())
        .fold(0.0_f64, f64::max);
    assert!(diff < 0.001, "Quiet signal should pass unchanged, max diff = {:.6}", diff);
}
