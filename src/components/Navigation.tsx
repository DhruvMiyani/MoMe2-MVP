import { useStore } from '../store';
import { Activity, List, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

export default function Navigation() {
  const { currentView, setCurrentView } = useStore();

  const navItems = [
    { id: 'qa' as const, label: 'QA System', icon: Activity },
    { id: 'worklist' as const, label: 'Triage Worklist', icon: List },
    { id: 'review' as const, label: 'Event Review', icon: Activity },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Activity className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold">MoMe 2.0 - Bradycardia HITL</h1>
          </div>

          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">Dr. J. Smith</span>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
              JS
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
