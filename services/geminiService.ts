import { GoogleGenAI, Type } from "@google/genai";
import { TransformationResponse, Variation, GenerationMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- STYLE HELPERS ---

const getChronologicalStyle = (level: number, era: string) => {
  switch (level) {
    case 1: return "fotografia digital realista, iluminação cinemática, alta resolução, 8k, texturas de pele reais";
    case 2: return "fotografia realista de 1920, preto e branco ou sépia, alta definição, estilo retrato histórico";
    case 3: return "pintura a óleo realista do século XIX (Realismo Acadêmico), altamente detalhado, proporções anatomicamente corretas";
    case 4: return "pintura a óleo realista do século XVIII (Barroco), iluminação dramática mas realista, texturas de tecido detalhadas";
    case 5: return "pintura a óleo realista do Renascimento (1500s), estilo Da Vinci ou Rafael, perspectiva e anatomia realistas";
    default: return "arte realista clássica";
  }
};

const getSalesTypeVisual = (level: number) => {
  const base = "PHOTOREALISTIC portrait, high quality 8k photography. NO CARTOON. ";
  switch (level) {
    case 0: // CAPA
      return base + "Subject looking directly at camera, breaking the fourth wall, pointing or gesturing invitingly, professional, charismatic, warm lighting, studio background.";
    case 1: // Inseguro
      return base + "Subject looks nervous, anxious, avoiding eye contact, perhaps sweating slightly, biting lip, ill-fitting clothes, posture is hunched or defensive. Lighting is slightly cold or harsh.";
    case 2: // Confiante demais
      return base + "Subject looks arrogant, smug, chin tilted up, overly slicked hair, flashy expensive suit/attire, aggressive intense stare. Lighting is high contrast, dramatic.";
    case 3: // Sem noção
      return base + "Subject looks confused, disheveled, mismatched clothes, staring blankly or with a socially awkward expression, mouth slightly open. Background is cluttered.";
    case 4: // Chato
      return base + "Subject looks overly intense, invading personal space (close-up), fake strained smile, wide eyes, perhaps holding too many documents/items, looking exhausting to talk to.";
    case 5: // Na medida
      return base + "Subject looks professional, trustworthy, calm, warm genuine smile, well-groomed, perfect posture, approachable. Lighting is soft, warm, and balanced.";
    default: return base + "Professional portrait.";
  }
};

const getSocialMediaStyle = (level: number, totalSlides: number) => {
    const base = "Professional PHOTOREALISTIC Instagram/Social Media photography. 8k, high quality, consistent character. ";
    if (level === 1) {
        return base + "Subject looking directly at camera with a highly engaging expression (surprised, pointing finger at viewer, or holding a relevant object). Strong eye contact. Background clean with space for headline text. Lighting dramatic and catchy.";
    }
    if (level === totalSlides) {
        return base + "Subject gesturing an invitation (e.g., 'link in bio' hand sign, or waving goodbye, or hands open welcomingly). Warm, friendly smile. Engaging directly with the viewer to encourage comments/likes.";
    }
    const middleIndex = (level - 2) % 4;
    switch (middleIndex) {
        case 0: return base + "Subject gesturing with hands as if explaining a concept, looking slightly to the side or at a prop. Thoughtful or teaching expression.";
        case 1: return base + "Subject holding a notebook, laptop, or prop relevant to the theme, looking down at it or showing it to the camera. Focus on the activity.";
        case 2: return base + "Subject reacting to something (laughing, pondering with hand on chin, or realizing something). Candid style shot.";
        case 3: return base + "Subject moving or walking, or sitting comfortably in the environment. More relaxed, 'lifestyle' vibe.";
        default: return base + "Subject in a professional pose.";
    }
};

// --- IMAGE GENERATION ---

const generateSingleImage = async (
  modelId: string, 
  prompt: string, 
  referenceImageBase64?: string
): Promise<string> => {
  try {
    const contents: any = { parts: [] };
    if (referenceImageBase64) {
      const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
      contents.parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBase64 } });
    }
    contents.parts.push({ text: prompt });
    const response = await ai.models.generateContent({ model: modelId, contents: contents });
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return "";
  } catch (error) {
    console.error("Error generating single image:", error);
    return "";
  }
};

// --- AVATAR GENERATION ---
export const generateAvatar = async (description: string, inputImageBase64: string): Promise<TransformationResponse> => {
    const imageModelId = "gemini-2.5-flash-image";
    const textModelId = "gemini-3-flash-preview";
    let prompt = `Create a high-quality, professional PHOTOREALISTIC portrait of the person in the reference image. CRITICAL: You MUST use the attached image as the ABSOLUTE SOURCE OF TRUTH for the face. Maintain identity. Style: High-end studio photography, 8k. `;
    if (description) prompt += `Attire/Look based on: "${description}". `;
    else prompt += `Attire: Professional casual. `;
    prompt += `Background: Clean, neutral. `;

    try {
        const generatedImagePromise = generateSingleImage(imageModelId, prompt, inputImageBase64);
        const captionPromise = ai.models.generateContent({
            model: textModelId,
            contents: `Crie uma legenda de Instagram para um avatar IA profissional. Contexto: ${description || "Profissional"}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { caption: { type: Type.STRING } } }
            }
        });
        const [generatedImage, captionResponse] = await Promise.all([generatedImagePromise, captionPromise]);
        const captionText = JSON.parse(captionResponse.text || "{}").caption || "Novo avatar IA profissional desbloqueado! 🚀";
        return {
            variations: [{
                level: 0, era: "Avatar Base", text: description || "Modelo Padrão", explanation: "Seu avatar base gerado com alta fidelidade.", imageBase64: generatedImage, subtitle: "Avatar Criado"
            }],
            captionSuggestion: captionText
        };
    } catch (error) { throw error; }
};

// --- MAIN SERVICE ---

export const generateVariations = async (
    phrase: string, 
    mode: GenerationMode, 
    inputImageBase64?: string, 
    environment?: string,
    count: number = 5
): Promise<TransformationResponse> => {
  if (mode === 'avatar') return generateAvatar(phrase, inputImageBase64!);

  const textModelId = "gemini-3-flash-preview";
  const imageModelId = "gemini-2.5-flash-image"; 
  const identityConstraint = inputImageBase64 ? ` CRITICAL IDENTITY INSTRUCTION: Use the attached image as the SOURCE OF TRUTH for the character's face. ` : ` CRITICAL: Create a consistent character. `;

  let systemInstruction = "";

  if (mode === 'chronological') {
      systemInstruction = `Você é um especialista em história. Receba uma frase e reescreva-a em 5 níveis de antiguidade (1 a 5). Gere também 'captionSuggestion'.`;
  } else if (mode === 'sales_types') {
      systemInstruction = `Você é um roteirista de vendas. Reescreva a fala em 5 perfis: Inseguro, Arrogante, Sem Noção, Chato, Na Medida. Gere 'captionSuggestion'.`;
  } else if (mode === 'social_media') {
      systemInstruction = `Crie um carrossel completo sobre o tema: "${phrase}" com ${count} slides. Slide 1: Hook, Slides Meio: Conteúdo, Último: CTA. Gere 'captionSuggestion'.`;
  } else if (mode === 'single_image') {
      systemInstruction = `Você é um Designer de Impacto. Sua tarefa é criar um POST ÚNICO (Single Image) de alta qualidade baseado na mensagem: "${phrase}". 
      Reescreva a mensagem para ser o mais persuasiva e impactante possível (tom profissional e inspirador). 
      Retorne apenas 1 variação no nível 1. Gere uma 'captionSuggestion' curta e direta.`;
  }

  try {
    const textResponse = await ai.models.generateContent({
      model: textModelId,
      contents: `Transforme: "${phrase}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.INTEGER },
                  era: { type: Type.STRING },
                  text: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["level", "era", "text", "explanation"]
              }
            },
            captionSuggestion: { type: Type.STRING }
          },
          required: ["variations", "captionSuggestion"]
        }
      }
    });

    const result = JSON.parse(textResponse.text || "{}") as TransformationResponse;

    if (mode === 'sales_types') {
        result.variations.unshift({ level: 0, era: "Capa", text: "Que tipo de vendedor você é?", subtitle: phrase, explanation: "Descubra seu perfil." });
    }

    if (result.variations.length > 0) {
      const sortedVariations = [...result.variations].sort((a, b) => a.level - b.level);
      const anchorLevel = mode === 'sales_types' ? 0 : 1;
      const anchorVariation = sortedVariations.find(v => v.level === anchorLevel);
      const otherVariations = sortedVariations.filter(v => v.level !== anchorLevel);

      let anchorImageBase64 = "";

      if (anchorVariation) {
        let visualDescription = "";
        if (mode === 'chronological') visualDescription = getChronologicalStyle(anchorVariation.level, anchorVariation.era);
        else if (mode === 'social_media' || mode === 'single_image') visualDescription = getSocialMediaStyle(1, 1);
        else visualDescription = getSalesTypeVisual(anchorVariation.level);

        let prompt = `${identityConstraint} Create a high-quality PHOTOREALISTIC portrait. Style: ${visualDescription}. Setting: ${environment || "Professional"}.`;
        anchorImageBase64 = await generateSingleImage(imageModelId, prompt, inputImageBase64);
        const idx = result.variations.findIndex(v => v.level === anchorLevel);
        if (idx !== -1) result.variations[idx].imageBase64 = anchorImageBase64;
      }

      const referenceForOthers = inputImageBase64 || anchorImageBase64;
      const otherPromises = otherVariations.map(async (variation) => {
        let visualDescription = "";
        if (mode === 'chronological') visualDescription = getChronologicalStyle(variation.level, variation.era);
        else if (mode === 'social_media') visualDescription = getSocialMediaStyle(variation.level, count);
        else visualDescription = getSalesTypeVisual(variation.level);

        let prompt = `TRANSFORM the character. ${identityConstraint} Keep SAME FACE. Pose: ${visualDescription}. Setting: ${environment || "Same"}.`;
        const generatedImg = await generateSingleImage(imageModelId, prompt, referenceForOthers);
        return { ...variation, imageBase64: generatedImg };
      });

      const processedOthers = await Promise.all(otherPromises);
      processedOthers.forEach(processedVar => {
        const idx = result.variations.findIndex(v => v.level === processedVar.level);
        if (idx !== -1) result.variations[idx] = processedVar;
      });
    }
    return result;
  } catch (error) { throw error; }
};

export const editVariationImage = async (currentImageBase64: string, userInstruction: string, level: number, era: string, referenceImageBase64?: string): Promise<string> => {
    const imageModelId = "gemini-2.5-flash-image"; 
    let prompt = `Edit image: "${userInstruction}". CRITICAL: KEEP IDENTITY AND FACE EXACTLY THE SAME. Realistic style.`;
    try {
        const contents: any = { parts: [] };
        contents.parts.push({ inlineData: { mimeType: "image/jpeg", data: currentImageBase64.replace(/^data:image\/.+;base64,/, "") } });
        if (referenceImageBase64) contents.parts.push({ inlineData: { mimeType: "image/jpeg", data: referenceImageBase64.replace(/^data:image\/.+;base64,/, "") } });
        contents.parts.push({ text: prompt });
        const response = await ai.models.generateContent({ model: imageModelId, contents: contents });
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) { if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`; }
        }
        return "";
    } catch (error) { throw error; }
};

export const generateNarration = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) { throw error; }
};