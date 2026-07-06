import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

export default function LandingPage() {
  const navigate = useNavigate();

  // Navbar sliding indicator handled inside reusable Navbar component

  // --- Typing Phrase Simulator ---
  const phrases = [
    "Simulate realtime AI-based Mock interview.",
    "Scan & Score ATS Resumes Instantly.",
    "Get analysis and feedback report instantly",
    "Get a community with exciting challenges "
  ];
  const [typedText, setTypedText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      if (typedText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setTypedText(currentPhrase.substring(0, typedText.length + 1));
        }, 55);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (typedText.length > 0) {
        timer = setTimeout(() => {
          setTypedText(currentPhrase.substring(0, typedText.length - 1));
        }, 25);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, phraseIndex]);

  useEffect(() => {
    if (window.location.hash === '#pricing') {
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, []);


  // --- Testimonials Slider Data ---
  const testimonials = [
    {
      quote: `"I gave an SDE mock on IntervFlow and the AI interviewer felt incredibly realistic. The filler-word feedback — catching 'so' and 'basically' — was something I never even noticed about myself. Within a month, I landed an SDE-2 offer at Flipkart. Highly recommend!"`,
      name: "Rohan Mehta",
      role: "SDE-2 at Flipkart, Bengaluru",
      avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%232563eb'/%3E%3Cstop offset='100%25' style='stop-color:%231d4ed8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='0' fill='url(%23bg)'/%3E%3Ctext x='50' y='56' font-family='Inter,system-ui,sans-serif' font-size='38' font-weight='600' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'%3ERM%3C/text%3E%3C/svg%3E"
    },
    {
      quote: `"My ATS score jumped from 54% to 91% in a single scan. IntervFlow pinpointed the exact keywords missing from Amazon's JD. The job matching system was incredibly valuable too — the match was laser-focused. I got the offer in just 3 weeks!"`,
      name: "Priya Nair",
      role: "Product Manager at Amazon, Hyderabad",
      avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%237c3aed'/%3E%3Cstop offset='100%25' style='stop-color:%236d28d9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='0' fill='url(%23bg)'/%3E%3Ctext x='50' y='56' font-family='Inter,system-ui,sans-serif' font-size='38' font-weight='600' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'%3EPN%3C/text%3E%3C/svg%3E"
    },
    {
      quote: `"The case study practice for finance interviews was extremely helpful. The AI spotted gaps in my 3-statement model that I instantly addressed to boost my score. I secured an Analyst role at Deloitte. IntervFlow genuinely changed the game for me!"`,
      name: "Arjun Sharma",
      role: "Financial Analyst at Deloitte, Mumbai",
      avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23059669'/%3E%3Cstop offset='100%25' style='stop-color:%23047857'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='0' fill='url(%23bg)'/%3E%3Ctext x='50' y='56' font-family='Inter,system-ui,sans-serif' font-size='38' font-weight='600' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'%3EAS%3C/text%3E%3C/svg%3E"
    },
    {
      quote: `"The AI consulting mock interviews felt as intense as the real McKinsey case round. The community challenges and leaderboard kept me motivated every single day. I cracked my BCG offer after just 6 weeks of preparation on IntervFlow!"`,
      name: "Sneha Reddy",
      role: "Consultant at BCG, Bengaluru",
      avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23d97706'/%3E%3Cstop offset='100%25' style='stop-color:%23b45309'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='0' fill='url(%23bg)'/%3E%3Ctext x='50' y='56' font-family='Inter,system-ui,sans-serif' font-size='38' font-weight='600' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'%3ESR%3C/text%3E%3C/svg%3E"
    }
  ];
  const [currentTIndex, setCurrentTIndex] = useState(0);

  const prevTestimonial = () => {
    setCurrentTIndex(prev => (prev - 1 + testimonials.length) % testimonials.length);
  };
  const nextTestimonial = () => {
    setCurrentTIndex(prev => (prev + 1) % testimonials.length);
  };


  // --- Interactive AI Prep Sandbox Playground ---
  const playgroundData = {
    swe: {
      status: "SIMULATOR ACTIVE: SOFTWARE ENGINEERING",
      text: `To handle 10,000 write requests per second for our URL shortener, I recommend using a distributed ID generation system like Snowflake or a pre-allocated range provider like ZooKeeper to avoid collisions. For the storage layer, we can shard our database by the partition key derived from the short URL hash. We will implement a Redis caching layer using an LRU eviction policy to store the hot URL mappings, ensuring redirection latency remains under 10ms...`,
      domain: "94/100",
      pacing: "122 WPM",
      star: "Exemplary",
      fillers: "Low (1)",
      bracket: "SDE System Design: PASSED",
      improvement: "Excellent response covering both write scalability and caching strategies. To perfect this, you could mention database partitioning (sharding by the short URL key) to ensure the storage tier scales seamlessly."
    },
    pm: {
      status: "SIMULATOR ACTIVE: PRODUCT MANAGEMENT",
      text: `To measure the success of Spotify's collaborative playlists, I segment metrics into adoption, engagement, and retention. For adoption, we track weekly active playlist creators. For engagement, we measure average tracks added and daily stream time. For retention, we track month-over-month playlist activity and user retention. A potential trade-off is solo streaming dilution, which we will monitor closely...`,
      domain: "90/100",
      pacing: "128 WPM",
      star: "Strong",
      fillers: "Low (2)",
      bracket: "Product Execution: PASSED",
      improvement: "Strong structured framework with clear metrics. Make sure to define a clear primary metric (e.g., weekly active playlist collaborators) and outline any potential negative trade-offs, such as dilution of solo streaming time."
    },
    fin: {
      status: "SIMULATOR ACTIVE: FINANCE & STRATEGY",
      text: `On the Income Statement, a $100 increase in depreciation reduces operating income by $100. At a 40% tax rate, net income drops by $60. On the Cash Flow Statement, net income decreases by $60, but adding back the $100 non-cash depreciation increases cash from operations by $40. On the Balance Sheet, cash increases by $40, PP&E decreases by $100 (net assets down $60), balancing the $60 decrease in retained earnings...`,
      domain: "96/100",
      pacing: "115 WPM",
      star: "Exemplary",
      fillers: "None (0)",
      bracket: "Financial Modeling: PASSED",
      improvement: "Flawless walkthrough of the three statements! Your technical reconciliation is highly accurate. To stand out, explicitly mention how the cash increase is reinvested back into capital expenditures."
    },
    con: {
      status: "SIMULATOR ACTIVE: BUSINESS CONSULTING",
      text: `I structure this airline profitability problem using the framework: Profit = Revenue - Cost. For revenue, I segment ticket sales (price vs passenger volume) and ancillary fees to check for competitive pricing pressure. For costs, I divide them into fixed (aircraft leasing, labor) and variable (fuel, airport fees). This allows us to isolate the margin compression source and test our hypothesis...`,
      domain: "89/100",
      pacing: "124 WPM",
      star: "Strong",
      fillers: "Low (3)",
      bracket: "Case Interview: PASSED",
      improvement: "Excellent MECE structuring. Your segmentation of revenue and variable/fixed costs is logical. To elevate your answer, outline a hypothesis at the end of your structure to guide the next phase of data gathering."
    }
  };

  const [activePlaygroundTab, setActivePlaygroundTab] = useState("swe");
  const [playgroundInputText, setPlaygroundInputText] = useState(playgroundData.swe.text);

  const switchPlaygroundTab = (tabKey) => {
    setActivePlaygroundTab(tabKey);
    setPlaygroundInputText(playgroundData[tabKey].text);
  };


  // --- FAQ Accordion ---
  const [activeFaq, setActiveFaq] = useState(null);
  const toggleFaq = (index) => {
    setActiveFaq(prev => (prev === index ? null : index));
  };


  // Chatbot states and methods removed (now handled in reusable Chatbot component)

  return (
    <div className="font-body-md text-body-md bg-background text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container pt-[100px] min-h-screen flex flex-col">
      <div className="bg-glow"></div>

      {/* Reusable Header Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto flex-grow w-full">
        
        {/* Immersive Hero Section */}
        <section className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-gutter min-h-[620px] mb-16 pt-8">
          
          {/* Left: Captivating Hero Content */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 shadow-[0_0_15px_rgba(37,99,235,0.15)]">
              <span className="w-2 h-2 rounded-full bg-primary ai-pulse"></span>
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-bold">IntervFlow AI Practice Studio</span>
            </div>
            <h1 className="font-display-lg text-3xl sm:text-5xl lg:text-display-lg text-glow text-white leading-tight mb-6">
              Prepare for <br className="hidden sm:inline" /> the Interviews <br /><span className="text-[#818CF8] text-glow">That Define Careers.</span>
            </h1>
            <p className="font-body-lg text-base sm:text-body-lg text-on-surface-variant mb-10 max-w-xl min-h-[4.5rem] sm:min-h-[3rem] lg:min-h-[2.5rem] mx-auto lg:mx-0 px-4 sm:px-0">
              {typedText}
              <span className="typing-cursor"></span>
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 mb-8 w-full sm:w-auto px-6 sm:px-0">
              <button onClick={() => navigate('/login')} className="btn-primary px-8 py-4 rounded-full text-white flex items-center justify-center gap-2 w-full sm:w-auto">
                Start Mock Session
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path>
                </svg>
              </button>
              <button onClick={() => navigate('/login')} className="btn-secondary px-8 py-4 rounded-full flex items-center justify-center gap-2 w-full sm:w-auto">
                <span className="material-symbols-outlined text-sm">work</span>
                Explore & Apply Jobs
              </button>
            </div>

            {/* Highly Informative Telemetry Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full border-t border-white/10 pt-6 px-4 sm:px-0">
              <div className="text-center lg:text-left">
                <span className="text-xl md:text-2xl font-bold text-white block">1,000+</span>
                <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block leading-normal">Mock Scenarios</span>
              </div>
              <div className="text-center lg:text-left">
                <span className="text-xl md:text-2xl font-bold text-white block">85%+</span>
                <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block leading-normal">ATS Score Audits</span>
              </div>
              <div className="text-center lg:text-left">
                <span className="text-xl md:text-2xl font-bold text-[#ddb7ff] block">100+</span>
                <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block leading-normal">Verified Jobs</span>
              </div>
              <div className="text-center lg:text-left">
                <span className="text-xl md:text-2xl font-bold text-emerald-400 block">₹299/mo</span>
                <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block leading-normal">Calibrated Price</span>
              </div>
            </div>
          </div>

          {/* Right: Animated High-Fidelity Simulator Mockup */}
          <div className="flex-1 relative w-full max-w-lg lg:max-w-none animate-float z-10">
            <div className="glass-card rounded-2xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10">
              {/* Mockup Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E1B4B] flex items-center justify-center border border-[#818cf8]/30 shadow-[0_0_10px_rgba(129,140,248,0.15)]">
                    <span className="material-symbols-outlined text-[#818CF8] font-bold text-sm">psychology</span>
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-white font-bold">Software Engineer (SDE)</h3>
                    <p className="font-label-sm text-[10px] text-on-surface-variant">System Design Calibration</p>
                  </div>
                </div>
                
              </div>
              
              {/* Active Mock Telemetry Overlay */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-center">
                  <span className="text-[9px] text-on-surface-variant block uppercase font-mono">Verbal Pacing</span>
                  <span className="text-sm font-bold text-emerald-400">120 WPM (Optimal)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-center">
                  <span className="text-[9px] text-on-surface-variant block uppercase font-mono">Filler Words Count</span>
                  <span className="text-sm font-bold text-amber-400">2 detected (Low)</span>
                </div>
              </div>

              {/* Chat Area */}
              <div className="space-y-4 mb-4">
                {/* AI Question */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex-shrink-0 flex items-center justify-center mt-1 border border-white/5">
                    <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl rounded-tl-none p-3.5 border border-white/5">
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Why does Dijkstra’s Algorithm fail on graphs with negative edge weights, while Prim's Algorithm can still function?
                    </p>
                  </div>
                </div>
                {/* Candidate Answer */}
                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-8 h-8 rounded-full border border-primary/20 flex-shrink-0 bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    ME
                  </div>
                  <div className="bg-primary/5 rounded-2xl rounded-tr-none p-3.5 border border-primary/20 w-3/4">
                    <div className="flex items-center gap-2 h-5">
                      <span className="w-1.5 h-3 bg-primary rounded-full animate-pulse"></span>
                      <span className="w-1.5 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                      <span className="ml-2 font-label-sm text-[10px] text-primary font-bold">Synthesizing vocal wave...</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Input Area */}
              <div className="relative">
                <div className="w-full bg-black/20 border border-white/10 rounded-xl p-3 pr-12 flex items-center">
                  <span className="font-body-md text-on-surface-variant opacity-50 text-xs font-mono">Dijkstra's assumes non-negative edge weights because...</span>
                </div>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#09090b]/80 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-primary text-sm">mic</span>
                </button>
              </div>
            </div>
            {/* Decorative Elements Behind Mockup */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/10 blur-[100px] rounded-full opacity-30 pointer-events-none"></div>
          </div>
        </section>

        {/* Placed Students Logo Wall (Continuous marquee) */}
        <section className="mb-24">
          {/* <p className="text-center font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest mb-6">Our alumni secure L4-L6 placements globally</p> */}
          <div className="logo-marquee-container relative py-4 bg-[#09090b]/30 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="logo-marquee-inner flex gap-16 items-center">
              <div className="flex gap-20 items-center flex-shrink-0">
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#4285F4] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]"></span> Google</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#635BFF] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#635BFF]"></span> Stripe</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#0052CC] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#0052CC]"></span> Atlassian</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#E50914] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#E50914]"></span> Netflix</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#FF9900] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#FF9900]"></span> Amazon</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#0078D4] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#0078D4]"></span> Microsoft</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#2563EB] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span> Razorpay</span>
              </div>
              <div className="flex gap-20 items-center flex-shrink-0">
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#4285F4] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]"></span> Google</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#635BFF] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#635BFF]"></span> Stripe</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#0052CC] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#0052CC]"></span> Atlassian</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#E50914] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#E50914]"></span> Netflix</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#FF9900] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#FF9900]"></span> Amazon</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#0078D4] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#0078D4]"></span> Microsoft</span>
                <span className="text-xs font-mono font-bold text-white/40 tracking-wider flex items-center gap-1.5 hover:text-[#2563EB] hover:text-glow transition-all cursor-pointer"><span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span> Razorpay</span>
              </div>
            </div>
            {/* Fade gradients over edges */}
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none"></div>
          </div>
        </section>

        {/* Interactive AI Prep Sandbox Playground */}
        <section id="simulator" className="mb-24 relative">
          <div className="mb-12 text-center px-4">
            <span className="text-xs text-primary className font-mono font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">Interactive Sandbox</span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl lg:text-headline-lg text-white mt-4">Interactive AI Prep Simulator</h2>
            <p className="font-body-lg text-sm sm:text-base lg:text-body-lg text-on-surface-variant max-w-2xl mx-auto mt-2">Test drive our evaluation intelligence directly inside your browser. Pick a target track and click evaluate to see our high-fidelity scoring scorecard in action!</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left: Question Tabs Selector */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1 block">SELECT PRACTICE CATEGORY</span>
              
              <button
                className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activePlaygroundTab === 'swe' ? 'playground-tab-active border-primary/50' : 'border-white/10 bg-[#09090b]/30 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => switchPlaygroundTab('swe')}
              >
                <span className="material-symbols-outlined text-primary text-xl bg-primary/10 p-2 rounded-lg">code</span>
                <div>
                  <h4 className="text-white text-sm font-bold">Software Engineering (SDE)</h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">Design a URL shortening service like TinyURL. How would you handle 10,000 write requests per second and ensure low-latency redirection?</p>
                </div>
              </button>

              <button
                className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activePlaygroundTab === 'pm' ? 'playground-tab-active border-[#ddb7ff]/50' : 'border-white/10 bg-[#09090b]/30 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => switchPlaygroundTab('pm')}
              >
                <span className="material-symbols-outlined text-[#ddb7ff] text-xl bg-[#ddb7ff]/10 p-2 rounded-lg">category</span>
                <div>
                  <h4 className="text-white text-sm font-bold">Product Management (PM)</h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">How would you measure the success of Spotify's collaborative playlist feature? What key metrics would you track?</p>
                </div>
              </button>

              <button
                className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activePlaygroundTab === 'fin' ? 'playground-tab-active border-emerald-500/50' : 'border-white/10 bg-[#09090b]/30 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => switchPlaygroundTab('fin')}
              >
                <span className="material-symbols-outlined text-emerald-400 text-xl bg-emerald-500/10 p-2 rounded-lg">trending_up</span>
                <div>
                  <h4 className="text-white text-sm font-bold">Finance &amp; Strategy</h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">Walk me through how a $100 increase in depreciation affects the three financial statements.</p>
                </div>
              </button>

              <button
                className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activePlaygroundTab === 'con' ? 'playground-tab-active border-amber-500/50' : 'border-white/10 bg-[#09090b]/30 hover:border-white/20 hover:bg-white/5'
                }`}
                onClick={() => switchPlaygroundTab('con')}
              >
                <span className="material-symbols-outlined text-amber-400 text-xl bg-amber-400/10 p-2 rounded-lg">business_center</span>
                <div>
                  <h4 className="text-white text-sm font-bold">Business Consulting</h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">An airline client is facing declining profitability despite stable passenger volumes. How would you structure your analysis?</p>
                </div>
              </button>
            </div>

            {/* Right: Active Simulator Console */}
            <div className="lg:col-span-7 flex flex-col justify-between glass-card rounded-2xl p-6 border border-white/10 bg-[#0e0e10]/80 min-h-[380px]">
              {/* Simulator Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs text-white font-mono uppercase">
                    SIMULATOR ACTIVE: {
                      activePlaygroundTab === 'swe' ? 'SOFTWARE ENGINEERING' :
                      activePlaygroundTab === 'pm' ? 'PRODUCT MANAGEMENT' :
                      activePlaygroundTab === 'fin' ? 'FINANCE & STRATEGY' : 'BUSINESS CONSULTING'
                    }
                  </span>
                </div>
                <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">Calibrating...</span>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex flex-col gap-3 relative min-h-[220px]">
                <div className="flex-1 flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-on-surface-variant/40 uppercase">Answer Transcript Workspace</span>
                  <textarea
                    value={playgroundInputText}
                    onChange={(e) => setPlaygroundInputText(e.target.value)}
                    className="w-full flex-1 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-xs text-white leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[180px]"
                  />
                </div>
              </div>

              {/* Footer Console Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between border-t border-white/10 pt-4">
                <button onClick={() => navigate('/login')} className="btn-secondary px-4 py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto">
                  <span className="material-symbols-outlined text-[16px]">mic</span>
                  Simulate Voice Audio
                </button>
                <button
                  className="btn-primary px-6 py-2.5 rounded-full text-xs text-white cursor-pointer animate-pulse w-full sm:w-auto justify-center"
                  onClick={() => navigate('/login')}
                >
                   Run Automated AI Evaluation
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Industry Support Grid */}
        <section id="resume" className="mb-24">
          <div className="mb-12 text-center px-4">
            <span className="text-xs text-primary font-mono font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">Alumni Coverage</span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl lg:text-headline-lg text-white mt-4 font-bold">Portfolios Targeted Globally</h2>
            <p className="font-body-lg text-sm sm:text-base lg:text-body-lg text-on-surface-variant max-w-xl mx-auto mt-2">Tailored calibration parameters across technical, financial, and management domains.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-4 items-center text-center sm:items-start sm:text-left">
              <span className="material-symbols-outlined text-primary text-2xl bg-primary/10 p-2.5 rounded-xl self-center sm:self-start">code</span>
              <div>
                <h3 className="text-white font-bold text-sm">Software Engineering</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-2">
                  Master data structures, core algorithms, system design principles, and live coding challenges across SWE, frontend, backend, or fullstack tracks.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-4 items-center text-center sm:items-start sm:text-left">
              <span className="material-symbols-outlined text-[#ddb7ff] text-2xl bg-[#ddb7ff]/10 p-2.5 rounded-xl self-center sm:self-start">category</span>
              <div>
                <h3 className="text-white font-bold text-sm">Product Management</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-2">
                  Formulate estimation frameworks, case study structures, product execution strategies, agile roadmaps, and metric calibration benchmarks.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-4 items-center text-center sm:items-start sm:text-left">
              <span className="material-symbols-outlined text-emerald-400 text-2xl bg-emerald-500/10 p-2.5 rounded-xl self-center sm:self-start">trending_up</span>
              <div>
                <h3 className="text-white font-bold text-sm">Finance &amp; Strategy</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-2">
                  excel in quantitative analysis, investment banking case studies, corporate financial models, market valuation, and asset strategy rounds.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-4 items-center text-center sm:items-start sm:text-left">
              <span className="material-symbols-outlined text-amber-400 text-2xl bg-amber-400/10 p-2.5 rounded-xl self-center sm:self-start">business_center</span>
              <div>
                <h3 className="text-white font-bold text-sm">Business Consulting</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-2">
                  Crack market entry estimates, profitability analysis case interviews, business growth frameworks, and high-impact stakeholder slides.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Calibrated Value Comparison Table */}
        <section id="pricing" className="mb-24">
          <div className="mb-12 text-center px-4">
            <span className="text-xs text-primary font-mono font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">Value Comparison</span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl lg:text-headline-lg text-white mt-4 font-bold">Transparent Pricing. No Surprises.</h2>
            <p className="font-body-lg text-sm sm:text-base lg:text-body-lg text-on-surface-variant max-w-xl mx-auto mt-2">Whether you're just starting out or going all in, we have a plan to take you from preparation to placement.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Free / Basic */}
            <div className="glass-card rounded-2xl p-8 border border-white/5 flex flex-col justify-between bg-white/5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">BASIC</span>
                <div className="flex items-baseline mt-2 mb-1">
                  <span className="text-3xl font-extrabold text-white">₹0</span>
                  <span className="text-xs text-on-surface-variant ml-1">/ lifetime</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-6">Try the platform risk-free. No card required.</p>
                <ul className="space-y-3.5 mb-8 text-xs text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span>3 ATS Resume Analyses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span>3 Automated AI Mock Interviews</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span>Access to Community &amp; Leaderboard</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-30">
                    <span className="material-symbols-outlined text-base mt-0.5">close</span>
                    <span>Premium Curated Jobs</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-30">
                    <span className="material-symbols-outlined text-base mt-0.5">close</span>
                    <span>24/7 Context AI Doubt Chatbot</span>
                  </li>
                </ul>
              </div>
              <button className="btn-secondary w-full py-3 rounded-full text-xs" onClick={() => navigate('/signup')}>Get Started Free</button>
            </div>

            {/* Pro */}
            <div className="glass-card rounded-2xl p-8 border-2 border-emerald-500 flex flex-col justify-between bg-emerald-950/40 relative shadow-[0_0_30px_rgba(16,185,129,0.18)] !overflow-visible">
              <div className="absolute -top-3 right-6 bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(16,185,129,0.25)]">VALUE PLAN</div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">PRO</span>
                <div className="flex items-baseline mt-2 mb-1">
                  <span className="text-3xl font-extrabold text-white">₹299</span>
                  <span className="text-xs text-on-surface-variant ml-1">/ month</span>
                </div>
                <p className="text-xs text-emerald-400 leading-relaxed mb-6">For serious candidates who want consistent practice and expert guidance.</p>
                <ul className="space-y-3.5 mb-8 text-xs text-white">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                    <span>10 ATS Resume Reviews / month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                    <span>7 AI Mock Interviews / month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                    <span><strong>3 Premium Job Applications</strong> monthly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                    <span>24/7 Context-Aware AI Doubt Tutor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                    <span>Global XP Leaderboards &amp; Streak Challenges</span>
                  </li>
                </ul>
              </div>
              <button className="w-full py-3 rounded-full font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 active:scale-95 transition-all cursor-pointer" onClick={() => navigate('/signup')}>Upgrade to Pro</button>
            </div>

            {/* Pro Plus */}
            <div className="glass-card rounded-2xl p-8 border-2 border-primary flex flex-col justify-between bg-primary/5 relative shadow-[0_0_30px_rgba(37,99,235,0.2)] !overflow-visible">
              <div className="absolute -top-3 right-6 bg-[#1E1B4B] text-[#818CF8] border border-[#818cf8]/30 text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(129,140,248,0.2)]">PREMIUM PLAN</div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">PRO PLUS</span>
                <div className="flex items-baseline mt-2 mb-1">
                  <span className="text-3xl font-extrabold text-white">₹999</span>
                  <span className="text-xs text-on-surface-variant ml-1">/ month</span>
                </div>
                <p className="text-xs text-[#ddb7ff] leading-relaxed mb-6">For placement-driven candidates who want maximum support and exposure.</p>
                <ul className="space-y-3.5 mb-8 text-xs text-white">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span><strong>Unlimited</strong> ATS Evaluations &amp; Keyword Scans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span><strong>Unlimited</strong> AI Mock Simulations (all tracks)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span><strong>Unlimited Applications</strong> with AI Profile Card</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span>24/7 Context-Aware AI Doubt Tutor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span>Priority Placement &amp; Warm Recruiter Introductions</span>
                  </li>
                </ul>
              </div>
              <button className="btn-primary w-full py-3 rounded-full text-xs text-white" onClick={() => navigate('/signup')}>Upgrade to Pro Plus</button>
            </div>
          </div>
        </section>

        {/* How it Works Timeline Section */}
        <section className="mb-24">
          <div className="mb-12 text-center px-4">
            <span className="text-xs text-[#ddb7ff] font-mono font-bold uppercase tracking-widest bg-[#ddb7ff]/10 border border-[#ddb7ff]/20 px-3 py-1 rounded-full">How It Works</span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl lg:text-headline-lg text-white mt-4 font-bold">From Resume to Offer — Your Journey</h2>
            <p className="text-sm sm:text-base text-on-surface-variant max-w-md mx-auto mt-2">Five steps that take you from prep to placement, guided by AI and verified experts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="relative timeline-step pl-16 md:pl-0 flex flex-col gap-3">
              <div className="absolute left-0 md:relative w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary font-bold z-10">1</div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-2">Upload Resume &amp; Set Role</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Drop your resume and select your target role. Our AI instantly generates your ATS score, flags keyword gaps, and suggests improvements.
              </p>
            </div>
            <div className="relative timeline-step pl-16 md:pl-0 flex flex-col gap-3">
              <div className="absolute left-0 md:relative w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary font-bold z-10">2</div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-2">AI Mock Interview</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Take a live voice-based AI mock. Get real-time questions, filler word detection, pacing analysis, and a full post-session scorecard.
              </p>
            </div>
            <div className="relative timeline-step pl-16 md:pl-0 flex flex-col gap-3">
              <div className="absolute left-0 md:relative w-10 h-10 rounded-full bg-[#ddb7ff]/10 border-2 border-[#ddb7ff]/50 flex items-center justify-center text-[#ddb7ff] font-bold z-10">3</div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-2">Explore &amp; Apply Jobs</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Browse verified job postings tailored to your profile. Apply directly using your optimized resume and AI mock scorecard.
              </p>
            </div>
            <div className="relative timeline-step pl-16 md:pl-0 flex flex-col gap-3">
              <div className="absolute left-0 md:relative w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold z-10">4</div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-2">Review &amp; Improve</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Deep-dive into your performance dashboard — WPM, filler count, answer structure scores, and specific feedback from your AI mock simulations and job matches.
              </p>
            </div>
            <div className="relative pl-16 md:pl-0 flex flex-col gap-3">
              <div className="absolute left-0 md:relative w-10 h-10 rounded-full bg-amber-400/10 border-2 border-amber-400/50 flex items-center justify-center text-amber-400 font-bold z-10">5</div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-2">Community &amp; Streaks</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Join weekly challenges, earn XP, climb the leaderboard, and stay consistent with daily prep streaks alongside 10k+ fellow candidates.
              </p>
            </div>
          </div>
        </section>

        {/* Testimonials Slider */}
        <section id="testimonials" className="mb-24 glass-panel rounded-2xl p-8 md:p-10 border border-white/10 glow-border">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 mb-8 gap-4">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono">Success Stories</span>
              <h3 className="text-white font-bold text-body-lg mt-1">Verified Placements</h3>
            </div>
            <div className="flex gap-2 self-end md:self-auto">
              <button onClick={prevTestimonial} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white cursor-pointer">
                <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
              </button>
              <button onClick={nextTestimonial} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white cursor-pointer">
                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
              </button>
            </div>
          </div>

          <div className="min-h-36 flex flex-col justify-between">
            <p className="text-body-md text-white italic leading-relaxed md:text-lg">
              {testimonials[currentTIndex].quote}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10">
                <img alt="Avatar" className="w-full h-full object-cover" src={testimonials[currentTIndex].avatar} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{testimonials[currentTIndex].name}</h4>
                <p className="text-[10px] text-on-surface-variant font-mono">{testimonials[currentTIndex].role}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive FAQ Accordion */}
        <section id="faq" className="mb-24 max-w-3xl mx-auto">
          <div className="mb-12 text-center px-4">
            <span className="text-xs text-[#ddb7ff] font-mono font-bold uppercase tracking-widest bg-[#ddb7ff]/10 border border-[#ddb7ff]/20 px-3 py-1 rounded-full">FAQ Calibration</span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl lg:text-headline-lg text-white mt-4 font-bold">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <div className={`glass-card rounded-2xl border border-white/5 faq-item transition-all ${activeFaq === 0 ? 'active' : ''}`} onClick={() => toggleFaq(0)}>
              <button className="w-full flex justify-between items-center p-6 text-left focus:outline-none cursor-pointer">
                <span className="text-white text-sm font-bold">How does the AI interview work? Is it really voice-based?</span>
                <span className="material-symbols-outlined text-primary transition-transform duration-300 faq-arrow">expand_more</span>
              </button>
              <div className="faq-answer px-6 pb-6 text-xs text-on-surface-variant leading-relaxed">
                Yes — IntervFlow's AI interviewer asks you questions via a realistic synthetic voice and listens to your spoken answers in real time. Our engine transcribes your response, detects filler words (like "um", "so", "basically"), tracks your words-per-minute pacing, and scores your answer structure — all within seconds of you finishing.
              </div>
            </div>

            <div className={`glass-card rounded-2xl border border-white/5 faq-item transition-all ${activeFaq === 1 ? 'active' : ''}`} onClick={() => toggleFaq(1)}>
              <button className="w-full flex justify-between items-center p-6 text-left focus:outline-none cursor-pointer">
                <span className="text-white text-sm font-bold">Does the ATS scanner work for non-tech roles like PM or Finance?</span>
                <span className="material-symbols-outlined text-primary transition-transform duration-300 faq-arrow">expand_more</span>
              </button>
              <div className="faq-answer px-6 pb-6 text-xs text-on-surface-variant leading-relaxed">
                Absolutely. Our ATS engine is trained on job descriptions across Software Engineering, Product Management, Finance &amp; Strategy, and Business Consulting. When you upload your resume, you select your target role — and we benchmark your resume against real JD requirements for that domain, flagging keyword gaps and passive verb usage.
              </div>
            </div>

            <div className={`glass-card rounded-2xl border border-white/5 faq-item transition-all ${activeFaq === 2 ? 'active' : ''}`} onClick={() => toggleFaq(2)}>
              <button className="w-full flex justify-between items-center p-6 text-left focus:outline-none cursor-pointer">
                <span className="text-white text-sm font-bold">What's the difference between AI mock and direct job portal applications?</span>
                <span className="material-symbols-outlined text-primary transition-transform duration-300 faq-arrow">expand_more</span>
              </button>
              <div className="faq-answer px-6 pb-6 text-xs text-on-surface-variant leading-relaxed">
                The AI mock is fully automated — you can practice anytime, get instant verbal pacing scoring, filler words counts, and review reports. The Job Portal connects these mocks directly to recruiters. By submitting your mock telemetry scorecard alongside your ATS-optimized resume, you prove your job-readiness instantly and secure interviews faster.
              </div>
            </div>

            <div className={`glass-card rounded-2xl border border-white/5 faq-item transition-all ${activeFaq === 3 ? 'active' : ''}`} onClick={() => toggleFaq(3)}>
              <button className="w-full flex justify-between items-center p-6 text-left focus:outline-none cursor-pointer">
                <span className="text-white text-sm font-bold">Can I switch between tracks (e.g., from SDE to PM) mid-subscription?</span>
                <span className="material-symbols-outlined text-primary transition-transform duration-300 faq-arrow">expand_more</span>
              </button>
              <div className="faq-answer px-6 pb-6 text-xs text-on-surface-variant leading-relaxed">
                Yes! Your account supports multiple active target roles. You can switch between SDE, PM, Finance, and Consulting tracks at any time from your profile settings without losing your existing history or mock records. Each domain has its own question bank and matching job openings.
              </div>
            </div>

            <div className={`glass-card rounded-2xl border border-white/5 faq-item transition-all ${activeFaq === 4 ? 'active' : ''}`} onClick={() => toggleFaq(4)}>
              <button className="w-full flex justify-between items-center p-6 text-left focus:outline-none cursor-pointer">
                <span className="text-white text-sm font-bold">Is IntervFlow suitable for freshers or only experienced candidates?</span>
                <span className="material-symbols-outlined text-primary transition-transform duration-300 faq-arrow">expand_more</span>
              </button>
              <div className="faq-answer px-6 pb-6 text-xs text-on-surface-variant leading-relaxed">
                IntervFlow is built for both. Freshers can start with the Free plan — get 3 mock interviews, 3 resume scans, and community access to build confidence. Experienced candidates use the Pro and Pro Plus tiers to sharpen advanced system design, case study thinking, and apply to premium matching roles from top-tier firms.
              </div>
            </div>
          </div>
        </section>

        {/* Final Lead Capture Section */}
        <section className="mb-24 relative overflow-hidden glass-panel rounded-3xl p-8 md:p-14 border border-white/10 glow-border text-center max-w-5xl mx-auto mx-4 sm:mx-auto">
          <div className="relative z-10">
            <span className="text-xs text-primary font-mono font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-6 inline-block">Day 15/30 Challenge</span>
            <h2 className="font-headline-lg text-2xl sm:text-4xl lg:text-display-lg text-glow text-white leading-tight mb-4 font-bold">Master Your Prep.<br />Secure the Offer.</h2>
            <p className="font-body-lg text-sm sm:text-base lg:text-body-lg text-on-surface-variant max-w-xl mx-auto mb-10">Join 10k+ candidates practicing coding mocks, product cases, financial modeling, and consulting frameworks today.</p>
            
            <div className="flex justify-center">
              <button onClick={() => navigate('/signup')} className="btn-primary px-12 py-4 rounded-full text-sm text-white font-semibold">
                Join Now
                              </button>
            </div>
          </div>
          {/* Glowing accents */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#ddb7ff]/10 blur-[100px] rounded-full pointer-events-none"></div>
        </section>

      </main>

      {/* Reusable Footer */}
      <Footer />

      {/* Reusable Chatbot Drawer Widget */}
      <Chatbot />
    </div>
  );
}
