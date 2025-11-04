"""
Context Agent - Extracts and structures EHR data from MIT-BIH Arrhythmia Database
"""
import wfdb
import numpy as np
from typing import Dict, List, Optional, Tuple
import os


class ContextAgent:
    """
    Agent responsible for extracting patient context from ECG data.
    Processes MIT-BIH Arrhythmia Database records to extract:
    - Patient demographics
    - ECG signal characteristics
    - Bradycardia annotations
    - Signal quality metrics
    """

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        # Records with prominent bradycardia
        self.bradycardia_records = ['107', '117', '118', '207', '217']

    def load_ecg_record(self, record_id: str) -> Tuple[wfdb.Record, wfdb.Annotation]:
        """
        Load ECG record and annotations from MIT-BIH database.
        Auto-downloads if not present locally.

        Args:
            record_id: MIT-BIH record ID (e.g., '107')

        Returns:
            Tuple of (record, annotation)
        """
        try:
            # Auto-downloads from PhysioNet if not present
            # Use pn_dir parameter to download from PhysioNet
            record = wfdb.rdrecord(record_id, pn_dir='mitdb')
            annotation = wfdb.rdann(record_id, 'atr', pn_dir='mitdb')
            return record, annotation
        except Exception as e:
            raise Exception(f"Error loading record {record_id}: {str(e)}")

    def extract_patient_context(self, record_id: str) -> Dict:
        """
        Extract comprehensive patient context from ECG record.

        Args:
            record_id: MIT-BIH record ID

        Returns:
            Dictionary containing patient context
        """
        record, annotation = self.load_ecg_record(record_id)

        # Extract signal data
        signal = record.p_signal[:, 0]  # First channel (usually MLII)
        fs = record.fs  # Sampling frequency (360 Hz for MIT-BIH)
        duration_min = len(signal) / (fs * 60)

        # Extract bradycardia events (heart rate < 60 bpm)
        bradycardia_events = self._detect_bradycardia_episodes(
            annotation, fs
        )

        # Calculate signal quality metrics
        quality_metrics = self._calculate_signal_quality(signal, fs)

        context = {
            "record_id": record_id,
            "patient_info": {
                "record_name": record.record_name,
                "comments": record.comments if hasattr(record, 'comments') else [],
                "duration_minutes": round(duration_min, 2),
                "sampling_rate": int(fs)
            },
            "signal_info": {
                "channels": record.sig_name,
                "units": record.units,
                "baseline": float(np.mean(signal)),
                "signal_range": [float(np.min(signal)), float(np.max(signal))]
            },
            "bradycardia_events": bradycardia_events,
            "quality_metrics": quality_metrics,
            "total_beats": int(len(annotation.sample)),
            "has_bradycardia": bool(len(bradycardia_events) > 0)
        }

        return context

    def _detect_bradycardia_episodes(
        self,
        annotation: wfdb.Annotation,
        fs: int
    ) -> List[Dict]:
        """
        Detect bradycardia episodes from R-peak annotations.
        Bradycardia: Heart rate < 60 bpm

        Args:
            annotation: WFDB annotation object
            fs: Sampling frequency

        Returns:
            List of bradycardia episodes with timestamps and heart rates
        """
        episodes = []
        samples = annotation.sample

        # Calculate RR intervals and heart rates
        for i in range(1, len(samples)):
            rr_interval = (samples[i] - samples[i-1]) / fs  # seconds
            heart_rate = 60 / rr_interval if rr_interval > 0 else 0

            if heart_rate < 60 and heart_rate > 30:  # Bradycardia range
                time_sec = samples[i] / fs
                episodes.append({
                    "time_seconds": round(time_sec, 2),
                    "time_minutes": round(time_sec / 60, 2),
                    "heart_rate_bpm": round(heart_rate, 1),
                    "rr_interval_ms": round(rr_interval * 1000, 0),
                    "annotation_type": annotation.symbol[i] if i < len(annotation.symbol) else "N"
                })

        return episodes

    def _calculate_signal_quality(self, signal: np.ndarray, fs: int) -> Dict:
        """
        Calculate signal quality metrics.

        Args:
            signal: ECG signal array
            fs: Sampling frequency

        Returns:
            Dictionary of quality metrics
        """
        # Basic quality indicators
        snr_estimate = self._estimate_snr(signal)
        baseline_wander = np.std(signal - np.convolve(signal, np.ones(fs)//fs, mode='same'))

        # Determine overall quality
        quality_score = "high" if snr_estimate > 20 else "medium" if snr_estimate > 10 else "low"

        return {
            "snr_estimate_db": round(float(snr_estimate), 2),
            "baseline_wander": round(float(baseline_wander), 4),
            "quality_score": quality_score,
            "signal_length": int(len(signal)),
            "has_artifacts": bool(baseline_wander > 0.1)
        }

    def _estimate_snr(self, signal: np.ndarray) -> float:
        """
        Estimate Signal-to-Noise Ratio.
        Simple estimation based on signal variance.

        Args:
            signal: ECG signal

        Returns:
            SNR estimate in dB
        """
        signal_power = np.var(signal)
        # Estimate noise from high-frequency components
        noise_estimate = np.var(np.diff(signal))

        if noise_estimate == 0:
            return 60.0  # Very clean signal

        snr = 10 * np.log10(signal_power / noise_estimate)
        return max(0, snr)  # Ensure non-negative

    def get_bradycardia_records(self) -> List[str]:
        """Return list of record IDs known to contain bradycardia."""
        return self.bradycardia_records

    def extract_ecg_segment(
        self,
        record_id: str,
        start_time: float,
        duration: float = 10.0
    ) -> Dict:
        """
        Extract a specific segment of ECG data for visualization.

        Args:
            record_id: MIT-BIH record ID
            start_time: Start time in seconds
            duration: Duration in seconds

        Returns:
            Dictionary with signal data and timestamps
        """
        record, _ = self.load_ecg_record(record_id)
        fs = record.fs

        start_sample = int(start_time * fs)
        end_sample = int((start_time + duration) * fs)

        # Extract segment
        signal_segment = record.p_signal[start_sample:end_sample, 0]
        time_array = np.arange(len(signal_segment)) / fs + start_time

        return {
            "time": time_array.tolist(),
            "signal": signal_segment.tolist(),
            "sampling_rate": fs,
            "start_time": start_time,
            "duration": duration
        }
