import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface RecrawlSource {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  lastCrawl: string | null;
}

interface RecrawlManagerProps {
  onClose: () => void;
}

export const RecrawlManager: React.FC<RecrawlManagerProps> = ({ onClose }) => {
  const [sources, setSources] = useState<Record<string, RecrawlSource>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newSource, setNewSource] = useState({ url: '', name: '', description: '' });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const response = await axios.get('/knowledge/recrawl-sources');
      setSources(response.data.sources);
    } catch (error) {
      console.error('Failed to load sources:', error);
      setMessage('Failed to load sources');
    }
  };

  const toggleSource = async (url: string, enabled: boolean) => {
    try {
      const updatedSources = { ...sources };
      updatedSources[url].enabled = enabled;
      
      await axios.post('/knowledge/recrawl-sources', {
        sources: Object.values(updatedSources)
      });
      
      setSources(updatedSources);
      setMessage(`Updated ${sources[url].name}`);
    } catch (error) {
      console.error('Failed to update source:', error);
      setMessage('Failed to update source');
    }
  };

  const recrawlAll = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post('/knowledge/recrawl-all');
      setMessage(`Recrawled ${response.data.results.length} sources`);
      await loadSources(); // Refresh sources
    } catch (error) {
      console.error('Failed to recrawl:', error);
      setMessage('Failed to recrawl sources');
    } finally {
      setLoading(false);
    }
  };

  const addNewSource = async () => {
    if (!newSource.url || !newSource.name) {
      setMessage('Please provide URL and name');
      return;
    }

    try {
      await axios.post('/knowledge/add-source', newSource);
      setNewSource({ url: '', name: '', description: '' });
      await loadSources(); // Refresh sources
      setMessage('Source added successfully');
    } catch (error) {
      console.error('Failed to add source:', error);
      setMessage('Failed to add source');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black/90 border border-orange-500/30 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-orange-100">Recrawl Sources</h2>
          <button
            onClick={onClose}
            className="text-orange-300 hover:text-orange-100"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded text-orange-100">
            {message}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-orange-100">Available Sources</h3>
          {Object.entries(sources).map(([url, source]) => (
            <div key={url} className="flex items-center space-x-3 p-3 bg-black/30 border border-orange-500/20 rounded">
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={(e) => toggleSource(url, e.target.checked)}
                className="w-4 h-4 text-orange-500 bg-black border-orange-500 rounded focus:ring-orange-500"
              />
              <div className="flex-1">
                <div className="font-medium text-orange-100">{source.name}</div>
                <div className="text-sm text-orange-300">{source.description}</div>
                <div className="text-xs text-orange-400">{source.url}</div>
                {source.lastCrawl && (
                  <div className="text-xs text-orange-400">
                    Last crawled: {new Date(source.lastCrawl).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-orange-100">Add New Source</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="URL"
              value={newSource.url}
              onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              className="w-full px-3 py-2 bg-black/30 border border-orange-500/30 rounded text-orange-100 placeholder-orange-300/60"
            />
            <input
              type="text"
              placeholder="Name"
              value={newSource.name}
              onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              className="w-full px-3 py-2 bg-black/30 border border-orange-500/30 rounded text-orange-100 placeholder-orange-300/60"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newSource.description}
              onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
              className="w-full px-3 py-2 bg-black/30 border border-orange-500/30 rounded text-orange-100 placeholder-orange-300/60"
            />
            <button
              onClick={addNewSource}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium"
            >
              Add Source
            </button>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={recrawlAll}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded font-medium disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? 'Recrawling...' : 'Recrawl All Enabled Sources'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 