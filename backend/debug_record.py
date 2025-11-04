"""Quick debug script to understand MIT-BIH record structure"""
import wfdb
import numpy as np

# Load record 107
record = wfdb.rdrecord('107', pn_dir='mitdb')
annotation = wfdb.rdann('107', 'atr', pn_dir='mitdb')

print(f"Record: {record.record_name}")
print(f"Duration: {len(record.p_signal) / record.fs / 60:.2f} minutes")
print(f"Sampling rate: {record.fs} Hz")
print(f"Total annotations: {len(annotation.sample)}")
print(f"\nFirst 20 annotations:")

# Calculate heart rates
for i in range(1, min(21, len(annotation.sample))):
    rr_interval = (annotation.sample[i] - annotation.sample[i-1]) / record.fs
    hr = 60 / rr_interval if rr_interval > 0 else 0
    time_min = annotation.sample[i] / record.fs / 60

    print(f"{i}. Time: {time_min:.2f} min, RR: {rr_interval:.3f}s, HR: {hr:.1f} bpm, Symbol: {annotation.symbol[i]}")

# Find slow heart rates
slow_beats = []
for i in range(1, len(annotation.sample)):
    rr_interval = (annotation.sample[i] - annotation.sample[i-1]) / record.fs
    hr = 60 / rr_interval if rr_interval > 0 else 0
    if hr < 60 and hr > 30:
        slow_beats.append((annotation.sample[i] / record.fs / 60, hr))

print(f"\n\nFound {len(slow_beats)} beats with HR < 60 bpm")
if slow_beats:
    print("First 10:")
    for time, hr in slow_beats[:10]:
        print(f"  Time: {time:.2f} min, HR: {hr:.1f} bpm")
