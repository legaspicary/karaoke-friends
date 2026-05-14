use audio_dsp::compressor::Compressor;

fn generate_sine(freq: f64, amplitude: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| amplitude * (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

fn rms(signal: &[f64]) -> f64 {
    (signal.iter().map(|s| s * s).sum::<f64>() / signal.len() as f64).sqrt()
}

fn db(linear: f64) -> f64 {
    20.0 * linear.log10()
}

#[test]
fn quiet_signal_passes_through() {
    let sr = 48000.0;
    let mut comp = Compressor::new(sr);
    comp.set_threshold(-20.0);
    comp.set_ratio(4.0);

    // -40 dBFS signal — well below threshold
    let amplitude = 10.0_f64.powf(-40.0 / 20.0);
    let input = generate_sine(1000.0, amplitude, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| comp.process(s)).collect();

    let diff_db = (db(rms(&output[4800..])) - db(rms(&input[4800..]))).abs();
    assert!(diff_db < 1.0, "Signal below threshold should pass through, got {:.1}dB change", diff_db);
}

#[test]
fn loud_signal_is_compressed() {
    let sr = 48000.0;
    let mut comp = Compressor::new(sr);
    comp.set_threshold(-20.0);
    comp.set_ratio(4.0);
    comp.set_knee(0.0);
    comp.set_attack_ms(1.0);
    comp.set_release_ms(50.0);

    // -6 dBFS signal — 14 dB above threshold
    let amplitude = 10.0_f64.powf(-6.0 / 20.0);
    let input = generate_sine(1000.0, amplitude, sr, 48000);
    let output: Vec<f64> = input.iter().map(|&s| comp.process(s)).collect();

    let input_db = db(rms(&input[24000..]));
    let output_db = db(rms(&output[24000..]));
    let gain_reduction = input_db - output_db;

    // 14 dB over threshold at 4:1 → ~10.5 dB gain reduction
    assert!(gain_reduction > 6.0, "Expected >6dB gain reduction, got {:.1}dB", gain_reduction);
}

#[test]
fn gain_reduction_reports_correctly() {
    let sr = 48000.0;
    let mut comp = Compressor::new(sr);
    comp.set_threshold(-20.0);
    comp.set_ratio(4.0);
    comp.set_attack_ms(1.0);

    let amplitude = 10.0_f64.powf(-6.0 / 20.0);
    let input = generate_sine(1000.0, amplitude, sr, 48000);
    for &s in &input {
        comp.process(s);
    }

    let gr = comp.gain_reduction_db();
    assert!(gr > 5.0, "Expected gain reduction reading >5dB, got {:.1}dB", gr);
}
