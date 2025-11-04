#!/usr/bin/env python3
"""
MIT-BIH Arrhythmia Database Converter
Converts MIT-BIH records to JSON format for web application use

Install dependencies:
    pip install wfdb numpy

Usage:
    python scripts/convert_mitbih.py
"""

import wfdb
import numpy as np
import json
import os
from pathlib import Path

# Records to convert - TOP 10 with most bradycardia (sorted by bradycardia beat count)
RECORDS_TO_CONVERT = [
    '117',  # 1518 bradycardia beats
    '124',  # 1475 bradycardia beats
    '123',  # 1408 bradycardia beats
    '108',  # 1083 bradycardia beats
    '113',  # 1003 bradycardia beats
    '202',  # 931 bradycardia beats
    '121',  # 853 bradycardia beats
    '201',  # 781 bradycardia beats
    '106',  # 723 bradycardia beats
    '114',  # 645 bradycardia beats
]

def convert_record_to_json(record_name: str, output_dir: Path, max_duration_sec: int = 300):
    """
    Convert a MIT-BIH record from local directory to JSON format

    Args:
        record_name: Record identifier (e.g., '100', '107')
        output_dir: Directory to save JSON files
        max_duration_sec: Maximum duration to include (default 5 minutes to reduce file size)
    """
    print(f"Processing record {record_name}...")

    try:
        # Load from local MIT-BIH directory
        local_mitbih_dir = Path(__file__).parent.parent / 'mit-bih-arrhythmia-database-1.0.0'
        record_path = str(local_mitbih_dir / record_name)

        print(f"  Loading from: {record_path}")
        record = wfdb.rdrecord(record_path)
        annotation = wfdb.rdann(record_path, 'atr')

        # Calculate how many samples to include
        fs = record.fs
        max_samples = int(max_duration_sec * fs) if max_duration_sec else record.sig_len
        max_samples = min(max_samples, record.sig_len)

        # Extract signal data (convert to mV if needed)
        # MIT-BIH signals are usually in physical units already
        signal_0 = record.p_signal[:max_samples, 0].astype(np.float32)  # MLII
        signal_1 = record.p_signal[:max_samples, 1].astype(np.float32) if record.n_sig > 1 else None

        # Get annotations within the time window
        ann_mask = annotation.sample < max_samples
        annotations = []
        for i in range(len(annotation.sample)):
            if ann_mask[i]:
                ann_dict = {
                    'sample': int(annotation.sample[i]),
                    'type': str(annotation.symbol[i]),
                }
                # Only add optional fields if they exist
                if hasattr(annotation, 'subtype') and annotation.subtype is not None:
                    ann_dict['subtype'] = str(annotation.subtype[i]) if annotation.subtype[i] is not None else None
                if hasattr(annotation, 'chan') and annotation.chan is not None:
                    ann_dict['chan'] = int(annotation.chan[i])
                if hasattr(annotation, 'num') and annotation.num is not None:
                    ann_dict['num'] = int(annotation.num[i])
                annotations.append(ann_dict)

        # Create JSON structure
        # Handle different attribute types (some may be numpy arrays, some may be lists)
        def to_list(attr, default):
            if hasattr(record, attr):
                val = getattr(record, attr)
                return val.tolist() if hasattr(val, 'tolist') else val
            return default

        record_data = {
            'recordName': record_name,
            'fs': int(fs),
            'length': max_samples,
            'channels': record.n_sig,
            'channelNames': record.sig_name if isinstance(record.sig_name, list) else record.sig_name.tolist(),
            'adcGain': to_list('adc_gain', [200] * record.n_sig),
            'baseline': to_list('baseline', [0] * record.n_sig),
            'units': record.units if isinstance(record.units, list) else record.units.tolist(),
            'comments': record.comments if isinstance(record.comments, list) else [],
            'signals': {
                'MLII': signal_0.tolist(),
                'V1': signal_1.tolist() if signal_1 is not None else None,
            },
            'annotations': annotations,
        }

        # Save to JSON file
        output_file = output_dir / f'{record_name}.json'
        with open(output_file, 'w') as f:
            json.dump(record_data, f, separators=(',', ':'))  # Compact JSON

        file_size_mb = output_file.stat().st_size / (1024 * 1024)
        print(f"  ✓ Saved {record_name}.json ({file_size_mb:.2f} MB)")
        print(f"    - Duration: {max_samples / fs:.1f}s")
        print(f"    - Channels: {', '.join(record.sig_name)}")
        print(f"    - Annotations: {len(annotations)}")

        return True

    except Exception as e:
        print(f"  ✗ Error processing {record_name}: {e}")
        return False

def main():
    """Convert MIT-BIH records to JSON format"""

    # Create output directory
    output_dir = Path(__file__).parent.parent / 'public' / 'data' / 'mitbih'
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("MIT-BIH Arrhythmia Database Converter")
    print("=" * 60)
    print(f"Output directory: {output_dir}")
    print(f"Records to convert: {', '.join(RECORDS_TO_CONVERT)}")
    print()

    # Convert each record - Use None to convert FULL duration (not just 5 min)
    success_count = 0
    for record_name in RECORDS_TO_CONVERT:
        if convert_record_to_json(record_name, output_dir, max_duration_sec=None):
            success_count += 1
        print()

    # Summary
    print("=" * 60)
    print(f"Conversion complete: {success_count}/{len(RECORDS_TO_CONVERT)} records")
    print("=" * 60)

    if success_count > 0:
        print("\nTo use in your app:")
        print("  import { loadMITBIHRecord } from './utils/mitbih';")
        print("  const record = await loadMITBIHRecord('107');")

if __name__ == '__main__':
    main()
