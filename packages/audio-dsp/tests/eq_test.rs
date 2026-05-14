use audio_dsp::eq::ParametricEQ;

fn generate_sine(freq: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

fn rms(signal: &[f64]) -> f64 {
    (signal.iter().map(|s| s * s).sum::<f64>() / signal.len() as f64).sqrt()
}

#[test]
fn eq_default_is_transparent() {
    let sr = 48000.0;
    let mut eq = ParametricEQ::new(sr);
    let input = generate_sine(1000.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| eq.process(s)).collect();

    let diff_db = (20.0 * (rms(&output[480..]) / rms(&input[480..])).log10()).abs();
    assert!(diff_db < 0.5, "Default EQ should be transparent, got {:.1}dB change", diff_db);
}

#[test]
fn hpf_removes_rumble() {
    let sr = 48000.0;
    let mut eq = ParametricEQ::new(sr);
    eq.set_hpf(200.0); // 200 Hz high-pass

    let input = generate_sine(50.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| eq.process(s)).collect();

    let attenuation_db = 20.0 * (rms(&output[960..]) / rms(&input[960..])).log10();
    assert!(attenuation_db < -20.0, "Expected >20dB attenuation at 50Hz with 200Hz HPF, got {:.1}dB", attenuation_db);
}

#[test]
fn low_mid_boost_adds_warmth() {
    let sr = 48000.0;
    let mut eq = ParametricEQ::new(sr);
    eq.set_low_mid(350.0, 6.0, 1.0); // +6dB at 350Hz

    let input = generate_sine(350.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| eq.process(s)).collect();

    let boost_db = 20.0 * (rms(&output[480..]) / rms(&input[480..])).log10();
    assert!(boost_db > 4.0, "Expected >4dB boost at 350Hz, got {:.1}dB", boost_db);
}
