import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Sparkles, Image as ImageIcon, X, MapPin, Hourglass, Briefcase, User, Share2, Layers, Maximize } from 'lucide-react';
import { GenerationMode } from '../types';

interface InputSectionProps {
  onGenerate: (text: string, mode: GenerationMode, image?: string, environment?: string, count?: number) => void;
  isLoading: boolean;
  initialImage?: string | null;
  initialMode?: GenerationMode;
}

const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading, initialImage, initialMode }) => {
  const [inputText, setInputText] = useState('');
  const [environment, setEnvironment] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('avatar');
  const [slideCount, setSlideCount] = useState<number>(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImage) {
        setSelectedImage(initialImage);
    }
    if (initialMode) {
        setMode(initialMode);
    }
  }, [initialImage, initialMode]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (mode === 'avatar' && !selectedImage) {
        alert("Por favor, carregue uma foto para criar o avatar.");
        return;
    }

    if ((inputText.trim() || mode === 'avatar') && !isLoading) {
      onGenerate(inputText, mode, selectedImage || undefined, environment || undefined, slideCount);
    }
  };

  const getPlaceholderText = () => {
      switch (mode) {
          case 'avatar': return "Descreva o estilo (ex: 'Homem de terno azul, sério' ou 'Mulher executiva')...";
          case 'chronological': return "Digite a frase moderna aqui... (ex: 'Não vou conseguir ir na festa hoje')";
          case 'sales_types': return "Digite a FALA ou o PITCH de vendas que você quer transformar... (ex: 'Esse é o melhor curso do mercado')";
          case 'social_media': return "Sobre o que é o carrossel? (ex: '5 Dicas para emagrecer', 'Minha história de superação')";
          case 'single_image': return "Digite a mensagem para o seu post único... (ex: 'Resultados vêm com consistência')";
          default: return "";
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-12 relative z-10">
      <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-slate-700/50 ring-1 ring-white/10 space-y-6">
        
        {/* Mode Selection */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1 bg-slate-900/50 rounded-xl">
            <button
                onClick={() => setMode('avatar')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${mode === 'avatar' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
            >
                <User className="w-4 h-4" />
                <span>Avatar</span>
            </button>
            <button
                onClick={() => setMode('chronological')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${mode === 'chronological' ? 'bg-antique-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
            >
                <Hourglass className="w-4 h-4" />
                <span>Viajante</span>
            </button>
            <button
                onClick={() => setMode('sales_types')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${mode === 'sales_types' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
            >
                <Briefcase className="w-4 h-4" />
                <span>Vendas</span>
            </button>
             <button
                onClick={() => setMode('social_media')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${mode === 'social_media' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
            >
                <Share2 className="w-4 h-4" />
                <span>Social</span>
            </button>
            <button
                onClick={() => setMode('single_image')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${mode === 'single_image' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
            >
                <Maximize className="w-4 h-4" />
                <span>Único</span>
            </button>
        </div>

        {/* 1. Text Input */}
        <div className="space-y-2">
            <label className="text-sm text-antique-300 font-bold uppercase tracking-wider flex items-center gap-2">
                1. {mode === 'avatar' ? "Descrição Visual" : mode === 'social_media' ? "Qual o tema do Carrossel?" : "Qual é a mensagem/fala?"}
            </label>
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholderText()}
                className="w-full bg-slate-900/50 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-1 focus:ring-antique-500 transition-all resize-none min-h-[80px] font-sans border border-slate-700/50"
                disabled={isLoading}
            />
        </div>

        {/* Dynamic Count Slider (Only for Social Media) */}
        {mode === 'social_media' && (
            <div className="space-y-2 bg-pink-900/20 p-4 rounded-xl border border-pink-500/20">
                <div className="flex justify-between items-center">
                    <label className="text-sm text-pink-300 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Imagens no Carrossel
                    </label>
                    <span className="text-pink-100 font-mono bg-pink-600/50 px-2 py-1 rounded text-xs">
                        {slideCount} Slides
                    </span>
                </div>
                <input 
                    type="range" 
                    min="3" 
                    max="10" 
                    step="1"
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2. Environment Input */}
            {mode !== 'avatar' && (
                <div className="space-y-2">
                    <label className="text-sm text-antique-300 font-bold uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> 2. Onde eles estão?
                    </label>
                    <textarea
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        placeholder="Descreva o ambiente..."
                        className="w-full h-full min-h-[100px] bg-slate-900/50 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-antique-500 transition-all resize-none border border-slate-700/50"
                        disabled={isLoading}
                    />
                </div>
            )}

            {/* 3. Image Upload */}
            <div className={`space-y-2 flex flex-col ${mode === 'avatar' ? 'md:col-span-2' : ''}`}>
                <label className="text-sm text-antique-300 font-bold uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> 
                    {mode === 'avatar' ? "2. Foto para Referência" : "3. Rosto / Avatar (Opcional)"}
                </label>
                
                <div className="relative flex-grow">
                    {!selectedImage ? (
                        <div 
                            onClick={() => !isLoading && fileInputRef.current?.click()}
                            className={`h-full min-h-[100px] border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/30 transition-colors group
                                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <ImageIcon className="w-8 h-8 text-slate-500 group-hover:text-antique-400 mb-2 transition-colors" />
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 text-center px-4">
                                Clique para adicionar {mode === 'avatar' ? "a foto base" : "um retrato"}
                            </span>
                        </div>
                    ) : (
                        <div className="relative h-full min-h-[100px] bg-slate-900 rounded-xl overflow-hidden group border border-slate-600">
                            <img 
                                src={selectedImage} 
                                alt="Preview" 
                                className="w-full h-full object-contain md:object-cover opacity-80 group-hover:opacity-100 transition-opacity bg-black"
                            />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={clearImage} className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full shadow-lg">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
            </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={(!inputText.trim() && mode !== 'avatar') || (mode === 'avatar' && !selectedImage) || isLoading}
              className={`w-full py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 font-bold text-lg uppercase tracking-wide
                ${isLoading || (mode === 'avatar' && !selectedImage)
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : mode === 'single_image' ? 'bg-gradient-to-r from-cyan-700 via-cyan-600 to-cyan-500 text-white'
                  : mode === 'social_media' ? 'bg-gradient-to-r from-pink-700 via-pink-600 to-pink-500 text-white'
                  : mode === 'avatar' ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500 text-white'
                  : 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500 text-white'
                } hover:shadow-lg active:scale-[0.99]`}
            >
              {isLoading ? (
                <><Sparkles className="w-5 h-5 animate-spin" /> {mode === 'avatar' ? "Criando Avatar..." : "Gerando..."}</>
              ) : (
                <><Send className="w-5 h-5" /> {mode === 'single_image' ? "Gerar Post Único" : "Gerar Variações"}</>
              )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InputSection;