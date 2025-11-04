import { readFileSync } from 'fs';

// Test loading one MIT-BIH record
const recordPath = './public/data/mitbih/107.json';
console.log('Loading record 107...');

const data = JSON.parse(readFileSync(recordPath, 'utf8'));
console.log(`Record: ${data.recordName}`);
console.log(`Sampling rate: ${data.fs} Hz`);
console.log(`Duration: ${(data.length / data.fs).toFixed(1)}s`);
console.log(`Annotations: ${data.annotations.length}`);

// Count R-peaks
const rpeaks = data.annotations.filter(a =>
  ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(a.type)
);
console.log(`R-peaks: ${rpeaks.length}`);

// Calculate heart rates
let bradyCount = 0;
let totalHR = 0;
let minHR = 1000;
let maxHR = 0;

for (let i = 0; i < rpeaks.length - 1; i++) {
  const rrInterval = (rpeaks[i + 1].sample - rpeaks[i].sample) / data.fs;
  const hr = 60 / rrInterval;
  totalHR += hr;
  minHR = Math.min(minHR, hr);
  maxHR = Math.max(maxHR, hr);
  if (hr < 60) bradyCount++;
}

const avgHR = totalHR / (rpeaks.length - 1);
console.log(`Average HR: ${avgHR.toFixed(1)} bpm`);
console.log(`Min HR: ${minHR.toFixed(1)} bpm`);
console.log(`Max HR: ${maxHR.toFixed(1)} bpm`);
console.log(`Beats with HR < 60: ${bradyCount} / ${rpeaks.length - 1}`);
console.log(`Percentage bradycardia: ${(bradyCount / (rpeaks.length - 1) * 100).toFixed(1)}%`);
