import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

export default function ContactPage() {
  const navigate = useNavigate();

  // Scroll to top smoothly when page loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitState, setSubmitState] = useState('idle'); // idle | sending | success

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitState('sending');
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/general/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      // Also trigger the mailto link to open the user's local email client prefilled
      const mailtoUrl = `mailto:darkphantom399@gmail.com?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(`Hi IntervFlow Team,\n\nName: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`)}`;
      window.location.href = mailtoUrl;

      setSubmitState('success');
      setTimeout(() => {
        setSubmitState('idle');
        setForm({ name: '', email: '', subject: '', message: '' });
      }, 3000);
    } catch (err) {
      console.error("Failed to submit contact request:", err);
      // Fallback: Still trigger the mailto redirect if backend connection fails
      const mailtoUrl = `mailto:darkphantom399@gmail.com?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(`Hi IntervFlow Team,\n\nName: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`)}`;
      window.location.href = mailtoUrl;

      setSubmitState('success');
      setTimeout(() => {
        setSubmitState('idle');
        setForm({ name: '', email: '', subject: '', message: '' });
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-[#e5e1e4] font-body-md antialiased">

      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 15% 15%, rgba(37,99,235,0.05) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(221,183,255,0.05) 0%, transparent 40%)'
        }}
      />

      {/* Reusable Header Navbar */}
      <Navbar activeTab="contact" />

      {/* ── Main Content ── */}
      <main className="flex-grow pt-36 pb-24 px-4 md:px-10 max-w-[1280px] mx-auto w-full flex flex-col gap-10">

        {/* Header */}
        <section className="max-w-3xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 shadow-[0_0_15px_rgba(37,99,235,0.15)]">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary uppercase tracking-wider font-bold font-mono">Get In Touch</span>
          </div>
          <h1 className="font-bold text-5xl md:text-6xl text-white leading-tight mb-6" style={{ textShadow: '0 0 30px rgba(37,99,235,0.2)' }}>
            Contact Us
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Have questions about IntervFlow? We're here to help. Reach out to our team for support, business inquiries, or direct feedback.
          </p>
        </section>

        {/* Content Grid */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

          {/* ── Left: Sidebar Info ── */}
          <div className="md:col-span-4 space-y-6">

            {/* Contact Methods */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-6 border border-white/10 bg-[#18181b]/40">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Contact Information</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Reach out to us directly through our dedicated support lines. We typically respond within 24 hours.
                </p>
              </div>

              <div className="space-y-4">
                {/* Technical Support */}
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5">
                  <div className="bg-white/5 p-2.5 rounded-lg shrink-0 group-hover:shadow-[0_0_15px_rgba(37,99,235,0.15)] border border-white/5 transition-all">
                    <span className="material-symbols-outlined text-primary">support_agent</span>
                  </div>
                  <div>
                    <h4 className="text-xs text-white font-bold">Technical Support</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">darkphantom399@gmail.com</p>
                  </div>
                </div>

                {/* Response Time */}
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5">
                  <div className="bg-white/5 p-2.5 rounded-lg shrink-0 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.15)] border border-white/5 transition-all">
                    <span className="material-symbols-outlined text-amber-400">schedule</span>
                  </div>
                  <div>
                    <h4 className="text-xs text-white font-bold">Response Time</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">Within 24 hours on business days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-xs text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2 font-mono font-bold">
                <span className="material-symbols-outlined text-base text-[#ddb7ff]">link</span>
                Quick Links
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'FAQs & Help Center', icon: 'help_outline', to: '/#faq' },
                  { label: 'Pricing Plans', icon: 'payments', to: '/#pricing' },
                  { label: 'Community Forum', icon: 'groups', to: '/dashboard' },
                ].map(({ label, icon, to }) => (
                  <Link
                    key={label}
                    to={to}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all text-on-surface-variant hover:text-white group"
                  >
                    <span className="material-symbols-outlined text-base text-primary group-hover:text-white transition-colors">{icon}</span>
                    <span className="text-xs">{label}</span>
                    <span className="material-symbols-outlined text-sm ml-auto opacity-40">arrow_forward</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Contact Form ── */}
          <div className="md:col-span-8">
            <div className="glass-panel rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 bg-[#18181b]/30">

              {submitState === 'success' ? (
                // Success State
                <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <span className="material-symbols-outlined text-emerald-400 text-4xl">check_circle</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
                      Thanks for reaching out. Our team will get back to you within 24 hours.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSubmitState('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="btn-secondary px-6 py-2.5 rounded-full text-xs font-bold"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                // Form
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="mb-2">
                    <h2 className="text-xl font-bold text-white">Send Us a Message</h2>
                    <p className="text-xs text-on-surface-variant mt-1">Fill in the form below and we'll respond promptly.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant tracking-widest uppercase font-mono font-bold block" htmlFor="name">Full Name</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">person</span>
                        <input
                          id="name" name="name" type="text" required
                          value={form.name} onChange={handleChange}
                          placeholder="John Doe"
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant tracking-widest uppercase font-mono font-bold block" htmlFor="email">Email Address</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">alternate_email</span>
                        <input
                          id="email" name="email" type="email" required
                          value={form.email} onChange={handleChange}
                          placeholder="johndoe@example.com"
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant tracking-widest uppercase font-mono font-bold block" htmlFor="subject">Subject</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">subject</span>
                      <input
                        id="subject" name="subject" type="text" required
                        value={form.subject} onChange={handleChange}
                        placeholder="How can we assist you?"
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  {/* Inquiry Type Chips */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant tracking-widest uppercase font-mono font-bold block">Inquiry Type</label>
                    <div className="flex flex-wrap gap-2">
                      {['Technical Support', 'Pricing & Plans', 'Enterprise', 'Feedback', 'Partnership', 'Other'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, subject: type }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                            form.subject === type
                              ? 'border-primary bg-primary/10 text-primary font-bold'
                              : 'border-white/10 bg-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant tracking-widest uppercase font-mono font-bold block" htmlFor="message">Your Message</label>
                    <textarea
                      id="message" name="message" rows={5} required
                      value={form.message} onChange={handleChange}
                      placeholder="How can we help you? Describe your question or feedback in detail..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20 resize-none h-36"
                    />
                    <p className="text-[10px] text-on-surface-variant/50 text-right font-mono">{form.message.length} / 1000</p>
                  </div>

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitState === 'sending'}
                      className={`w-full md:w-auto btn-primary px-8 py-4 rounded-full font-bold text-xs text-white shadow-xl flex items-center justify-center gap-2 transition-all ${submitState === 'sending' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {submitState === 'sending' ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          Sending Message...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">send</span>
                          Send Message
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* 24/7 Context-Aware AI Chatbot Floating Drawer */}
      <Chatbot />
    </div>
  );
}