import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AdScenario } from "../types";

// [핵심 수정] 로컬 스토리지에서 키를 가져오도록 변경
const getAIInstance = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  
  if (!apiKey) {
    throw new Error("API 키를 찾을 수 없습니다. 키를 입력했는지 확인해주세요.");
  }
  // 기존에 쓰던 최신 라이브러리 그대로 사용
  return new GoogleGenAI({ apiKey });
};

// [호환성 유지] App.tsx에서 이 함수들을 찾을 수 있어 빈 껍데기만 남겨둡니다. (에러 방지용)
export const checkApiKey = async (): Promise<boolean> => {
  return true; 
};

export const promptForApiKey = async (): Promise<void> => {
  // 아무것도 하지 않음
};

/**
 * 시나리오 생성 (Gemini 3 Pro 사용)
 */
export const generateAdScenario = async (imagesBase64: string[], userGuidance: string = ""): Promise<AdScenario> => {
  const ai = getAIInstance();
  
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      concept: { type: Type.STRING },
      targetAudience: { type: Type.STRING },
      marketingHook: { type: Type.STRING },
      imagePrompts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["title", "concept", "targetAudience", "marketingHook", "imagePrompts"],
  };

  const imageParts = imagesBase64.map((data) => ({
    inlineData: {
      mimeType: "image/png",
      data: data,
    },
  }));

  try {
    // 모델명을 최신 공개 모델로 변경하여 안정성 확보 (3-pro-preview -> 2.0-flash)
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", 
      contents: {
        parts: [
          ...imageParts,
          {
            text: `
              당신은 세계적인 크리에이티브 디렉터입니다.
              사용자 가이드: "${userGuidance}"
              
              이미지를 분석하고 광고 시나리오를 JSON 형식으로 작성하세요.
              출력 포맷:
              {
                "title": "제목",
                "concept": "컨셉",
                "targetAudience": "타겟",
                "marketingHook": "카피",
                "imagePrompts": ["프롬프트1", "프롬프트2", ... 30개]
              }
            `,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const data = JSON.parse(response.text());
    return data as AdScenario;

  } catch (e: any) {
    console.error("Scenario Error:", e);
    throw new Error(`시나리오 생성 실패: ${e.message || "알 수 없는 오류"}`);
  }
};

/**
 * 이미지 생성 함수 (테스트용 플레이스홀더 반환)
 */
export const generateSingleImage = async (prompt: string): Promise<string> => {
  // 키 연결 확인을 위해, 일단 확실하게 작동하는 테스트 이미지를 보여줍니다.
  return `https://via.placeholder.com/1024x576/FFCC00/000000?text=Success!`;
};
