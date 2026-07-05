import { useState, useEffect, useRef } from 'react';

export default function Chatbot() {
  const [userName, setUserName] = useState("Alex");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: "bot", text: "Hi there! I am your 24/7 AI Doubt Tutor. Ask me any technical doubts, resume queries, or strategies for SDE, PM, Finance, and Consulting interviews!" }
  ]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Load username for personalized chatbot greetings
  useEffect(() => {
    const name = sessionStorage.getItem('userName');
    if (name) setUserName(name);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isBotTyping]);

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    
    // Append user message immediately
    const updatedMessages = [...chatMessages, { sender: "user", text: userMsg }];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsBotTyping(true);

    try {
      const userName = sessionStorage.getItem('userName') || '';
      const userDomain = sessionStorage.getItem('userDomain') || 'fullstack';
      const userExperience = sessionStorage.getItem('userExperience') || '';
      const userEducation = sessionStorage.getItem('userEducation') || '';
      const userTargetCompany = sessionStorage.getItem('userTargetCompany') || '';
      const userATS = sessionStorage.getItem('userATS') || '';
      const userMatch = sessionStorage.getItem('userMatch') || '';
      const userResume = sessionStorage.getItem('extractedResumeText') || '';
      
      const userProfile = {
        name: userName,
        domain: userDomain,
        experience: userExperience,
        education: userEducation,
        dreamCompany: userTargetCompany,
        atsScore: userATS,
        roleMatch: userMatch
      };
      
      // Limit history items to last 8 messages to prevent huge payloads
      const historyItems = chatMessages.slice(-8).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMsg,
          history: historyItems,
          domain: userDomain,
          resumeText: userResume,
          userProfile,
          email: sessionStorage.getItem('userEmail')
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to get chatbot response");
      }

      setChatMessages(prev => [...prev, { sender: "bot", text: data.answer }]);
    } catch (err) {
      console.error("Chatbot submission error:", err);
      const isLimitError = err.message.toLowerCase().includes("exclusive") || 
                           err.message.toLowerCase().includes("limit") || 
                           err.message.toLowerCase().includes("upgrade");
      
      if (isLimitError) {
        setChatMessages(prev => [...prev, { 
          sender: "bot", 
          text: err.message, 
          isBillingRedirect: true 
        }]);
        setIsBotTyping(false);
        return;
      }

      // Heuristic fallback response on frontend in case backend is completely offline
      let botResponse = "I'm having trouble connecting to my AI brain. But here's some advice: Focus on MECE structuring for consulting, Google XYZ metrics for resumes, and sharding/caching for SDE interviews!";
      const q = userMsg.toLowerCase();
      if (q.includes('redis') || q.includes('caching') || q.includes('sde') || q.includes('system design') || q.includes('coding')) {
        botResponse = "For SDE rounds, optimize for database writes using a hash partition strategy and caching layers like Redis.";
      } else if (q.includes('pm') || q.includes('product') || q.includes('metrics')) {
        botResponse = "For PM, structure answers around customer adoption, engagement, and retention metrics.";
      } else if (q.includes('finance') || q.includes('depreciation') || q.includes('valuation')) {
        botResponse = "For Finance, master the 3 statements: a $100 depreciation increase results in a -$60 Net Income and +$40 operating cash.";
      } else if (q.includes('consulting') || q.includes('case study') || q.includes('profitability')) {
        botResponse = "For Consulting, frame issues using Mutually Exclusive, Collectively Exhaustive (MECE) structures.";
      }
      setChatMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-3 z-50 font-body-md">
      {/* Floating Trigger Button */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="w-14 h-14 rounded-full bg-[#1E1B4B] text-white flex items-center justify-center shadow-lg shadow-black/40 hover:scale-105 active:scale-95 transition-all duration-300 border border-[#818CF8]/40 relative cursor-pointer"
      >
        <span className="material-symbols-outlined text-[26px]">school</span>
        {/* Notification badge dot */}
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#09090b] flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
        </span>
      </button>
 
      {/* Backdrop Backdrop blur for Fullscreen framed mode */}
      {isChatOpen && isChatFullscreen && (
        <div 
          onClick={() => { setIsChatOpen(false); setIsChatFullscreen(false); }} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] cursor-pointer animate-fade-in"
        />
      )}

      {/* Chat Drawer Window */}
      <div 
        className={`fixed border border-white/10 bg-[#09090b]/98 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ease-in-out z-50 ${
          isChatOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        } ${
          isChatFullscreen 
            ? 'bottom-[10vh] right-[4vw] md:right-[calc(50vw-400px)] w-[92vw] md:w-[800px] h-[80vh] rounded-3xl' 
            : 'bottom-[88px] right-[16px] w-[380px] h-[520px] rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-white/5 to-white/0 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary shadow-[0_0_10px_rgba(221,183,255,0.15)]">
              <span className="material-symbols-outlined text-lg">school</span>
            </div>
            <div className="text-left">
              <h3 className="text-xs font-bold text-white leading-none">AI Tutor</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Context Active</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Fullscreen Toggle */}
            <button 
              onClick={() => setIsChatFullscreen(!isChatFullscreen)} 
              className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white transition-colors cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined text-base">{isChatFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
            {/* Close Button */}
            <button 
              onClick={() => { setIsChatOpen(false); setIsChatFullscreen(false); }} 
              className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white transition-colors cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
 
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed text-left flex flex-col gap-2.5 ${msg.sender === 'user' ? 'bg-[#1E1B4B] border border-[#818CF8]/30 text-white rounded-tr-none' : 'bg-white/5 border border-white/5 text-on-surface rounded-tl-none'}`}>
                <span>{msg.text}</span>
                {msg.isBillingRedirect && (
                  <button
                    onClick={() => window.location.href = '/billing'}
                    className="mt-1 px-3 py-1.5 bg-[#818cf8] text-[#09090b] font-bold rounded-lg border-none hover:scale-105 active:scale-95 transition-transform cursor-pointer text-center"
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            </div>
          ))}
          {isBotTyping && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/5 text-on-surface max-w-[85%] rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
 
        {/* Input Area */}
        <div className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Ask a technical doubt or resume query..." 
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
          />
          <button 
            onClick={sendChatMessage}
            className="h-9 w-9 rounded-xl bg-[#1E1B4B] hover:bg-[#1E1B4B]/80 border border-[#818CF8]/30 text-white flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
