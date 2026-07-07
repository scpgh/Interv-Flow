import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import { auth } from '../firebase';

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeJd, setActiveJd] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // New JD form state
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newJdText, setNewJdText] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Custom Mock Interview Config for the JD (set by Recruiter)
  const [customMode, setCustomMode] = useState('standard'); // 'standard' | 'prompt' | 'questions'
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [customQuestionsRaw, setCustomQuestionsRaw] = useState('');
  const [duration, setDuration] = useState(15);

  // Inspector States
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Helper: Fetch auth headers
  const getAuthHeaders = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      }
    } catch (e) {
      console.warn("Firebase token refresh failed:", e.message);
    }
    const cached = sessionStorage.getItem('idToken') || '';
    return { 'Authorization': `Bearer ${cached}`, 'Content-Type': 'application/json' };
  };

  const showFlash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  useEffect(() => {
    const role = sessionStorage.getItem('userRole') || sessionStorage.getItem('adminRole') || '';
    if (role !== 'RECRUITER' && role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    sessionStorage.setItem('activeViewMode', 'recruiter');
    fetchMyJobs();
  }, []);

  const fetchMyJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs`);
      const data = await res.json();
      if (data.success) {
        // Filter jobs posted by this recruiter
        const myEmail = (sessionStorage.getItem('userEmail') || '').toLowerCase().trim();
        const filtered = (data.jds || []).filter(j => j.recruiterEmail?.toLowerCase().trim() === myEmail);
        setJds(filtered);
      }
    } catch (err) {
      console.error(err);
      showFlash('error', 'Failed to fetch job postings.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicantsForJd = async (jd) => {
    setLoadingApplicants(true);
    setActiveJd(jd);
    try {
      const res = await fetch(`${API_URL}/api/jobs/${jd.id}/applicants`, {
        headers: await getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setApplicants(data.applicants || []);
      } else {
        showFlash('error', data.error || 'Failed to fetch applicants list.');
      }
    } catch (err) {
      console.error(err);
      showFlash('error', 'Network error fetching applicants.');
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleInspectCandidate = async (email) => {
    setLoadingCandidate(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs/candidate/${encodeURIComponent(email)}`, {
        headers: await getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCandidate(data.candidate);
      } else {
        showFlash('error', data.error || 'Failed to fetch candidate details.');
      }
    } catch (err) {
      console.error(err);
      showFlash('error', 'Network error fetching candidate details.');
    } finally {
      setLoadingCandidate(false);
    }
  };

  const handlePostJd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCompany.trim() || !newJdText.trim()) {
      showFlash('error', 'All fields are required.');
      return;
    }

    let parsedQuestions = [];
    if (customMode === 'questions' && customQuestionsRaw.trim()) {
      parsedQuestions = customQuestionsRaw
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0);
    }

    setFormSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          title: newTitle,
          company: newCompany,
          jdText: newJdText,
          customSystemPrompt: customMode === 'prompt' ? customSystemPrompt : '',
          customQuestions: parsedQuestions,
          duration: duration
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showFlash('success', 'Job description posted successfully.');
        if (window.addIntervflowNotification) {
          window.addIntervflowNotification(
            'Job Posting Published',
            `Your job description for ${newTitle} at ${newCompany} was successfully listed on the job board.`,
            'publish',
            'text-[#818cf8]'
          );
        }
        setNewTitle('');
        setNewCompany('');
        setNewJdText('');
        setCustomMode('standard');
        setCustomSystemPrompt('');
        setCustomQuestionsRaw('');
        setDuration(15);
        fetchMyJobs();
      } else {
        showFlash('error', data.error || 'Failed to post job.');
      }
    } catch (err) {
      console.error(err);
      showFlash('error', 'Network error posting job.');
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative pt-16 font-body-md">
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      <DashboardNavbar activeTab="recruiter_dashboard" />

      {msg.text && (
        <div className={`fixed top-24 right-6 px-4 py-3 rounded-lg flex items-center gap-2 text-sm z-50 animate-bounce border ${
          msg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          <span className="material-symbols-outlined text-lg">{msg.type === 'error' ? 'error' : 'check_circle'}</span>
          <span>{msg.text}</span>
        </div>
      )}

      <main className="flex-grow max-w-[1400px] w-full mx-auto px-6 py-8 z-10 relative flex flex-col lg:flex-row gap-6">
        {/* Left Side: Create Job & Posted Jobs */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Post JD Form */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/[0.01] text-left">
            <h2 className="text-md font-bold text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">post_add</span>
              Post Job Position
            </h2>

            <form onSubmit={handlePostJd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend Engineer (Scale)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Job Description (JD)</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Paste details, tech stack, and evaluation guidelines here..."
                  value={newJdText}
                  onChange={(e) => setNewJdText(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Recruiter Custom Interview Builder */}
              <div className="border-t border-white/10 pt-4 flex flex-col gap-4 text-left">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Candidate Mock Setup</h3>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 font-semibold">Customize the interview parameters candidates face when they apply.</p>
                </div>

                {/* Duration Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-on-surface-variant">Interview Duration</label>
                    <span className="font-mono font-bold text-white">{duration} Min</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Custom mode buttons */}
                <div className="flex gap-2 border-b border-white/10 pb-3 mt-1">
                  {[
                    { key: 'standard', label: 'Standard' },
                    { key: 'prompt', label: 'Guidelines' },
                    { key: 'questions', label: 'Questions' }
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCustomMode(opt.key)}
                      className={`flex-1 py-1.5 rounded-lg border text-[10px] font-semibold text-center transition-all cursor-pointer ${
                        customMode === opt.key
                          ? 'bg-[#1e1b4b] border-primary text-white font-bold shadow-md'
                          : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Mode A: Standard */}
                {customMode === 'standard' && (
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-on-surface-variant leading-relaxed">
                    💡 The AI interviewer dynamically analyzes the JD text to interview applicants.
                  </div>
                )}

                {/* Mode B: Guidelines */}
                {customMode === 'prompt' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Interviewer System instructions</label>
                    <textarea
                      rows={3}
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                      placeholder="e.g. Focus on database normalization and system indexing. Ask candidate to compare SQL vs NoSQL..."
                      className="w-full bg-[#131315]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary resize-none placeholder:text-white/20"
                    />
                  </div>
                )}

                {/* Mode C: Questions */}
                {customMode === 'questions' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <label className="font-bold text-on-surface-variant uppercase">Sequential Questions to Ask</label>
                      <span className="opacity-55 font-mono">one per line</span>
                    </div>
                    <textarea
                      rows={3}
                      value={customQuestionsRaw}
                      onChange={(e) => setCustomQuestionsRaw(e.target.value)}
                      placeholder="Question 1...&#10;Question 2...&#10;Question 3..."
                      className="w-full bg-[#131315]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary resize-none font-mono placeholder:text-white/20"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={formSaving}
                className="w-full py-3.5 bg-[#1E1B4B] hover:bg-[#1E1B4B]/80 text-[#818CF8] hover:text-[#b4c5ff] border border-[#818cf8]/30 transition-all duration-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold hover:scale-[1.02] active:scale-95 shadow-lg shadow-black/40"
              >
                {formSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#818cf8]/30 border-t-[#818cf8] rounded-full animate-spin" />
                ) : (
                  'Publish Job Posting'
                )}
              </button>
            </form>
          </div>

          {/* List of Posted Jobs */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/[0.01] text-left flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">My Listed Jobs</h2>
            
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : jds.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {jds.map((jd) => (
                  <button
                    key={jd.id}
                    onClick={() => fetchApplicantsForJd(jd)}
                    className={`w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${
                      activeJd?.id === jd.id
                        ? 'bg-[#1e1b4b] border-[#818cf8]/40 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{jd.title}</span>
                    <span className="text-[10px] opacity-75">{jd.company}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant italic font-mono py-4">No jobs posted yet.</p>
            )}
          </div>
        </div>

        {/* Right Side: Applicant list */}
        <div className="w-full lg:w-2/3">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/[0.01] text-left min-h-[500px] flex flex-col gap-6">
            {activeJd ? (
              <>
                <div>
                  <span className="text-[10px] font-bold text-[#ddb7ff] uppercase font-mono bg-[#ddb7ff]/10 border border-[#ddb7ff]/20 px-2.5 py-0.5 rounded-full">
                    Applicants Telemetry
                  </span>
                  <h1 className="text-lg font-bold text-white mt-3">Candidates for {activeJd.title} ({activeJd.company})</h1>
                  <p className="text-xs text-on-surface-variant mt-1">Review ATS scores, mock interview grades, and inspect full transcripts.</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01] flex-grow">
                  {loadingApplicants ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-on-surface-variant font-mono">Syncing applicant scores...</p>
                    </div>
                  ) : applicants.length > 0 ? (
                    <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                          <th className="py-3 px-4">Applicant</th>
                          <th className="py-3 px-4">Resume ATS Score</th>
                          <th className="py-3 px-4">Mock Score</th>
                          <th className="py-3 px-4">Interview Date</th>
                          <th className="py-3 px-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applicants.map((app, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 text-left">
                              <button
                                type="button"
                                onClick={() => handleInspectCandidate(app.candidateEmail)}
                                className="font-semibold text-white hover:text-primary transition-all text-left bg-transparent border-none cursor-pointer p-0 block hover:underline"
                              >
                                {app.candidateName}
                              </button>
                              <div className="text-[10px] text-on-surface-variant font-mono">{app.candidateEmail}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#818cf8]">
                              {app.resumeAtsScore !== null ? `🎯 ${app.resumeAtsScore}%` : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                              {app.mockScore !== null ? `🤖 ${app.mockScore}%` : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-on-surface-variant font-mono">
                              {new Date(app.completedAt || Date.now()).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {app.sessionId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/practice/feedback/${app.sessionId}`)}
                                  className="bg-[#1e1b4b]/50 hover:bg-[#1e1b4b] text-[#818CF8] hover:text-[#b4c5ff] border border-[#818cf8]/30 hover:border-[#818cf8]/50 font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                                >
                                  Inspect Transcript
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2">group_off</span>
                      <p className="text-xs text-on-surface-variant font-semibold">No candidates have completed mock sessions for this JD yet.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow py-36 text-center gap-4">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl">arrow_back</span>
                <h3 className="text-sm font-bold text-white">Select a Position</h3>
                <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
                  Select one of your posted job positions on the left side to inspect candidate performance logs.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* CANDIDATE DETAILS MODAL */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative text-left flex flex-col gap-5 bg-[#09090b] border border-[#818cf8]/20 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedCandidate(null)}
              className="absolute top-4 right-4 bg-transparent border-none text-on-surface-variant hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div>
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">Candidate Inspection</span>
              <h3 className="text-md font-bold text-white mt-1">{selectedCandidate.name}</h3>
              <p className="text-xs text-on-surface-variant">{selectedCandidate.email}</p>
            </div>

            <div className="border-t border-white/10 pt-4 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-on-surface-variant font-semibold block text-[10px] uppercase font-mono">Domain</span>
                  <span className="text-white font-medium">{selectedCandidate.domain?.toUpperCase() || 'SWE'}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant font-semibold block text-[10px] uppercase font-mono">Experience</span>
                  <span className="text-white font-medium">{selectedCandidate.experienceYears}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant font-semibold block text-[10px] uppercase font-mono">Education</span>
                  <span className="text-white font-medium">{selectedCandidate.highestEducation}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant font-semibold block text-[10px] uppercase font-mono">Target Company</span>
                  <span className="text-white font-medium">{selectedCandidate.dreamCompany}</span>
                </div>
              </div>

              {/* Portfolio Links */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-on-surface-variant font-semibold block text-[10px] uppercase font-mono">Professional Profiles</span>
                <div className="flex gap-4">
                  {selectedCandidate.linkedinUrl ? (
                    <a
                      href={selectedCandidate.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">link</span> LinkedIn
                    </a>
                  ) : (
                    <span className="text-on-surface-variant/50">LinkedIn: Not Provided</span>
                  )}

                  {selectedCandidate.githubUrl ? (
                    <a
                      href={selectedCandidate.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">code</span> GitHub
                    </a>
                  ) : (
                    <span className="text-on-surface-variant/50">GitHub: Not Provided</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="w-full py-3 bg-[#1e1b4b] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/30 rounded-xl font-bold text-xs text-white cursor-pointer transition-all flex items-center justify-center"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loadingCandidate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
