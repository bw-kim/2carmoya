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
    const verdictSection = document.getElementById('verdict-section');
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
        reader.readAsData