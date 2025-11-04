import { useEffect } from 'react';
import { useStore } from './store';
import { generateMockEpisodes } from './utils/mockData';
import Navigation from './components/Navigation';
import TriageWorklist from './components/TriageWorklist';
import EventReview from './components/EventReview';
import Analytics from './components/Analytics';

function App() {
  const currentView = useStore((state) => state.currentView);
  const setEpisodes = useStore((state) => state.setEpisodes);

  // Load mock data on mount
  useEffect(() => {
    const mockEpisodes = generateMockEpisodes(25);
    setEpisodes(mockEpisodes);
  }, [setEpisodes]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Navigation />
      <main className="container mx-auto p-4 max-w-[1400px]">
        {currentView === 'worklist' && <TriageWorklist />}
        {currentView === 'review' && <EventReview />}
        {currentView === 'analytics' && <Analytics />}
      </main>
    </div>
  );
}

export default App;
