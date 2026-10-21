// Analyses the actual browser recording produced by audio-runtime.mjs.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const path = '.openai/audio-qa/';
const encoded = (await readFile(path + 'material-auditions.webm')).toString('base64');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const analysis = await page.evaluate(async base64 => {
    const raw = atob(base64); const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const decoder = new OfflineAudioContext(2, 1, 48000);
    const decoded = await decoder.decodeAudioData(bytes.buffer);
    const left = decoded.getChannelData(0); const right = decoded.getChannelData(Math.min(1, decoded.numberOfChannels - 1));
    const rate = decoded.sampleRate; const hop = Math.round(rate / 100);
    const windows = [];
    for (let offset = 0; offset < left.length; offset += hop) {
      let energy = 0;
      for (let index = offset; index < Math.min(offset + hop, left.length); index++) energy += (left[index] ** 2 + right[index] ** 2) / 2;
      windows.push(Math.sqrt(energy / hop));
    }
    const regions = []; let start = -1; let last = -1;
    windows.forEach((rms, index) => {
      if (rms > 0.0001) { if (start < 0) start = index; last = index; }
      else if (start >= 0 && index - last > 13) { regions.push([Math.max(0, start - 2) * hop, Math.min(left.length, (last + 3) * hop)]); start = -1; }
    });
    if (start >= 0) regions.push([Math.max(0, start - 2) * hop, left.length]);
    function fft(real, imag) {
      const length = real.length;
      for (let i = 1, j = 0; i < length; i++) { let bit = length >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imag[i], imag[j]] = [imag[j], imag[i]]; } }
      for (let size = 2; size <= length; size <<= 1) {
        const angle = -2 * Math.PI / size;
        for (let begin = 0; begin < length; begin += size) for (let offset = 0; offset < size / 2; offset++) {
          const cosine = Math.cos(angle * offset), sine = Math.sin(angle * offset); const a = begin + offset, b = a + size / 2;
          const tr = real[b] * cosine - imag[b] * sine, ti = real[b] * sine + imag[b] * cosine;
          real[b] = real[a] - tr; imag[b] = imag[a] - ti; real[a] += tr; imag[a] += ti;
        }
      }
    }
    const names = ['Magnetic', 'Glass', 'Transit', 'Memory', 'Unfold', 'Resonance'];
    const materials = regions.map(([from, to], cue) => {
      let energyL = 0, energyR = 0, peak = 0; const spectrum = new Float64Array(1024);
      for (let index = from; index < to; index++) { energyL += left[index] ** 2; energyR += right[index] ** 2; peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index])); }
      for (let offset = from; offset < to; offset += 512) {
        const real = new Float64Array(2048), imag = new Float64Array(2048);
        for (let index = 0; index < 2048; index++) real[index] = ((left[offset + index] || 0) + (right[offset + index] || 0)) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / 2047));
        fft(real, imag);
        for (let bin = 0; bin < 1024; bin++) spectrum[bin] += real[bin] ** 2 + imag[bin] ** 2;
      }
      let total = 0, weighted = 0; const bands = [0, 0, 0];
      spectrum.forEach((power, bin) => { const hz = bin * rate / 2048; total += power; weighted += power * hz; bands[hz < 250 ? 0 : hz < 2000 ? 1 : 2] += power; });
      const peaks = Array.from(spectrum, (power, bin) => ({ hz: Math.round(bin * rate / 2048), power })).sort((a, b) => b.power - a.power).slice(0, 5).map(peak => peak.hz);
      return { cue: names[cue] || 'Unexpected region', onsetSeconds: from / rate, audibleDuration: (to - from) / rate, peak, spectralCentroidHz: weighted / total, bassPercent: bands[0] / total * 100, bodyPercent: bands[1] / total * 100, airPercent: bands[2] / total * 100, leftRightEnergyDb: 10 * Math.log10(energyL / energyR), strongestFrequenciesHz: peaks };
    });
    return { sampleRate: rate, channels: decoded.numberOfChannels, duration: decoded.duration, materials };
  }, encoded);
  assert.equal(analysis.materials.length, 6, 'Exactly six distinct separated sound events in the actual recording');
  assert.ok(analysis.materials.every(item => item.peak < 0.8 && item.audibleDuration < 0.9), 'Recorded cues are short and have headroom');
  assert.ok(analysis.materials[0].leftRightEnergyDb > 2, 'Magnetic audition is spatially left');
  assert.ok(Math.abs(analysis.materials[1].leftRightEnergyDb) < 0.5, 'Glass audition is centered');
  assert.ok(analysis.materials[5].leftRightEnergyDb < -2, 'Resonance audition is spatially right');
  assert.ok(analysis.materials[1].bodyPercent > analysis.materials[5].bodyPercent, 'Glass emphasis differs from the physical low-body resonance');
  await writeFile(path + 'composer-analysis.json', JSON.stringify(analysis, null, 2));
  console.log(JSON.stringify(analysis, null, 2));
} finally { await browser.close(); }
