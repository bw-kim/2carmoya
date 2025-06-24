// analyze.js

// 1단계: 차량의 사실 정보만 요청하는 프롬프트 (간결화, Temperature 0.1)
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
                      "model": "string",
                      "confidence": "number",
                      "price_range": "string",
                      "release_period": "string",
                      "features": "string"
                    }
                  ]
                }
                ### 지시사항 ###
                1. 이미지가 자동차인지 판단 후 'is_car' 설정. 아니라면 모든 필드 null.
                2. 'confidence'는 추측에 대한 자신감을 0-100 숫자로 표현. 사진 모호 시 낮게 설정.
                3. 1순위 'confidence'가 90 미만이면 2순위 후보 추가.
                `
            },
            { "inline_data": { "mime_type": "image/jpeg", "data": base64Image } }
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.1
    }
});

// 2단계: 식별된 차종을 바탕으로 페르소나 분석을 요청하는 프롬프트 (Temperature 0.8)
const createPersonaAnalysisRequest = (carModel) => ({
    "contents": [{
        "parts": [
            {
                "text": `
                너는 자동차로 사람의 페르소나를 분석하는 '카BTI' 전문가야. 유머와 '밈(meme)'을 섞어서 분석해줘.
                '${carModel}' 차량이 식별되었다. 이 차를 타는 사람의 페르소나를 아래 JSON 구조에 맞춰서 창의적이고 재치있게 분석해줘.
                
                {
                  "verdict": {
                    "car_review": "string",
                    "owner_wealth_hint": "string"
                  },
                  "lifestyle": {
                    "playlist": "string",
                    "weekend_haunts": "string",
                    "instagram_feed": "string"
                  },
                  "vibe": {
                    "fashion_style": "string",
                    "car_scent": "string",
                    "go_to_coffee": "string"
                  },
                  "meme_index": {
                    "show_off": "number",
                    "reckless": "number",
                    "jealousy": "number",
                    "success": "number",
                    "family": "number"
                  }
                }
                `
            }
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.8
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
        
        // 모든 API 호출에 gemini-1.5-flash-latest 모델 사용
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
            ...personaJson 
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