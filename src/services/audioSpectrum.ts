/** The same measured spectrum drives every band of a Music instrument. Values
 * are normalised magnitudes, never clocks or invented beats. */
export type AudioSpectrum = { rms: number; bass: number; mid: number; treble: number };
export const SILENT_SPECTRUM: Readonly<AudioSpectrum> = Object.freeze({ rms: 0, bass: 0, mid: 0, treble: 0 });

export function analyseSpectrum(wave: Float32Array, frequency: Uint8Array, sampleRate: number, fftSize: number, target: AudioSpectrum): AudioSpectrum {
  let power = 0;
  for (let i = 0; i < wave.length; i++) power += wave[i] * wave[i];
  target.rms = Math.min(1, Math.sqrt(power / Math.max(1, wave.length)) * 3.6);
  const hzPerBin = sampleRate / fftSize;
  const band = (from: number, to: number) => {
    const begin = Math.max(1, Math.floor(from / hzPerBin)), end = Math.min(frequency.length - 1, Math.ceil(to / hzPerBin));
    if (end < begin) return 0;
    let sum = 0;
    for (let i = begin; i <= end; i++) sum += (frequency[i] / 255) ** 2;
    return Math.sqrt(sum / (end - begin + 1));
  };
  target.bass = band(45, 250); target.mid = band(250, 2500); target.treble = band(2500, 12000);
  return target;
}
