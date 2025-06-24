document.addEventListener('DOMContentLoaded', () => {
    // 페이지 DOM 요소
    const mainPage = document.getElementById('main-page');
    const uploadPage = document.getElementById('upload-page');
    const resultPage = document.getElementById('result-page');

    // 버튼 DOM 요소
    const startAnalysisButton = document.getElementById('start-analysis-button');
    const backToMainButton = document.getElementById('back-to-main-button');
    const resetButton = document.getElementById('reset-button');
    
    // 업로드 및 결과 표시 관련 DOM 요소
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const loaderWrapper = document.getElementById('loader-wrapper');
    const loadingText = document.getElementById('loading-text');
    const resultsDiv = document.getElementById('results');
    const errorSection = document.getElementById('error-section');
    const finalVerdictSection = document.getElementById('final-verdict-section');
    const carInfoSection = document.getElementById('car-info-section');
    const lifestyleSection = document.getElementById('lifestyle-section');
    const vibeSection = document.getElementById('vibe-section');
    const memeChartCanvas = document.getElementById('memeChart');
    
    let myMemeChart = null;
    let loadingInterval = null;

    // --- 페이지 전환 로직 ---
    startAnalysisButton.addEventListener('click', () => {
        mainPage.style.display = 'none';
        uploadPage.style.display = 'block';
    });
    
    backToMainButton.addEventListener('click', () => {
        uploadPage.style.display = 'none';
        mainPage.style.display = 'block';
    });

    resetButton.addEventListener('click', () => {
        resultPage.style.display = 'none';
        uploadPage.style.display = 'block';
        imageUpload.value = null; 
        
        if (myMemeChart) {
            myMemeChart.destroy();
            myMemeChart = null;
        }
    });

    // --- 분석 로직 ---
    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        uploadPage.style.display = 'none';
        resultPage.style.display = 'block';
        resultsDiv.style.display = 'none';
        errorSection.style.display = 'none';
        loaderWrapper.style.display = 'block';
        startLoadingAnimation();

        const reader = new FileReader();
        reader.onload = (e) => { imagePreview.src = e.target.result; };
        reader.readAsDataURL(file);

        const base64Image = await toBase64(file);

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image.split(',')[1] }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '서버에서 오류가 발생했습니다.');
            }

            const data = await response.json();
            displayResults(data.analysis);

        } catch (error) {
            displayError(error.message);
        } finally {
            stopLoadingAnimation();
        }
    });

    // --- 로딩 애니메이션 함수 ---
    function startLoadingAnimation() {
        const messages = [
            "전여친 인스타 염탐 중...",
            "AI가 현남친의 재력을 분석 중입니다...",
            "차량 번호판으로 신상 터는 중... (농담입니다😉)",
            "블랙박스 영상 확인 중... 혹시 뭐 찍힌 거 없죠?",
            "심장 부여잡고 기다리는 중..."
        ];
        let messageIndex = 0;
        loadingText.textContent = messages[messageIndex];
        loadingInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            loadingText.textContent = messages[messageIndex];
        }, 2000);
    }

    function stopLoadingAnimation() {
        clearInterval(loadingInterval);
        loaderWrapper.style.display = 'none';
    }

    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    // --- 에러 표시 함수 ---
    function displayError(message) {
        resultsDiv.style.display = 'none';
        errorSection.style.display = 'block';
        errorSection.innerHTML = `<p style="color: red;">${message}</p>`;
    }

    // --- 결과 표시 함수 ---
    function displayResults(analysis) {
        if (!analysis) {
            displayError('분석 결과를 가져올 수 없습니다.');
            return;
        }

        // 자동차가 아닌 사진 처리
        if (analysis.is_car === false) {
            resultsDiv.style.display = 'none';
            errorSection.style.display = 'block';
            errorSection.innerHTML = `
                <img src="https://i.ibb.co/L8yT6T8/undraw-Question-re-1fy7.png" alt="질문하는 그림">
                <h4>이건... 차가 아닌데요?</h4>
                <p>자동차 사진을 올려주셔야<br>전여친의 현남친을 분석할 수 있어요!</p>
            `;
            return;
        }

        // 최종 판결 섹션
        finalVerdictSection.innerHTML = `"${analysis.final_verdict || '분석 완료!'}"`;

        // 기본 차량 정보 (후보군) 섹션
        carInfoSection.innerHTML = '<h3>기본 정보 (AI 추정)</h3>';
        analysis.car_candidates.forEach((car, index) => {
            carInfoSection.innerHTML += `
                <div class="car-candidate">
                    <h4>후보 ${index + 1}</h4>
                    <p><strong>🚘 차종:</strong> ${car.model || '정보 없음'} (적중률 ${car.confidence || 0}%)</p>
                    <p><strong>💰 가격대:</strong> ${car.price_range || '정보 없음'}</p>
                    <p><strong>🗓️ 출시 시기:</strong> ${car.release_period || '정보 없음'}</p>
                    <p><strong>✨ 특징:</strong> ${car.features || '정보 없음'}</p>
                </div>
            `;
        });

        // 라이프스타일 섹션
        lifestyleSection.innerHTML = `
            <h3>1. 라이프스타일 & 취미</h3>
            <h4>🎵 플레이리스트</h4>
            <p>${analysis.lifestyle.playlist || '정보 없음'}</p>
            <h4>📍 주말 출몰 지역</h4>
            <p>${analysis.lifestyle.weekend_haunts || '정보 없음'}</p>
            <h4>📱 인스타그램 피드</h4>
            <p>${analysis.lifestyle.instagram_feed || '정보 없음'}</p>
        `;

        // 감성 & 디테일 섹션
        vibeSection.innerHTML = `
            <h3>2. 감성 & 디테일</h3>
            <h4>👕 '현남친' 패션 스타일</h4>
            <p>${analysis.vibe.fashion_style || '정보 없음'}</p>
            <h4>👃 차량 방향제 취향</h4>
            <p>${analysis.vibe.car_scent || '정보 없음'}</p>
            <h4>☕️ 자주 마실 것 같은 커피</h4>
            <p>${analysis.vibe.go_to_coffee || '정보 없음'}</p>
        `;

        // 밈 지수 차트
        const { meme_index } = analysis;
        const chartData = {
            labels: ['과시력', '양카력', '질투 유발력', '성공력', '패밀리력'],
            datasets: [{
                label: analysis.car_candidates[0].model || '분석 결과',
                data: [
                    meme_index.show_off || 0, meme_index.reckless || 0,
                    meme_index.jealousy || 0, meme_index.success || 0, meme_index.family || 0
                ],
                fill: true,
                backgroundColor: 'rgba(26, 115, 232, 0.2)',
                borderColor: 'rgb(26, 115, 232)',
                pointBackgroundColor: 'rgb(26, 115, 232)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(26, 115, 232)'
            }]
        };
        const chartConfig = {
            type: 'radar', data: chartData,
            options: {
                elements: { line: { borderWidth: 3 } },
                scales: {
                    r: {
                        angleLines: { display: true },
                        suggestedMin: 0, suggestedMax: 5,
                        pointLabels: { font: { size: 14, weight: 'bold' } },
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: { legend: { position: 'top' } }
            }
        };

        if (myMemeChart) myMemeChart.destroy();
        myMemeChart = new Chart(memeChartCanvas, chartConfig);

        resultsDiv.style.display = 'block';
    }
});