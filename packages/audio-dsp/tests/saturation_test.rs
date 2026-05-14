use audio_dsp::saturation::Saturation;

fn generate_sine(freq: f64, amplitude: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| amplitude * (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

#[test]
fn output_is_bounded() {
    let sr = 48000.0;
    let mut sat = Saturation::new(sr);
    sat.set_drive_db(24.0);
    sat.set_mix(1.0);

    let input = generate_sine(1000.0, 1.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| sat.process(s)).collect();

    let max = output.iter().map(|s| s.abs()).fold(0.0_f64, f64::max);
    assert!(max <= 1.01, "Saturated output should be bounded, got peak {:.3}", max);
}

#[test]
fn zero_drive_is_transparent() {
    let sr = 48000.0;
    let mut sat = Saturation::new(sr);
    sat.set_drive_db(0.0);
    sat.set_mix(1.0);

    let input = generate_sine(1000.0, 0.5, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| sat.process(s)).collect();

    let max_diff: f64 = input.iter().zip(output.iter())
        .map(|(a, b)| (a - b).abs())
        .fold(0.0_f64, f64::max);
    assert!(max_diff < 0.05, "Zero drive should be near-transparent, got max diff {:.4}", max_diff);
}

#[test]
fn adds_harmonics() {
    let sr = 48000.0;
    let mut sat = Saturation::new(sr);
    sat.set_drive_db(12.0);
    sat.set_mix(1.0);

    // Pure sine in — if harmonics are added, signal won't be a pure sine anymore
    let input = generate_sine(1000.0, 0.5, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| sat.process(s)).collect();

    // Check that output differs from a scaled sine (meaning harmonics were added)
    let output_peak = output.iter().map(|s| s.abs()).fold(0.0_f64, f64::max);
    let scaled_input: Vec<f64> = input.iter().map(|s| s * output_peak / 0.5).collect();
    let correlation: f64 = output.iter().zip(scaled_input.iter())
        .map(|(a, b)| (a - b).abs())
        .sum::<f64>() / output.len() as f64;

    assert!(correlation > 0.01, "Expected harmonics to change waveform shape, correlation diff = {:.4}", correlation);
}
