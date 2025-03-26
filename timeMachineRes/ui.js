import { createCodeMirrorEditor } from './editor.js';
import { parseFileName } from './fileHandler.js';
import * as styles from './styles.js';

// 파일 목록 아이템 생성
export function createFileListItem(file, onFileClick) {
    const { dateTime, type, name } = parseFileName(file);

    const div = document.createElement('div');
    div.classList.add('file-list-item');
    styles.applyFileItemStyles(div);

    const dateSpan = document.createElement('div');
    dateSpan.textContent = dateTime;
    dateSpan.style.fontSize = '12px';
    dateSpan.style.color = '#666';

    const typeSpan = document.createElement('span');
    typeSpan.textContent = type;
    typeSpan.style.fontWeight = 'bold';
    typeSpan.style.marginRight = '8px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;

    div.appendChild(dateSpan);

    const infoDiv = document.createElement('div');
    infoDiv.appendChild(typeSpan);
    infoDiv.appendChild(nameSpan);
    div.appendChild(infoDiv);

    div.dataset.filename = file;
    div.addEventListener('click', () => {
        const otherDivs = document.querySelectorAll('.file-list-item');
        otherDivs.forEach(otherDiv => {
            // styles.applyFileItemStyles(otherDiv);
            otherDiv.style.backgroundColor = '';
        });
        div.style.backgroundColor = 'lightgray';
        onFileClick(file)
    });

    return div;
}

// JSON 에디터 UI 생성
export async function createJsonEditor(jsonData) {
    const editorContainer = document.createElement('div');
    styles.createEditorContainerStyles(editorContainer);

    // 제목 추가
    const titleDiv = document.createElement('div');
    titleDiv.textContent = '로그 데이터 편집기';
    titleDiv.style.padding = '10px';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.borderBottom = '1px solid #ccc';

    // 편집 영역 생성
    const formContainer = document.createElement('div');
    formContainer.style.padding = '15px';
    formContainer.style.overflow = 'auto';

    editorContainer.appendChild(titleDiv);
    editorContainer.appendChild(formContainer);

    // systemPrompt 필드 생성 (항상 CodeMirror 사용)
    if (jsonData.systemPrompt !== undefined) {
        await createPromptField(formContainer, 'systemPrompt', jsonData.systemPrompt);
    }

    // model 필드 생성
    if (jsonData.model !== undefined) {
        createModelSelect(formContainer, jsonData.model);
    }

    // llm 필드 생성
    if (jsonData.llm !== undefined) {
        createLLMSelect(formContainer, jsonData.llm);
    }

    // messages 배열 처리
    if (Array.isArray(jsonData.messages)) {
        await createMessagesSection(formContainer, jsonData.messages);
    }

    // 다른 필드들 처리
    for (const [key, value] of Object.entries(jsonData)) {
        if (!['systemPrompt', 'model', 'messages', 'llm'].includes(key)) {
            await createField(formContainer, key, value);
        }
    }

    // 버튼 영역
    const buttonDiv = createButtonSection();
    editorContainer.appendChild(buttonDiv);

    // 응답 섹션 추가
    const responseSection = createResponseSection();
    editorContainer.appendChild(responseSection);

    return editorContainer;
}

// systemPrompt 전용 필드 생성 함수 (항상 CodeMirror 사용)
async function createPromptField(container, key, value) {
    const fieldDiv = document.createElement('div');
    fieldDiv.style.marginBottom = '15px';

    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = `${key}:`;
    fieldLabel.style.display = 'block';
    fieldLabel.style.marginBottom = '5px';
    fieldLabel.style.fontWeight = 'bold';

    const editorContainer = document.createElement('div');
    editorContainer.style.width = '100%';
    editorContainer.style.minHeight = '200px'; // systemPrompt는 더 높게 설정
    editorContainer.style.border = '1px solid #ccc';
    editorContainer.dataset.key = key;

    fieldDiv.appendChild(fieldLabel);
    fieldDiv.appendChild(editorContainer);
    container.appendChild(fieldDiv);

    // DOM에 추가된 후 에디터 초기화
    await createCodeMirrorEditor(editorContainer, value, 'text/plain');
}

// 필드 생성 함수
async function createField(container, key, value, mode = 'javascript') {
    const fieldDiv = document.createElement('div');
    fieldDiv.style.marginBottom = '15px';

    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = `${key}:`;
    fieldLabel.style.display = 'block';
    fieldLabel.style.marginBottom = '5px';
    fieldLabel.style.fontWeight = 'bold';

    if (typeof value === 'object' && value !== null) {
        const editorContainer = document.createElement('div');
        editorContainer.style.width = '100%';
        editorContainer.style.minHeight = '150px';
        editorContainer.style.border = '1px solid #ccc';
        editorContainer.dataset.key = key;

        fieldDiv.appendChild(fieldLabel);
        fieldDiv.appendChild(editorContainer);
        container.appendChild(fieldDiv);

        // DOM에 추가된 후 에디터 초기화
        await createCodeMirrorEditor(editorContainer, JSON.stringify(value, null, 2), 'text/plain');
    } else {
        const fieldInput = document.createElement('input');
        fieldInput.type = 'text';
        fieldInput.value = value !== null ? value.toString() : '';
        fieldInput.style.width = '100%';
        fieldInput.style.padding = '8px';
        fieldInput.style.fontFamily = 'monospace';
        fieldInput.dataset.key = key;

        fieldDiv.appendChild(fieldLabel);
        fieldDiv.appendChild(fieldInput);
        container.appendChild(fieldDiv);
    }
}
function createLLMSelect(container, currentLLM) {
    const modelDiv = document.createElement('div');
    modelDiv.style.marginBottom = '15px';

    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'llm:';
    modelLabel.style.display = 'block';
    modelLabel.style.marginBottom = '5px';
    modelLabel.style.fontWeight = 'bold';

    const modelSelect = document.createElement('select');
    modelSelect.style.width = '100%';
    modelSelect.style.padding = '8px';
    modelSelect.dataset.key = 'llm';

    const llms = [
        'gemini',
        'claude',
        'openai',
        'deepseek',
        'ollama',
        'groq',
    ];
    llms.forEach(llm => {
        const option = document.createElement('option');
        option.value = llm;
        option.textContent = llm;
        if (currentLLM === llm) {
            option.selected = true;
        }
        modelSelect.appendChild(option);
    });

    modelDiv.appendChild(modelLabel);
    modelDiv.appendChild(modelSelect);
    container.appendChild(modelDiv);

}
// 모델 선택 필드 생성
function createModelSelect(container, currentModel) {
    const modelDiv = document.createElement('div');
    modelDiv.style.marginBottom = '15px';

    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'model:';
    modelLabel.style.display = 'block';
    modelLabel.style.marginBottom = '5px';
    modelLabel.style.fontWeight = 'bold';

    const modelSelect = document.createElement('select');
    modelSelect.style.width = '100%';
    modelSelect.style.padding = '8px';
    modelSelect.dataset.key = 'model';

    const models = [
        'gpt-4o',
        'gpt-4o-mini',
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-20250219',
        'qwen-2.5-32b',
        'deepseek-r1-distill-qwen-32b',
        'deepseek-r1-distill-llama-70b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'deepseek-chat',
        'gemini-2.5-pro-exp-03-25',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
    ];
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (currentModel === model) {
            option.selected = true;
        }
        modelSelect.appendChild(option);
    });

    modelDiv.appendChild(modelLabel);
    modelDiv.appendChild(modelSelect);
    container.appendChild(modelDiv);
}

// 메시지 섹션 생성
async function createMessagesSection(container, messages) {
    const messagesDiv = document.createElement('div');
    messagesDiv.style.marginBottom = '15px';

    const messagesLabel = document.createElement('label');
    messagesLabel.textContent = 'messages:';
    messagesLabel.style.display = 'block';
    messagesLabel.style.marginBottom = '5px';
    messagesLabel.style.fontWeight = 'bold';

    messagesDiv.appendChild(messagesLabel);

    const messagesContainer = document.createElement('div');
    messagesContainer.style.border = '1px solid #ddd';
    messagesContainer.style.padding = '10px';
    messagesContainer.style.borderRadius = '5px';

    for (let i = 0; i < messages.length; i++) {
        await createMessageItem(messagesContainer, messages[i], i);
    }

    messagesDiv.appendChild(messagesContainer);
    container.appendChild(messagesDiv);
}

// 개별 메시지 아이템 생성
async function createMessageItem(container, message, index) {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '15px';
    messageDiv.style.padding = '10px';
    messageDiv.style.backgroundColor = '#f9f9f9';
    messageDiv.style.borderRadius = '5px';

    const messageHeader = document.createElement('div');
    messageHeader.textContent = `메시지 ${index + 1}`;
    messageHeader.style.fontWeight = 'bold';
    messageHeader.style.marginBottom = '10px';

    const roleDiv = document.createElement('div');
    roleDiv.style.marginBottom = '10px';

    const roleLabel = document.createElement('label');
    roleLabel.textContent = 'role:';
    roleLabel.style.display = 'block';
    roleLabel.style.marginBottom = '5px';

    const roleDisplay = document.createElement('div');
    roleDisplay.textContent = message.role;
    roleDisplay.style.padding = '5px';
    roleDisplay.style.border = '1px solid #ccc';
    roleDisplay.style.backgroundColor = '#f5f5f5';
    roleDisplay.style.borderRadius = '3px';
    roleDisplay.dataset.messageIndex = index;
    roleDisplay.dataset.field = 'role';

    roleDiv.appendChild(roleLabel);
    roleDiv.appendChild(roleDisplay);

    const contentDiv = document.createElement('div');
    const contentLabel = document.createElement('label');
    contentLabel.textContent = 'content:';
    contentLabel.style.display = 'block';
    contentLabel.style.marginBottom = '5px';

    const contentEditorContainer = document.createElement('div');
    contentEditorContainer.style.width = '100%';
    contentEditorContainer.style.minHeight = '150px';
    contentEditorContainer.style.border = '1px solid #ccc';
    contentEditorContainer.dataset.messageIndex = index;
    contentEditorContainer.dataset.field = 'content';

    contentDiv.appendChild(contentLabel);
    contentDiv.appendChild(contentEditorContainer);

    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(contentDiv);

    container.appendChild(messageDiv);

    // DOM에 추가된 후 에디터 초기화
    await createCodeMirrorEditor(contentEditorContainer, message.content, 'text/plain');
}

// 버튼 섹션 생성
function createButtonSection() {
    const buttonDiv = document.createElement('div');
    buttonDiv.style.padding = '10px';
    buttonDiv.style.display = 'flex';
    buttonDiv.style.justifyContent = 'flex-end';
    buttonDiv.style.gap = '10px';
    buttonDiv.style.borderTop = '1px solid #ccc';

    const saveBtn = document.createElement('button');
    saveBtn.id = 'saveButton';
    saveBtn.textContent = '요청';
    saveBtn.style.padding = '8px 16px';
    saveBtn.style.backgroundColor = '#4CAF50';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontWeight = 'bold';
    saveBtn.onclick = handleSave;

    buttonDiv.appendChild(saveBtn);
    return buttonDiv;
}

// 응답 표시 섹션 생성
function createResponseSection() {
    const responseSection = document.createElement('div');
    responseSection.id = 'responseSection';
    responseSection.style.marginTop = '20px';
    responseSection.style.padding = '15px';
    responseSection.style.border = '1px solid #ddd';
    responseSection.style.borderRadius = '5px';
    responseSection.style.backgroundColor = '#f9f9f9';
    responseSection.style.display = 'none'; // 초기에는 숨김

    const responseHeader = document.createElement('div');
    responseHeader.style.display = 'flex';
    responseHeader.style.justifyContent = 'space-between';
    responseHeader.style.alignItems = 'center';
    responseHeader.style.marginBottom = '10px';

    const responseTitle = document.createElement('div');
    responseTitle.textContent = '서버 응답';
    responseTitle.style.fontWeight = 'bold';

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '16px';
    closeButton.onclick = () => {
        responseSection.style.display = 'none';
    };

    responseHeader.appendChild(responseTitle);
    responseHeader.appendChild(closeButton);

    const textSection = document.createElement('div');
    textSection.id = 'responseTextSection';
    textSection.style.display = 'none';
    textSection.style.marginBottom = '15px';

    const textTitle = document.createElement('div');
    textTitle.textContent = 'Text 응답 (text/plain)';
    textTitle.style.fontWeight = 'bold';
    textTitle.style.marginBottom = '5px';

    const textContent = document.createElement('div');
    textContent.id = 'responseTextContent';
    textContent.style.whiteSpace = 'pre-wrap';
    textContent.style.fontFamily = 'monospace';
    textContent.style.overflow = 'auto';
    textContent.style.maxHeight = '300px';
    textContent.style.padding = '10px';
    textContent.style.border = '1px solid #eee';
    textContent.style.backgroundColor = '#fff';

    textSection.appendChild(textTitle);
    textSection.appendChild(textContent);

    const rawSection = document.createElement('div');
    rawSection.id = 'responseRawSection';
    rawSection.style.display = 'none';

    const rawTitle = document.createElement('div');
    rawTitle.textContent = 'Raw 응답';
    rawTitle.style.fontWeight = 'bold';
    rawTitle.style.marginBottom = '5px';

    const rawContent = document.createElement('div');
    rawContent.id = 'responseRawContent';
    rawContent.style.whiteSpace = 'pre-wrap';
    rawContent.style.fontFamily = 'monospace';
    rawContent.style.overflow = 'auto';
    rawContent.style.maxHeight = '300px';
    rawContent.style.padding = '10px';
    rawContent.style.border = '1px solid #eee';
    rawContent.style.backgroundColor = '#fff';

    rawSection.appendChild(rawTitle);
    rawSection.appendChild(rawContent);

    responseSection.appendChild(responseHeader);
    responseSection.appendChild(textSection);
    responseSection.appendChild(rawSection);

    return responseSection;
}

// 저장 버튼 핸들러
async function handleSave() {
    try {
        const updatedData = collectFormData();
        console.log('저장할 데이터:', updatedData);

        // 저장 버튼 비활성화 및 로딩 상태 표시
        const saveBtn = document.getElementById('saveButton');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.style.backgroundColor = '#cccccc';
        saveBtn.textContent = '요청 중...';

        // 이전 응답 숨기기
        const responseSection = document.getElementById('responseSection');
        if (responseSection) {
            responseSection.style.display = 'none';
        }

        // 서버로 데이터 전송
        const response = await saveDataToServer(updatedData);

        // 응답 표시
        showResponse(response);

        // 저장 버튼 상태 복원
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        saveBtn.style.backgroundColor = '#4CAF50';
    } catch (e) {
        // 오류 표시
        showResponse({ error: e.message }, true);

        // 저장 버튼 상태 복원
        const saveBtn = document.getElementById('saveButton');
        saveBtn.disabled = false;
        saveBtn.textContent = '요청';
        saveBtn.style.backgroundColor = '#4CAF50';
    }
}

// 서버에 데이터 저장 함수
async function saveDataToServer(data) {
    try {
        // /request 엔드포인트로 POST 요청 전송
        const response = await fetch('/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        // 응답 확인
        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
        }

        // JSON 응답 파싱
        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('저장 실패:', error);
        throw error;
    }
}

// 응답 표시 함수
function showResponse(response, isError = false) {
    // 응답 섹션 찾기
    const responseSection = document.getElementById('responseSection');

    if (!responseSection) {
        console.error('응답을 표시할 섹션을 찾을 수 없습니다.');
        return;
    }

    const textSection = document.getElementById('responseTextSection');
    const textContent = document.getElementById('responseTextContent');
    const rawSection = document.getElementById('responseRawSection');
    const rawContent = document.getElementById('responseRawContent');
    const rawTitle = document.getElementById('responseRawSection').querySelector('div');

    // 오류 표시
    if (isError) {
        textSection.style.display = 'block';
        rawSection.style.display = 'none';
        textContent.style.color = 'red';
        textContent.textContent = `오류: ${response.error}`;
    }
    // 정상 응답 처리
    else {
        // text 필드 처리
        if (response.text !== undefined) {
            textSection.style.display = 'block';
            textContent.style.color = 'black';
            // response.text가 JSON인지 확인하고 JSON이면 예쁘게 출력
            console.log(response.text);
            try {
                if (response.text.constructor === String) throw null;
                textContent.textContent = JSON.stringify(response.text, null, 2);
            } catch (e) {
                // JSON 파싱 실패시 일반 텍스트로 표시
                textContent.textContent = response.text;
            }
        } else {
            textSection.style.display = 'none';
        }

        // raw 필드 처리
        if (response.raw !== undefined) {
            rawSection.style.display = 'block';

            // raw가 JSON인지 확인
            let rawDisplay;
            try {
                // 이미 객체라면 stringify
                if (typeof response.raw === 'object' && response.raw !== null) {
                    rawDisplay = JSON.stringify(response.raw, null, 2);
                    rawTitle.textContent = 'Raw 응답 (JSON)';
                }
                // 문자열이면 JSON으로 파싱 시도
                else {
                    const parsed = JSON.parse(response.raw);
                    rawDisplay = JSON.stringify(parsed, null, 2);
                    rawTitle.textContent = 'Raw 응답 (JSON)';
                }
            } catch (e) {
                // JSON 파싱 실패시 일반 텍스트로 표시
                rawDisplay = response.raw;
                rawTitle.textContent = 'Raw 응답 (text/plain)';
            }

            rawContent.textContent = rawDisplay;
        } else {
            rawSection.style.display = 'none';
        }
    }

    // 응답 섹션 표시
    responseSection.style.display = 'block';

    // 응답 섹션으로 스크롤
    responseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 폼 데이터 수집
function collectFormData() {
    const formData = {};

    // 일반 필드 수집
    document.querySelectorAll('[data-key]').forEach(input => {
        const key = input.dataset.key;
        if (input.tagName === 'SELECT') {
            formData[key] = input.value;
        } else if (input.tagName === 'INPUT') {
            formData[key] = input.value;
        } else if (input.editor) {
            try {
                const value = input.editor.getValue();
                if (key === 'systemPrompt') {
                    // systemPrompt는 텍스트로 저장
                    formData[key] = value;
                } else {
                    // 객체는 JSON으로 파싱 시도
                    try {
                        formData[key] = JSON.parse(value);
                    } catch (e) {
                        formData[key] = value;
                    }
                }
            } catch (e) {
                formData[key] = input.editor.getValue();
            }
        }
    });

    // 메시지 배열 수집
    const messages = [];
    document.querySelectorAll('[data-message-index]').forEach(element => {
        const index = parseInt(element.dataset.messageIndex);
        const field = element.dataset.field;

        if (!messages[index]) {
            messages[index] = { role: '', content: '' };
        }

        if (field === 'role') {
            messages[index].role = element.textContent;
        } else if (field === 'content' && element.editor) {
            messages[index].content = element.editor.getValue();
        }
    });

    // 빈 메시지 필터링 후 저장
    if (messages.length > 0) {
        formData.messages = messages.filter(msg => msg && msg.role && msg.content);
    }

    return formData;
} 