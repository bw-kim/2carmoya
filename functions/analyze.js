// 1단계: 차량의 사실 정보만 요청하는 프롬프트 (⭐️ 한글로 수정됨 ⭐️)
const createCarIdentificationRequest = (base64Image) => ({
    "contents": [{
        "parts": [
            {
                "text": `
                너는 매우 정확한 자동차 식별 전문가야. 이미지 속 자동차를 분석하고, 다음 JSON 형식에 맞춰 사실 정보만 제공해줘. 모든 답변은 반드시 한글로 작성해줘.

                {
                  "is_car": true,
                  "car_candidates": [
                    {
                      "model": "가장 유력한 자동차 모델명 (세대 포함)",
                      "confidence": 95,
                      "price_range": "예상 가격대 (KRW 기준)",
                      "release_period": "해당 모델의 출시 기간",
                      "features": "이 차의 핵심 특징"
                    }
                  ]
                }
                
                ### 지시사항 ###
                1. 먼저 이미지가 자동차인지 판단해줘. 아니라면 'is_car'를 false로 설정하고 나머지 모든 필드는 null로 채워줘.
                2. 'confidence'는 너의 추측에 대한 자신감을 0에서 100 사이의 숫자로 표현한 '적중률'이야. 사진이 흐리거나 모호하면 자신감 수치를 솔직하게 낮춰서 표현해야 해. 예시 숫자 95를 그대로 쓰지 마.
                3. 1순위 후보의 'confidence'가 90 미만이라면, 2순위 후보를 'car_candidates' 배열에 추가해줘.
                `
            },
            { "inline_data": { "mime_type": "image/jpeg", "data": base64Image } }
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.1 // 사실 확인을 위해 매우 낮은 temperature 설정
    }
});

// 2단계: 식별된 차종을 바탕으로 페르소나 분석을 요청하는 프롬프트
const createPersonaAnalysisRequest = (carModel) => ({
    "contents": [{
        "parts": [
            {
                "text": `
                너는 자동차로 사람의 페르소나를 분석하는 '카BTI' 전문가야. 유머와 '밈(meme)'을 섞어서 분석해줘.
                '${carModel}' 차량이 식별되었다. 이 차를 타는 사람의 페르소나를 아래 JSON 구조에 맞춰서 창의적이고 재치있게 분석해줘.
                
                {
                  "verdict": {
                    "car_review": "차량 자체에 대한 재치있는 한줄평",
                    "owner_wealth_hint": "차량 가격대에 기반한 소유주의 재력에 대한 은유적 코멘트. 저렴한 차라도 절대 비꼬지 말고 긍정적으로 표현해줘."
                  },
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
                `
            }
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.8 // 창의적인 분석을 위해 높은 temperature 설정
    }
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

        // --- 1단계: 차량 정보 식별 API 호출 ---
        const identificationRequest = createCarIdentificationRequest(image);
        const identificationResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(identificationRequest),
        });

        if (!identificationResponse.ok) throw new Error(`Gemini API Error (Step 1): ${await identificationResponse.text()}`);
        
        const identificationData = await identificationResponse.json();
        const identificationText = identificationData.candidates[0].content.parts[0].text;
        const identificationJson = JSON.parse(identificationText);

        // 자동차가 아니거나 식별 실패 시, 그대로 결과 반환
        if (identificationJson.is_car === false || !identificationJson.car_candidates || identificationJson.car_candidates.length === 0) {
            return new Response(JSON.stringify({ analysis: { is_car: false } }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const identifiedCarModel = identificationJson.car_candidates[0].model;

        // --- 2단계: 페르소나 분석 API 호출 ---
        const personaRequest = createPersonaAnalysisRequest(identifiedCarModel);
        const personaResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personaRequest),
        });
        
        if (!personaResponse.ok) throw new Error(`Gemini API Error (Step 2): ${await personaResponse.text()}`);

        const personaData = await personaResponse.json();
        const personaText = personaData.candidates[0].content.parts[0].text;
        const personaJson = JSON.parse(personaText);

        // --- 1단계와 2단계 결과 합치기 ---
        const finalAnalysis = {
            is_car: true,
            car_candidates: identificationJson.car_candidates,
            ...personaJson // verdict, lifestyle, vibe, meme_index 포함
        };
        
        return new Response(JSON.stringify({ analysis: finalAnalysis }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Server-side exception:', e.message);
        return new Response(JSON.stringify({ error: `서버 내부 오류: ${e.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}