const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const TARGET_SIZE = 1.9 * 1024 * 1024; // 1.9MB

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const errorMessage = document.getElementById('errorMessage');
const previewSection = document.getElementById('previewSection');
const originalPreview = document.getElementById('originalPreview');
const compressedPreview = document.getElementById('compressedPreview');
const originalSize = document.getElementById('originalSize');
const originalDimensions = document.getElementById('originalDimensions');
const compressedSize = document.getElementById('compressedSize');
const compressedDimensions = document.getElementById('compressedDimensions');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressFill = document.getElementById('progressFill');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const compressedInfo = document.getElementById('compressedInfo');

let compressedBlob = null;
let originalFileName = '';
let originalImageWidth = null;
let originalImageHeight = null;
let originalImageElement = null;

// 파일 크기 포맷팅
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// 에러 메시지 표시
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// 에러 메시지 숨기기
function hideError() {
    errorMessage.style.display = 'none';
}

// 파일 처리
async function handleFile(file) {
    hideError();
    
    // 파일 크기 검증
    if (file.size > MAX_UPLOAD_SIZE) {
        showError(`파일 크기가 너무 큽니다. 최대 업로드 용량은 100MB입니다. (현재: ${formatFileSize(file.size)})`);
        return;
    }

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
        showError('이미지 파일만 업로드할 수 있습니다.');
        return;
    }

    originalFileName = file.name;
    
    // 원본 이미지 미리보기 및 크기 가져오기
    const reader = new FileReader();
    reader.onload = async (e) => {
        originalPreview.src = e.target.result;
        originalSize.textContent = `크기: ${formatFileSize(file.size)}`;
        
        // 이미지 크기 가져오기
        const img = new Image();
        img.onload = async () => {
            originalDimensions.textContent = `해상도: ${img.width} × ${img.height}px`;
            originalImageWidth = img.width;
            originalImageHeight = img.height;
            originalImageElement = img;
            
            // 압축 시작
            previewSection.style.display = 'block';
            loadingOverlay.style.display = 'flex';
            compressedPreview.style.display = 'none';
            compressedInfo.style.display = 'none';
            downloadBtn.style.display = 'none';
            progressFill.style.width = '0%';

            try {
                await compressImage(file);
            } catch (error) {
                showError(`압축 중 오류가 발생했습니다: ${error.message}`);
                loadingOverlay.style.display = 'none';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Canvas를 사용하여 이미지 압축 (해상도 유지)
function compressImageWithCanvas(image, quality) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = originalImageWidth;
        canvas.height = originalImageHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, originalImageWidth, originalImageHeight);
        
        // 파일 타입에 따라 적절한 MIME 타입 설정
        let mimeType = 'image/jpeg';
        if (originalFileName.toLowerCase().endsWith('.png')) {
            mimeType = 'image/png';
        } else if (originalFileName.toLowerCase().endsWith('.webp')) {
            mimeType = 'image/webp';
        }
        
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas 압축 실패'));
            }
        }, mimeType, quality);
    });
}

// 이미지 압축
async function compressImage(file) {
    // 이미지 로드
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);
    
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
    });
    
    let quality = 0.9;
    let resultBlob = null;
    const maxAttempts = 10; // 더 많은 시도로 정밀도 향상
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        progressFill.style.width = `${((attempt + 1) / maxAttempts) * 100}%`;
        
        try {
            resultBlob = await compressImageWithCanvas(image, quality);
            
            // 1.9MB 이하인지 확인
            if (resultBlob.size <= TARGET_SIZE) {
                break;
            }
            
            // 목표 크기를 초과하면 품질을 낮춤
            if (attempt < maxAttempts - 1) {
                // 이진 탐색 방식으로 품질 조정
                const nextQuality = quality - (0.9 / maxAttempts);
                quality = Math.max(0.1, nextQuality);
            }
        } catch (error) {
            URL.revokeObjectURL(imageUrl);
            throw new Error(`압축 실패: ${error.message}`);
        }
    }
    
    URL.revokeObjectURL(imageUrl);
    
    if (!resultBlob || resultBlob.size > TARGET_SIZE) {
        throw new Error('목표 크기(1.9MB) 이하로 압축할 수 없습니다.');
    }
    
    // 전역 변수에 저장
    compressedBlob = resultBlob;
    
    // 압축된 이미지 미리보기
    const reader = new FileReader();
    reader.onload = (e) => {
        compressedPreview.src = e.target.result;
        compressedSize.textContent = `크기: ${formatFileSize(resultBlob.size)}`;
        compressedDimensions.textContent = `해상도: ${originalImageWidth} × ${originalImageHeight}px`;
    };
    reader.readAsDataURL(resultBlob);
    loadingOverlay.style.display = 'none';
    compressedPreview.style.display = 'block';
    compressedInfo.style.display = 'flex';
    downloadBtn.style.display = 'block';
    progressFill.style.width = '100%';
}

// 다운로드
function downloadCompressedImage() {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // 원본 파일명에서 확장자 추출
    const extension = originalFileName.split('.').pop();
    const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
    a.download = `${nameWithoutExt}_compressed.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 리셋
function reset() {
    previewSection.style.display = 'none';
    fileInput.value = '';
    compressedBlob = null;
    originalFileName = '';
    originalImageWidth = null;
    originalImageHeight = null;
    originalImageElement = null;
    hideError();
}

// 이벤트 리스너
selectBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

downloadBtn.addEventListener('click', downloadCompressedImage);
resetBtn.addEventListener('click', reset);

// 드래그 앤 드롭 방지 (전역)
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
});

