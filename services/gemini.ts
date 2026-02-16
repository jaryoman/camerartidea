import { GoogleGenerativeAI } from "@google/generative-ai";

// 여기를 수정했습니다: 로컬 스토리지에서 키를 가져오도록 변경
const API_KEY = localStorage.getItem('GEMINI_API_KEY') || ""; 
const genAI = new GoogleGenerativeAI(API_KEY);
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AdScenario } from "../types";

// Helper to get a fresh AI instance with the latest key
const getAIInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API 키를 찾을 수 없습니다. 먼저 키를 선택해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

export const checkApiKey = async (): Promise<boolean> => {
  // @ts-ignore - window.aistudio is injected by the environment
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const promptForApiKey = async (): Promise<void> => {
   // @ts-ignore
   if (window.aistudio && window.aistudio.openSelectKey) {
     // @ts-ignore
     await window.aistudio.openSelectKey();
   }
};

/**
 * Analyzes the images and generates a scenario + 30 prompts using Gemini 3 Pro.
 */
export const generateAdScenario = async (imagesBase64: string[], userGuidance: string = ""): Promise<AdScenario> => {
  const ai = getAIInstance();
  
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "광고 캠페인의 눈길을 끄는 제목." },
      concept: { type: Type.STRING, description: "광고 컨셉과 감정선에 대한 상세한 설명." },
      targetAudience: { type: Type.STRING, description: "주요 타겟 오디언스." },
      marketingHook: { type: Type.STRING, description: "메인 마케팅 후킹 메시지 또는 슬로건." },
      imagePrompts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "30개의 연속성을 가진 영화적이고 감성적인 이미지 프롬프트.",
      },
    },
    required: ["title", "concept", "targetAudience", "marketingHook", "imagePrompts"],
  };

  // Create image parts for all uploaded images
  const imageParts = imagesBase64.map((data) => ({
    inlineData: {
      mimeType: "image/png", // We assume inputs are converted/compatible or just use generic image type handling
      data: data,
    },
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        ...imageParts,
        {
          text: `
            당신은 감성적인 스토리텔링과 섬세한 영화적 미장센에 특화된 세계적인 크리에이티브 디렉터입니다.
            
            사용자 가이드: "${userGuidance ? userGuidance : "이미지를 바탕으로 인물의 감정이 살아있는 깊이 있는 시나리오를 만드세요."}"
            
            1. **심층 분석:** 업로드된 제품/이미지의 본질을 파악하고, 이를 통해 전달할 수 있는 인간의 근원적인 감정을 찾아내세요.
            
            2. **감정의 여정 (Emotional Arc):** 
               - 단순한 광고 이미지의 나열이 아닙니다. 30장의 이미지는 하나의 짧은 영화(Short Film)처럼 기승전결이 있어야 합니다.
               - 흐름 예시: [일상의 결핍/권태] -> [우연한 발견/호기심] -> [제품과의 첫 만남/교감] -> [몰입과 경험] -> [내면의 변화/환희] -> [여운].
            
            3. **30컷의 시네마틱 시퀀스 프롬프트 작성 (가장 중요):**
               - **연속성(Continuity):** 각 프롬프트는 이전 장면과 시각적, 감정적으로 자연스럽게 이어져야 합니다 (맥락과 개연성 유지). 갑작스럽게 튀는 장면을 배제하세요.
               - **미세한 감정 묘사(Micro-expressions):** "웃고 있다" 대신 "입가에 번지는 옅은 미소", "눈가에 맺힌 벅찬 감정", "떨리는 손끝" 등 인물의 내면을 보여주는 디테일에 집중하세요.
               - **영화적 연출:** 익스트림 클로즈업(눈, 입술, 손), 몽환적인 아웃포커싱, 빛과 그림자의 대비(Chiaroscuro), 1인칭 시점 등을 활용하여 몰입감을 높이세요.
               - **모든 텍스트는 한국어로 작성하세요.**
               - 프롬프트는 'gemini-3-pro-image-preview' 모델이 4K 고화질 시네마틱 이미지를 생성할 수 있도록 조명, 질감, 렌즈 효과 등을 구체적으로 묘사해야 합니다.

            목표: 사용자가 생성된 30장의 이미지를 순서대로 보았을 때, 대사 없이도 인물의 감정선에 깊이 공감하고 제품의 가치를 느끼게 하는 것입니다.
          `,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      thinkingConfig: { thinkingBudget: 2048 }, // Increased thinking budget for deeper narrative construction
    },
  });

  if (!response.text) {
    throw new Error("Gemini로부터 응답이 없습니다.");
  }

  try {
    const data = JSON.parse(response.text);
    return data as AdScenario;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("광고 시나리오 데이터를 분석하는데 실패했습니다.");
  }
};

/**
 * Generates a single high-quality image using Gemini 3 Pro Image.
 */
export const generateSingleImage = async (prompt: string): Promise<string> => {
  const ai = getAIInstance();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9", // Cinematic ratio
          imageSize: "4K",    // High resolution
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("이미지 데이터를 찾을 수 없습니다.");
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};
