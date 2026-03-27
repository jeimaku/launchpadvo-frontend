import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ClientDashboard() {
  const navigate = useNavigate();
  
  // Grab the client's name that we saved during login!
  const userName = localStorage.getItem('userName') || 'Client';

  // State to handle the file upload process
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage(''); // Clear any previous messages when a new file is picked
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setMessage('⚠️ Please select a file first.');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      // 1. This MUST say 'file' to perfectly match upload.single('file') on the backend
      formData.append('file', file); 
      
      // 2. We must send the document type so the backend can name the file correctly
      formData.append('document_type', 'Business Permit'); 

      const response = await fetch('http://192.168.200.15:5000/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Remember: Do NOT set Content-Type manually for FormData
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document. Check backend terminal.');
      }

      setMessage('✅ Document securely uploaded to Launchpad!');
      setFile(null); // Clear the file selection

    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      {/* Simple Client Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6 shadow-xl hidden md:flex md:flex-col h-screen sticky top-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d2f34c]">
            <span className="text-xl font-black text-slate-900">L</span>
          </div>
          <h1 className="text-xl font-bold">Client Portal</h1>
        </div>
        <nav className="space-y-4 text-sm font-semibold text-slate-400 flex-1">
          <p className="block px-4 py-2 rounded-lg bg-[#d2f34c]/10 text-[#d2f34c]">📁 My Documents</p>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-800">Welcome, {userName}! 👋</h2>
          <button 
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </header>

        {/* Upload Card */}
        <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 max-w-2xl">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">Upload Requirements</h3>
            <p className="text-sm text-slate-500">Securely submit your Business Permit or valid ID.</p>
          </div>

          <form onSubmit={handleUpload} className="space-y-6">
            
            {/* File Input */}
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-10 h-10 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-400">PDF, PNG, or JPG (MAX. 5MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </label>
            </div>

            {/* Display Selected File Name */}
            {file && (
              <p className="text-sm font-semibold text-slate-700 text-center">
                Selected file: <span className="text-blue-600">{file.name}</span>
              </p>
            )}

            {/* Upload Message */}
            {message && (
              <div className={`p-4 rounded-lg text-sm font-bold text-center ${message.includes('❌') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full rounded-lg bg-[#d2f34c] px-6 py-3 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading to Drive...' : 'Upload Document'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}