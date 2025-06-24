// Gemini API에 보낼 요청 형식
const createGeminiRequestBody = (base64Image) => ({
    "contents": [
        {
            "parts": [
                {
                    "text": `
                    이 사진 속 자동차에 대한 정보를 JSON 형식으로 알려줘.
                    필요한 정보는 다음과 같아:
                    1. model (차종 이름)
                    2. price (대한민국 원 기준 예상 가격대, 예: "5,000만원 ~ 6,000만원")
                    3. year (출시 연도, 예: "2023년")
                    4. demographics (주로 선호하는 소비층, 예: "30-40대 전문직 남성")
                    5. description (차량에 대한 간략한 종합 설명)
                    
                    만약 자동차가 아니거나 식별이 불가능하면, 모든 필드를 "판별 불가"로 채워줘.
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
    }
});


export async function onRequest(context) {
    // 1. POST 요청만 허용
    if (context.request.method !== 'POST') {
        return new Response('잘못된 요청입니다.', { status: 405 });
    }

    // 2. Cloudflare 대시보드에 저장된 API 키 가져오기 (가장 중요한 부분)
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
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

        const requestBody = createGeminiRequestBody(image);

        // 3. Gemini API 호출
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
            return new Response(JSON.stringify({ error: 'Gemini API에서 오류가 발생했습니다.' }), {
                status: geminiResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const geminiData = await geminiResponse.json();
        
        // Gemini의 응답에서 텍스트 부분(JSON 형식)을 파싱
        const analysisText = geminiData.candidates[0].content.parts[0].text;
        const analysisJson = JSON.parse(analysisText);
        
        // 4. 프론트엔드로 결과 반환
        return new Response(JSON.stringify({ analysis: analysisJson }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: '내부 서버 오류가 발생했습니다.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}