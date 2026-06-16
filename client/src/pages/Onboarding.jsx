import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Onboarding() {
  const navigate = useNavigate();

  // Load existing signup data if any
  const [name, setName] = useState(sessionStorage.getItem('userName') || "");
  const [domain, setDomain] = useState(sessionStorage.getItem('userDomain') || "fullstack");
  const [experience, setExperience] = useState("0 Yrs");
  const [education, setEducation] = useState("B.S. Computer Science");
  const [targetCompany, setTargetCompany] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter your name");
      return;
    }
    setErrorMsg("");

    try {
      const email = sessionStorage.getItem('userEmail');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          experienceYears: experience,
          highestEducation: education,
          dreamCompany: targetCompany,
          linkedinUrl: linkedin,
          githubUrl: github
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile.");
      }

      // Save profile data in sessionStorage
      sessionStorage.setItem('userName', name);
      sessionStorage.setItem('userDomain', domain);
      sessionStorage.setItem('userExperience', experience);
      sessionStorage.setItem('userEducation', education);
      sessionStorage.setItem('userTargetCompany', targetCompany || "Google");
      sessionStorage.setItem('userLinkedIn', linkedin || "https://linkedin.com/in/alexrivera");
      sessionStorage.setItem('userGitHub', github || "https://github.com/alexrivera");
      sessionStorage.setItem('onboardingCompleted', 'true');

      // Proceed to Resume Analyzer
      navigate('/resume-analyzer');
    } catch (err) {
      setErrorMsg(err.message || "Failed to update profile details.");
      console.error("Onboarding error:", err);
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-24 font-body-md text-left">
      {/* Atmosphere Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"
        style={{
          background: 'radial-gradient(circle at 15% 15%, rgba(37,99,235,0.04) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(221,183,255,0.04) 0%, transparent 40%)'
        }}
      />

      <main className="flex-grow flex items-center justify-center p-margin-mobile md:p-margin-desktop relative z-10 my-8">
        <div className="glass-panel w-full max-w-2xl rounded-2xl p-8 md:p-10 relative z-10 flex flex-col gap-6 bg-[#18181b]/35 border border-white/10">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
              <span className="material-symbols-outlined text-[16px] text-primary">person_add</span>
              <span className="text-[10px] text-primary uppercase tracking-widest font-mono font-bold">Candidate Onboarding</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-white font-bold tracking-tight">Complete Your Profile</h2>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
              Help us calibrate our AI evaluation metrics and tailor the resume audits to your exact background.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs font-mono flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Name */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="name">Full Name</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">person</span>
                  <input
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/40"
                    id="name"
                    type="text"
                    required
                    placeholder="Alex Rivera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {/* Target Domain */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="domain">Target Job Role</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">category</span>
                  <select
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-10 py-3 rounded-lg focus:outline-none focus:ring-0 border-none appearance-none cursor-pointer"
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  >
                    <optgroup className="bg-[#131315] text-primary font-bold text-left" label="Technology & Engineering">
                      <option className="bg-[#131315] text-on-surface" value="backend">Backend Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="frontend">Frontend Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="fullstack">Fullstack Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="mobile">Mobile Developer (iOS/Android)</option>
                      <option className="bg-[#131315] text-on-surface" value="devops">DevOps & Infrastructure</option>
                      <option className="bg-[#131315] text-on-surface" value="ml">Machine Learning / AI Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="dataeng">Data Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="security">Security / AppSec Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="sdet">QA / SDET Engineer</option>
                      <option className="bg-[#131315] text-on-surface" value="swe">Software Engineer (General)</option>
                      <option className="bg-[#131315] text-on-surface" value="pm">Product Manager</option>
                      <option className="bg-[#131315] text-on-surface" value="em">Engineering Manager</option>
                      <option className="bg-[#131315] text-on-surface" value="ds">Data Scientist</option>
                      <option className="bg-[#131315] text-on-surface" value="design">UX/UI Designer</option>
                      <option className="bg-[#131315] text-on-surface" value="cloud">Cloud Architect</option>
                      <option className="bg-[#131315] text-on-surface" value="solutions">Solutions Architect</option>
                    </optgroup>
                    <optgroup className="bg-[#131315] text-primary font-bold text-left" label="Business & Finance">
                      <option className="bg-[#131315] text-on-surface" value="consulting">Management Consultant</option>
                      <option className="bg-[#131315] text-on-surface" value="finance">Investment Analyst</option>
                      <option className="bg-[#131315] text-on-surface" value="bizdev">Business Developer</option>
                      <option className="bg-[#131315] text-on-surface" value="financial">Financial Analyst</option>
                      <option className="bg-[#131315] text-on-surface" value="strategy">Strategy & Operations</option>
                      <option className="bg-[#131315] text-on-surface" value="vc">Venture Capital Analyst</option>
                    </optgroup>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 pointer-events-none text-[20px] text-on-surface-variant">expand_more</span>
                </div>
              </div>

              {/* Experience Level */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="experience">Years of Experience</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">work_history</span>
                  <select
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-10 py-3 rounded-lg focus:outline-none focus:ring-0 border-none appearance-none cursor-pointer"
                    id="experience"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  >
                    <option className="bg-[#131315] text-on-surface" value="0 Yrs">Fresher / Student (0 Yrs)</option>
                    <option className="bg-[#131315] text-on-surface" value="0.5 Yrs">Junior (0 - 1 Yrs)</option>
                    <option className="bg-[#131315] text-on-surface" value="2.5 Yrs">Mid-Level (1 - 3 Yrs)</option>
                    <option className="bg-[#131315] text-on-surface" value="5.5 Yrs">Senior (3 - 6 Yrs)</option>
                    <option className="bg-[#131315] text-on-surface" value="8.5 Yrs">Lead / Architect (6 - 10 Yrs)</option>
                    <option className="bg-[#131315] text-on-surface" value="12+ Yrs">Principal / EM (10+ Yrs)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 pointer-events-none text-[20px] text-on-surface-variant">expand_more</span>
                </div>
              </div>

              {/* Education */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="education">Highest Education</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">school</span>
                  <input
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/40"
                    id="education"
                    type="text"
                    required
                    placeholder="B.S. Computer Science"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                  />
                </div>
              </div>

              {/* Target Company */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="company">Target Dream Company</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">business_center</span>
                  <input
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/40"
                    id="company"
                    type="text"
                    placeholder="Google, Stripe, McKinsey..."
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                  />
                </div>
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="linkedin">LinkedIn Profile (Optional)</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">link</span>
                  <input
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/40"
                    id="linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
              </div>

              {/* GitHub / Portfolio URL */}
              <div className="space-y-1.5 text-left md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="github">GitHub / Portfolio Website (Optional)</label>
                <div className="relative input-glow rounded-lg border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl">code</span>
                  <input
                    className="w-full bg-transparent text-on-surface font-body-md text-xs pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/40"
                    id="github"
                    type="url"
                    placeholder="https://github.com/username"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                  />
                </div>
              </div>

            </div>

            <button
              type="submit"
              className="w-full btn-primary py-4 text-xs font-bold rounded-xl text-white flex items-center justify-center gap-2 border-none mt-4 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              Save Profile & Proceed
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
