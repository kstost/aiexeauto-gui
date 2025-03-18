import { loadCodeMirrorResources, refreshEditor } from './editor.js';
import { fetchLogFiles, fetchFileContent } from './fileHandler.js';
import { createFileListItem, createJsonEditor } from './ui.js';
import * as styles from './styles.js';

// 초기화
async function initialize() {
    // 스타일 초기화
    styles.initializeStyles();

    // CodeMirror 리소스 로드를 먼저 실행
    await loadCodeMirrorResources();

    // 기본 레이아웃 생성
    const container = styles.createContainerStyles();

    // 왼쪽 패널 생성
    const leftDiv = document.createElement('div');
    leftDiv.id = 'leftDiv';
    styles.createLeftPanelStyles(leftDiv);

    // 오른쪽 패널 생성
    const rightDiv = document.createElement('div');
    rightDiv.id = 'rightDiv';
    styles.createRightPanelStyles(rightDiv);
    rightDiv.innerHTML = 'rightDiv';

    container.appendChild(leftDiv);
    container.appendChild(rightDiv);
    document.body.appendChild(container);

    // 파일 목록 로드
    try {
        const files = await fetchLogFiles();
        const fileList = files.map(file => 
            createFileListItem(file, async (filename) => {
                try {
                    const content = await fetchFileContent(filename);
                    rightDiv.innerHTML = '';

                    // JSON 파싱 시도
                    try {
                        const jsonData = JSON.parse(content);
                        // console.log(jsonData.model);
                        if (jsonData.model === 'gemini') jsonData.model = 'gemini-2.0-flash';
                        const editor = await createJsonEditor(jsonData);
                        rightDiv.appendChild(editor);

                        // 에디터가 DOM에 추가된 후 모든 CodeMirror 에디터 refresh
                        setTimeout(() => {
                            document.querySelectorAll('.CodeMirror').forEach(cmElement => {
                                if (cmElement.CodeMirror) {
                                    cmElement.CodeMirror.refresh();
                                }
                            });
                        }, 100);
                    } catch (e) {
                        // JSON이 아닌 경우 일반 텍스트로 표시
                        rightDiv.innerHTML = `<pre style="white-space: pre-wrap; padding: 10px;">${content}</pre>`;
                    }
                } catch (error) {
                    console.error('파일 내용을 불러오는데 실패했습니다:', error);
                    rightDiv.innerHTML = '파일 내용을 불러오는데 실패했습니다.';
                }
            })
        );

        // 파일 목록을 날짜 기준으로 최신순 정렬
        fileList.sort((a, b) => {
            const filenameA = a.dataset.filename;
            const filenameB = b.dataset.filename;
            return filenameB.localeCompare(filenameA);
        });

        leftDiv.innerHTML = '';
        fileList.forEach(div => leftDiv.appendChild(div));
    } catch (error) {
        console.error('로그 파일 목록을 가져오는데 실패했습니다:', error);
        leftDiv.innerHTML = '로그 파일을 불러오는데 실패했습니다.';
    }
}

// 애플리케이션 시작
initialize(); 