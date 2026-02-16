import React, { useEffect, useState } from 'react';
import { checkApiKey, promptForApiKey } from '../services/gemini';

interface ApiKeyCheckerProps {
  onKeyValid: () => void;
}

const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onKeyValid }) => {
  const [hasKey, setHasKey] = useState(false);
  const [checking, setChecking] = useState(true);

  const verifyKey = async () => {
    try {
      const valid = await checkApiKey();
      setHasKey(valid);
      if (valid) {
        onKeyValid();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    verifyKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectKey = async () => {
    await promptForApiKey();
    // Re-check after dialog interaction
    await verifyKey();
  };

  if (checking) return null;

  if (hasKey) return null; // Invisible if key exists

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-yellow-500/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl shadow-yellow-500/10">
        <div className="mb-6 flex justify-center">
           <svg className="w-16 h-16 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 11 9 13.536 9 15m-3-1v1m0 0v1m0-1h1m-1-1H3m14-4l-3.5 3.5M21 5a2 2 0 11-4 0 2 2 0 014 0z" />
           </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">API 키 필요</h2>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          <strong>Nano Banana Pro</strong> (Gemini 3 Pro)를 사용하려면 유료 Google Cloud 프로젝트와 연결된 유효한 API 키를 선택해야 합니다.
        </p>
        <button
          onClick={handleSelectKey}
          className="w-full py-3 px-6 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-95"
        >
          API 키 선택
        </button>
        <div className="mt-4 text-xs text-gray-500">
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noreferrer"
            className="underline hover:text-yellow-400 transition-colors"
          >
            결제 관련 도움말 더보기
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyChecker;