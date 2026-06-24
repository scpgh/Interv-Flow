import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(129,140,248,0.15) 0%, transparent 60%), #09090b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        padding: '2rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-120px', left: '-120px',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', right: '-100px',
        width: '350px', height: '350px',
        background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: '88px', height: '88px',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '2rem',
        boxShadow: '0 0 40px rgba(251,191,36,0.1)',
        animation: 'pulse 2.5s ease-in-out infinite',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: '#fbbf24' }}>
          build_circle
        </span>
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: '-0.03em',
        margin: '0 0 0.75rem',
        lineHeight: 1.15,
      }}>
        Under Maintenance{dots}
      </h1>

      {/* Subtext */}
      <p style={{
        fontSize: '1rem',
        color: 'rgba(255,255,255,0.45)',
        maxWidth: '480px',
        lineHeight: 1.7,
        margin: '0 0 2.5rem',
      }}>
        IntervFlow is currently undergoing scheduled maintenance to bring you a better experience.
        We'll be back shortly — no action is required on your end.
      </p>

      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: '999px',
        padding: '8px 18px',
        fontSize: '0.75rem',
        color: '#fbbf24',
        fontWeight: '600',
        letterSpacing: '0.04em',
        marginBottom: '2.5rem',
      }}>
        <span style={{
          width: '7px', height: '7px',
          background: '#fbbf24',
          borderRadius: '50%',
          boxShadow: '0 0 8px #fbbf24',
          display: 'inline-block',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        SYSTEM MAINTENANCE IN PROGRESS
      </div>

      {/* Footer note */}
      <p style={{
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.2)',
        marginTop: 'auto',
        paddingTop: '3rem',
      }}>
        IntervFlow · Administrators can still access the platform
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
