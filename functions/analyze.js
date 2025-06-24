const createGeminiRequestBody = (base64Image) => ({
    "contents": [
        {
            "parts": [
                {
                    "text": `
                    너는 자동차로 사람의 페르소나를 분석하는 '카BTI' 전문가야. 정확한 정보와 유머, '밈(meme)'을 섞어서 분석해줘.
                    이 사진 속 자동차를 기반으로, 아래 JSON 구조에 맞춰서 답변해줘.

                    {
                      "is_car": true,
                      "final_verdict": "모든 분석 결과를 한 문장으로 요약한 최종 판결",
                      "car_candidates": [
                        {
                          "model": "가장 유력한 자동차 모델명 (세대 포함)",
                          "confidence": 95,
                          "price_range": "신차 또는 중고차 기준 예상 가격대 (KRW)",
                          "release_period": "해당 모델의 출시 기간",
                          "features": "이 차의 핵심 특징이나 사람들이 열광하는 포인트"
                        }
                      ],
                      "lifestyle": {
                        "playlist": "이 차에서 흘러나올 것 같은 음악 플레이리스트",
                        "weekend_haunts": "주말에 이 차가 주로 나타날 것 같은 장소",
                        "instagram_feed": "이 차주 인스타그램에 올라올 법한 게시물 특징"
                      },
                      "vibe": {
                        "fashion_style": "차주가 즐겨 입을 것 같은 패션 스타일",
                        "car_scent": "차에서 날 것 같은 방향제나 향기",
                        "go_to_coffee": "차주가 자주 마실 것 같은 커피 메뉴"
                      },
                      "meme_index": {
                        "show_off": "과시력 (1~5점)",
                        "reckless": "양카력 (1~5점)",
                        "jealousy": "질투 유발력 (1~5점)",
                        "success": "성공력 (1~5점)",
                        "family": "패밀리력 (1~5점)"
                      }
                    }

                    ### 지시사항 ###
                    1. 이미지를 보고 자동차인지 아닌지 먼저 판단해줘.
                    2. 자동차가 맞다면: 'is_car'를 true로 설정하고 나머지 모든 필드를 채워줘.
                    3. 자동차가 아니라면: 'is_car'를 false로 설정하고, 나머지 모든 필드는 null로 채워줘.
                    4. 1순위 후보의 'confidence'가 90 미만이라면, 2순위 후보를 'car_candidates' 배열에 추가해줘.
                    5. 'final_verdict'는 모든 분석 내용을 바탕으로 가장 임팩트 있는 한마디로 요약해줘.
                    `
                },
                { "inline_data": { "mime_type": "image/jpeg", "data": base64Image } }
            ]
        }
    ],
    "generationConfig": { "response_mime_type": "application/json" }
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
            return new Response(JSON.stringify({ error: '이미지 데이터가 없습니다.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        const requestBody = createGeminiRequestBody(image);
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            return new Response(JSON.stringify({ error: `Gemini API 오류: ${errorBody}` }), { status: geminiResponse.status, headers: { 'Content-Type': 'application/json' } });
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