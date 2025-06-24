document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const resultsDiv = document.getElementById('results');
    const loader = document.getElementById('loader');

    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 1. 이미지 미리보기 보여주기
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // 2. 결과창 초기화 및 로더 표시
        resultsDiv.innerHTML = '';
        loader.style.display = 'block';

        // 3. 이미지를 Base64로 변환하여 서버로 전송
        const base64Image = await toBase64(file);

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: base64Image.split(',')[1] }), // "data:image/jpeg;base64," 부분 제거
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '서버에서 오류가 발생했습니다.');
            }

            const data = await response.json();
            
            // 4. 결과 표시
            displayResults(data.analysis);

        } catch (error) {
            resultsDiv.innerHTML = `<p style="color: red;">오류: ${error.message}</p>`;
        } finally {
            // 5. 로더 숨기기
            loader.style.display = 'none';
        }
    });

    // 파일 객체를 Base64 문자열로 변환하는 헬퍼 함수
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    // 분석 결과를 HTML 형식으로 만들어주는 함수
    function displayResults(analysis) {
        if (!analysis) {
            resultsDiv.innerHTML = '<p>분석 결과를 가져올 수 없습니다.</p>';
            return;
        }

        let html = `
            <h3>AI 분석 결과</h3>
            <p><strong>차종:</strong> ${analysis.model || '정보 없음'}</p>
            <p><strong>가격대:</strong> ${analysis.price || '정보 없음'}</p>
            <p><strong>출시 연도:</strong> ${analysis.year || '정보 없음'}</p>
            <p><strong>주요 소비층:</strong> ${analysis.demographics || '정보 없음'}</p>
            <hr>
            <p><strong>AI의 상세 설명:</strong></p>
            <p>${analysis.description || '상세 설명 없음'}</p>
        `;
        resultsDiv.innerHTML = html;
    }
});