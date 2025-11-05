import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loadECGDataForEpisode, isMITBIHEpisode, loadHeartRateTrend } from '../utils/mitbihData';
import { ECGData } from '../types';

/**
 * MIT-BIH Patient Demographics
 * All data sourced from MIT-BIH Arrhythmia Database header files (.hea)
 * Format in header: # [Age] [Sex] [Hospital codes]
 */
interface PatientInfo {
  demographics: string;
  clinicalNotes: string;
}

const MITBIH_PATIENT_INFO: Record<string, PatientInfo> = {
  'Patient 100': {
    demographics: '69 yrs • Male',
    clinicalNotes: 'Meds: Aldomet, Inderal'
  },
  'Patient 106': {
    demographics: '24 yrs • Female',
    clinicalNotes: 'Medication: Inderal (beta-blocker)'
  },
  'Patient 107': {
    demographics: '63 yrs • Male',
    clinicalNotes: 'Digoxin • Complete heart block'
  },
  'Patient 119': {
    demographics: 'Age unknown • Unknown sex',
    clinicalNotes: 'ECG Monitor Recording'
  },
  'Patient 200': {
    demographics: '64 yrs • Male',
    clinicalNotes: 'Meds: Digoxin, Quinidine'
  },
  'Patient 231': {
    demographics: '72 yrs • Female',
    clinicalNotes: 'AV block • Mobitz II block'
  }
};

type ArrhythmiaFilter = 'all' | 'brady' | 'tachy' | 'pac' | 'vtac' | 'afib' | 'normal';

export default function ClinicalDashboard() {
  const { episodes, selectedEpisodeId, setSelectedEpisodeId } = useStore();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTab, setSelectedTab] = useState<'summary' | 'new' | 'all' | 'discarded'>('summary');
  const [ecgData, setEcgData] = useState<ECGData | null>(null);
  const [loadingECG, setLoadingECG] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState<typeof episodes>([]);
  const [loadingAllEpisodes, setLoadingAllEpisodes] = useState(false);
  const [hrTrendData, setHrTrendData] = useState<number[]>([]);
  const [selectedArrhythmiaFilter, setSelectedArrhythmiaFilter] = useState<ArrhythmiaFilter>('all');

  // Get current episode or first one from filtered episodes
  const currentEpisode = selectedEpisodeId
    ? [...episodes, ...allEpisodes].find((ep) => ep.episode_id === selectedEpisodeId)
    : episodes[0];

  const currentIndex = episodes.findIndex((ep) => ep.episode_id === currentEpisode?.episode_id);

  // Load all episodes when "All Events" tab is selected
  useEffect(() => {
    async function loadAllEps() {
      if (selectedTab === 'all' && allEpisodes.length === 0 && !loadingAllEpisodes) {
        setLoadingAllEpisodes(true);
        try {
          console.log('Loading ALL MIT-BIH episodes from all 6 patients...');
          const { loadMITBIHEpisodes } = await import('../utils/mitbihData');
          const allEps = await loadMITBIHEpisodes(100, true); // Load up to 100 episodes, all patients
          setAllEpisodes(allEps);
          console.log(`Loaded ${allEps.length} episodes from all patients`);
        } catch (error) {
          console.error('Failed to load all episodes:', error);
        } finally {
          setLoadingAllEpisodes(false);
        }
      }
    }
    loadAllEps();
  }, [selectedTab, allEpisodes.length, loadingAllEpisodes]);

  // Filter episodes based on selected tab and arrhythmia type
  const filteredEpisodes = useMemo(() => {
    let baseEpisodes: typeof episodes = [];

    if (selectedTab === 'summary' || selectedTab === 'new') {
      // Show only the 3 high-bradycardia patients (default episodes)
      baseEpisodes = selectedTab === 'new'
        ? episodes.filter(ep => ep.status === 'needs_review')
        : episodes;
    } else if (selectedTab === 'all') {
      // Show all episodes from all 6 patients
      baseEpisodes = allEpisodes.length > 0 ? allEpisodes : episodes;
    } else if (selectedTab === 'discarded') {
      // Show denied episodes
      baseEpisodes = [...episodes, ...allEpisodes].filter(ep => ep.status === 'denied');
    } else {
      baseEpisodes = episodes;
    }

    // Apply arrhythmia type filter
    if (selectedArrhythmiaFilter === 'all') {
      return baseEpisodes;
    } else {
      return baseEpisodes.filter(ep => ep.type === selectedArrhythmiaFilter);
    }
  }, [selectedTab, episodes, allEpisodes, selectedArrhythmiaFilter]);

  // Group episodes by patient (define BEFORE using it)
  const episodesByPatient = useMemo(() => {
    const grouped = filteredEpisodes.reduce((acc, ep) => {
      const patientId = ep.patient_id || 'Unknown';

      if (!acc[patientId]) {
        acc[patientId] = { total: 0, bradyCount: 0, episodes: [] };
      }

      acc[patientId].total++;
      if (ep.avg_hr < 60) acc[patientId].bradyCount++;
      acc[patientId].episodes.push(ep);

      return acc;
    }, {} as Record<string, { total: number; bradyCount: number; episodes: typeof episodes }>);

    // Debug logging
    console.log(`=== EPISODES BY PATIENT (${selectedTab} tab) ===`);
    Object.entries(grouped).forEach(([patientId, data]) => {
      console.log(`${patientId}: ${data.total} episodes`);
      data.episodes.forEach(ep => {
        console.log(`  - ${ep.episode_id} (${format(ep.start_ts, 'HH:mm:ss')}) - HR: ${ep.avg_hr} bpm`);
      });
    });

    return grouped;
  }, [filteredEpisodes, selectedTab]);

  // Patient navigation
  const currentPatientId = currentEpisode?.patient_id;
  const patientIds = Object.keys(episodesByPatient);
  const currentPatientIndex = patientIds.findIndex(id => id === currentPatientId);

  const moveToNextPatient = () => {
    if (currentPatientIndex < patientIds.length - 1) {
      const nextPatientId = patientIds[currentPatientIndex + 1];
      const firstEpisode = episodesByPatient[nextPatientId].episodes[0];
      setSelectedEpisodeId(firstEpisode.episode_id);
    }
  };

  const moveToPreviousPatient = () => {
    if (currentPatientIndex > 0) {
      const prevPatientId = patientIds[currentPatientIndex - 1];
      const firstEpisode = episodesByPatient[prevPatientId].episodes[0];
      setSelectedEpisodeId(firstEpisode.episode_id);
    }
  };

  // Load ECG data for current episode
  useEffect(() => {
    async function loadECG() {
      if (!currentEpisode) {
        setEcgData(null);
        return;
      }

      setLoadingECG(true);
      try {
        // Load ONLY real MIT-BIH data - NO synthetic/demo episodes
        if (isMITBIHEpisode(currentEpisode)) {
          console.log(`Loading REAL MIT-BIH ECG data for episode ${currentEpisode.episode_id}`);
          const data = await loadECGDataForEpisode(currentEpisode);
          setEcgData(data);
        } else {
          // ERROR: Only MIT-BIH episodes allowed - no synthetic data
          console.error('ERROR: Non-MIT-BIH episode detected - cannot load synthetic data');
          setEcgData(null);
        }
      } catch (error) {
        console.error('CRITICAL ERROR: Failed to load MIT-BIH ECG data:', error);
        setEcgData(null);
      } finally {
        setLoadingECG(false);
      }
    }

    loadECG();
  }, [currentEpisode]);

  // Load heart rate trend data for the current patient
  useEffect(() => {
    async function loadHRTrend() {
      if (!currentEpisode?.patient_id) {
        setHrTrendData([]);
        return;
      }

      try {
        console.log(`Loading heart rate trend for ${currentEpisode.patient_id}...`);
        const { heartRates } = await loadHeartRateTrend(currentEpisode.patient_id);
        setHrTrendData(heartRates);
      } catch (error) {
        console.error('Failed to load heart rate trend:', error);
        setHrTrendData([]);
      }
    }

    loadHRTrend();
  }, [currentEpisode?.patient_id]);

  const totalEvents = filteredEpisodes.length;
  const needsReviewCount = filteredEpisodes.filter((ep) => ep.status === 'needs_review').length;

  // Get episodes for the current patient only
  const currentPatientEpisodes = useMemo(() => {
    if (!currentEpisode?.patient_id) return [];
    return episodesByPatient[currentEpisode.patient_id]?.episodes || [];
  }, [currentEpisode?.patient_id, episodesByPatient]);

  // Find current episode index within the current patient's episodes
  const currentPatientEpisodeIndex = useMemo(() => {
    return currentPatientEpisodes.findIndex(ep => ep.episode_id === currentEpisode?.episode_id);
  }, [currentPatientEpisodes, currentEpisode?.episode_id]);

  const moveToNext = () => {
    // Navigate to next episode within the SAME patient
    if (currentPatientEpisodeIndex < currentPatientEpisodes.length - 1) {
      setSelectedEpisodeId(currentPatientEpisodes[currentPatientEpisodeIndex + 1].episode_id);
    }
  };

  const moveToPrevious = () => {
    // Navigate to previous episode within the SAME patient
    if (currentPatientEpisodeIndex > 0) {
      setSelectedEpisodeId(currentPatientEpisodes[currentPatientEpisodeIndex - 1].episode_id);
    }
  };

  const handleDiscard = () => {
    // Move to next episode within same patient before discarding
    if (currentPatientEpisodeIndex < currentPatientEpisodes.length - 1) {
      setSelectedEpisodeId(currentPatientEpisodes[currentPatientEpisodeIndex + 1].episode_id);
    } else if (currentPatientEpisodeIndex > 0) {
      setSelectedEpisodeId(currentPatientEpisodes[currentPatientEpisodeIndex - 1].episode_id);
    }
    // TODO: Add logic to actually remove/mark episode as discarded
    console.log('Discarded episode:', currentEpisode?.episode_id);
  };

  // Generate SVG path from real heart rate data
  const generateHRTrendPath = (hrData: number[]): string => {
    if (hrData.length === 0) {
      // Return flat line at 80 bpm if no data
      return "M 0 40 L 1000 40";
    }

    const width = 1000;
    const height = 80;
    const minHR = 30;  // Minimum HR on Y-axis
    const maxHR = 120; // Maximum HR on Y-axis

    // Convert HR values to SVG coordinates
    const points = hrData.map((hr, index) => {
      const x = (index / (hrData.length - 1)) * width;
      // Invert Y-axis (lower HR = higher Y value in SVG)
      const normalizedHR = (hr - minHR) / (maxHR - minHR);
      const y = height - (normalizedHR * height);
      return { x, y };
    });

    // Build SVG path using line segments
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  if (!currentEpisode) {
    return <div className="flex items-center justify-center h-screen bg-white">No episodes found</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Tabs */}
      <div className="bg-white border-b border-gray-300 px-6 py-2 flex items-center space-x-6">
        <button className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-2">
          Events
        </button>
        <button className="text-gray-600 hover:text-gray-900 pb-2">Reports</button>
        <button className="text-gray-600 hover:text-gray-900 pb-2">Services</button>
        <button className="text-gray-600 hover:text-gray-900 pb-2">Criteria</button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-white border-r border-gray-300 flex flex-col">
          {/* Patient Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-lg">👤</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {currentEpisode?.patient_id || 'Patient Name'}
                </div>
                <div className="text-xs text-gray-600">
                  {currentEpisode?.patient_id && MITBIH_PATIENT_INFO[currentEpisode.patient_id]
                    ? MITBIH_PATIENT_INFO[currentEpisode.patient_id].demographics
                    : 'Unknown demographics'}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-700 font-medium mt-2">
              MIT-BIH Arrhythmia Database • 1975-1979
            </div>
            <div className="text-xs text-gray-500">
              {currentEpisode?.patient_id && MITBIH_PATIENT_INFO[currentEpisode.patient_id]
                ? MITBIH_PATIENT_INFO[currentEpisode.patient_id].clinicalNotes
                : 'ECG Monitor Recording'}
            </div>
          </div>

          {/* Summary Tabs */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-4 mb-3">
              <button
                onClick={() => setSelectedTab('summary')}
                className={`text-xs pb-1 ${
                  selectedTab === 'summary'
                    ? 'text-gray-900 font-semibold border-b-2 border-blue-500'
                    : 'text-gray-600'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setSelectedTab('new')}
                className={`text-xs pb-1 ${
                  selectedTab === 'new'
                    ? 'text-gray-900 font-semibold border-b-2 border-blue-500'
                    : 'text-gray-600'
                }`}
              >
                New Events
              </button>
              <button
                onClick={() => setSelectedTab('all')}
                className={`text-xs pb-1 ${
                  selectedTab === 'all'
                    ? 'text-gray-900 font-semibold border-b-2 border-blue-500'
                    : 'text-gray-600'
                }`}
              >
                All Events {loadingAllEpisodes && '⏳'}
              </button>
            </div>
            <div className="text-lg font-bold text-gray-900">{totalEvents} Events</div>
            <div className="text-sm text-red-600 font-semibold">{needsReviewCount} for Review</div>
          </div>

          {/* Events Label */}
          <div className="px-4 py-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Events</span>
              <div className="flex items-center space-x-3">
                <span>👤</span>
                <span>📋</span>
              </div>
            </div>
          </div>

          {/* Patients List */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(episodesByPatient).map(([patientId, data]) => (
              <div key={patientId} className="border-b border-gray-200 bg-white">
                {/* Patient Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{patientId}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {data.total} Episodes • {data.bradyCount} Bradycardia
                      </div>
                    </div>
                    {data.episodes.some((ep) => ep.status === 'needs_review') && (
                      <div className="bg-red-500 rounded-full px-2 py-1">
                        <span className="text-white text-xs font-bold">
                          {data.episodes.filter((ep) => ep.status === 'needs_review').length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Episode List for this Patient */}
                <div className="max-h-40 overflow-y-auto">
                  {data.episodes.map((ep) => (
                    <button
                      key={ep.episode_id}
                      onClick={() => setSelectedEpisodeId(ep.episode_id)}
                      className={`w-full px-4 py-2 text-left text-xs hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                        ep.episode_id === currentEpisode?.episode_id
                          ? 'bg-blue-50 border-l-4 border-l-blue-500 font-semibold'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-gray-900">{format(ep.start_ts, 'HH:mm:ss')}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">
                            HR: {ep.min_hr}-{ep.avg_hr} bpm
                          </div>
                        </div>
                        {ep.status === 'needs_review' && (
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Day/Night Events */}
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-2">Day/Night Events</div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="text-yellow-500">☀️</span>
                <span className="text-xs text-gray-700 font-semibold">
                  {Math.floor(totalEvents * 0.6)}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-blue-500">🌙</span>
                <span className="text-xs text-gray-700 font-semibold">
                  {Math.floor(totalEvents * 0.4)}
                </span>
              </div>
            </div>
          </div>

          {/* Reports */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button className="text-sm text-gray-700 font-medium hover:text-gray-900">
              Reports
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
          {/* HR Trend Graph */}
          <div className="bg-white p-4 border-b border-gray-300 h-36 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-600">Heart Rate Trend - {currentEpisode ? format(currentEpisode.start_ts, 'MM/dd/yyyy') : selectedDate}</div>
              <div className="text-xs text-gray-500">30 min recording</div>
            </div>
            <svg className="w-full h-24" viewBox="0 0 1000 80">
              {/* Grid lines */}
              {[0, 200, 400, 600, 800, 1000].map((x) => (
                <line key={x} x1={x} y1="0" x2={x} y2="80" stroke="#e5e7eb" strokeWidth="1" />
              ))}
              {[0, 20, 40, 60, 80].map((y) => (
                <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="#e5e7eb" strokeWidth="1" />
              ))}
              {/* HR trend line - REAL MIT-BIH DATA */}
              <path
                d={generateHRTrendPath(hrTrendData)}
                stroke="#6b7280"
                strokeWidth="1.5"
                fill="none"
              />
              {/* Axis labels */}
              <text x="5" y="15" fontSize="10" fill="#9ca3af">120</text>
              <text x="5" y="45" fontSize="10" fill="#9ca3af">80</text>
              <text x="5" y="75" fontSize="10" fill="#9ca3af">40</text>
            </svg>
          </div>

          {/* Event Header */}
          <div className={`px-6 py-3 border-b flex items-center justify-between flex-shrink-0 ${
            currentEpisode.type === 'brady' ? 'bg-pink-100 border-pink-200' :
            currentEpisode.type === 'tachy' ? 'bg-orange-100 border-orange-200' :
            currentEpisode.type === 'vtac' ? 'bg-red-100 border-red-300' :
            currentEpisode.type === 'afib' ? 'bg-purple-100 border-purple-200' :
            currentEpisode.type === 'pac' ? 'bg-yellow-100 border-yellow-200' :
            'bg-green-100 border-green-200'
          }`}>
            <div className="flex items-center space-x-4">
              {/* Arrhythmia Type Toggle */}
              <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm">
                <button
                  onClick={() => setSelectedArrhythmiaFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-l-lg transition-colors ${
                    selectedArrhythmiaFilter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setSelectedArrhythmiaFilter('brady')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 ${
                    selectedArrhythmiaFilter === 'brady'
                      ? 'bg-pink-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  BRADY
                </button>
                <button
                  onClick={() => setSelectedArrhythmiaFilter('tachy')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 ${
                    selectedArrhythmiaFilter === 'tachy'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  TACHY
                </button>
                <button
                  onClick={() => setSelectedArrhythmiaFilter('pac')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 ${
                    selectedArrhythmiaFilter === 'pac'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  PAC
                </button>
                <button
                  onClick={() => setSelectedArrhythmiaFilter('vtac')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 ${
                    selectedArrhythmiaFilter === 'vtac'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  VTAC
                </button>
                <button
                  onClick={() => setSelectedArrhythmiaFilter('afib')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 rounded-r-lg ${
                    selectedArrhythmiaFilter === 'afib'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  AFIB
                </button>
              </div>

              <span className="text-sm text-gray-700">
                {format(currentEpisode.start_ts, 'MM/dd/yyyy HH:mm:ss a')} (EST)
              </span>
              <span className="text-sm text-gray-700 font-semibold">
                AVG HR {currentEpisode.avg_hr} BPM
              </span>
            </div>

            {/* Event Navigation */}
            <div className="flex items-center space-x-3">
              <button
                onClick={moveToPreviousPatient}
                disabled={currentPatientIndex === 0}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev Patient</span>
              </button>

              <div className="px-3 py-1 bg-white border-2 border-blue-500 rounded text-xs font-bold text-gray-900">
                {currentPatientId} ({currentPatientIndex + 1}/{patientIds.length})
              </div>

              <button
                onClick={moveToNextPatient}
                disabled={currentPatientIndex === patientIds.length - 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <span>Next Patient</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Combined ECG Strip */}
          <div className="flex-1 overflow-y-auto p-6">
            <CombinedECGStrip data={ecgData} episode={currentEpisode} />
          </div>

          {/* Bottom Controls */}
          <div className="bg-gray-200 border-t border-gray-400 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-4">
              <button
                onClick={moveToPrevious}
                disabled={currentIndex === 0}
                className="p-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Gain:</span>
                <select className="border border-gray-400 rounded px-2 py-1 text-sm bg-white text-gray-900">
                  <option>10 mm/mV</option>
                  <option>5 mm/mV</option>
                  <option>20 mm/mV</option>
                </select>
              </div>

              <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-semibold text-sm">
                Mark unreviewed
              </button>

              <button
                onClick={handleDiscard}
                className="px-4 py-2 bg-white border border-gray-400 rounded hover:bg-gray-100 text-sm text-gray-800"
              >
                Discard
              </button>

              <button
                onClick={moveToNext}
                disabled={currentPatientEpisodeIndex >= currentPatientEpisodes.length - 1}
                className="p-2 bg-white border border-gray-400 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next event in this patient (↓)"
              >
                ▼
              </button>
              <button
                onClick={moveToPrevious}
                disabled={currentPatientEpisodeIndex <= 0}
                className="p-2 bg-white border border-gray-400 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous event in this patient (↑)"
              >
                ▲
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <button className="text-sm text-gray-600 hover:text-gray-900">Create event</button>
              <button className="text-sm text-gray-600 hover:text-gray-900">Caliper</button>

              <button
                onClick={moveToNext}
                disabled={currentIndex === episodes.length - 1}
                className="p-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Combined ECG Strip Component showing all three leads
function CombinedECGStrip({ data, episode }: { data: ECGData | null; episode: any }) {
  // Always call hooks first (Rules of Hooks - must be called unconditionally)
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1); // 1x, 2x, 4x
  const [hoveredBpmLabel, setHoveredBpmLabel] = React.useState<{ hr: number; x: number; y: number } | null>(null);
  const [llmExplanation, setLlmExplanation] = React.useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = React.useState(false);
  const explanationCache = React.useRef<Map<number, string>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animationRef = React.useRef<number>();

  // Calculate totalWidth based on actual data duration
  // Use 100 pixels per second for consistent time scale
  const PIXELS_PER_SECOND = 100;
  const dataDurationSeconds = data ? data.samples.length / data.fs : 30;
  const totalWidth = Math.round(dataDurationSeconds * PIXELS_PER_SECOND);

  const viewWidth = 1200;
  const leads = ['Lead I', 'Lead II', 'Lead III'];

  // Playback animation
  React.useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setScrollPosition((prev) => {
          const newPos = prev + (2 * playbackSpeed); // Scroll speed
          if (newPos >= totalWidth - viewWidth) {
            setIsPlaying(false);
            return 0; // Loop back to start
          }
          return newPos;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalWidth, viewWidth]);

  const handleScroll = (e: React.WheelEvent) => {
    // Note: Can't preventDefault on passive wheel events in modern browsers
    const newPosition = Math.max(0, Math.min(totalWidth - viewWidth, scrollPosition + e.deltaX));
    setScrollPosition(newPosition);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Fetch GPT-5 explanation when hovering over a BPM label
  React.useEffect(() => {
    if (!hoveredBpmLabel) {
      setLlmExplanation(null);
      setLoadingExplanation(false);
      return;
    }

    const hr = hoveredBpmLabel.hr;

    // Check cache first
    if (explanationCache.current.has(hr)) {
      setLlmExplanation(explanationCache.current.get(hr)!);
      setLoadingExplanation(false);
      return;
    }

    // Fetch from GPT-5
    const fetchExplanation = async () => {
      setLoadingExplanation(true);

      try {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

        if (!apiKey) {
          // Use fallback if no API key
          const fallback = generateFallbackExplanation(hr);
          explanationCache.current.set(hr, fallback);
          setLlmExplanation(fallback);
          setLoadingExplanation(false);
          return;
        }

        const prompt = `You are a clinical AI assistant. Provide a brief, 2-sentence explanation for a heart rate of ${hr} bpm detected in an ECG recording.

Context:
- Normal heart rate: 60-100 bpm
- Bradycardia: < 60 bpm
- Current heart rate: ${hr} bpm
- Severity: ${hr < 40 ? 'Severe' : hr < 50 ? 'Moderate' : hr < 60 ? 'Mild bradycardia' : 'Normal'}

Provide a concise clinical explanation focusing on the significance of this specific heart rate measurement.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-5',
            messages: [
              {
                role: 'system',
                content: 'You are a clinical AI assistant specializing in cardiac arrhythmia interpretation. Provide concise, accurate clinical explanations.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const explanation = data.choices[0].message.content.trim();

        // Cache the result
        explanationCache.current.set(hr, explanation);
        setLlmExplanation(explanation);
      } catch (error) {
        console.error('Failed to fetch GPT-5 explanation:', error);
        const fallback = generateFallbackExplanation(hr);
        explanationCache.current.set(hr, fallback);
        setLlmExplanation(fallback);
      } finally {
        setLoadingExplanation(false);
      }
    };

    fetchExplanation();
  }, [hoveredBpmLabel]);

  // Generate fallback explanation without API
  const generateFallbackExplanation = (hr: number): string => {
    if (hr < 40) {
      return `Severe bradycardia at ${hr} bpm. Heart rate significantly below normal threshold (60 bpm), indicating critical slowing of cardiac rhythm. Immediate clinical evaluation recommended.`;
    } else if (hr < 50) {
      return `Moderate bradycardia at ${hr} bpm. Heart rate substantially below normal threshold (60 bpm), representing clinically significant slowing. Review patient symptoms and clinical context.`;
    } else if (hr < 60) {
      return `Mild bradycardia at ${hr} bpm. Heart rate below normal threshold (60 bpm) but within acceptable range for some patients. Monitor and correlate with clinical presentation.`;
    } else {
      return `Normal sinus rhythm at ${hr} bpm. Heart rate within normal physiological range (60-100 bpm). No intervention required.`;
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1, 2, 4];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  const handleRestart = () => {
    setScrollPosition(0);
    setIsPlaying(true);
  };

  // Show loading state AFTER all hooks are called
  if (!data || !episode) {
    return (
      <div className="bg-white border border-gray-300 rounded p-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-sm text-gray-600">Loading ECG data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
      {/* Strip Header */}
      <div className="px-3 py-1 bg-gray-50 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-700 font-semibold">ECG - All Leads</span>

          {/* Playback Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlay}
              className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-900"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={handleRestart}
              className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-900"
              title="Restart"
            >
              Restart
            </button>

            <button
              onClick={handleSpeedChange}
              className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-900"
              title="Change speed"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-600">
          <span>HR: {episode.avg_hr} bpm</span>
          <span>•</span>
          <span>Duration: {((episode.end_ts.getTime() - episode.start_ts.getTime()) / 1000).toFixed(1)}s</span>
        </div>
      </div>

      {/* Combined ECG Grid and Waveforms */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto cursor-grab active:cursor-grabbing"
        onWheel={handleScroll}
        style={{ height: '450px' }}
      >
        <div
          className="p-3 relative"
          style={{
            width: `${totalWidth}px`,
            height: '100%',
            backgroundImage: `
              linear-gradient(to right, #fecaca 1px, transparent 1px),
              linear-gradient(to bottom, #fecaca 1px, transparent 1px),
              linear-gradient(to right, #fca5a5 2px, transparent 2px),
              linear-gradient(to bottom, #fca5a5 2px, transparent 2px)
            `,
            backgroundSize: '5px 5px, 5px 5px, 25px 25px, 25px 25px',
            backgroundPosition: '0 0, 0 0, 0 0, 0 0',
            transform: `translateX(-${scrollPosition}px)`,
            transition: isPlaying ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <svg
            className="absolute top-0 left-0"
            width={totalWidth}
            height="450"
            viewBox={`0 0 ${totalWidth} 450`}
            preserveAspectRatio="none"
          >
            {/* Render all three leads stacked vertically */}
            {leads.map((leadName, leadIndex) => {
              const yOffset = leadIndex * 150; // Vertical spacing between leads
              const centerY = yOffset + 75;

              return (
                <g key={leadName}>
                  {/* Lead label */}
                  <text x="10" y={yOffset + 20} fontSize="12" fill="#6b7280" fontWeight="600">
                    {leadName}
                  </text>

                  {/* Baseline for this lead */}
                  <line
                    x1="0"
                    y1={centerY}
                    x2={totalWidth}
                    y2={centerY}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />

                  {/* ECG Waveform for this lead */}
                  <ECGWaveformLead
                    samples={data.samples}
                    width={totalWidth}
                    yOffset={yOffset}
                    leadIndex={leadIndex}
                  />

                  {/* R-peak markers for this lead */}
                  {data.r_peaks?.slice(0, 30).map((peakIdx: number, idx: number) => {
                    // Ensure peakIdx is within bounds
                    if (peakIdx < 0 || peakIdx >= data.samples.length) {
                      return null;
                    }

                    // Calculate position based on TIME in seconds, not sample index
                    const timeInSeconds = peakIdx / data.fs;
                    const x = (timeInSeconds / dataDurationSeconds) * totalWidth;
                    const voltage = data.samples[peakIdx];

                    // Skip if voltage is undefined or NaN
                    if (voltage === undefined || isNaN(voltage)) {
                      return null;
                    }

                    // Scale voltage appropriately
                    const y = centerY - voltage * 30;

                    return (
                      <g key={`${leadName}-${idx}`}>
                        <circle cx={x} cy={y} r="3" fill="#ef4444" />
                      </g>
                    );
                  })}

                  {/* Horizontal separator line */}
                  {leadIndex < 2 && (
                    <line
                      x1="0"
                      y1={yOffset + 150}
                      x2={totalWidth}
                      y2={yOffset + 150}
                      stroke="#d1d5db"
                      strokeWidth="1"
                    />
                  )}
                </g>
              );
            })}

            {/* Time markers (shared across all leads) */}
            {(() => {
              // Show time markers every 5 seconds for readability
              const markerInterval = 5; // seconds
              const numMarkers = Math.floor(dataDurationSeconds / markerInterval);

              return Array.from({ length: numMarkers + 1 }, (_, i) => {
                const timeInSeconds = i * markerInterval;
                const x = (timeInSeconds / dataDurationSeconds) * totalWidth;

                return (
                  <g key={i}>
                    <line x1={x} y1="0" x2={x} y2="450" stroke="#e5e7eb" strokeWidth="0.5" opacity="0.5" />
                    <text x={x + 5} y="440" fontSize="9" fill="#6b7280">
                      {timeInSeconds}s
                    </text>
                  </g>
                );
              });
            })()}

            {/* Heart Rate labels - Only show every 4 seconds */}
            {(() => {
              let lastLabelTime = -4; // Initialize to show first label immediately
              // Calculate total duration in seconds
              const totalDurationSeconds = data.samples.length / data.fs;

              return data.r_peaks && data.r_peaks.length > 1 && data.r_peaks.slice(0, -1).map((rpeak, i) => {
                const rrInterval = (data.r_peaks![i + 1] - rpeak) / data.fs;
                const hr = 60 / rrInterval;

                // Color coding: Red for bradycardia (< 60), Green for normal (>= 60)
                const isBradycardia = hr < 60;
                const labelBgColor = isBradycardia ? '#ef4444' : '#22c55e';

                // Calculate position based on TIME in seconds, not sample index
                const timeInSeconds = rpeak / data.fs;
                const nextTimeInSeconds = data.r_peaks![i + 1] / data.fs;
                const x = (timeInSeconds / totalDurationSeconds) * totalWidth;
                const width = ((nextTimeInSeconds - timeInSeconds) / totalDurationSeconds) * totalWidth;

                // Only show label every 4 seconds
                const timeFromStart = timeInSeconds;
                const showLabel = (timeFromStart - lastLabelTime) >= 4;

                if (showLabel) {
                  lastLabelTime = timeFromStart;
                }

                return (
                  <g key={`hr-${i}`}>
                    {/* HR label (only every 4 seconds) */}
                    {showLabel && (
                      <g
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredBpmLabel({
                            hr: Math.round(hr),
                            x: rect.left + rect.width / 2,
                            y: rect.top
                          });
                        }}
                        onMouseLeave={() => setHoveredBpmLabel(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Label background */}
                        <rect
                          x={x + width / 2 - 25}
                          y="8"
                          width="50"
                          height="18"
                          fill={labelBgColor}
                          rx="3"
                          opacity="0.95"
                        />
                        {/* HR text */}
                        <text
                          x={x + width / 2}
                          y="20"
                          fontSize="11"
                          fontWeight="bold"
                          fill="#ffffff"
                          textAnchor="middle"
                        >
                          {hr.toFixed(0)} bpm
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            })()}
          </svg>
        </div>

        {/* Playhead cursor */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10 pointer-events-none"
            style={{
              left: `${viewWidth / 2}px`,
              boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)',
            }}
          >
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-blue-600" />
            </div>
          </div>
        )}

        {/* Explainability Tooltip Overlay */}
        {hoveredBpmLabel && episode && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredBpmLabel.x,
              top: hoveredBpmLabel.y - 10,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl max-w-md border border-gray-700">
              {/* Arrow pointing down */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900" />
              </div>

              {/* Heart Rate Info */}
              <div className="flex items-center space-x-2 mb-2">
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                  hoveredBpmLabel.hr < 60 ? 'bg-red-500' : 'bg-green-500'
                }`}>
                  {hoveredBpmLabel.hr} bpm
                </span>
                <span className="text-xs text-gray-400">
                  {hoveredBpmLabel.hr < 40 ? 'Severe' : hoveredBpmLabel.hr < 50 ? 'Moderate' : hoveredBpmLabel.hr < 60 ? 'Mild' : 'Normal'}
                </span>
              </div>

              {/* AI Explanation */}
              <div className="text-sm leading-relaxed">
                <div className="flex items-start space-x-2">
                  {loadingExplanation ? (
                    <>
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-gray-400 italic">Generating AI explanation...</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"/>
                      </svg>
                      <p className="text-gray-200">
                        {llmExplanation || `Loading explanation for ${hoveredBpmLabel.hr} bpm...`}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Detection Criteria */}
              <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                <div className="flex items-center space-x-2">
                  <span>Detected by:</span>
                  <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {hoveredBpmLabel.hr < 60 ? 'HR < 60 bpm' : 'Normal range'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scrollbar indicator */}
      <div className="h-2 bg-gray-100 border-t border-gray-200">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{
            width: `${(viewWidth / totalWidth) * 100}%`,
            marginLeft: `${(scrollPosition / totalWidth) * 100}%`,
          }}
        />
      </div>

      {/* Time display */}
      <div className="px-3 py-1 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <span>
          Time: {((scrollPosition / totalWidth) * 30).toFixed(1)}s / 30.0s
        </span>
        <span className="text-gray-500">
          {isPlaying ? '▶ Playing' : '⏸ Paused'} • {playbackSpeed}x speed
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ECG WAVEFORM RENDERING - REAL MIT-BIH DATA ONLY (NO SYNTHETIC DATA)
// ============================================================================

function ECGWaveformLead({
  samples,
  width,
  yOffset,
  leadIndex,
}: {
  samples: Float32Array;
  width: number;
  yOffset: number;
  leadIndex: number;
}) {
  const centerY = yOffset + 75;
  const height = 150; // Height available for this lead
  const amplitudeScale = 60; // Vertical scaling for ECG amplitude

  // Generate path from REAL MIT-BIH samples ONLY
  const points: string[] = [];

  if (!samples || samples.length === 0) {
    // ERROR: No real data available - show error message
    console.error(`ECGWaveformLead: No real samples available for lead ${leadIndex} - CANNOT RENDER`);
    return (
      <g>
        <text x={width/2} y={centerY} textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="bold">
          ERROR: No real MIT-BIH data available
        </text>
      </g>
    );
  }

  // Log that we're using real MIT-BIH data
  console.log(`✅ ECGWaveformLead: Rendering REAL MIT-BIH data for lead ${leadIndex}`, {
    totalSamples: samples.length,
    firstSample: samples[0],
    lastSample: samples[samples.length - 1],
    width: width
  });

  // Find min/max for proper scaling of real data
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
    if (samples[i] > max) max = samples[i];
  }

  // Add padding to prevent clipping
  const range = (max - min) || 1;
  const padding = range * 0.1;
  min -= padding;
  max += padding;
  const adjustedRange = max - min;

  // Generate path points from real voltage samples
  for (let x = 0; x < width; x++) {
    // Map x position to sample index
    const sampleIdx = Math.floor((x / width) * samples.length);
    const voltage = samples[Math.min(sampleIdx, samples.length - 1)];

    // Normalize voltage to 0-1 range
    const normalized = (voltage - min) / adjustedRange;

    // Convert to Y coordinate (flip because SVG Y increases downward)
    const y = centerY - ((normalized - 0.5) * amplitudeScale);

    // Add point to path
    if (x === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  }

  const pathData = points.join(' ');

  return (
    <path
      d={pathData}
      stroke="#1f2937"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
