import React, { useState, useEffect } from 'react';
import { getAllKnowledge, addLink, crawlLink, removeLink } from '../services/knowledgeService';
import type { KnowledgeLink } from '../services/knowledgeService';
import { Link } from 'react-router-dom';

const KnowledgeAdmin: React.FC = () => {
  const [links, setLinks] = useState<KnowledgeLink[]>([]);
  const [input, setInput] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    loadLinks();
    
    // Check if we're in development mode
    const checkDevMode = async () => {
      try {
        const response = await fetch('/api/environment');
        const data = await response.json();
        setIsDevMode(data.environment === 'development');
      } catch (error) {
        // Default to showing admin controls if we can't determine environment
        setIsDevMode(true);
      }
    };
    checkDevMode();
  }, []);

  async function loadLinks() {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllKnowledge();
      setLinks(all);
    } catch (e: any) {
      setError('Failed to load knowledge: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const handleAddLinks = async () => {
    setError(null);
    const newUrls = input
      .split(/\s+/)
      .map((url) => url.trim())
      .filter((url) => url && !links.some((l) => l.url === url))
      .map((url) => {
        if (!/^https?:\/\//i.test(url)) {
          return 'https://' + url;
        }
        return url;
      });
    try {
      for (const url of newUrls) {
        await addLink(url);
      }
      setInput('');
      await loadLinks();
    } catch (e: any) {
      setError('Failed to add link: ' + (e.message || e));
    }
  };

  const handleCrawl = async (url: string) => {
    setIsCrawling(true);
    setError(null);
    try {
      await crawlLink(url);
      await loadLinks();
    } catch (e: any) {
      setError('Crawl failed: ' + (e.message || e));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleCrawlAll = async () => {
    console.log('handleCrawlAll called');
    setIsCrawling(true);
    setError(null);
    try {
      const toCrawl = links.filter(l => l.status === 'pending' || l.status === 'error');
      console.log('Links to crawl:', toCrawl.length, toCrawl.map(l => ({url: l.url, status: l.status})));
      for (const link of toCrawl) {
        console.log('Crawling:', link.url);
        await crawlLink(link.url);
      }
      await loadLinks();
    } catch (e: any) {
      console.error('Crawl all error:', e);
      setError('Crawl all failed: ' + (e.message || e));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleRecrawlAll = async () => {
    console.log('handleRecrawlAll called');
    setIsCrawling(true);
    setError(null);
    try {
      const response = await fetch('/knowledge/recrawl-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Recrawl all result:', result);
      await loadLinks();
    } catch (e: any) {
      console.error('Recrawl all error:', e);
      setError('Recrawl all failed: ' + (e.message || e));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleRemove = async (url: string) => {
    setError(null);
    try {
      await removeLink(url);
      await loadLinks(); // Refresh the list
    } catch (e: any) {
      setError('Failed to remove link: ' + (e.message || e));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 overflow-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-6xl w-full shadow-lg mx-auto" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        <h2 className="text-3xl font-bold text-white mb-6 text-center">
          Knowledge Base {!isDevMode && '(Read Only)'}
        </h2>
        {error && <div className="mb-4 text-red-400">{error}</div>}
        
        {/* Admin controls - only show in dev mode */}
        {isDevMode && (
          <div className="mb-4 flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white font-semibold hover:from-orange-600 hover:to-purple-600 transition-all disabled:opacity-50"
              onClick={handleCrawlAll}
              disabled={isCrawling || links.filter(l => l.status === 'pending' || l.status === 'error').length === 0}
            >
              {isCrawling ? 'Crawling...' : 'Crawl New & Failed'}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white font-semibold hover:from-orange-600 hover:to-purple-600 transition-all disabled:opacity-50"
              onClick={handleRecrawlAll}
              disabled={isCrawling || links.length === 0}
            >
              {isCrawling ? 'Crawling...' : 'Recrawl All'}
            </button>
          </div>
        )}
        {/* Add Links section - always show */}
        <div className="mb-6">
          <textarea
            className="w-full min-h-[60px] max-h-40 px-4 py-3 rounded-lg bg-black/30 text-orange-100 placeholder-orange-300/60 border border-orange-500/30 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 resize-vertical text-base mb-2"
            placeholder="Paste links here, one per line or space-separated... (Press Enter to add)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                e.preventDefault();
                handleAddLinks();
              }
            }}
          />
          <button
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-500 text-white font-semibold hover:from-orange-600 hover:to-purple-600 transition-all"
            onClick={handleAddLinks}
            disabled={!input.trim()}
          >
            Add Links
          </button>
        </div>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white mb-2">Links</h3>
          {loading ? <div className="text-orange-200">Loading...</div> : null}
          <div className="space-y-3">
            {links.length === 0 && !loading && <div className="text-orange-200">No links added yet.</div>}
            {links.map((link) => {
              // Tag filtering
              const badTagPatterns = [
                /window/i, /script/i, /data/i, /contain-/i, /intrinsic-size/i, /webpack/i, /object/i, /style/i, /html/i, /head/i, /body/i, /meta/i, /div/i, /span/i, /class/i, /id/i, /src/i, /href/i, /content/i, /rel/i, /type/i, /async/i, /defer/i, /crossorigin/i, /integrity/i, /referrerpolicy/i, /preconnect/i, /dns-prefetch/i, /manifest/i, /apple/i, /msapplication/i, /theme/i, /color/i, /viewport/i, /description/i, /keywords/i, /author/i, /generator/i, /title/i, /lang/i, /charset/i, /base/i, /link/i, /canonical/i, /alternate/i, /icon/i, /image/i, /svg/i, /png/i, /jpg/i, /jpeg/i, /gif/i, /webp/i, /avif/i, /mp4/i, /webm/i, /ogg/i, /mp3/i, /wav/i, /flac/i, /aac/i, /m4a/i, /opus/i, /track/i, /audio/i, /video/i, /source/i, /media/i, /poster/i, /controls/i, /autoplay/i, /loop/i, /muted/i, /playsinline/i, /preload/i, /width/i, /height/i, /min/i, /max/i, /step/i, /value/i, /name/i, /for/i, /form/i, /action/i, /method/i, /enctype/i, /accept/i, /required/i, /readonly/i, /disabled/i, /checked/i, /selected/i, /multiple/i, /size/i, /pattern/i, /placeholder/i, /autocomplete/i, /autofocus/i, /spellcheck/i, /tabindex/i, /accesskey/i, /draggable/i, /contenteditable/i, /hidden/i, /aria-/i, /role/i, /itemprop/i, /itemscope/i, /itemtype/i, /itemid/i, /itemref/i, /data-/i, /ng-/i, /v-/i, /svelte-/i, /react-/i, /vue-/i, /angular/i, /ember/i, /polymer/i, /lit-/i, /stencil/i, /preact/i, /inferno/i, /riot/i, /marko/i, /mithril/i, /hyperapp/i, /sapper/i, /astro/i, /qwik/i, /solid/i, /alpine/i, /stimulus/i, /htmx/i, /unocss/i, /tailwind/i, /bootstrap/i, /bulma/i, /foundation/i, /material/i, /semantic/i, /uikit/i, /pure/i, /skeleton/i, /milligram/i, /spectre/i, /tachyons/i, /windi/i, /windicss/i, /postcss/i, /sass/i, /scss/i, /less/i, /stylus/i, /css/i, /stylesheet/i, /font/i, /google/i, /adobe/i, /typekit/i, /monospace/i, /serif/i, /sans-serif/i, /cursive/i, /fantasy/i, /system-ui/i, /ui-/i, /apple-/i, /blink-/i, /helvetica/i, /arial/i, /verdana/i, /tahoma/i, /trebuchet/i, /georgia/i, /palatino/i, /garamond/i, /bookman/i, /comic/i, /impact/i, /lucida/i, /times/i, /courier/i, /consolas/i, /menlo/i, /monaco/i, /andale/i, /arial/i, /calibri/i, /cambria/i, /candara/i, /corbel/i, /franklin/i, /gill/i, /lucida/i, /optima/i, /segoe/i, /rockwell/i, /century/i, /baskerville/i, /didot/i, /futura/i, /goudy/i, /hoefler/i, /josefin/i, /lato/i, /montserrat/i, /muli/i, /nunito/i, /open/i, /oswald/i, /playfair/i, /poppins/i, /quicksand/i, /raleway/i, /roboto/i, /rubik/i, /slabo/i, /source/i, /titillium/i, /ubuntu/i, /vollkorn/i, /work/i, /yeseva/i
              ];
              // Handle tags that might be a string or array
              const tagsArray = typeof link.tags === 'string' ? 
                (link.tags.startsWith('[') ? JSON.parse(link.tags) : link.tags.split(',')) : 
                (link.tags || []);
              
              const filteredTags = tagsArray.filter(tag =>
                /^[a-zA-Z0-9_-]{3,24}$/.test(tag) &&
                !badTagPatterns.some(pattern => pattern.test(tag))
              );
              return (
                <div key={link.url} className="bg-black/20 rounded-lg p-4 border border-orange-500/20 mb-3 relative">
                  {/* Action buttons - top right (only in dev mode) */}
                  {isDevMode && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        className="p-1 text-white/60 hover:text-white/80 transition-all disabled:opacity-50 text-sm bg-transparent border-none"
                        onClick={() => handleCrawl(link.url)}
                        disabled={isCrawling}
                        title={isCrawling ? 'Crawling...' : link.status === 'crawled' ? 'Recrawl' : 'Crawl'}
                      >
                        ↻
                      </button>
                      <button
                        className="p-1 text-white/60 hover:text-white/80 transition-all text-sm bg-transparent border-none"
                        onClick={() => handleRemove(link.url)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className={isDevMode ? "pr-16" : ""}> {/* Add right padding only when buttons are shown */}
                    <div className="text-orange-200 font-mono break-all text-sm mb-2">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-orange-300 hover:text-orange-100 underline transition-colors"
                      >
                        {link.url}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${link.status === 'crawled' ? 'bg-green-700/40 text-green-300' : link.status === 'pending' ? 'bg-yellow-700/40 text-yellow-300' : 'bg-red-700/40 text-red-300'}`}>{link.status}</span>
                      {filteredTags.map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded-full bg-purple-700/40 text-purple-200 text-xs max-w-[10rem] truncate" title={tag}>{tag}</span>
                      ))}
                    </div>
                    {link.content && <div className="text-white/70 text-sm leading-relaxed">{link.content.slice(0, 300)}</div>}
                    {link.errorMsg && <div className="text-red-400 text-sm mt-1">{link.errorMsg}</div>}
                  </div>
                </div>
              ); // <-- close the return for the map
          })}
          </div>
        </div>
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-white mb-4">Knowledge Preview</h3>
          <div className="bg-black/30 rounded-lg p-6 text-white/80 min-h-[100px]">
            {links.filter((l) => l.status === 'crawled').length === 0 && <span className="text-orange-200">No knowledge crawled yet.</span>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {links.filter((l) => l.status === 'crawled').map((l) => (
                <div key={l.url} className="bg-black/20 rounded-lg p-4 border border-orange-500/20">
                  <div className="font-mono text-orange-300 text-sm mb-2 break-all">
                    <a 
                      href={l.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-orange-300 hover:text-orange-100 underline transition-colors"
                    >
                      {l.url}
                    </a>
                  </div>
                  <div className="text-sm leading-relaxed">{l.content?.slice(0, 250)}...</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeAdmin; 