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
                      "verdict": {
                        "car_review": "차량 자체에 대한 재치있는 한줄평",
                        "owner_wealth_hint": "차량 가격대에 기반한 소유주의 재력에 대한 은유적 코멘트. 저렴한 차라도 절대 비꼬지 말고 긍정적으로 표현해줘. (예: '강력한 상대입니다', '검소함 속의 멋을 아는 분이네요')"
                      },
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
                    1. 이미지를 보고 자동차인지 아닌지 먼저 판단해줘. 자동차가 아니라면 'is_car'를 false로 설정하고 나머지 모든 필드는 null로 채워줘.
                    2. 'confidence'는 너의 추측에 대한 자신감을 0에서 100 사이의 숫자로 표현한 '적중률'이야. **사진이 흐리거나, 로고가 안보이거나, 특징이 명확하지 않으면 자신감(confidence) 수치를 솔직하고 과감하게 낮춰서 표현해야 해. 절대 예시 숫자 95를 그대로 쓰면 안돼.**
                    3. 1순위 후보의 'confidence'가 90 미만이라면, 2순위 후보를 'car_candidates' 배열에 추가해줘.
                    4. 'verdict'와 나머지 분석은 1순위 후보를 기준으로 작성해줘.
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
            console.error('Failed to parse Gemini response as JSON