import React, { useState, useRef } from 'react';
import { Hourglass, History, Quote, UserCheck, Wand2, Upload, X, Sparkles, MessageSquare, Copy, Check } from 'lucide-react';
import InputSection from './components/InputSection';
import VariationCard from './components/VariationCard';
import VariationCarousel from './components/VariationCarousel';
import { generateVariations, editVariationImage } from './services/geminiService';
import { Variation, LoadingState, GenerationMode } from './types';

function App() {
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [captionSuggestion, setCaptionSuggestion] = useState('');
  const [originalPhrase, setOriginalPhrase] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<GenerationMode>('chronological');

  // New state to control InputSection from here
  const [forcedInputImage, setForcedInputImage] = useState<string | null>(null);
  const [forcedInputMode, setForcedInputMode] = useState<GenerationMode | undefined>(undefined);

  // Avatar Editing State
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarEditPrompt, setAvatarEditPrompt] = useState("");
  const [avatarEditRefImage, setAvatarEditRefImage] = useState<string | null>(null);
  const [isRegeneratingAvatar, setIsRegeneratingAvatar] = useState(false);
  const avatarEditFileRef = useRef<HTMLInputElement>(null);

  // Caption Editing State
  const [captionCopied, setCaptionCopied] = useState(false);

  const handleGenerate = async (phrase: string, mode: GenerationMode, image?: string, environment?: string, count?: number) => {
    setStatus(LoadingState.LOADING);
    setOriginalPhrase(phrase);
    setOriginalImage(image || null);
    setVariations([]); // Clear previous
    setCaptionSuggestion('');
    setCurrentMode(mode);
    
    // Reset Avatar Edit State
    setIsEditingAvatar(false);
    setAvatarEditPrompt("");
    setAvatarEditRefImage(null);

    // Reset forced props so they don't stick
    setForcedInputMode(undefined);
    setForcedInputImage(null);

    try {
      const result = await generateVariations(phrase, mode, image, environment, count);
      setVariations(result.variations);
      if (result.captionSuggestion) {
          setCaptionSuggestion(result.captionSuggestion);
      }
      setStatus(LoadingState.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(LoadingState.ERROR);
    }
  };

  const handleUpdateVariation = (index: number, updatedVariation: Variation) => {
    setVariations(prev => {
        const newVariations = [...prev];
        const foundIndex = newVariations.findIndex(v => v.level === updatedVariation.level);
        if (foundIndex !== -1) {
            newVariations[foundIndex] = updatedVariation;
        }
        return newVariations;
    });
  };

  const handleUseAvatarAsReference = () => {
      const avatarImage = variations[0]?.imageBase64;
      if (avatarImage) {
          // Send image back to InputSection
          setForcedInputImage(avatarImage);
          // Switch mode to Chronological (default next step)
          setForcedInputMode('chronological');
          // Clear current results to prompt user to generate new stuff
          setVariations([]);
          setCaptionSuggestion('');
          setStatus(LoadingState.IDLE);
          setIsEditingAvatar(false);
          // Scroll up
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const handleCopyCaption = () => {
      navigator.clipboard.writeText(captionSuggestion);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
  };

  // --- AVATAR EDITING HANDLERS ---

  const handleAvatarEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarEditRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegenerateAvatar = async () => {
      if (!avatarEditPrompt.trim() || !variations[0]?.imageBase64) return;

      setIsRegeneratingAvatar(true);
      try {
          const newImage = await editVariationImage(
              variations[0].imageBase64,
              avatarEditPrompt,
              0, // Avatar level is 0
              "Avatar Base",
              avatarEditRefImage || undefined
          );

          if (newImage) {
              setVariations(prev => [{ ...prev[0], imageBase64: newImage }]);
              // Reset edit fields on success
              setAvatarEditPrompt("");
              setAvatarEditRefImage(null);
              setIsEditingAvatar(false);
          }
      } catch (error) {
          console.error("Failed to edit avatar", error);
          alert("Não foi possível editar o avatar. Tente novamente.");
      } finally {
          setIsRegeneratingAvatar(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black text-slate-200 font-sans selection:bg-antique-500/30 selection:text-antique-100 overflow-x-hidden">
      
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-antique-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-900/30 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 relative z-10 flex flex-col items-center">
        
        {/* Header */}
        <header className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-antique-900/30 border border-antique-700/30 rounded-2xl mb-4 shadow-lg shadow-antique-900/20">
            <Hourglass className="w-8 h-8 text-antique-400" />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-antique-100 to-antique-400 tracking-tight drop-shadow-sm">
            Criador de posts Jefferson Gomes
          </h1>
          <p className="text-lg text-slate-400 max-w-lg mx-auto leading-relaxed">
            Transforme sua comunicação através do tempo ou através de personalidades.
          </p>
        </header>

        {/* Input */}
        <InputSection 
            onGenerate={handleGenerate} 
            isLoading={status === LoadingState.LOADING}
            initialImage={forcedInputImage}
            initialMode={forcedInputMode} 
        />

        {/* Loading State */}
        {status === LoadingState.LOADING && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-antique-900 border-t-antique-400 rounded-full animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <History className="w-6 h-6 text-antique-500" />
              </div>
            </div>
            <p className="text-antique-200 font-display text-lg tracking-widest uppercase">
              {currentMode === 'avatar' 
                  ? "Criando seu avatar digital..." 
                  : (originalImage ? "Pintando os retratos..." : "Analisando a mensagem...")
              }
            </p>
          </div>
        )}

        {/* Error State */}
        {status === LoadingState.ERROR && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-200 p-6 rounded-xl text-center max-w-md">
            <p className="font-bold mb-2">Houve uma perturbação.</p>
            <p className="text-sm opacity-80">Não foi possível realizar a transformação no momento. Por favor, tente novamente.</p>
          </div>
        )}

        {/* Results */}
        {status === LoadingState.SUCCESS && variations.length > 0 && (
          <div className="w-full space-y-8 animate-fadeIn pb-20">
            <div className="flex items-center gap-4 text-slate-500 mb-8 w-full max-w-4xl mx-auto">
              <div className="h-px bg-slate-800 flex-1"></div>
              <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <Quote className="w-3 h-3" /> Resultado
              </span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </div>

            {/* Special Layout for Avatar Mode Result */}
            {currentMode === 'avatar' ? (
                <div className="flex flex-col items-center gap-6">
                     <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-emerald-500/50 max-w-sm w-full group">
                         {isRegeneratingAvatar && (
                             <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                                 <Sparkles className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                                 <span className="text-emerald-200 font-bold">Ajustando detalhes...</span>
                             </div>
                         )}
                         <img src={variations[0].imageBase64} alt="Avatar" className="w-full h-auto" />
                         <div className="absolute bottom-0 inset-x-0 bg-black/60 p-4 text-center backdrop-blur-sm">
                             <p className="text-emerald-300 font-display font-bold">Avatar Base Criado</p>
                         </div>
                     </div>

                     {/* Avatar Editing Interface */}
                     {isEditingAvatar ? (
                         <div className="w-full max-w-lg bg-slate-800/80 p-6 rounded-xl border border-emerald-500/30 shadow-2xl animate-fadeIn space-y-4">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-emerald-300 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                     <Wand2 className="w-4 h-4" /> Editar Avatar
                                 </h3>
                                 <button onClick={() => setIsEditingAvatar(false)} className="text-slate-400 hover:text-white">
                                     <X className="w-4 h-4" />
                                 </button>
                             </div>
                             
                             <textarea
                                 value={avatarEditPrompt}
                                 onChange={(e) => setAvatarEditPrompt(e.target.value)}
                                 placeholder="O que você quer mudar? (ex: 'Mude o fundo para um escritório moderno', 'Adicione óculos', 'Melhore a iluminação')"
                                 className="w-full bg-slate-900/80 text-white p-3 rounded-lg text-sm border border-slate-600 focus:border-emerald-500 outline-none resize-none h-24"
                             />

                             <div className="flex gap-2 items-center">
                                 {avatarEditRefImage && (
                                     <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-600 flex-none group/preview">
                                         <img src={avatarEditRefImage} alt="Ref" className="w-full h-full object-cover" />
                                         <button 
                                             onClick={() => setAvatarEditRefImage(null)}
                                             className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 text-white"
                                         >
                                             <X className="w-3 h-3" />
                                         </button>
                                     </div>
                                 )}
                                 
                                 <button 
                                     onClick={() => avatarEditFileRef.current?.click()}
                                     className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-500 text-slate-300 text-xs font-bold uppercase flex items-center gap-2 flex-none"
                                     title="Adicionar imagem de referência extra"
                                 >
                                     <Upload className="w-3 h-3" />
                                     {avatarEditRefImage ? "Trocar Ref" : "Add Ref Extra"}
                                 </button>
                                 <input 
                                     type="file" 
                                     ref={avatarEditFileRef}
                                     onChange={handleAvatarEditFileChange}
                                     accept="image/png, image/jpeg, image/webp"
                                     className="hidden"
                                 />
                                 
                                 <button 
                                     onClick={handleRegenerateAvatar}
                                     disabled={!avatarEditPrompt.trim() || isRegeneratingAvatar}
                                     className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-xs font-bold uppercase transition-all shadow-lg"
                                 >
                                     {isRegeneratingAvatar ? "Editando..." : "Aplicar Mudança"}
                                 </button>
                             </div>
                             <p className="text-[10px] text-slate-500">
                                 Dica: Use a "Ref Extra" se quiser copiar um estilo ou objeto específico de outra imagem para o seu avatar.
                             </p>
                         </div>
                     ) : (
                         <div className="flex gap-4 flex-wrap justify-center">
                            <button 
                                onClick={() => setIsEditingAvatar(true)}
                                className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold shadow-lg transition-all flex items-center gap-2"
                            >
                                <Wand2 className="w-4 h-4" />
                                Editar
                            </button>
                            
                            <button 
                                onClick={() => {
                                    setVariations([]);
                                    setCaptionSuggestion('');
                                    setStatus(LoadingState.IDLE);
                                }}
                                className="px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Descartar
                            </button>
                            <button 
                                onClick={handleUseAvatarAsReference}
                                className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-500 hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <UserCheck className="w-5 h-5" />
                                Usar como Referência
                            </button>
                         </div>
                     )}
                     
                     {!isEditingAvatar && (
                        <p className="text-sm text-slate-400 max-w-md text-center animate-fadeIn">
                            Ao clicar em "Usar como Referência", este avatar será carregado automaticamente no formulário acima para você criar suas viagens no tempo ou perfis de vendedor.
                        </p>
                     )}
                </div>
            ) : (
                /* Standard Result (Carousel or List) */
                variations[0]?.imageBase64 ? (
                <VariationCarousel 
                    originalPhrase={originalPhrase}
                    originalImage={originalImage || variations[0].imageBase64 || ''} 
                    variations={variations}
                    onUpdateVariation={handleUpdateVariation}
                />
                ) : (
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-slate-700 via-antique-700/50 to-antique-900 hidden md:block"></div>
                    {variations.map((variation, idx) => (
                    <div key={idx} className="md:pl-20 relative">
                        <div className={`absolute left-[21px] top-10 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] z-10 hidden md:block
                        ${idx === 0 ? 'bg-slate-500' : idx === 4 ? 'bg-antique-400' : 'bg-slate-700'}
                        `}></div>
                        <VariationCard variation={variation} index={idx} />
                    </div>
                    ))}
                </div>
                )
            )}

            {/* Caption Suggestion Section */}
            {captionSuggestion && (
                <div className="max-w-4xl mx-auto w-full bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 mt-12 animate-fadeIn shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-400" /> 
                            Sugestão de Legenda
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleCopyCaption}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all
                                    ${captionCopied ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                                `}
                            >
                                {captionCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {captionCopied ? "Copiado!" : "Copiar"}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <textarea 
                            value={captionSuggestion}
                            onChange={(e) => setCaptionSuggestion(e.target.value)}
                            className="w-full h-40 bg-slate-900/50 text-slate-200 p-4 rounded-xl border border-slate-600/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none font-sans text-sm leading-relaxed"
                            placeholder="A legenda aparecerá aqui..."
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-slate-500 pointer-events-none">
                            Editável
                        </div>
                    </div>
                </div>
            )}

          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-slate-600 text-sm text-center">
          <p>© {new Date().getFullYear()} Criador de posts Jefferson Gomes.</p>
        </footer>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default App;