document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 가져오기
    const uploadContainer = document.getElementById('upload-container');
    const resultWrapper = document.getElementById('result-wrapper');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const resultsDiv = document.getElementById('results');
    const loader = document.getElementById('loader');
    const resetButton = document.getElementById('reset-button');
    
    // ⭐️ 기본 정보 섹션 DOM 요소 추가
    const carInfoSection = document.getElementById('car-info-section');
    const lifestyleSection = document.getElementById('lifestyle-section');
    const vibeSection = document.getElementById('vibe-section');
    const memeChartCanvas = document.getElementById('memeChart');
    
    let myMemeChart = null;

    // 이미지 업로드 이벤트 리스너
    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        uploadContainer.style.display = 'none';
        resultWrapper.style.display = 'block';
        resultsDiv.style.display = 'none';
        loader.style.display = 'block';

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
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = `<p style="color: red; text-align: center;">오류: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    });

    // '처음으로' 버튼 이벤트 리스너
    resetButton.addEventListener('click', () => {
        uploadContainer.style.display = 'block';
        resultWrapper.style.display = 'none';
        imageUpload.value = null; 
        
        if (myMemeChart) {
            myMemeChart.destroy();
            myMemeChart = null;
        }
    });

    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    // 분석 결과를 화면에 표시하는 함수
    function displayResults(analysis) {
        if (!analysis || !analysis.car_info || !analysis.car_info.model) {
            resultsDiv.innerHTML = `<p style="color: red; text-align: center;">분석 결과를 가져올 수 없습니다.</p>`;
            resultsDiv.style.display = 'block';
            return;
        }
        
        // ⭐️ 0. 기본 차량 정보 섹션 채우기 (가장 먼저)
        const { car_info } = analysis;
        carInfoSection.innerHTML = `
            <h3>기본 정보</h3>
            <p><strong>🚘 차종:</strong> ${car_info.model || '정보 없음'}</p>
            <p><strong>💰 가격대:</strong> ${car_info.price_range || '정보 없음'}</p>
            <p><strong>🗓️ 출시 시기:</strong> ${car_info.release_period || '정보 없음'}</p>
        `;

        // 1. 라이프스타일 섹션 채우기
        const { lifestyle } = analysis;
        lifestyleSection.innerHTML = `
            <h3>1. 라이프스타일 & 취미</h3>
            <h4>🎵 플레이리스트</h4>
            <p>${lifestyle.playlist || '정보 없음'}</p>
            <h4>📍 주말 출몰 지역</h4>
            <p>${lifestyle.weekend_haunts || '정보 없음'}</p>
            <h4>📱 인스타그램 피드</h4>
            <p>${lifestyle.instagram_feed || '정보 없음'}</p>
        `;

        // 2. 감성 & 디테일 섹션 채우기
        const { vibe } = analysis;
        vibeSection.innerHTML = `
            <h3>2. 감성 & 디테일</h3>
            <h4>👕 '현남친' 패션 스타일</h4>
            <p>${vibe.fashion_style || '정보 없음'}</p>
            <h4>💬 카톡 스타일</h4>
            <p>${vibe.kakaotalk_style || '정보 없음'}</p>
            <h4>🤫 내 마음속 한마디</h4>
            <p>"${vibe.inner_monologue || '정보 없음'}"</p>
        `;

        // 3. 밈 지수 차트 그리기
        const { meme_index } = analysis;
        const chartData = {
            labels: ['과시력', '양카력', '질투 유발력', '성공력', '패밀리력'],
            datasets: [{
                // ⭐️ 차트 라벨을 car_info.model 로 변경
                label: car_info.model || '분석 결과',
                data: [
                    meme_index.show_off || 0,
                    meme_index.reckless || 0,
                    meme_index.jealousy || 0,
                    meme_index.success || 0,
                    meme_index.family || 0
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
            type: 'radar',
            data: chartData,
            options: {
                elements: { line: { borderWidth: 3 } },
                scales: {
                    r: {
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: 5,
                        pointLabels: { font: { size: 14, weight: 'bold' } },
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: { legend: { position: 'top' } }
            }
        };

        if (myMemeChart) {
            myMemeChart.destroy();
        }
        myMemeChart = new Chart(memeChartCanvas, chartConfig);

        resultsDiv.style.display = 'block';
    }
});