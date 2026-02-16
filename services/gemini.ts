import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AdScenario } from "../types";

// [수정됨] API 키를 로컬 스토리지에서 확실하게 가져옵니다.
const getAIInstance = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("API 키가 없습니다. 화면을 새로고침하고 키를 다시 입력해주세요.");
  }
  return new GoogleGenAI({ apiKey });
};

// [유지] App.tsx와의 호환성을 위해 빈 함수 유지
export const checkApiKey = async (): Promise<boolean> => { return true; };
export const promptForApiKey = async (): Promise<void> => {};

/**
 * 사용자님이 요청하신 Gemini 3 Pro 설정이 포함된 시나리오 생성 함수
 */
export const generateAdScenario = async (imagesBase64: string[], userGuidance: string = ""): Promise<AdScenario> => {
  const ai = getAIInstance();
  
  // 요청하신 스키마 그대로 유지
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

  // 이미지 데이터 변환
  const imageParts = imagesBase64.map((data) => ({
    inlineData: {
      mimeType: "image/png", 
      data: data,
    },
  }));

  try {
    // 👇 사용자님이 요청하신 코드 블록 (수정 없이 그대로 적용) 👇
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // 요청하신 모델명 유지
      contents: {
        parts: [
          ...imageParts,
          {
            text: `
              당신은 감성적인 스토리텔링과 섬세한 영화적 미장센에 특화된 세계적인 크리에이티브 디렉터입니다.
              
              사용자 가이드: "${userGuidance ? userGuidance : "이미지를 바탕으로 인물의 감정이 살아있는 깊이 있는 시나리오를 만드세요."}"
              
              1. **심층 분석:** 업로드된 제품/이미지의 본질을 파악하고, 이를 통해 전달할 수 있는 인간의 근원적인 감정을 찾아내세요.
              
              2. **감정의 여정 (Emotional Arc):** - 단순한 광고 이미지의 나열이 아닙니다. 30장의 이미지는 하나의 짧은 영화(Short Film)처럼 기승전결이 있어야 합니다.
                 - 흐름 예시: [일상의 결핍/권태] -> [우연한 발견/호기심] -> [제품과의 첫 만남/교감] -> [몰입과 경험] -> [내면의 변화/환희] -> [여운].
              
              3. **30컷의 시네마틱 시퀀스 프롬프트 작성 (가장 중요):**
                 - **연속성(Continuity):** 각 프롬프트는 이전 장면과 시각적, 감정적으로 자연스럽게 이어져야 합니다 (맥락과 개연성 유지). 갑작스럽게 튀는 장면을 배제하세요.
                 - **미세한 감정 묘사(Micro-expressions):** "웃고 있다" 대신 "입가에 번지는 옅은 미소", "눈가에 맺힌 벅찬 감정", "떨리는 손끝" 등 인물의 내면을 보여주는 디테일에 집중하세요.
                 - **영화적 연출:** 익스트림 클로즈업(눈, 입술, 손), 몽환적인 아웃포커싱, 빛과 그림자의 대비(Chiaroscuro), 1인칭 시점 등을 활용하여 몰입감을 높이세요.
                 - **모든 텍스트는 한국어로 작성하세요.**
                 - 프롬프트는 'gemini-3-pro-image-preview' 모델이 4K 고화질 시네마틱 이미지를 생성할 수 있도록
