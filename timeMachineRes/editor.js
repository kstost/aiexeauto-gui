// CodeMirror 리소스 로드 상태
let isCodeMirrorLoaded = false;
let loadPromise = null;

// CodeMirror 관련 리소스 로드
export function loadCodeMirrorResources() {
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = new Promise((resolve) => {
        // 기본 CodeMirror 스타일시트
        loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css');
        // 테마 추가 (가독성 향상)
        loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css');
        
        // 추가 CSS 스타일 적용
        addCustomStyles();
        
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js', () => {
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js', () => {
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/markdown/markdown.min.js', () => {
                    isCodeMirrorLoaded = true;
                    resolve();
                });
            });
        });
    });

    return loadPromise;
}

// 사용자 정의 CSS 스타일 추가
function addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .CodeMirror {
            height: auto !important;
            min-height: 100px;
            border: 1px solid #ddd;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
        }
        .CodeMirror-scroll {
            min-height: 100px;
        }
    `;
    document.head.appendChild(style);
}

// 스크립트 로드 함수
function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
}

// 스타일시트 로드 함수
function loadStylesheet(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

// CodeMirror 에디터 생성
export async function createCodeMirrorEditor(container, content, mode = 'markdown') {
    // CodeMirror가 로드되지 않았다면 기다립니다
    if (!isCodeMirrorLoaded) {
        await loadCodeMirrorResources();
    }

    // 컨테이너에 최소 높이 설정
    container.style.minHeight = '100px';
    
    const editor = CodeMirror(container, {
        value: content || '',
        mode: mode,
        lineWrapping: true,
        viewportMargin: Infinity,
        lineNumbers: true,
        theme: 'monokai',  // 테마 적용
        autoRefresh: true  // 자동 새로고침 옵션
    });
    container.editor = editor;
    
    // 에디터가 즉시 표시되도록 명시적으로 refresh 호출
    setTimeout(() => {
        editor.refresh();
    }, 10);
    
    return editor;
}

// CodeMirror 에디터 refresh (필요시 공개 함수로 호출)
export function refreshEditor(editorContainer) {
    if (editorContainer && editorContainer.editor) {
        editorContainer.editor.refresh();
    }
} 