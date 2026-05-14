use audio_dsp::biquad::{Biquad, FilterType};

fn generate_sine(freq: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
    (0..num_samples)
        .map(|i| (2.0 * std::f64::consts::PI * freq * i as f64 / sample_rate).sin())
        .collect()
}

fn rms(signal: &[f64]) -> f64 {
    (signal.iter().map(|s| s * s).sum::<f64>() / signal.len() as f64).sqrt()
}

#[test]
fn highpass_attenuates_below_cutoff() {
    let sr = 48000.0;
    let mut filter = Biquad::new();
    filter.set_params(FilterType::Highpass, 1000.0, 0.707, 0.0, sr);

    let input = generate_sine(100.0, sr, 4800); // 100 Hz — well below 1kHz cutoff
    let output: Vec<f64> = input.iter().map(|&s| filter.process_sample(s)).collect();

    let input_rms = rms(&input[480..]); // skip transient
    let output_rms = rms(&output[480..]);
    let attenuation_db = 20.0 * (output_rms / input_rms).log10();

    assert!(attenuation_db < -12.0, "Expected >12dB attenuation at 100Hz, got {:.1}dB", attenuation_db);
}

#[test]
fn highpass_passes_above_cutoff() {
    let sr = 48000.0;
    let mut filter = Biquad::new();
    filter.set_params(FilterType::Highpass, 1000.0, 0.707, 0.0, sr);

    let input = generate_sine(4000.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| filter.process_sample(s)).collect();

    let input_rms = rms(&input[480..]);
    let output_rms = rms(&output[480..]);
    let diff_db = (20.0 * (output_rms / input_rms).log10()).abs();

    assert!(diff_db < 1.0, "Expected <1dB change at 4kHz, got {:.1}dB", diff_db);
}

#[test]
fn peak_filter_boosts_at_center() {
    let sr = 48000.0;
    let mut filter = Biquad::new();
    filter.set_params(FilterType::Peak, 1000.0, 1.0, 6.0, sr); // +6dB at 1kHz

    let input = generate_sine(1000.0, sr, 4800);
    let output: Vec<f64> = input.iter().map(|&s| filter.process_sample(s)).collect();

    let input_rms = rms(&input[480..]);
    let output_rms = rms(&output[480..]);
    let boost_db = 20.0 * (output_rms / input_rms).log10();

    assert!(boost_db > 4.5 && boost_db < 7.5, "Expected ~6dB boost, got {:.1}dB", boost_db);
}
