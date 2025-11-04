import { useEffect, useRef, useState, useCallback } from 'react';
import { ECGData, Episode } from '../types';

interface ECGCanvasProps {
  data: ECGData;
  episode: Episode;
  width?: number;
  height?: number;
  onSegmentAction?: (action: 'approve' | 'deny') => void;
}

export default function ECGCanvas({
  data,
  episode,
  width = 1200,
  height = 400,
  onSegmentAction,
}: ECGCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(false);
  const [hoverX, setHoverX] = useState(0);

  const { samples, fs, r_peaks, hr_series } = data;

  // Draw the ECG
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#111827'; // gray-900
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 0.5;

    // Vertical lines (time)
    const gridSpacingX = 50; // pixels
    for (let x = 0; x < width; x += gridSpacingX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines (amplitude)
    const gridSpacingY = 40;
    for (let y = 0; y < height; y += gridSpacingY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Calculate visible range
    const samplesPerPixel = Math.max(1, Math.floor(samples.length / (width * zoom)));
    const startSample = Math.max(0, Math.floor(pan * samples.length));
    const endSample = Math.min(samples.length, startSample + width * samplesPerPixel);

    // Calculate HR from R-peaks if not provided
    const heartRates: number[] = [];
    if (r_peaks && r_peaks.length > 1) {
      if (hr_series && hr_series.length === r_peaks.length) {
        heartRates.push(...hr_series);
      } else {
        // Calculate HR from consecutive R-peaks
        for (let i = 0; i < r_peaks.length - 1; i++) {
          const rrInterval = (r_peaks[i + 1] - r_peaks[i]) / fs;
          const hr = 60 / rrInterval;
          heartRates.push(hr);
        }
      }
    }

    // Find min/max for scaling with padding
    let min = Infinity;
    let max = -Infinity;
    for (let i = startSample; i < endSample; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    // Add 10% padding to prevent clipping
    const range = max - min || 1;
    const padding = range * 0.1;
    min -= padding;
    max += padding;

    // Draw bradycardia segment overlay (red tinted area)
    const segmentStartPx =
      ((episode.start_sample - startSample) / samplesPerPixel) * zoom;
    const segmentEndPx = ((episode.end_sample - startSample) / samplesPerPixel) * zoom;

    if (segmentEndPx > 0 && segmentStartPx < width) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.15)'; // red with transparency
      ctx.fillRect(
        Math.max(0, segmentStartPx),
        0,
        Math.min(width, segmentEndPx) - Math.max(0, segmentStartPx),
        height
      );

      // Draw segment borders
      ctx.strokeStyle = '#DC2626'; // danger red
      ctx.lineWidth = 2;
      if (segmentStartPx > 0 && segmentStartPx < width) {
        ctx.beginPath();
        ctx.moveTo(segmentStartPx, 0);
        ctx.lineTo(segmentStartPx, height);
        ctx.stroke();
      }
      if (segmentEndPx > 0 && segmentEndPx < width) {
        ctx.beginPath();
        ctx.moveTo(segmentEndPx, 0);
        ctx.lineTo(segmentEndPx, height);
        ctx.stroke();
      }
    }

    // Draw HR highlight boxes - Red for HR < 60 BPM, Green for HR >= 60 BPM
    if (r_peaks && r_peaks.length > 1 && heartRates.length > 0) {
      for (let i = 0; i < r_peaks.length - 1; i++) {
        const hr = heartRates[i];
        const isBradycardia = hr < 60;

        const peakStart = r_peaks[i];
        const peakEnd = r_peaks[i + 1];

        // Convert to pixel coordinates
        const boxStartPx = ((peakStart - startSample) / samplesPerPixel) * zoom;
        const boxEndPx = ((peakEnd - startSample) / samplesPerPixel) * zoom;

        // Only draw if visible on screen
        if (boxEndPx > 0 && boxStartPx < width) {
          const leftX = Math.max(0, boxStartPx);
          const rightX = Math.min(width, boxEndPx);
          const boxWidth = rightX - leftX;

          if (boxWidth > 0) {
            // Color coding
            const fillColor = isBradycardia ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.15)';
            const strokeColor = isBradycardia ? '#EF4444' : '#22c55e';
            const labelBgColor = isBradycardia ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';

            // Draw semi-transparent box
            ctx.fillStyle = fillColor;
            ctx.fillRect(leftX, 0, boxWidth, height);

            // Draw border (dashed for bradycardia, solid for normal)
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isBradycardia ? 2 : 1;
            ctx.setLineDash(isBradycardia ? [5, 3] : []);
            ctx.strokeRect(leftX, 0, boxWidth, height);

            // Draw HR value label at the top of the box
            if (boxWidth > 30) { // Only show label if box is wide enough
              ctx.font = 'bold 11px monospace';
              const hrText = `${hr.toFixed(0)} bpm`;
              const textWidth = ctx.measureText(hrText).width;
              const textX = leftX + (boxWidth - textWidth) / 2;

              // Draw background for text
              ctx.fillStyle = labelBgColor;
              ctx.fillRect(textX - 3, 5, textWidth + 6, 16);

              // Draw text
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(hrText, textX, 17);
            }
          }
        }
      }

      ctx.setLineDash([]); // Reset to solid line
    }

    // Draw ECG waveform
    ctx.strokeStyle = '#10B981'; // green
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const topMargin = 40;
    const bottomMargin = 40;
    const availableHeight = height - topMargin - bottomMargin;
    const updatedRange = max - min || 1;

    let firstPoint = true;
    for (let x = 0; x < width; x++) {
      const sampleIdx = Math.floor(startSample + (x / zoom) * samplesPerPixel);
      if (sampleIdx >= samples.length) break;

      // Normalized value between 0 and 1, clamped to prevent overflow
      const normalized = Math.max(0, Math.min(1, (samples[sampleIdx] - min) / updatedRange));
      // Map to canvas coordinates with margins
      const y = height - bottomMargin - (normalized * availableHeight);

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw R-peaks
    ctx.fillStyle = '#EF4444'; // red
    r_peaks?.forEach((peakIdx) => {
      if (peakIdx >= startSample && peakIdx < endSample) {
        const x = ((peakIdx - startSample) / samplesPerPixel) * zoom;
        const normalized = Math.max(0, Math.min(1, (samples[peakIdx] - min) / updatedRange));
        const y = height - bottomMargin - (normalized * availableHeight);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw time scale
    ctx.fillStyle = '#9CA3AF'; // gray-400
    ctx.font = '12px monospace';
    const startTime = startSample / fs;
    const endTime = endSample / fs;
    ctx.fillText(`${startTime.toFixed(1)}s`, 10, height - 10);
    ctx.fillText(`${endTime.toFixed(1)}s`, width - 60, height - 10);

  }, [samples, fs, r_peaks, hr_series, episode, width, height, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Zoom with scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(10, z * delta)));
  }, []);

  // Pan with drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const delta = (e.clientX - dragStart) / width;
        setPan((p) => Math.max(0, Math.min(1 - 1 / zoom, p - delta)));
        setDragStart(e.clientX);
      }

      // Check if hovering over segment
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const samplesPerPixel = Math.max(1, Math.floor(samples.length / (width * zoom)));
        const startSample = Math.floor(pan * samples.length);
        const segmentStartPx =
          ((episode.start_sample - startSample) / samplesPerPixel) * zoom;
        const segmentEndPx = ((episode.end_sample - startSample) / samplesPerPixel) * zoom;

        setHoveredSegment(x >= segmentStartPx && x <= segmentEndPx);
        setHoverX(x);
      }
    },
    [isDragging, dragStart, width, zoom, pan, samples.length, episode]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-grab active:cursor-grabbing rounded-lg max-w-full"
        style={{ width, height }}
      />

      {/* Hover controls */}
      {hoveredSegment && onSegmentAction && (
        <div
          className="absolute flex items-center space-x-2 bg-gray-800/95 rounded-lg px-3 py-2 shadow-lg border border-gray-600"
          style={{
            left: hoverX,
            top: 20,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            onClick={() => onSegmentAction('approve')}
            className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            title="Approve (A)"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onSegmentAction('deny')}
            className="px-3 py-1 bg-danger text-white rounded-md hover:bg-danger/90 transition-colors text-sm font-medium"
            title="Deny (D)"
          >
            ✕ Deny
          </button>
          <div className="text-xs text-gray-300 border-l border-gray-600 pl-2">
            {episode.min_hr} / {episode.avg_hr} bpm
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-gray-800/95 rounded-lg px-3 py-2 shadow-lg border border-gray-600">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
          className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
        >
          −
        </button>
        <span className="text-sm text-gray-300 min-w-[60px] text-center">
          {(zoom * 100).toFixed(0)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.25))}
          className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
        >
          +
        </button>
        <div className="border-l border-gray-600 pl-2 ml-2">
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
