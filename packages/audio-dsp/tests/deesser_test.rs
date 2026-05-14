use audio_dsp::deesser::DeEsser;

fn generate_sine(freq: f64, amplitude: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| amplitude * (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

fn rms(signal: &[f64]) -> f64 {
    (signal.iter().map(|s| s * s).sum::<f64>() / signal.len() as f64).sqrt()
}

#[test]
fn low_frequency_passes_untouched() {
    let sr = 48000.0;
    let mut de = DeEsser::new(sr);
    de.set_threshold(-20.0);

    // 200 Hz — way below the 6kHz sibilance band
    let amplitude = 10.0_f64.powf(-10.0 / 20.0);
    let input = generate_sine(200.0, amplitude, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| de.process(s)).collect();

    let diff_db = (20.0 * (rms(&output[4800..]) / rms(&input[4800..])).log10()).abs();
    assert!(diff_db < 1.0, "Low freq should pass through de-esser, got {:.1}dB change", diff_db);
}

#[test]
fn sibilant_frequency_is_reduced() {
    let sr = 48000.0;
    let mut de = DeEsser::new(sr);
    de.set_frequency(6000.0);
    de.set_threshold(-30.0);
    de.set_range(12.0);

    // 6 kHz sibilance at -10 dBFS — loud sibilant
    let amplitude = 10.0_f64.powf(-10.0 / 20.0);
    let input = generate_sine(6000.0, amplitude, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| de.process(s)).collect();

    let reduction_db = 20.0 * (rms(&input[9600..]) / rms(&output[9600..])).log10();
    assert!(reduction_db > 3.0, "Expected >3dB sibilance reduction, got {:.1}dB", reduction_db);
}
