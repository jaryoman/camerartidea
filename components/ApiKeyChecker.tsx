import React, { useState, useEffect } from 'react';

interface Props {
  onKeyValid: () => void;
}

export default function ApiKeyChecker({ onKeyValid }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1. 이미 저장된 키가 있는지 확인
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) {
      setIsVisible(false);
      onKeyValid();
    }
  }, [onKeyValid]);

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    
    // 2. 키를 저장하고 앱 시작
    // 'GOOG_'로 시작하지 않아도 일단 저장하도록 허용 (유연성)
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    setIsVisible(false);
    onKeyValid();
    
    // 3. 확실한 적용을 위해 페이지 새로고침 (gemini.ts가 키를 물고 다시 로드됨)
    window.location.reload(); 
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-yellow-500/10">
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">API 키 입력</h2>
          <p className="text-gray-400 text-sm">
            앱을 사용하려면 Google AI Studio의 API 키가 필요합니다.<br/>
            키는 브라우저에만 저장되며 서버로 전송되지 않습니다.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">GEMINI API KEY</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder-gray-600"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!apiKey}
            className={`w-full py-3.5 rounded-xl font-bold text-black transition-all transform active:scale-95 ${
              apiKey 
                ? 'bg-yellow-400 hover:bg-yellow-300 shadow-lg shadow-yellow-400/20' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            시작하기
          </button>

          <div className="text-center pt-2">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-yellow-400 underline transition-colors"
            >
              API 키가 없으신가요? 여기서 발급받기
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
