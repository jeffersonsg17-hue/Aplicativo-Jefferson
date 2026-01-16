import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Download, Instagram, Layout, Clapperboard, Loader2, Image as ImageIcon, Layers, Pencil, Wand2, Save, X as XIcon, Upload, TrendingUp } from 'lucide-react';
import { Variation } from '../types';
import { generateNarration, editVariationImage } from '../services/geminiService';

interface VariationCarouselProps {
  originalPhrase: string;
  originalImage: string;
  variations: Variation[];
  onUpdateVariation?: (index: number, variation: Variation) => void;
}

// --- Music/Ambience Assets (Public Domain / CC0 Placeholders) ---
const MUSIC_URLS = {
  cover: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Frederic_Chopin_-_Nocturne_Op_9_No_2.ogg", // Upbeat or neutral
  modern: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Erik_Satie_-_Gymnop%C3%A9die_No._1.ogg", 
  y1900: "https://upload.wikimedia.org/wikipedia/commons/5/51/Scott_Joplin_-_The_Entertainer_%281902%2C_piano_roll%29.ogg", 
  y1800: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Frederic_Chopin_-_Nocturne_Op_9_No_2.ogg", 
  baroque: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Johann_Sebastian_Bach_-_No._1_-_Pr%C3%A9lude_in_C_Major%2C_BWV_846.ogg", 
  renaissance: "https://upload.wikimedia.org/wikipedia/commons/b/b0/John_Dowland_-_Come_Again.ogg" 
};

const getMusicForLevel = (level: number) => {
  if (level === 0) return MUSIC_URLS.cover;
  if (level >= 5) return MUSIC_URLS.renaissance;
  if (level === 4) return MUSIC_URLS.baroque;
  if (level === 3) return MUSIC_URLS.y1800;
  if (level === 2) return MUSIC_URLS.y1900;
  return MUSIC_URLS.modern;
};

// --- PCM Decoding Helpers ---
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getSupportedMimeType = () => {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
};

const VariationCarousel: React.FC<VariationCarouselProps> = ({ originalPhrase, originalImage, variations, onUpdateVariation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'post' | 'video' | 'art'>('split');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Editing States
  const [isEditingText, setIsEditingText] = useState(false);
  const [editTextValue, setEditTextValue] = useState("");
  const [editSubtitleValue, setEditSubtitleValue] = useState(""); // For Cover slide subtitle
  
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [editReferenceImage, setEditReferenceImage] = useState<string | null>(null);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  // Video Generation States
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Construct slides.
  // Level -1: The user's original input.
  // Level 0: The Generated Cover (if Sales mode).
  // Level 1-5: The Variations.
  const slides = [
    {
      level: -1, 
      era: "Entrada Original",
      text: originalPhrase,
      explanation: "Frase e imagem originais fornecidas.",
      imageBase64: originalImage,
      subtitle: undefined as string | undefined
    },
    ...variations
  ];

  const currentSlide = slides[currentIndex];

  const nextSlide = () => {
    resetEditingStates();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    resetEditingStates();
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const resetEditingStates = () => {
    setIsEditingText(false);
    setIsEditingImage(false);
    setEditTextValue("");
    setEditSubtitleValue("");
    setImagePrompt("");
    setEditReferenceImage(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSlide.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- EDITING HANDLERS ---
  
  const startTextEdit = () => {
    setEditTextValue(currentSlide.text);
    if (currentSlide.level === 0 && currentSlide.subtitle) {
        setEditSubtitleValue(currentSlide.subtitle);
    }
    setIsEditingText(true);
  };

  const saveTextEdit = () => {
    if (onUpdateVariation && currentSlide.level >= 0) { // Allow editing Cover (0) and vars (1-5)
        // Need to map current slide index back to variations array index
        // variations array does not include the Input slide (-1).
        // slides = [Input(-1), ...variations]
        // So variation index = currentIndex - 1
        const varIndex = currentIndex - 1;
        if (varIndex >= 0) {
            onUpdateVariation(varIndex, { 
                ...currentSlide as Variation, 
                text: editTextValue,
                subtitle: currentSlide.level === 0 ? editSubtitleValue : undefined 
            });
        }
    }
    setIsEditingText(false);
  };

  const toggleImageEdit = () => {
      setIsEditingImage(!isEditingImage);
      setImagePrompt("");
      setEditReferenceImage(null);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageRegeneration = async () => {
      if (!imagePrompt.trim() || !onUpdateVariation) return;
      
      setIsRegeneratingImage(true);
      try {
          const newImage = await editVariationImage(
              currentSlide.imageBase64 || "", 
              imagePrompt, 
              currentSlide.level, 
              currentSlide.era,
              editReferenceImage || undefined
          );
          if (newImage) {
            const varIndex = currentIndex - 1;
            if (varIndex >= 0) {
                 onUpdateVariation(varIndex, { ...currentSlide as Variation, imageBase64: newImage });
            }
            setImagePrompt("");
            setEditReferenceImage(null);
            setIsEditingImage(false);
          }
      } catch (e) {
          console.error("Failed to regenerate image", e);
          alert("Erro ao editar imagem. Tente novamente.");
      } finally {
          setIsRegeneratingImage(false);
      }
  };

  const getFontForLevel = (level: number) => {
    if (level === 0) return "Cinzel"; // Cover
    if (level >= 4) return "Cinzel";
    if (level >= 2) return "Playfair Display";
    return "Inter";
  };

  // --- BRANDING LOGIC ---
  
  // Custom function to draw the "Jefferson Gomes" logo programmatically
  // This recreates the provided logo (Graph + Text) on the Canvas
  const drawBrandLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
      ctx.save();
      
      // Base offset for the whole logo group
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Color Palette (Light for dark backgrounds)
      const primaryColor = '#e2e8f0'; // Slate-200
      const secondaryColor = '#94a3b8'; // Slate-400
      
      // --- 1. Draw Icon (The Graph) ---
      // Icon position roughly 0,0 to 80,60
      const barWidth = 10;
      const gap = 5;
      const startX = 0;
      const baselineY = 50;

      // Bars (Height increasing)
      const heights = [20, 30, 40, 50, 60];
      
      ctx.fillStyle = secondaryColor; // Darker for bars
      heights.forEach((h, i) => {
          const barX = startX + (i * (barWidth + gap));
          // Draw rounded rect bars
          ctx.beginPath();
          ctx.roundRect(barX, baselineY - h, barWidth, h, 2);
          ctx.fill();
      });

      // Arrow
      ctx.strokeStyle = primaryColor; // Lighter/Brighter for arrow
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      // Start near first bar, go up to last bar
      ctx.moveTo(startX - 5, baselineY - heights[0] + 10);
      ctx.lineTo(startX + (heights.length * (barWidth + gap)) + 5, baselineY - heights[heights.length-1] - 10);
      ctx.stroke();

      // Arrow Head
      const endX = startX + (heights.length * (barWidth + gap)) + 5;
      const endY = baselineY - heights[heights.length-1] - 10;
      ctx.beginPath();
      ctx.moveTo(endX - 10, endY);
      ctx.lineTo(endX, endY);
      ctx.lineTo(endX, endY + 10);
      ctx.stroke();

      // --- 2. Draw Text ---
      // Position below icon
      const textX = 0;
      const textY = baselineY + 25;

      ctx.textAlign = 'left';
      
      // "JEFFERSON GOMES"
      ctx.font = '900 24px Inter, sans-serif'; // Extra Bold
      ctx.fillStyle = primaryColor;
      ctx.fillText('JEFFERSON GOMES', textX, textY);

      // "INSIDE SALES"
      ctx.font = '500 16px Inter, sans-serif'; // Medium
      ctx.fillStyle = secondaryColor;
      ctx.letterSpacing = '2px'; // Tracking
      ctx.fillText('INSIDE SALES', textX, textY + 20);

      ctx.restore();
  };

  // --- DOWNLOAD SINGLE STATIC POST ---
  const handleDownloadPost = async () => {
    if (!currentSlide.imageBase64) return;
    
    setIsDownloading(true);

    // CHANGE: If in 'art' mode, download raw image (clean, original resolution, no text)
    if (viewMode === 'art') {
        const link = document.createElement('a');
        link.href = currentSlide.imageBase64;
        link.download = `jefferson_gomes_arte-${currentSlide.era.replace(/\s/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
        return;
    }

    // Logic for 'post' and 'split' modes (Render canvas with text)
    if (!canvasRef.current) {
         setIsDownloading(false);
         return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1350;

    // Load single image for static post
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSlide.imageBase64;
    await new Promise((resolve) => { img.onload = resolve; });

    renderSlideToCanvas(ctx, currentSlide, img, canvas.width, canvas.height, 1.0, 1.0);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `jefferson_gomes_post-${currentSlide.era.replace(/\s/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
    setIsDownloading(false);
  };

  // --- DOWNLOAD ALL IMAGES ---
  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
        for (let i = 0; i < slides.length; i++) {
            if (slides[i].imageBase64) {
                const link = document.createElement('a');
                link.href = slides[i].imageBase64!;
                link.download = `jefferson_gomes-${slides[i].era.replace(/\s/g, '_')}-${i}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // Slight delay to prevent browser from blocking multiple downloads
                await new Promise(r => setTimeout(r, 300));
            }
        }
    } catch (e) {
        console.error("Erro ao baixar imagens", e);
    }
    setIsDownloading(false);
  };

  // --- RENDER LOGIC ---
  const renderSlideToCanvas = (
    ctx: CanvasRenderingContext2D, 
    slide: typeof slides[0], 
    imageObj: HTMLImageElement | null,
    width: number, 
    height: number,
    scale: number,
    opacity: number
  ) => {
    // 1. Clear & Fill Background
    ctx.clearRect(0, 0, width, height); 
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = opacity;

    // 2. Draw Image
    if (imageObj && imageObj.naturalWidth > 0) {
        // Calculate dimensions to cover with zoom
        const imgRatio = imageObj.naturalWidth / imageObj.naturalHeight;
        const canvasRatio = width / height;
        
        let renderW, renderH, offsetX, offsetY;

        if (imgRatio > canvasRatio) {
            renderH = height;
            renderW = imageObj.naturalWidth * (height / imageObj.naturalHeight);
            offsetX = (width - renderW) / 2;
            offsetY = 0;
        } else {
            renderW = width;
            renderH = imageObj.naturalHeight * (width / imageObj.naturalWidth);
            offsetX = 0;
            offsetY = (height - renderH) / 2;
        }

        // Apply scale (Zoom from center)
        const zoomedW = renderW * scale;
        const zoomedH = renderH * scale;
        const zoomedX = offsetX - (zoomedW - renderW) / 2;
        const zoomedY = offsetY - (zoomedH - renderH) / 2;

        ctx.drawImage(imageObj, zoomedX, zoomedY, zoomedW, zoomedH);
    }

    // 3. Gradient Overlay (Bottom to Top)
    // Matches CSS: bg-gradient-to-t from-black via-black/60 to-transparent
    const gradient = ctx.createLinearGradient(0, height, 0, 0); 
    gradient.addColorStop(0, 'rgba(0,0,0,1)'); // Black at bottom
    gradient.addColorStop(0.4, 'rgba(0,0,0,0.6)'); // Fade
    gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Transparent at top
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 4. Diagramação (Layout) - Text Rendering
    const fontFamily = getFontForLevel(slide.level);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1f5f9';

    // --- ERA (TOP) ---
    // CSS: mb-auto pt-4 (Top of container)
    // Canvas: Draw at fixed top position
    // ONLY DRAW IF NOT COVER (Level 0)
    const eraY = 120;
    
    if (slide.level !== 0) {
      ctx.font = 'bold 26px Inter';
      ctx.globalAlpha = opacity * 0.8;
      ctx.fillText(slide.era.toUpperCase(), width / 2, eraY);
      
      // Draw underline for Era
      const eraWidth = ctx.measureText(slide.era.toUpperCase()).width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((width / 2) - (eraWidth / 2) - 20, eraY + 15);
      ctx.lineTo((width / 2) + (eraWidth / 2) + 20, eraY + 15);
      ctx.stroke();
    }
    
    ctx.globalAlpha = opacity;

    // --- MAIN TEXT (BOTTOM) ---
    // CSS: mb-12 (Bottom of container)
    // Canvas: We need to wrap text, calculate total height, and draw upwards from bottom margin.
    
    let fontSize = 60;
    if (slide.level === 0) fontSize = 80; // Cover text is bigger
    
    ctx.font = `${slide.level >= 3 ? 'italic' : ''} ${fontSize}px ${fontFamily}`;
    
    const textStr = slide.level === 0 ? slide.text.toUpperCase() : `"${slide.text}"`;
    const maxWidth = 900;
    const lineHeight = fontSize * 1.3;

    // Split words
    const words = textStr.split(' ');
    let line = '';
    const lines = [];

    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    // Determine Y start position
    // We want the text block to END at (height - bottomPadding)
    const bottomPadding = 220; // Increased padding slightly to fit watermark
    const totalTextHeight = lines.length * lineHeight;
    let startY = height - bottomPadding - totalTextHeight + lineHeight; // +lineHeight because fillText draws from baseline

    // Safety: don't draw over the Era if text is huge (only relevant if Era is drawn)
    if (slide.level !== 0 && startY < eraY + 100) {
        startY = eraY + 100;
    }

    // Draw Lines for Main Text
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], width / 2, startY + (i * lineHeight));
    }

    // --- SUBTITLE (FOR COVER ONLY) ---
    if (slide.level === 0 && slide.subtitle) {
        // Draw below the main text
        const subtitleY = startY + (lines.length * lineHeight) + 20; // 20px padding below main title
        
        ctx.font = 'bold 36px Playfair Display'; // Different font for contrast
        ctx.fillStyle = '#cbd5e1'; // Slate-300 like color
        
        // Wrap Subtitle
        const subWords = `"${slide.subtitle}"`.split(' ');
        let subLine = '';
        const subLines = [];
        const subLineHeight = 50;

        for(let n = 0; n < subWords.length; n++) {
            const testLine = subLine + subWords[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                subLines.push(subLine);
                subLine = subWords[n] + ' ';
            } else {
                subLine = testLine;
            }
        }
        subLines.push(subLine);

        for (let i = 0; i < subLines.length; i++) {
            ctx.fillText(subLines[i], width / 2, subtitleY + (i * subLineHeight));
        }
    }

    // --- WATERMARK (LOGO) ---
    // Bottom Left corner
    const paddingLeft = 50;
    const paddingBottom = 50;
    const watermarkY = height - paddingBottom - 100; // 100 is approx logo height
    
    drawBrandLogo(ctx, paddingLeft, watermarkY, 1.5);

    ctx.restore();
  };

  // --- VIDEO GENERATION ---
  const handleGenerateVideo = async () => {
    setIsGeneratingVideo(true);
    setVideoUrl(null);
    setGenerationProgress("Inicializando estúdio...");

    try {
        const mimeType = getSupportedMimeType();
        if (!mimeType) throw new Error("Nenhum formato de vídeo suportado encontrado.");

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        await audioContext.resume(); 
        
        const canvas = document.createElement('canvas'); 
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // --- PRELOAD ASSETS ---
        
        // 1. Audio Narrations
        const narrationBuffers: AudioBuffer[] = [];
        for (let i = 0; i < slides.length; i++) {
            setGenerationProgress(`Criando narração (${i + 1}/${slides.length})...`);
            // For Cover (Level 0) or Input (Level -1), maybe different logic?
            // Just narrate the text for now.
            const base64Audio = await generateNarration(slides[i].text);
            const bytes = base64ToUint8Array(base64Audio);
            const audioBuffer = pcmToAudioBuffer(bytes, audioContext, 24000, 1);
            narrationBuffers.push(audioBuffer);
        }

        // 2. Music Tracks
        setGenerationProgress("Carregando trilha sonora...");
        const musicBuffers: Record<string, AudioBuffer> = {};
        const uniqueMusicUrls = Array.from(new Set(slides.map(s => getMusicForLevel(s.level))));
        
        for (const url of uniqueMusicUrls) {
             try {
                 const response = await fetch(url);
                 const arrayBuffer = await response.arrayBuffer();
                 const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                 musicBuffers[url] = audioBuffer;
             } catch (e) {
                 console.warn("Failed to load music", url, e);
             }
        }

        // 3. Images
        setGenerationProgress("Preparando imagens...");
        const imageAssets: HTMLImageElement[] = [];
        for (let i = 0; i < slides.length; i++) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            if (slides[i].imageBase64) {
                img.src = slides[i].imageBase64!;
                await new Promise((resolve) => { 
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                });
                try { await img.decode(); } catch (e) {}
            }
            imageAssets.push(img);
        }

        setGenerationProgress("Renderizando vídeo...");

        // --- RECORDING SETUP ---
        const streamDestination = audioContext.createMediaStreamDestination();
        const canvasStream = canvas.captureStream(30); 
        
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...streamDestination.stream.getAudioTracks()
        ]);

        const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000 
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.start();

        // --- ANIMATION LOOP ---
        const fadeInDuration = 1.0; 
        const fadeOutDuration = 0.5; 
        const musicGain = audioContext.createGain();
        musicGain.connect(streamDestination);
        musicGain.gain.value = 0.15; 

        let currentMusicSource: AudioBufferSourceNode | null = null;
        let currentMusicUrl: string | null = null;

        for (let i = 0; i < slides.length; i++) {
            const narrationBuffer = narrationBuffers[i];
            const slideDuration = narrationBuffer.duration + fadeInDuration + fadeOutDuration; 
            
            // Handle Music Change
            const targetMusicUrl = getMusicForLevel(slides[i].level);
            if (targetMusicUrl !== currentMusicUrl && musicBuffers[targetMusicUrl]) {
                 if (currentMusicSource) {
                     try { currentMusicSource.stop(); } catch(e) {}
                 }
                 currentMusicSource = audioContext.createBufferSource();
                 currentMusicSource.buffer = musicBuffers[targetMusicUrl];
                 currentMusicSource.loop = true;
                 currentMusicSource.connect(musicGain);
                 currentMusicSource.start();
                 currentMusicUrl = targetMusicUrl;
            }

            // Play Narration
            const narrationSource = audioContext.createBufferSource();
            narrationSource.buffer = narrationBuffer;
            narrationSource.connect(streamDestination);
            narrationSource.start(audioContext.currentTime + fadeInDuration);

            // Animate Frames
            const fps = 30;
            const totalFrames = Math.ceil(slideDuration * fps);
            
            for (let frame = 0; frame < totalFrames; frame++) {
                const currentTimeInSlide = frame / fps;
                
                let opacity = 1.0;
                if (currentTimeInSlide < fadeInDuration) {
                    opacity = currentTimeInSlide / fadeInDuration;
                } else if (currentTimeInSlide > (slideDuration - fadeOutDuration)) {
                    opacity = (slideDuration - currentTimeInSlide) / fadeOutDuration;
                }

                const progress = frame / totalFrames;
                const scale = 1.0 + (progress * 0.08); 
                
                renderSlideToCanvas(ctx, slides[i], imageAssets[i], canvas.width, canvas.height, scale, opacity);
                
                await new Promise(r => setTimeout(r, 1000/fps));
            }
        }

        if (currentMusicSource) {
             try { currentMusicSource.stop(); } catch(e) {}
        }
        mediaRecorder.stop();
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setIsGeneratingVideo(false);
            setGenerationProgress("");
            audioContext.close();
        };

    } catch (error) {
        console.error(error);
        setGenerationProgress("Erro ao gerar vídeo. Tente novamente.");
        setTimeout(() => setIsGeneratingVideo(false), 3000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-fadeIn">
      
      {/* Controls Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-4 px-2 gap-4">
        <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl overflow-x-auto max-w-full">
          <button 
            onClick={() => setViewMode('split')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
              ${viewMode === 'split' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <Layout className="w-4 h-4" /> <span className="hidden sm:inline">Detalhes</span>
          </button>
          <button 
            onClick={() => setViewMode('art')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
              ${viewMode === 'art' ? 'bg-indigo-900/50 text-white shadow-sm ring-1 ring-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <ImageIcon className="w-4 h-4" /> <span className="hidden sm:inline">Arte</span>
          </button>
          <button 
            onClick={() => setViewMode('post')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
              ${viewMode === 'post' ? 'bg-gradient-to-r from-purple-900 to-pink-900 text-white border border-pink-700/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <Instagram className="w-4 h-4" /> Post
          </button>
          <button 
            onClick={() => setViewMode('video')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
              ${viewMode === 'video' ? 'bg-gradient-to-r from-antique-800 to-antique-600 text-white border border-antique-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <Clapperboard className="w-4 h-4" /> Vídeo
          </button>
        </div>

        {viewMode !== 'video' && (
            <div className="flex gap-2">
                <button 
                onClick={handleDownloadAll}
                disabled={isDownloading}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                title="Baixar todas as imagens"
                >
                    <Layers className="w-4 h-4" /> 
                    <span className="hidden sm:inline">Baixar Tudo</span>
                </button>
                <button 
                onClick={handleDownloadPost}
                disabled={!currentSlide.imageBase64 || isDownloading}
                className="px-3 py-2 bg-antique-600 hover:bg-antique-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-antique-500/20"
                >
                {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                    <Download className="w-4 h-4" /> 
                    <span className="hidden sm:inline">{viewMode === 'art' ? "Baixar Imagem" : "Baixar Post"}</span>
                    </>
                )}
                </button>
            </div>
        )}
      </div>

      <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl min-h-[600px] flex flex-col">
        
        {/* Hidden Canvas for Static Image Generation */}
        <canvas ref={canvasRef} className="hidden" />

        {viewMode === 'split' && (
          /* --- SPLIT VIEW (Original Layout + Editing) --- */
          <div className="flex flex-col md:flex-row flex-grow animate-fadeIn">
            <div className="w-full md:w-1/2 bg-black/40 relative flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-700/50 group">
              {currentSlide.imageBase64 ? (
                <div className={`relative rounded-lg overflow-hidden shadow-2xl border-4 transition-all duration-500
                  ${currentSlide.level === -1 ? 'border-blue-500/50' : currentSlide.level === 0 ? 'border-yellow-500/80' : currentSlide.level >= 4 ? 'border-antique-500' : 'border-slate-500'}
                `}>
                  {isRegeneratingImage && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-antique-400 animate-spin mb-2" />
                          <span className="text-antique-200 text-sm font-display">Recriando a história...</span>
                      </div>
                  )}
                  <img 
                    src={currentSlide.imageBase64} 
                    alt={currentSlide.era} 
                    className="max-h-[400px] w-auto object-contain"
                  />
                  
                  {/* Image Edit Trigger */}
                  {currentSlide.level >= 0 && !isEditingImage && (
                    <button 
                        onClick={toggleImageEdit}
                        className="absolute bottom-4 right-4 p-2 bg-slate-900/80 hover:bg-antique-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm border border-white/20"
                        title="Editar imagem"
                    >
                        <Wand2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Image Edit Popover */}
                  {isEditingImage && (
                      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-30 animate-fadeIn">
                          <h4 className="text-antique-200 font-display mb-4 text-center">Editar Imagem</h4>
                          
                          {/* Reference Image Preview */}
                          {editReferenceImage && (
                              <div className="relative mb-4 w-24 h-24 rounded-lg overflow-hidden border border-slate-600 group/ref">
                                  <img src={editReferenceImage} alt="Ref" className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => setEditReferenceImage(null)}
                                    className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white hover:bg-red-600"
                                  >
                                      <XIcon className="w-3 h-3" />
                                  </button>
                              </div>
                          )}

                          <textarea
                             value={imagePrompt}
                             onChange={(e) => setImagePrompt(e.target.value)}
                             placeholder="O que você quer mudar? (ex: 'Adicione um chapéu', 'Mude o fundo para noite')"
                             className="w-full bg-slate-800/80 text-white p-3 rounded-lg text-sm mb-4 border border-slate-600 focus:border-antique-500 outline-none resize-none h-20"
                          />
                          
                          <div className="flex gap-2 w-full">
                              <button 
                                onClick={toggleImageEdit}
                                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs uppercase font-bold text-slate-300"
                              >
                                  Cancelar
                              </button>
                              
                              {/* Upload Reference Button */}
                              <button 
                                onClick={() => editFileInputRef.current?.click()}
                                className="flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 text-slate-300"
                                title="Enviar imagem de referência"
                              >
                                  <Upload className="w-4 h-4" />
                              </button>
                              <input 
                                  type="file" 
                                  ref={editFileInputRef}
                                  onChange={handleEditFileChange}
                                  accept="image/png, image/jpeg, image/webp"
                                  className="hidden"
                              />

                              <button 
                                onClick={handleImageRegeneration}
                                disabled={!imagePrompt.trim() || isRegeneratingImage}
                                className="flex-1 py-2 bg-antique-600 hover:bg-antique-500 rounded-lg text-xs uppercase font-bold text-white disabled:opacity-50"
                              >
                                  Gerar
                              </button>
                          </div>
                      </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500">Imagem não disponível</div>
              )}
            </div>

            <div className="w-full md:w-1/2 p-8 flex flex-col justify-center relative bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]">
              <div className="mb-6 flex justify-between items-start">
                  <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border
                    ${currentSlide.level === 0 ? 'bg-yellow-900/30 text-yellow-500 border-yellow-500/30' : currentSlide.level >= 4 ? 'bg-antique-900/30 text-antique-500 border-antique-500/30' : 'bg-slate-800/50 text-slate-300 border-slate-600'}
                  `}>
                    {currentSlide.era}
                  </span>
                  
                  {currentSlide.level >= 0 && !isEditingText && (
                      <button 
                        onClick={startTextEdit}
                        className="p-1.5 text-slate-500 hover:text-antique-500 transition-colors"
                        title="Editar texto"
                      >
                          <Pencil className="w-4 h-4" />
                      </button>
                  )}
              </div>

              <div className="flex-grow flex flex-col justify-center mb-8">
                {isEditingText ? (
                    <div className="animate-fadeIn">
                        {/* Title Edit */}
                        <label className="text-xs text-slate-400 font-bold mb-1 block">Título</label>
                        <textarea
                            value={editTextValue}
                            onChange={(e) => setEditTextValue(e.target.value)}
                            className="w-full bg-slate-800/10 border-b-2 border-antique-500 text-slate-100 p-2 text-xl md:text-2xl font-serif italic focus:outline-none resize-none min-h-[100px] mb-4"
                        />
                        
                        {/* Subtitle Edit (Only for Level 0) */}
                        {currentSlide.level === 0 && (
                            <>
                                <label className="text-xs text-slate-400 font-bold mb-1 block">Subtítulo (Frase Original)</label>
                                <textarea
                                    value={editSubtitleValue}
                                    onChange={(e) => setEditSubtitleValue(e.target.value)}
                                    className="w-full bg-slate-800/10 border-b-2 border-indigo-500 text-slate-200 p-2 text-lg font-serif focus:outline-none resize-none min-h-[80px]"
                                />
                            </>
                        )}

                        <div className="flex justify-end gap-2 mt-4">
                             <button 
                                onClick={() => setIsEditingText(false)}
                                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white"
                             >
                                 <XIcon className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={saveTextEdit}
                                className="p-2 bg-antique-600 hover:bg-antique-500 rounded-full text-white"
                             >
                                 <Save className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Main Title */}
                        <h2 className={`text-2xl md:text-3xl leading-relaxed mb-4 cursor-pointer hover:opacity-80 transition-opacity
                        ${currentSlide.level === 0 ? 'font-display font-bold text-yellow-100 text-4xl' : currentSlide.level >= 3 ? 'font-display italic text-antique-100' : 'font-serif text-slate-100'}
                        `}
                        onClick={() => currentSlide.level >= 0 && startTextEdit()}
                        title="Clique para editar"
                        >
                        {currentSlide.level === 0 ? currentSlide.text.toUpperCase() : `"${currentSlide.text}"`}
                        </h2>

                        {/* Subtitle (Level 0 only) */}
                        {currentSlide.level === 0 && currentSlide.subtitle && (
                             <h3 className="text-xl md:text-2xl text-slate-300 font-serif italic mb-6 cursor-pointer hover:opacity-80 transition-opacity border-t border-slate-700/50 pt-4 mt-2"
                                 onClick={() => currentSlide.level >= 0 && startTextEdit()}
                             >
                                 "{currentSlide.subtitle}"
                             </h3>
                        )}
                    </div>
                )}
                
                {!isEditingText && (
                    <>
                        <div className="h-1 w-20 bg-gradient-to-r from-antique-600 to-transparent rounded-full mb-4"></div>
                        <p className="text-sm text-slate-400 font-sans leading-relaxed">
                        {currentSlide.explanation}
                        </p>
                    </>
                )}
              </div>
              
              <div className="flex justify-between items-center mt-auto border-t border-slate-700/30 pt-4">
                  <span className="text-xs text-slate-500">Slide {currentIndex + 1} de {slides.length}</span>
                  <button onClick={handleCopy} className="flex items-center gap-2 text-sm text-antique-400 hover:text-antique-300 transition-colors">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado" : "Copiar Texto"}
                  </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'art' && (
           /* --- ART VIEW (Clean) --- */
           <div className="flex-grow flex items-center justify-center p-0 bg-black animate-fadeIn relative">
              {currentSlide.imageBase64 ? (
                  <img 
                    src={currentSlide.imageBase64} 
                    alt={currentSlide.era} 
                    className="w-full h-full object-contain max-h-[600px]"
                  />
              ) : (
                 <div className="text-slate-500">Imagem não disponível</div>
              )}
              
              <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                 <span className="inline-block px-4 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white/50 uppercase tracking-widest">
                    {currentSlide.era}
                 </span>
              </div>
           </div>
        )}

        {viewMode === 'post' && (
          /* --- POST VIEW (Instagram Preview) --- */
          <div className="flex-grow flex items-center justify-center p-8 bg-black/20 animate-fadeIn">
             <div className="aspect-[4/5] h-[550px] relative rounded-lg overflow-hidden shadow-2xl group cursor-default bg-slate-900">
                {currentSlide.imageBase64 && (
                  <img 
                    src={currentSlide.imageBase64} 
                    alt="Background" 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[20s] ease-linear group-hover:scale-110"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                <div className="absolute inset-0 p-8 flex flex-col justify-end text-center">
                  <div className="mb-auto pt-4 opacity-80">
                    {currentSlide.level !== 0 && (
                      <span className="text-xs font-bold tracking-[0.3em] uppercase text-white/70 border-b border-white/20 pb-2">
                        {currentSlide.era}
                      </span>
                    )}
                  </div>
                  <div className="mb-12">
                    <p className={`text-white text-2xl md:text-3xl leading-snug drop-shadow-lg
                      ${currentSlide.level === 0 ? 'font-display font-bold text-4xl' : currentSlide.level >= 4 ? 'font-display' : currentSlide.level >= 2 ? 'font-serif' : 'font-sans'}
                      ${currentSlide.level >= 3 ? 'italic' : ''}
                    `}>
                      {currentSlide.level === 0 ? currentSlide.text.toUpperCase() : `"${currentSlide.text}"`}
                    </p>
                    
                    {/* Subtitle in Post View */}
                    {currentSlide.level === 0 && currentSlide.subtitle && (
                        <p className="text-slate-200 text-lg font-serif italic mt-4 opacity-90 drop-shadow-md">
                            "{currentSlide.subtitle}"
                        </p>
                    )}
                  </div>

                  {/* HTML Version of Watermark (Bottom Left) */}
                  <div className="absolute bottom-6 left-6 text-left opacity-90 flex flex-col gap-0.5">
                      {/* Graph Icon using Lucide (Approximation) */}
                      <TrendingUp className="w-8 h-8 text-slate-400 mb-1" />
                      <div className="font-sans font-black text-slate-200 text-xs tracking-wide">JEFFERSON GOMES</div>
                      <div className="font-sans font-medium text-slate-400 text-[10px] tracking-[0.2em]">INSIDE SALES</div>
                  </div>

                </div>
             </div>
          </div>
        )}

        {/* ... Video View Omitted for brevity but logic is handled above in renderSlideToCanvas ... */}
        {viewMode === 'video' && (
            /* --- VIDEO VIEW --- */
            <div className="flex-grow flex flex-col items-center justify-center p-8 bg-black/40 animate-fadeIn">
                {!videoUrl ? (
                    <div className="text-center space-y-6 max-w-md">
                        <div className="p-4 bg-antique-900/20 rounded-full inline-block mb-2">
                             <Clapperboard className="w-12 h-12 text-antique-400" />
                        </div>
                        <h3 className="text-2xl font-display text-antique-100">Estúdio de Narração</h3>
                        <p className="text-slate-400">
                            A IA irá narrar cada variação, aplicar efeitos de movimento e compilar tudo em um arquivo de vídeo pronto para o Reels (9:16).
                        </p>
                        
                        {isGeneratingVideo ? (
                            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                                <Loader2 className="w-8 h-8 text-antique-500 animate-spin mx-auto mb-3" />
                                <p className="text-antique-200 animate-pulse">{generationProgress}</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleGenerateVideo}
                                disabled={!currentSlide.imageBase64}
                                className="w-full px-6 py-4 bg-gradient-to-r from-antique-700 to-antique-600 hover:from-antique-600 hover:to-antique-500 text-white rounded-xl font-bold shadow-lg hover:shadow-antique-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Clapperboard className="w-5 h-5" />
                                Gerar Vídeo Narrado
                            </button>
                        )}
                        <p className="text-xs text-slate-500 mt-4">
                            Nota: O processo ocorre no seu navegador e pode levar alguns segundos.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 w-full">
                         <div className="relative rounded-lg overflow-hidden shadow-2xl border border-slate-600">
                            <video 
                                src={videoUrl} 
                                controls 
                                autoPlay 
                                className="max-h-[550px] aspect-[9/16]"
                            />
                         </div>
                         <div className="flex gap-4">
                             <button 
                                onClick={() => setVideoUrl(null)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                             >
                                Voltar
                             </button>
                             <a 
                                href={videoUrl} 
                                download="jefferson_gomes_reels.webm"
                                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"
                             >
                                <Download className="w-5 h-5" /> Baixar Vídeo
                             </a>
                         </div>
                         <p className="text-xs text-slate-500">
                             Dica: O formato WebM é aceito pela maioria das plataformas. Se precisar de MP4, utilize um conversor online.
                         </p>
                    </div>
                )}
            </div>
        )}

        {/* Carousel Navigation (Only hidden during generation) */}
        {!isGeneratingVideo && (
            <>
                <button 
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-antique-600 text-white rounded-full shadow-lg backdrop-blur-sm transition-all md:block hover:scale-110 z-20"
                style={{ display: viewMode === 'video' ? 'none' : 'block' }}
                >
                <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 hover:bg-antique-600 text-white rounded-full shadow-lg backdrop-blur-sm transition-all md:block hover:scale-110 z-20"
                style={{ display: viewMode === 'video' ? 'none' : 'block' }}
                >
                <ChevronRight className="w-6 h-6" />
                </button>
            </>
        )}

        {/* Pagination Dots */}
        {!isGeneratingVideo && (
            <div 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20"
                style={{ display: viewMode === 'video' ? 'none' : 'flex' }}
            >
            {slides.map((_, idx) => (
                <button
                key={idx}
                onClick={() => {
                    resetEditingStates();
                    setCurrentIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 shadow-sm
                    ${idx === currentIndex ? 'w-6 bg-antique-500' : 'bg-white/30 hover:bg-white/50'}
                `}
                />
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default VariationCarousel;