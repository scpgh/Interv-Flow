import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    sessionStorage.clear();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      // 1. Sign in with Firebase client SDK
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // 2. Verify with backend API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid email or password.");
      }
      
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('userEmail', data.user.email);
      sessionStorage.setItem('userName', data.user.name);
      sessionStorage.setItem('userDomain', data.user.domain);
      sessionStorage.setItem('onboardingCompleted', String(data.user.onboardingCompleted));
      
      if (data.user.onboardingCompleted) {
        sessionStorage.setItem('userExperience', data.user.experienceYears || '');
        sessionStorage.setItem('userEducation', data.user.highestEducation || '');
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      let friendlyMessage = err.message || "Failed to sign in. Please verify your credentials.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === 'auth/operation-not-allowed') {
        friendlyMessage = "Email/Password sign-in is disabled in Firebase Console. Please enable 'Email/Password' under Build > Authentication > Sign-in method.";
      }
      setErrorMsg(friendlyMessage);
      console.error("Login error:", err);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    try {
      // 1. Sign in with Google Pop-up via Firebase SDK
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // 2. Send ID Token to backend verification endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Google Sign In failed.");
      }

      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('userEmail', data.user.email);
      sessionStorage.setItem('userName', data.user.name);
      sessionStorage.setItem('userDomain', data.user.domain);
      sessionStorage.setItem('onboardingCompleted', String(data.user.onboardingCompleted));
      
      if (data.user.onboardingCompleted) {
        sessionStorage.setItem('userExperience', data.user.experienceYears || '');
        sessionStorage.setItem('userEducation', data.user.highestEducation || '');
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed Google login.");
      console.error("Google authentication failed:", err);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col bg-radial-gradient font-body-md overflow-x-hidden">
      {/* Main Content Area - Centered Login */}
      <main className="flex-grow flex items-center justify-center p-margin-mobile md:p-margin-desktop relative z-10">
        {/* Abstract atmospheric background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[80px]"></div>
        </div>

        <div className="glass-panel w-full max-w-md rounded-xl p-8 md:p-10 relative z-10 flex flex-col gap-8">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 flex items-start gap-2.5 text-left">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {/* Header Section */}
          <div className="text-center space-y-2">
            <div className="flex flex-col items-center gap-3">
              <Link to="/">
                <img 
                  src="/intervflow_logo.png" 
                  alt="IntervFlow Logo" 
                  className="h-16 w-16 object-contain filter drop-shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer" 
                />
              </Link>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">IntervFlow</h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">Sign in to continue your preparation.</p>
          </div>

          {/* Google SSO Button */}
          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-surface-container/50 hover:bg-surface-container border border-outline-variant hover:border-outline text-on-surface py-3 px-4 rounded-lg transition-all duration-200 group cursor-pointer"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              <span className="font-label-md text-label-md">Continue with Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px bg-outline-variant flex-grow"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">or</span>
            <div className="h-px bg-outline-variant flex-grow"></div>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5 text-left">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="email">Email address</label>
                <div className="relative input-glow rounded-lg transition-all duration-200 border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>mail</span>
                  <input 
                    className="w-full bg-transparent text-on-surface font-body-md text-body-md pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/50" 
                    id="email" 
                    placeholder="name@company.com" 
                    required 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="password">Password</label>
                  <Link className="font-label-sm text-label-sm text-primary hover:text-[#b4c5ff] transition-colors" to="/signup">Forgot password?</Link>
                </div>
                <div className="relative input-glow rounded-lg transition-all duration-200 border border-outline-variant bg-black/20 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant pointer-events-none text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>lock</span>
                  <input 
                    className="w-full bg-transparent text-on-surface font-body-md text-body-md pl-10 pr-10 py-3 rounded-lg focus:outline-none focus:ring-0 border-none placeholder-on-surface-variant/50" 
                    id="password" 
                    placeholder="••••••••" 
                    required 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    className="absolute right-3 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none cursor-pointer" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button className="w-full bg-[#1E1B4B] hover:bg-[#1E1B4B]/80 text-[#818CF8] hover:text-[#b4c5ff] border border-[#818cf8]/20 hover:border-[#818cf8]/40 transition-all duration-200 rounded-lg py-3 px-4 flex items-center justify-center gap-2 cursor-pointer font-semibold group" type="submit">
              <span className="font-label-md text-label-md">Sign In</span>
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_forward</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Don't have an account? <Link className="text-primary hover:text-[#b4c5ff] transition-colors underline decoration-primary/30 hover:decoration-primary underline-offset-4" to="/signup">Sign up</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
