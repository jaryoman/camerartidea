import React, { useState, useRef, useEffect } from 'react';
import ApiKeyChecker from './components/ApiKeyChecker';
import ScenarioView from './components/ScenarioView';
import { generateAdScenario, generateSingleImage } from './services/gemini';
import { AdScenario, GeneratedImage, AppState } from './types';

function App() {
  const [keyValid, setKeyValid] = useState(false);
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [scenario, setScenario] = useState<AdScenario | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  
  // Changed to array to support multiple images
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>("");
  
  // State for image viewer modal
  const [viewImage, setViewImage] = useState<GeneratedImage | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queue processing ref
  const processingRef = useRef(false);

  const processFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    
    if (files.length > 10) {
      setError("최대 10장까지만 업로드 가능합니다.");
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError("유효하지 않은 파일입니다. 이미지 파일만 업로드해주세요.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} 파일이 너무 큽니다. 이미지당 최대 5MB까지 가능합니다.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setError(null);
    
    // Read all files
    const readers = validFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) resolve(reader.result as string);
          else reject("파일 읽기 실패");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then(results => {
        setReferenceImages(results);
      })
      .catch(err => {
        console.error(err);
        setError("파일을 읽는 중 오류가 발생했습니다.");
      });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(event.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (state === AppState.IDLE) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (state !== AppState.IDLE) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const startProcess = async () => {
    if (referenceImages.length === 0) return;

    try {
      setState(AppState.ANALYZING);
      setError(null);
      
      // Remove data URL prefix for API for all images
      const base64DataArray = referenceImages.map(img => img.split(',')[1]);
      
      const scenarioData = await generateAdScenario(base64DataArray, userPrompt);
      setScenario(scenarioData);
      
      // Initialize image placeholders
      const initialImages: GeneratedImage[] = scenarioData.imagePrompts.map((prompt, index) => ({
        id: `img-${index}-${Date.now()}`,
        prompt,
        url: null,
        status: 'pending'
      }));
      setImages(initialImages);
      
      setState(AppState.GENERATING_IMAGES);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "이미지 분석에 실패했습니다.");
      setState(AppState.ERROR);
    }
  };

  // Image Generation Queue Effect
  useEffect(() => {
    if (state !== AppState.GENERATING_IMAGES || processingRef.current) return;

    const processQueue = async () => {
      processingRef.current = true;
      const batchSize = 3; // Generate 3 at a time to be polite to the API
      
      // Find pending images
      let pendingIndices = images
        .map((img, idx) => (img.status === 'pending' ? idx : -1))
        .filter(idx => idx !== -1);

      if (pendingIndices.length === 0) {
        setState(AppState.COMPLETE);
        processingRef.current = false;
        return;
      }

      // Take a batch
      const batchIndices = pendingIndices.slice(0, batchSize);

      // Set them to generating
      setImages(prev => prev.map((img, idx) => 
        batchIndices.includes(idx) ? { ...img, status: 'generating' } : img
      ));

      try {
        await Promise.all(
          batchIndices.map(async (idx) => {
            try {
              const url = await generateSingleImage(images[idx].prompt);
              setImages(prev => prev.map((img, i) => 
                i === idx ? { ...img, url, status: 'completed' } : img
              ));
            } catch (e) {
              setImages(prev => prev.map((img, i) => 
                i === idx ? { ...img, status: 'failed' } : img
              ));
            }
          })
        );
      } finally {
        processingRef.current = false;
      }
    };

    processQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, state]);

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `nano-banana-pro-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetry = (id: string) => {
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        return { ...img, status: 'pending' };
      }
      return img;
    }));
    
    // Ensure the state is GENERATING_IMAGES so the effect picks it up
    if (state === AppState.COMPLETE || state === AppState.ERROR) {
      setState(AppState.GENERATING_IMAGES);
    }
  };

  const handleRetryAll = () => {
    setImages(prev => prev.map(img => {
      if (img.status === 'failed') {
        return { ...img, status: 'pending' };
      }
      return img;
    }));

    if (state === AppState.COMPLETE || state === AppState.ERROR) {
      setState(AppState.GENERATING_IMAGES);
    }
  };

  const pendingCount = images.filter(i => i.status === 'pending').length;
  const completedCount = images.filter(i => i.status === 'completed').length;
  const failedCount = images.filter(i => i.status === 'failed').length;
  const progress = images.length > 0 ? (completedCount / images.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white selection:bg-yellow-500/30">
      <ApiKeyChecker onKeyValid={() => setKeyValid(true)} />
      
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-black text-xs">NB</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Nano Banana <span className="text-yellow-400 font-light">Pro Builder</span></h1>
          </div>
          <div className="text-xs font-mono text-gray-500">
             Gemini 3 Pro Powered
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Intro / Upload Section */}
        <div className={`transition-all duration-500 ${state !== AppState.IDLE ? 'mb-12' : 'min-h-[60vh] flex flex-col justify-center'}`}>
          
          {state === AppState.IDLE && (
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
                카메라트 <span className="text-yellow-400">아이디어 박스</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                최대 10장의 제품 이미지를 업로드하고 비전을 설명하세요. 바이럴 전략을 수립하고 4K 마케팅 비주얼을 생성해 드립니다.
              </p>
            </div>
          )}

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              bg-zinc-900/50 border-2 border-dashed rounded-3xl p-8 transition-all duration-200 text-center relative overflow-hidden group
              ${isDragging ? 'border-yellow-400 bg-zinc-800/80 scale-[1.02] shadow-xl shadow-yellow-400/10' : ''}
              ${!isDragging && referenceImages.length > 0 ? 'border-yellow-500/50 bg-zinc-900' : ''}
              ${!isDragging && referenceImages.length === 0 ? 'border-zinc-800 hover:border-zinc-700' : ''}
            `}
          >
             <input
                type="file"
                accept="image/*"
                multiple // Allow multiple file selection
                onChange={handleImageUpload}
                ref={fileInputRef}
                disabled={state !== AppState.IDLE}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
              />
              
              {referenceImages.length > 0 ? (
                <div className="relative z-30 flex flex-col items-center justify-center gap-6">
                  
                  {/* Grid for multiple images */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full max-w-4xl">
                    {referenceImages.map((src, index) => (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden shadow-xl border border-white/10 group-hover:border-yellow-500/30 transition-colors">
                        <img src={src} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>

                  {state === AppState.IDLE && (
                    <div className="w-full max-w-2xl space-y-4">
                       <h3 className="text-xl font-bold text-white">{referenceImages.length}개의 이미지 선택됨</h3>
                       
                       <div className="text-left">
                        <label className="block text-sm font-medium text-gray-400 mb-2">캠페인 비전 / 프롬프트 (선택사항)</label>
                        <textarea
                          value={userPrompt}
                          onChange={(e) => setUserPrompt(e.target.value)}
                          placeholder="예: 네온 사인이 가득한 사이버펑크 스타일을 원해요, 또는 미니멀한 북유럽 감성으로..."
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all resize-none h-24 relative z-40"
                          onClick={(e) => e.stopPropagation()} // Prevent triggering file input
                        />
                       </div>

                       <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                         <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent re-triggering file input
                            startProcess();
                          }}
                          className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-transform transform hover:scale-105 shadow-lg shadow-yellow-400/20"
                         >
                           30개 자산 생성 (4K)
                         </button>
                         <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setReferenceImages([]);
                            setUserPrompt("");
                            if(fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                         >
                           초기화 & 변경
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 z-10 pointer-events-none">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform duration-300 ${isDragging ? 'scale-110 bg-yellow-400/20 text-yellow-400' : 'bg-zinc-800 text-gray-400 group-hover:scale-110'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className={`text-xl font-medium mb-2 transition-colors ${isDragging ? 'text-yellow-400' : 'text-white'}`}>
                    {isDragging ? '이미지를 여기에 놓으세요' : '최대 10장의 제품 이미지를 드래그하세요'}
                  </p>
                  <p className="text-sm text-gray-500">PNG, JPG 지원 (각 최대 5MB)</p>
                </div>
              )}
          </div>
        </div>

        {/* Status & Errors */}
        {error && (
           <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-center animate-fade-in">
             {error}
           </div>
        )}

        {/* Loading State for Analysis */}
        {state === AppState.ANALYZING && (
          <div className="text-center py-20">
             <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-6"></div>
             <h3 className="text-2xl font-bold text-white mb-2">제품 DNA 분석 중...</h3>
             <p className="text-gray-400">Gemini 3 Pro가 캠페인 시나리오를 작성하고 있습니다.</p>
          </div>
        )}

        {/* Results Area */}
        {(state === AppState.GENERATING_IMAGES || state === AppState.COMPLETE) && scenario && (
          <div className="animate-fade-in-up">
            <ScenarioView scenario={scenario} />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">생성된 자산 <span className="text-gray-500 text-lg font-normal ml-2">({completedCount} / 30)</span></h2>
                {failedCount > 0 && (
                  <button
                    onClick={handleRetryAll}
                    className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    실패한 작업 모두 재시도 ({failedCount})
                  </button>
                )}
              </div>
              {state === AppState.GENERATING_IMAGES && (
                 <div className="flex items-center gap-3">
                   <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                   </div>
                   <span className="text-sm text-yellow-400 animate-pulse">생성 중...</span>
                 </div>
              )}
            </div>

            {/* Grid updated to 16:9 aspect ratio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-yellow-500/50 transition-colors">
                  {img.status === 'completed' && img.url ? (
                    <>
                      <img src={img.url} alt="Generated Asset" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                         <p className="text-xs text-gray-300 line-clamp-3 mb-3 max-w-[80%]">{img.prompt}</p>
                         <div className="flex gap-2">
                           <button 
                             onClick={() => setViewImage(img)}
                             className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white transition-colors"
                             title="크게 보기"
                           >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                           </button>
                           <button 
                             onClick={() => img.url && downloadImage(img.url, img.id)}
                             className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
                           >
                             <span>다운로드</span>
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           </button>
                         </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                       {img.status === 'failed' ? (
                         <div className="flex flex-col items-center gap-3 animate-fade-in">
                           <span className="text-red-400 text-xs">생성 실패</span>
                           <button
                             onClick={() => handleRetry(img.id)}
                             className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
                           >
                             <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                             </svg>
                             재시도
                           </button>
                         </div>
                       ) : img.status === 'generating' ? (
                         <>
                           <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                           <span className="text-xs text-yellow-400">4K 렌더링 중...</span>
                         </>
                       ) : (
                         <span className="text-xs text-zinc-600">대기 중...</span>
                       )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {state === AppState.COMPLETE && (
              <div className="mt-12 text-center">
                <button 
                  onClick={() => {
                    setImages([]);
                    setScenario(null);
                    setReferenceImages([]);
                    setUserPrompt("");
                    setState(AppState.IDLE);
                  }}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                >
                  새 캠페인 만들기
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in p-4" onClick={() => setViewImage(null)}>
          
          <button className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
      
          <div className="max-w-7xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video w-full max-h-[80vh] mb-6">
               <img src={viewImage.url!} alt="Full view" className="w-full h-full object-contain rounded-lg shadow-2xl shadow-yellow-500/10" />
            </div>
            
            <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 p-6 rounded-2xl max-w-3xl w-full">
               <p className="text-gray-300 text-sm mb-4 leading-relaxed">{viewImage.prompt}</p>
               <div className="flex justify-between items-center">
                   <span className="text-xs text-gray-500 font-mono">ID: {viewImage.id.split('-')[1]}</span>
                   <button 
                      onClick={() => downloadImage(viewImage.url!, viewImage.id)}
                      className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg transition-transform transform hover:scale-105 flex items-center gap-2"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      4K 다운로드
                   </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;