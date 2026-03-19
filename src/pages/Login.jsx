import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 1. IMPORT ALL ASSETS
import lpLogo from '../assets/launchpad.png';
import slide1 from '../assets/lpc2.jpg';
import slide2 from '../assets/lpc3.jpg';
import slide3 from '../assets/lpc4.jpg';
import slide4 from '../assets/lpc5.jpg';

// Put images in an array for the slideshow
const images = [slide1, slide2, slide3, slide4];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // SLIDESHOW STATE
  const [currentImage, setCurrentImage] = useState(0);
  const navigate = useNavigate();

  // 2. AUTOMATIC SLIDESHOW EFFECT (Changes every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prevImage) => (prevImage + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer); // Cleanup when component unmounts
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Invalid email or password');

      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.user.role); 
      localStorage.setItem('userName', data.user.name); 

      if (data.user.role === 'client') {
        navigate('/client-dashboard'); 
      } else {
        navigate('/dashboard'); 
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans">
      
      {/* ========================================== */}
      {/* LEFT SIDE: SLIDESHOW & INFORMATION HERO    */}
      {/* ========================================== */}
      <div className="relative hidden w-full lg:flex lg:w-3/5 bg-slate-900 overflow-hidden">
        
        {/* CROSSFADING IMAGES */}
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentImage ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ))}

        {/* DARK OVERLAY BLEND (Makes text readable over any image) */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/20" />

        {/* LAUNCHPAD INFO CONTENT */}
        <div className="relative z-10 flex flex-col justify-end p-16 pb-24 h-full w-full">
          <img src={lpLogo} alt="Launchpad Logo" className="h-12 object-contain self-start mb-8 filter brightness-0 invert" />
          <h1 className="text-4xl font-black text-white leading-tight mb-4 tracking-tight">
            Virtual Office Management
          </h1>
          <p className="text-lg text-slate-300 max-w-xl leading-relaxed">
            Welcome to the Launchpad Coworking management system. Easily register clients, track payments, and issue secure official receipts across all our branches.
          </p>
          
          {/* Slideshow Indicators */}
          <div className="flex gap-2 mt-8">
            {images.map((_, index) => (
              <div 
                key={index} 
                className={`h-1.5 rounded-full transition-all duration-500 ${index === currentImage ? 'w-8 bg-[#d2f34c]' : 'w-2 bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* RIGHT SIDE: LOGIN FORM                     */}
      {/* ========================================== */}
      <div className="flex w-full items-center justify-center lg:w-2/5 p-8 lg:p-12 xl:p-24 shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 relative bg-white">
        <div className="w-full max-w-md">
          
          {/* Form Header */}
          <div className="mb-10 text-center lg:text-left">
            <img src={lpLogo} alt="Launchpad VO" className="h-12 object-contain mx-auto lg:mx-0 mb-6" />
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 mt-2 font-medium">Please sign in to access the system.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3.5 text-slate-700 transition-colors focus:border-[#b8d839] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50 bg-slate-50 focus:bg-white font-medium"
                placeholder="admin@launchpad.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="block text-sm font-bold text-slate-700">Password</label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3.5 text-slate-700 transition-colors focus:border-[#b8d839] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50 bg-slate-50 focus:bg-white font-medium"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-100 flex items-start gap-2">
                <span className="text-lg leading-none">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#d2f34c] px-4 py-4 font-black text-slate-900 transition-all hover:bg-[#b8d839] hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#d2f34c]/30 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none mt-2"
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
      
    </div>
  );
}