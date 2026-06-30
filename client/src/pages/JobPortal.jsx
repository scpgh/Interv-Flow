import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';

export default function JobPortal() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs`);
      const data = await res.json();
      if (data.success) {
        setJds(data.jds || []);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = (jd) => {
    navigate('/practice', {
      state: {
        jobTitle: jd.title,
        jdText: jd.jdText,
        company: jd.company,
        jdId: jd.id,
        customSystemPrompt: jd.customSystemPrompt || '',
        customQuestions: jd.customQuestions || [],
        duration: jd.duration || 15,
        mode: 'jd'
      }
    });
  };

  const filteredJds = jds.filter(jd => 
    (jd.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (jd.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (jd.jdText || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col pt-16 relative overflow-x-hidden font-body-md">
      <div className="bg-glow"></div>
      <DashboardNavbar activeTab="jobs" />
      
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-12 py-10 z-10 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-white/5 pb-6 text-left">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Apply Jobs &amp; Stand Out
            </h1>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed font-body-md">
              Browse positions posted by recruiters, search specific roles, and attempt customized mock interviews.
            </p>
          </div>

          {/* Search input field */}
          <div className="relative w-full max-w-xs shrink-0">
            <input
              type="text"
              placeholder="Search jobs, domains, or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#09090b] border border-white/10 rounded-full py-2.5 pl-4 pr-10 text-xs text-white placeholder-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 font-body-md"
            />
            <span className="material-symbols-outlined absolute right-3.5 top-2.5 text-on-surface-variant text-[16px] pointer-events-none select-none">
              search
            </span>
          </div>
        </div>

        {/* Available JDs */}
        <div className="flex flex-col gap-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant font-mono">Syncing active job boards...</p>
            </div>
          ) : filteredJds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              {filteredJds.map((jd) => (
                <div
                  key={jd.id}
                  className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between gap-6 transition-all duration-300 relative group text-left"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-md font-bold text-white group-hover:text-white transition-colors">{jd.title}</h3>
                        <p className="text-xs text-on-surface-variant font-semibold mt-0.5">{jd.company}</p>
                      </div>
                      <span className="material-symbols-outlined text-[#818cf8]/40 bg-[#818cf8]/5 p-2 rounded-xl border border-[#818cf8]/10 text-lg">
                        work
                      </span>
                    </div>
                    
                    <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4 whitespace-pre-line mt-2">
                      {jd.jdText}
                    </p>
                  </div>

                  <button
                    onClick={() => handleStartInterview(jd)}
                    className="w-full py-3 bg-[#1e1b4b] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/30 rounded-xl font-bold text-xs text-white hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/40"
                  >
                    <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                    Apply &amp; Start Mock Interview
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center flex flex-col items-center gap-4 animate-fade-in">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-5xl">search_off</span>
              <h2 className="text-md font-bold text-white">No Matching Jobs Found</h2>
              <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed font-body-md mt-1">
                We couldn't find any job descriptions matching your search query "{searchQuery}". Try refining your keywords.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
