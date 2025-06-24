// Gemini API에 보낼 요청 본문을 생성하는 함수
const createGeminiRequestBody = (base64Image) => ({
    "contents": [
        {
            "parts": [
                {
                    // 1. 개선된 프롬프트 적용
                    "text": `
                    Step 1: 이 사진 속 자동차의 제조사, 모델명, 세대(예: 1세대)를 최대한 자세히 식별해줘.
                    Step 2: 만약 Step 1에서 차종을 성공적으로 식별했다면, 그 정보를 바탕으로 아래 JSON 형식에 맞춰서 답변해줘. 각 필드에 대한 정보가 확실하지 않다면 "정보 부족"이라고 명시해줘.

                    {
                      "model": "식별된 모델명 (세대 포함)",
                      "price": "신차 또는 중고차 기준 예상 가격대",
                      "year": "사진 속 모델의 출시 기간 (예: 2016년~2022년)",
                      "demographics": "주로 선호하는 소비층",
                      "description": "차량의 주요 특징 및 간략한 종합 설명"
                    }

                    만약 Step 1에서 자동차 식별 자체가 불가능하다면, 모든 필드를 "판별 불가"로 채운 JSON을 반환해줘.
                    `
                },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64Image
                    }
                }
            ]
        }
    ],
    "generationConfig": {
        "response_mime_type": "application/json"
    },
    // 안정적인 답변을 위해 temperature 값을 낮게 설정 (선택 사항)
    "safetySettings": [
        { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
        { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
        { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
        { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
    ]
});


export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response('잘못된 요청입니다.', { status: 405 });
    }

    const geminiApiKey = context.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: '서버에 API 키가 설정되지 않았습니다.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    try {
        const { image } = await context.request.json();
        if (!image) {
            return new Response(JSON.stringify({ error: '이미지 데이터가 없습니다.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // 2. gemini-1.5-pro-latest 모델을 사용하도록 URL 수정
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;

        const requestBody = createGeminiRequestBody(image);

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            return new Response(JSON.stringify({ error: `Gemini API 오류: ${errorBody}` }), {
                status: geminiResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const geminiData = await geminiResponse.json();

        if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content.parts[0].text) {
            console.error('Unexpected Gemini response structure:', geminiData);
            throw new Error('Gemini로부터 예상치 못한 형식의 응답을 받았습니다.');
        }
        
        const analysisText = geminiData.candidates[0].content.parts[0].text;
        let analysisJson;

        try {
            analysisJson = JSON.parse(analysisText);
        } catch (parseError) {
            console.error('Failed to parse Gemini response as JSON:', analysisText);
            throw new Error('Gemini가 반환한 텍스트를 JSON으로 변환하는 데 실패했습니다.');
        }
        
        return new Response(JSON.stringify({ analysis: analysisJson }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Server-side exception:', e);
        return new Response(JSON.stringify({ error: `서버 내부 오류: ${e.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}