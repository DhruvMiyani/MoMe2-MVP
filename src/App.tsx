import { useEffect, useState } from 'react';
import { useStore } from './store';
import { loadMITBIHEpisodes } from './utils/mitbihData';
import ClinicalDashboard from './components/ClinicalDashboard';
import Analytics from './components/Analytics';

function App() {
  const currentView = useStore((state) => state.currentView);
  const setEpisodes = useStore((state) => state.setEpisodes);
  const setSelectedEpisodeId = useStore((state) => state.setSelectedEpisodeId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load MIT-BIH data on mount
  useEffect(() => {
    let timeoutId: number;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        console.log('Loading MIT-BIH episodes...');

        // Set a timeout to prevent infinite loading (30 seconds)
        const loadPromise = loadMITBIHEpisodes(100);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error('Loading MIT-BIH data timed out after 30 seconds'));
          }, 30000);
        });

        const episodes = await Promise.race([loadPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        if (episodes.length === 0) {
          throw new Error('No bradycardia episodes found in MIT-BIH data');
        }

        // Set only REAL MIT-BIH episodes - NO synthetic/demo data
        setEpisodes(episodes);

        // Automatically select the first real episode
        setSelectedEpisodeId(episodes[0].episode_id);

        console.log(`Successfully loaded ${episodes.length} REAL MIT-BIH episodes (no synthetic data)`);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('CRITICAL ERROR: Failed to load MIT-BIH data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load real MIT-BIH data';

        // NO FALLBACK TO MOCK DATA - Only real data allowed
        setError(errorMessage + ' - Only real MIT-BIH data is allowed. No synthetic/mock data available.');
      } finally {
        setLoading(false);
      }
    }
    loadData();

    return () => clearTimeout(timeoutId);
  }, [setEpisodes, setSelectedEpisodeId]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xl font-semibold text-gray-700">Loading MIT-BIH Data...</div>
          <div className="text-sm text-gray-500">Downloading ECG records from PhysioNet</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-xl font-semibold text-red-600">Failed to Load Data</div>
          <div className="text-sm text-gray-600">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Clinical Dashboard is the main screen */}
      {(currentView === 'worklist' || currentView === 'review') && <ClinicalDashboard />}

      {/* Analytics view */}
      {currentView === 'analytics' && (
        <div className="min-h-screen bg-gray-900 text-gray-100">
          <main className="container mx-auto p-4 max-w-[1400px]">
            <Analytics />
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
