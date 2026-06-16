import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

export default function Community() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Alex");
  const [userDomain, setUserDomain] = useState("fullstack");
  const [userEmail, setUserEmail] = useState("test@example.com");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [feedTab, setFeedTab] = useState("all"); // "all" or "saved"
  
  // Comment states
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentTextMap, setCommentTextMap] = useState({});

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCategory, setModalCategory] = useState("System Design");
  const [modalDesc, setModalDesc] = useState("");
  const [modalCode, setModalCode] = useState("");
  const [modalLanguage, setModalLanguage] = useState("python");
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Static leaderboard mock profiles
  const mockLeaderboardProfiles = {
    "Devore Chen": {
      name: "Devore Chen",
      rank: 1,
      streak: "42 Days",
      xp: "980 XP",
      title: "Senior Fullstack Lead at Google",
      initials: "DC",
      mentorKey: "devore",
      techStack: ["React", "TypeScript", "Node.js", "Docker", "Kubernetes", "GraphQL"],
      badges: [
        { emoji: "🏅", name: "Staff Level", desc: "Completed Staff L6 engineering simulations." },
        { emoji: "💻", name: "Systems Architect", desc: "Scored 90%+ on advanced systems designs." },
        { emoji: "🔥", name: "Streak Master", desc: "Maintained practice streaks for 30+ days." }
      ],
      summaries: [
        { company: "Google", role: "L6 Staff Backend Architect", text: "Faced custom CDN edge routing design challenge. Discussed consistent hashing, LRU cache eviction policies, and hot-spot routing optimizations under 10M QPS." },
        { company: "Meta", role: "L6 Systems Engineer", text: "Walked through custom distributed task scheduling and rate limiting algorithms for global notifications delivery queues." }
      ]
    },
    "Sarah Jenkins": {
      name: "Sarah Jenkins",
      rank: 2,
      streak: "38 Days",
      xp: "915 XP",
      title: "ML Systems Lead at Razorpay",
      initials: "SJ",
      mentorKey: "sarah",
      techStack: ["Go", "gRPC", "PostgreSQL", "Kafka", "AWS", "Redis", "PyTorch"],
      badges: [
        { emoji: "💻", name: "Systems Architect", desc: "Scored 90%+ on advanced systems designs." },
        { emoji: "🔥", name: "Streak Master", desc: "Maintained practice streaks for 30+ days." }
      ],
      summaries: [
        { company: "Razorpay", role: "ML Systems Architect", text: "Designed a high-throughput transaction ledger and distributed ML pipelines. Covered two-phase commit protocols, write-ahead logs, and database sharding keys." }
      ]
    },
    "Clara Lin": {
      name: "Clara Lin",
      rank: 3,
      streak: "35 Days",
      xp: "890 XP",
      title: "NoSQL & Infra Lead at Stripe",
      initials: "CL",
      mentorKey: "clara",
      techStack: ["Python", "AWS DynamoDB", "NoSQL Sharding", "Redis Cache", "Docker"],
      badges: [
        { emoji: "💻", name: "Systems Architect", desc: "Scored 90%+ on advanced systems designs." },
        { emoji: "🔥", name: "Streak Master", desc: "Maintained practice streaks for 30+ days." }
      ],
      summaries: [
        { company: "Stripe", role: "L6 NoSQL Support Lead", text: "Created offline feature store generation framework for credit card fraud detection. Handled model drift audits and sub-15ms sync pipeline updates." }
      ]
    }
  };

  const handleOpenCurrentUserProfile = () => {
    const domainLabel = userDomain === 'backend' 
      ? 'Backend Eng' 
      : userDomain === 'frontend' 
        ? 'Frontend Eng' 
        : userDomain === 'pm'
          ? 'Product Manager'
          : 'Candidate Partner';
      
    const userSummaries = posts.filter(p => !p.anonymous && (p.author.includes(userName) || p.author.includes("You"))).map(p => ({
      company: p.title.split(' - ')[0] || "Target Company",
      role: p.title.split(' - ')[1] || domainLabel,
      text: p.description
    }));

    setSelectedProfile({
      name: `${userName} (You)`,
      rank: 4,
      streak: "15 Days",
      xp: "750 XP",
      title: `${domainLabel} at IntervFlow`,
      initials: userName.slice(0, 2).toUpperCase(),
      mentorKey: null,
      techStack: userDomain === 'backend' 
        ? ["Go", "Node.js", "MongoDB", "Docker", "Redis"]
        : userDomain === 'frontend'
          ? ["React", "JavaScript", "Tailwind CSS", "CSS", "Vite"]
          : ["Product Roadmap", "User Personas", "Agile", "KPI metrics"],
      badges: [
        { emoji: "🔥", name: "Streak Active", desc: "Maintained streak for 15 days." },
        { emoji: "💻", name: "Systems Design", desc: "Demonstrated baseline database architecture capability." },
        { emoji: "📝", name: "ATS 85+", desc: "Resume scored above 85% keyword match." }
      ],
      summaries: userSummaries.length > 0 ? userSummaries : [
        { company: "IntervFlow", role: "Active Candidate", text: "Practicing behavioral STAR responses and resume keyword indexing logs." }
      ]
    });
  };

  // Load user profile & fetch posts on mount
  useEffect(() => {
    const name = sessionStorage.getItem('userName') || 'Alex';
    const domain = sessionStorage.getItem('userDomain') || 'fullstack';
    const email = sessionStorage.getItem('userEmail') || 'test@example.com';
    setUserName(name);
    setUserDomain(domain);
    setUserEmail(email);

    // Load bookmarks
    const saved = localStorage.getItem('intervflow_bookmarks');
    if (saved) {
      try {
        setBookmarkedIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error(e);
      }
    }

    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/community/posts`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error("Failed to fetch community posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (postId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/community/posts/${postId}/upvote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prevPosts => 
          prevPosts.map(post => post.id === postId ? { ...post, upvotes: data.post.upvotes, votedEmails: data.post.votedEmails } : post)
        );
      }
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  };

  const handleToggleBookmark = (postId, e) => {
    e.stopPropagation();
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      localStorage.setItem('intervflow_bookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  const toggleComments = (postId, e) => {
    e.stopPropagation();
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handlePostComment = async (postId) => {
    const text = commentTextMap[postId];
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          author: userName,
          text
        })
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prevPosts => 
          prevPosts.map(p => p.id === postId ? data.post : p)
        );
        setCommentTextMap(prev => ({ ...prev, [postId]: "" }));
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalDesc.trim()) return;

    try {
      const domainLabel = userDomain === 'backend' 
        ? 'Backend Eng' 
        : userDomain === 'frontend' 
          ? 'Frontend Eng' 
          : userDomain === 'pm'
            ? 'Product Manager'
            : 'Candidate Partner';
      
      const authorMeta = postAnonymous 
        ? `Just now • Verified ${domainLabel} at IntervFlow` 
        : `Just now • ${domainLabel} at IntervFlow`;

      const codeSnippet = modalCode.trim() 
        ? { code: modalCode, language: modalLanguage } 
        : null;

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/community/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: modalTitle,
          category: modalCategory,
          description: modalDesc,
          author: postAnonymous ? "Anonymous Candidate" : `${userName} (You)`,
          authorMeta,
          codeSnippet,
          anonymous: postAnonymous
        })
      });

      const data = await res.json();
      if (data.success) {
        // Prepend post to state
        setPosts(prev => [data.post, ...prev]);
        
        // Reset states & close modal
        setModalTitle("");
        setModalDesc("");
        setModalCode("");
        setPostAnonymous(false);
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to create post:", err);
    }
  };

  // Filter posts by category and bookmarks tab
  const filteredPosts = posts.filter(post => {
    // Tab filter
    if (feedTab === "saved" && !bookmarkedIds.has(post.id)) {
      return false;
    }
    
    // Category filter
    if (categoryFilter === "All Categories") return true;
    return post.category.toLowerCase().includes(categoryFilter.toLowerCase()) || 
           categoryFilter.toLowerCase().includes(post.category.toLowerCase());
  });

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-16 font-body-md">
      {/* Background Atmosphere */}
      <div className="bg-glow"></div>

      {/* Navbar */}
      <DashboardNavbar activeTab="community" />

      {/* Main Container */}
      <main className="flex-grow w-full max-w-[1400px] mx-auto px-margin-mobile md:px-margin-desktop py-10 z-10 relative">
        
        {/* Hero Section */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-left">
            <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-4xl">groups</span>
              Community Prep Hub
            </h1>
            <p className="font-body-lg text-sm md:text-base text-on-surface-variant max-w-2xl mt-2">
              Compete in weekly coding & interview challenges, track leaderboard standings, and share real-time exam feedbacks.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="px-6 py-3 glow-button font-bold text-xs flex items-center gap-2 border-none shrink-0"
          >
            <span className="material-symbols-outlined text-sm font-bold">share</span>
            Share Experience
          </button>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: Challenges & Forums (8 columns) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Active Challenges */}
            <section className="glass-panel rounded-2xl p-6 glow-border text-left">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
                <h2 className="text-headline-md text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">emoji_events</span>
                  Weekly Practice Challenges
                </h2>
                <span className="text-[10px] font-mono bg-primary/20 text-primary border border-primary/20 px-3 py-1 rounded-full uppercase font-bold tracking-wider">Active</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Challenge 1 */}
                <div className="glass-card p-5 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-300">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="text-white font-semibold text-sm md:text-body-md">The STAR Master Challenge</h3>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] fill-1">bolt</span>+200 XP
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                      Complete 3 Behavioral/HR Mock Sessions scoring 85%+ on response structure details.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[11px] text-on-surface-variant mb-2 font-mono">
                      <span>Your Progress: 2/3 complete</span>
                      <span className="text-primary font-bold">66%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-4">
                      <div className="bg-primary h-full w-[66%]"></div>
                    </div>
                    <button 
                      onClick={() => navigate('/practice')} 
                      className="glow-button w-full py-2.5 text-white font-bold text-xs flex items-center justify-center gap-1.5 border-none"
                    >
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Launch STAR Mock
                    </button>
                  </div>
                </div>

                {/* Challenge 2 */}
                <div className="glass-card p-5 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-300">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="text-white font-semibold text-sm md:text-body-md">Consistent Architect</h3>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] fill-1">bolt</span>+150 XP
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                      Maintain your streak for 7 consecutive days to lock in permanent system telemetry multipliers.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[11px] text-on-surface-variant mb-2 font-mono">
                      <span>Your Progress: 4/7 days</span>
                      <span className="text-[#ddb7ff] font-bold">57%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-4">
                      <div className="bg-gradient-to-r from-primary to-[#ddb7ff] h-full w-[57%]"></div>
                    </div>
                    <div className="text-center text-[10px] text-on-surface-variant/80 font-mono">
                      Streak multiplier: 1.2x active!
                    </div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Discussion Forum */}
            <section className="flex flex-col gap-4 text-left">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-headline-md text-lg md:text-xl font-bold text-white">Interview Discussion Forum</h2>
                
                {/* Category Dropdown */}
                <div className="relative">
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-on-surface font-body-md focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="All Categories">All Categories</option>
                    <option value="System Design">System Design</option>
                    <option value="Coding Algorithms">Coding Algorithms</option>
                    <option value="STAR Behavioral">STAR Behavioral</option>
                    <option value="HR Screener">HR Screener</option>
                    <option value="Frontend Architecture">Frontend Architecture</option>
                    <option value="Object-Oriented Design">Object-Oriented Design (OOD)</option>
                    <option value="DevOps &amp; Infrastructure">DevOps &amp; Infrastructure</option>
                    <option value="Machine Learning / AI">Machine Learning / AI</option>
                  </select>
                </div>
              </div>

              {/* Feed Tabs: All Feed vs Saved Snippets */}
              <div className="flex border-b border-white/10 mb-2">
                <button 
                  onClick={() => setFeedTab("all")}
                  className={`px-4 py-2.5 text-xs font-semibold border-none bg-transparent cursor-pointer transition-all ${
                    feedTab === "all" ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  All Feed
                </button>
                <button 
                  onClick={() => setFeedTab("saved")}
                  className={`px-4 py-2.5 text-xs font-semibold border-none bg-transparent cursor-pointer transition-all flex items-center gap-1.5 ${
                    feedTab === "saved" ? 'text-[#ddb7ff] border-b-2 border-[#ddb7ff] font-bold' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm select-none">bookmark</span>
                  Saved Snippets ({bookmarkedIds.size})
                </button>
              </div>

              {/* Forum Feed */}
              {loading ? (
                <div className="text-center py-10 text-xs text-on-surface-variant glass-panel rounded-2xl p-6 border border-white/5">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
                  Loading Prep Hub feed...
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12 text-xs text-on-surface-variant bg-black/10 rounded-xl border border-dashed border-white/10 glass-panel p-6">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">
                    {feedTab === "saved" ? "bookmark_border" : "forum"}
                  </span>
                  <p className="font-semibold text-sm">
                    {feedTab === "saved" ? "No saved snippets yet." : "No posts found in this category."}
                  </p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">
                    {feedTab === "saved" ? "Click 'Save Snippet' on any post to keep it here." : "Be the first to share an interview experience for this topic!"}
                  </p>
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const hasUpvoted = post.votedEmails && post.votedEmails.includes(userEmail);
                  
                  return (
                    <article 
                      key={post.id} 
                      className="glass-panel rounded-2xl p-6 border border-white/8 hover:border-white/15 transition-all duration-300"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 flex items-center justify-center bg-primary/20 text-primary font-mono text-xs font-bold select-none">
                            {post.anonymous ? (
                              <span className="material-symbols-outlined text-sm text-on-surface-variant">visibility_off</span>
                            ) : (
                              post.author.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{post.author}</h4>
                            <p className="text-[10px] text-on-surface-variant font-mono">{post.authorMeta}</p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider font-mono">
                          {post.category}
                        </span>
                      </div>
                      
                      {/* Post Content */}
                      <h3 className="text-white font-semibold text-body-md md:text-body-lg mb-2 hover:text-primary transition-colors cursor-pointer leading-snug">
                        {post.title}
                      </h3>
                      
                      <p className="text-xs md:text-sm text-on-surface-variant mb-4 leading-relaxed whitespace-pre-wrap">
                        {post.description}
                      </p>

                      {/* Rendering Code Block if present */}
                      {post.codeSnippet && (
                        <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[#09090b] mb-4 relative group overflow-hidden">
                          <div className="absolute right-3 top-3 text-[9px] text-on-surface-variant font-mono uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5 pointer-events-none select-none">
                            {post.codeSnippet.language}
                          </div>
                          <pre className="font-mono text-xs text-emerald-400 overflow-x-auto hide-scrollbar whitespace-pre text-left max-h-[300px]">
                            <code>{post.codeSnippet.code}</code>
                          </pre>
                        </div>
                      )}

                      {/* Rendering STAR breakdown if present */}
                      {post.gridData && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 font-body-md">
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-primary uppercase block font-mono">S - Situation</span>
                            <span className="text-[11px] text-on-surface-variant leading-normal">{post.gridData.S}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-primary uppercase block font-mono">T - Task</span>
                            <span className="text-[11px] text-on-surface-variant leading-normal">{post.gridData.T}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-primary uppercase block font-mono">A - Action</span>
                            <span className="text-[11px] text-on-surface-variant leading-normal">{post.gridData.A}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-primary uppercase block font-mono">R - Result</span>
                            <span className="text-[11px] text-on-surface-variant leading-normal">{post.gridData.R}</span>
                          </div>
                        </div>
                      )}

                      {/* Post Actions */}
                      <div className="flex items-center gap-4 flex-wrap border-t border-white/5 pt-4">
                        <button 
                          onClick={(e) => handleUpvote(post.id, e)}
                          className={`flex items-center gap-1.5 text-xs cursor-pointer border-none bg-transparent transition-all ${
                            hasUpvoted ? 'text-[#b4c5ff] font-bold' : 'text-on-surface-variant hover:text-primary'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[18px] ${hasUpvoted ? 'fill-1' : ''}`}>thumb_up</span>
                          <span className="font-mono">{post.upvotes} Upvotes</span>
                        </button>
                        
                        <button 
                          onClick={(e) => toggleComments(post.id, e)}
                          className={`flex items-center gap-1.5 text-xs cursor-pointer border-none bg-transparent transition-all ${
                            expandedComments.has(post.id) ? 'text-[#b4c5ff] font-bold' : 'text-on-surface-variant hover:text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                          <span className="font-mono">{post.comments} Comments</span>
                        </button>

                        {/* Interactive Try Mock Challenge CTA */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            let companyName = 'Google';
                            let titleText = post.title;
                            if (post.title.includes(' - ')) {
                              const parts = post.title.split(' - ');
                              companyName = parts[0].trim();
                              titleText = parts[1].trim();
                            }
                            navigate('/practice', {
                              state: {
                                jobTitle: titleText,
                                jdText: post.description,
                                company: companyName,
                                mode: 'jd'
                              }
                            });
                          }}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-white transition-all cursor-pointer border-none bg-transparent"
                        >
                          <span className="material-symbols-outlined text-[18px]">bolt</span>
                          <span className="font-bold text-primary hover:underline">Try Challenge</span>
                        </button>
                        
                        <button 
                          onClick={(e) => handleToggleBookmark(post.id, e)}
                          className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-none bg-transparent ml-auto ${
                            bookmarkedIds.has(post.id) ? 'text-[#ddb7ff]' : 'text-on-surface-variant hover:text-[#ddb7ff]'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[18px] ${bookmarkedIds.has(post.id) ? 'fill-1' : ''}`}>bookmark</span>
                          <span>{bookmarkedIds.has(post.id) ? 'Saved' : 'Save Snippet'}</span>
                        </button>
                      </div>

                      {/* Comments Drawer Section */}
                      {expandedComments.has(post.id) && (
                        <div className="mt-4 border-t border-white/5 pt-4 space-y-4">
                          {/* List of comments */}
                          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                            {post.commentsList && post.commentsList.length > 0 ? (
                              post.commentsList.map((comment) => (
                                <div key={comment.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-left">
                                  <div className="flex justify-between items-center mb-1 text-on-surface-variant font-mono text-[10px]">
                                    <span className="font-bold text-white">{comment.author}</span>
                                    <span>
                                      {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-on-surface-variant leading-relaxed font-body-md text-[11px] md:text-xs">
                                    {comment.text}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-on-surface-variant/40 italic py-2 text-center">
                                No comments yet. Be the first to share your thoughts!
                              </p>
                            )}
                          </div>

                          {/* Write Comment Form */}
                          <div className="flex gap-2 pt-2">
                            <input 
                              type="text"
                              placeholder="Write a comment..."
                              value={commentTextMap[post.id] || ""}
                              onChange={(e) => setCommentTextMap(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handlePostComment(post.id); }}
                              className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary font-body-md"
                            />
                            <button 
                              onClick={() => handlePostComment(post.id)}
                              className="px-4 py-2.5 glow-button text-white font-bold text-xs border-none shrink-0"
                            >
                              Post
                            </button>
                          </div>
                        </div>
                      )}

                    </article>
                  );
                })
              )}
            </section>
          </div>
          
          {/* Right Side: Leaderboards & Stats (4 columns) */}
          <div className="lg:col-span-4 flex flex-col gap-8 text-left">
            
            {/* Global XP Leaderboard */}
            <section className="glass-panel rounded-2xl p-6 glow-border">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
                <h2 className="text-headline-md text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#2563eb]">leaderboard</span>
                  Global XP Leaderboard
                </h2>
                <span className="text-[10px] text-on-surface-variant font-mono">June 2026</span>
              </div>
              
              <div className="flex flex-col gap-3">
                {/* Rank 1 */}
                <div 
                  onClick={() => setSelectedProfile(mockLeaderboardProfiles["Devore Chen"])}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-7 h-7 rounded-full bg-amber-400/20 text-amber-400 font-mono font-bold flex items-center justify-center border border-amber-400/30 text-xs shrink-0">1</div>
                    <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs select-none shrink-0">DC</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Devore Chen</h4>
                      <p className="text-[9px] text-on-surface-variant font-mono">🔥 42 Days Streak</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-amber-400 font-mono">980 XP</span>
                  </div>
                </div>

                {/* Rank 2 */}
                <div 
                  onClick={() => setSelectedProfile(mockLeaderboardProfiles["Sarah Jenkins"])}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-300 font-mono font-bold flex items-center justify-center border border-slate-300/30 text-xs shrink-0">2</div>
                    <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs select-none shrink-0">SJ</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Sarah Jenkins</h4>
                      <p className="text-[9px] text-on-surface-variant font-mono">🔥 38 Days Streak</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-300 font-mono">915 XP</span>
                  </div>
                </div>

                {/* Rank 3 */}
                <div 
                  onClick={() => setSelectedProfile(mockLeaderboardProfiles["Clara Lin"])}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-7 h-7 rounded-full bg-amber-600/20 text-amber-600 font-mono font-bold flex items-center justify-center border border-amber-600/30 text-xs shrink-0">3</div>
                    <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs select-none shrink-0">CL</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Clara Lin</h4>
                      <p className="text-[9px] text-on-surface-variant font-mono">🔥 35 Days Streak</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-amber-600 font-mono">890 XP</span>
                  </div>
                </div>

                {/* Rank 4: Current User */}
                <div 
                  onClick={handleOpenCurrentUserProfile}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#2563eb]/10 border-2 border-primary/40 group relative shadow-[0_0_15px_rgba(37,99,235,0.1)] cursor-pointer"
                >
                  <div className="absolute -top-2.5 -right-2 bg-[#2563eb] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">You</div>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-mono font-bold flex items-center justify-center border border-primary/30 text-xs shrink-0">4</div>
                    <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center font-bold text-xs select-none text-primary shrink-0">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{userName} (You)</h4>
                      <p className="text-[9px] text-primary font-bold font-mono">🔥 15 Days Streak</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-primary font-mono">750 XP</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => alert("Simulation: Full standings page is coming soon!")}
                className="w-full mt-6 py-2.5 rounded-xl btn-secondary font-semibold text-xs border-none"
              >
                View Full Standings
              </button>
            </section>
            
            {/* Badges */}
            <section className="glass-panel rounded-2xl p-6 text-left">
              <h2 className="text-headline-md text-base md:text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
                <span className="material-symbols-outlined text-amber-500">local_fire_department</span>
                My Badges (4)
              </h2>
              
              <div className="grid grid-cols-4 gap-3 py-2">
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 text-center group relative cursor-pointer">
                  <span className="text-2xl mb-1 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">🔥</span>
                  <span className="text-[9px] text-on-surface-variant font-mono">15-Day</span>
                  <div className="absolute bottom-12 w-32 p-2 rounded bg-[#09090b]/95 border border-white/10 text-[9px] text-on-surface-variant hidden group-hover:block z-50 shadow-xl leading-relaxed text-center">
                    Maintained practice streak for 15 days!
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 text-center group relative cursor-pointer">
                  <span className="text-2xl mb-1 filter drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]">💻</span>
                  <span className="text-[9px] text-on-surface-variant font-mono">Systems</span>
                  <div className="absolute bottom-12 w-32 p-2 rounded bg-[#09090b]/95 border border-white/10 text-[9px] text-on-surface-variant hidden group-hover:block z-50 shadow-xl leading-relaxed text-center">
                    Scored 90%+ on NoSQL System design database mocks.
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 text-center group relative cursor-pointer">
                  <span className="text-2xl mb-1 filter drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">📝</span>
                  <span className="text-[9px] text-on-surface-variant font-mono">ATS 85+</span>
                  <div className="absolute bottom-12 w-32 p-2 rounded bg-[#09090b]/95 border border-white/10 text-[9px] text-on-surface-variant hidden group-hover:block z-50 shadow-xl leading-relaxed text-center">
                    Resume analyzer score exceeds 85%.
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 text-center group relative cursor-pointer opacity-40 hover:opacity-100 transition-opacity">
                  <span className="text-2xl mb-1 filter grayscale">🏅</span>
                  <span className="text-[9px] text-on-surface-variant font-mono">Staff</span>
                  <div className="absolute bottom-12 w-32 p-2 rounded bg-[#09090b]/95 border border-white/10 text-[9px] text-on-surface-variant hidden group-hover:block z-50 shadow-xl leading-relaxed text-center">
                    Complete staff-level simulation (L6). Unlocks soon!
                  </div>
                </div>
              </div>
            </section>

            {/* Premium Slots Card */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-transparent to-[#ddb7ff]/10 flex flex-col justify-between h-48 relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <span className="text-[9px] bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest font-mono select-none">
                  Premium Perk
                </span>
                <h3 className="text-white font-semibold text-sm md:text-body-md mt-2">
                  Book Mock Sessions with Top Leaderboard Performers
                </h3>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Review strategies, double streak milestones, and exchange coding answers.
              </p>
              <button 
                onClick={() => navigate('/billing#bookings')}
                className="glow-button w-full py-2.5 text-white font-bold text-xs flex items-center justify-center gap-1.5 border-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                Unlock Premium Slots
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Share Experience Modal (Hidden by default) */}
      <div 
        className={`fixed inset-0 bg-[#09090b]/80 backdrop-blur-md items-center justify-center z-[100] transition-all duration-300 ${
          isModalOpen ? 'flex opacity-100' : 'hidden opacity-0 pointer-events-none'
        }`}
      >
        <div className="glass-panel rounded-2xl w-full max-w-lg p-6 mx-4 border border-white/10 text-left">
          <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
            <h3 className="text-white font-semibold text-body-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">rate_review</span>
              Share Interview Experience
            </h3>
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="material-symbols-outlined text-on-surface-variant hover:text-white cursor-pointer border-none bg-transparent p-0"
            >
              close
            </button>
          </div>
          
          <form className="space-y-4" onSubmit={handleCreatePost}>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">Company & Job Title</label>
              <input 
                required 
                type="text" 
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Google - Senior Backend Architect" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">Category</label>
                <select 
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="System Design">System Design</option>
                  <option value="Coding Algorithms">Coding Algorithms</option>
                  <option value="STAR Behavioral">STAR Behavioral</option>
                  <option value="HR Screener">HR Screener</option>
                  <option value="Frontend Architecture">Frontend Architecture</option>
                  <option value="Object-Oriented Design">Object-Oriented Design (OOD)</option>
                  <option value="DevOps &amp; Infrastructure">DevOps &amp; Infrastructure</option>
                  <option value="Machine Learning / AI">Machine Learning / AI</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">XP Points Awarded</label>
                <input 
                  readOnly 
                  value="+50 XP for sharing" 
                  className="w-full bg-white/5 border border-white/5 text-[#ddb7ff] font-bold rounded-xl px-4 py-2.5 text-xs font-mono text-center select-none focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">Description & Solutions</label>
              <textarea 
                required 
                rows="4" 
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="Detail the questions you faced and how you successfully partitioned/answered..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary resize-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">Optional Code Snippet</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <select 
                  value={modalLanguage} 
                  onChange={(e) => setModalLanguage(e.target.value)}
                  className="col-span-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white cursor-pointer"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
              <textarea 
                rows="3" 
                value={modalCode}
                onChange={(e) => setModalCode(e.target.value)}
                placeholder="Paste code snippet here..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-primary resize-none"
              ></textarea>
            </div>
            
            {/* Anonymity Toggle */}
            <div className="flex items-center gap-2 py-2 select-none">
              <input 
                type="checkbox" 
                id="post-anonymous-toggle"
                checked={postAnonymous}
                onChange={(e) => setPostAnonymous(e.target.checked)}
                className="bg-black/40 border border-white/10 rounded focus:ring-0 focus:ring-offset-0 text-primary cursor-pointer w-4 h-4"
              />
              <label htmlFor="post-anonymous-toggle" className="text-xs text-on-surface-variant cursor-pointer font-medium">
                Post Anonymously (Hide my name, keep verified tags)
              </label>
            </div>

            <button 
              type="submit" 
              className="w-full py-3.5 glow-button text-white font-bold text-xs border-none cursor-pointer"
            >
              Publish to Prep Hub
            </button>
          </form>
        </div>
      </div>

      {/* Leaderboard Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-left animate-fade-in">
          <div className="glass-panel rounded-3xl w-full max-w-lg p-6 border border-white/10 relative">
            <button 
              onClick={() => setSelectedProfile(null)}
              className="absolute right-4 top-4 material-symbols-outlined text-on-surface-variant hover:text-white cursor-pointer border-none bg-transparent p-0"
            >
              close
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-primary/20 border border-primary/35 flex items-center justify-center text-primary font-mono text-base font-bold select-none shrink-0 animate-pulse">
                {selectedProfile.initials}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {selectedProfile.name}
                  <span className="text-[10px] bg-amber-400/15 border border-amber-400/30 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                    Rank #{selectedProfile.rank}
                  </span>
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">{selectedProfile.title}</p>
                <div className="flex gap-3 text-[10px] font-mono text-primary mt-1.5">
                  <span>🔥 {selectedProfile.streak} Streak</span>
                  <span>🏆 {selectedProfile.xp}</span>
                </div>
              </div>
            </div>

            {/* Badges Section */}
            <div className="mb-5">
              <h4 className="text-[10px] font-mono text-outline uppercase tracking-wider mb-2">Earned Badges</h4>
              <div className="flex flex-wrap gap-2">
                {selectedProfile.badges.map((badge, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-on-surface-variant hover:bg-white/10 transition-colors group relative cursor-help"
                  >
                    <span>{badge.emoji}</span>
                    <span className="font-semibold text-white">{badge.name}</span>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-48 p-2 rounded bg-[#09090b]/98 border border-white/10 text-[9px] text-on-surface-variant hidden group-hover:block z-[200] shadow-2xl leading-normal text-center">
                      {badge.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferred Tech Stack */}
            <div className="mb-5">
              <h4 className="text-[10px] font-mono text-outline uppercase tracking-wider mb-2">Preferred Tech Stack</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedProfile.techStack.map((tech, idx) => (
                  <span key={idx} className="text-[10px] font-mono bg-primary/10 border border-primary/20 text-[#b4c5ff] px-2 py-0.5 rounded-lg">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* Shared Summaries */}
            <div className="mb-6">
              <h4 className="text-[10px] font-mono text-outline uppercase tracking-wider mb-2">Public Shared Experiences</h4>
              <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                {selectedProfile.summaries.map((sum, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-left">
                    <div className="flex justify-between items-center mb-1 text-[9px] font-mono">
                      <span className="font-bold text-white">{sum.company}</span>
                      <span className="text-primary font-semibold">{sum.role}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {sum.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Book Session CTA */}
            {selectedProfile.mentorKey ? (
              <button
                onClick={() => {
                  setSelectedProfile(null);
                  navigate('/billing#bookings', { state: { activeTab: 'bookings' } });
                }}
                className="w-full py-3 btn-primary text-white font-bold text-xs flex items-center justify-center gap-1 border-none cursor-pointer shadow-lg"
              >
                <span className="material-symbols-outlined text-base">calendar_today</span>
                Book Mock Session with {selectedProfile.name.split(' ')[0]}
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3 bg-white/5 border border-white/10 text-on-surface-variant/40 text-xs font-bold font-mono rounded-xl cursor-not-allowed text-center"
              >
                Your Public Profile Preview
              </button>
            )}

          </div>
        </div>
      )}

      <Footer />
      <Chatbot />
    </div>
  );
}
