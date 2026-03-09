import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  // 1. State Variables to hold the typed data and UI status
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // The hook that lets us change pages
  const navigate = useNavigate();

  // 2. The function that runs when the user clicks "Sign In"
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevents the page from refreshing
    setError('');
    setIsLoading(true);

    try {
      // 3. Send the data to your Node.js backend
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // If the backend rejects the login, throw an error to show the user
      if (!response.ok) {
        throw new Error(data.message || 'Invalid email or password');
      }

      // 4. Success! Save the secure JWT ID badge AND the User details to the browser
      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.user.role); // Save the role!
      localStorage.setItem('userName', data.user.name); // Saving the name is handy for a "Welcome, Jay Mark!" message later

      // 5. The Traffic Cop: Teleport the user based on their role
      if (data.user.role === 'client') {
        navigate('/client-dashboard'); // Send clients to their private view
      } else {
        navigate('/dashboard'); // Send Admin and Staff to the main analytics view
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        
        {/* LOGO PLACEHOLDER */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#d2f34c] shadow-lg">
            <span className="text-3xl font-black text-slate-900">L</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">Launchpad VO</h2>
          <p className="text-sm text-slate-500">Sign in to your virtual workspace</p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Email Input */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50"
              placeholder="virtualoffice@launchpad.com"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50"
              placeholder="••••••••"
            />
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200 text-center">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#d2f34c] px-4 py-3 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] focus:outline-none focus:ring-4 focus:ring-[#d2f34c]/30 disabled:opacity-70"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}