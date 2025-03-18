// body에 height 100% 적용
document.body.style.height = '100vh';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

let container = document.createElement('div');
container.style.display = 'flex';
container.style.width = '100%';
container.style.height = '100%';
container.style.backgroundColor = '#f0f0f0';
container.style.overflow = 'hidden';

let leftDiv = document.createElement('div');
leftDiv.id = 'leftDiv';
leftDiv.style.width = '200px';
leftDiv.style.height = '100%';
leftDiv.style.backgroundColor = '#e0e0e0';
leftDiv.style.flexShrink = '0';
leftDiv.style.overflow = 'auto';
container.appendChild(leftDiv);

let rightDiv = document.createElement('div');
rightDiv.id = 'rightDiv';
rightDiv.style.flex = '1';
rightDiv.style.height = '100%';
rightDiv.style.backgroundColor = '#ffffff';
rightDiv.style.overflow = 'auto';
rightDiv.innerHTML = 'rightDiv';
container.appendChild(rightDiv);

document.body.appendChild(container);

// CodeMirror 스크립트 및 스타일 로드
function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
}

function loadStylesheet(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

// CodeMirror 로드
loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css');
loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js', function() {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js', function() {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/markdown/markdown.min.js', function() {
            // CodeMirror 로드 완료
        });
    });
});

// /logs 엔드포인트에서 로그 파일 목록 가져오기
fetch('/logs')
    .then(response => response.json())
    .then(files => {
        // 파일 목록을 왼쪽 div에 표시
        const fileList = files
            .filter(file => {
                // UNI 또는 RES 타입만 필터링
                const mainParts = file.split('_');
                if (mainParts.length >= 2) {
                    const type = mainParts[1];
                    return type === 'UNI' || type === 'RES';
                }
                return false;
            })
            .map(file => {
                // console.log(file);

                // 파일명 파싱 (예: 2025-03-18T05-11-26-653Z-1742274686653_RES_whatToDo.txt)
                let dateTime = '';
                let type = '';
                let name = '';

                // 타임스탬프와 ID 부분 분리
                const mainParts = file.split('_');
                if (mainParts.length >= 2) {
                    // 타임스탬프 부분 처리
                    const timestampPart = mainParts[0]; // 예: 2025-03-18T05-11-26-653Z-1742274686653

                    // T로 분리된 날짜와 시간 부분
                    const dateParts = timestampPart.split('T');
                    if (dateParts.length >= 2) {
                        const date = dateParts[0]; // 예: 2025-03-18

                        // 시간 부분 처리
                        const timeParts = dateParts[1].split('-'); // 예: 05-11-26-653Z-1742274686653
                        if (timeParts.length >= 3) {
                            const hour = parseInt(timeParts[0]) + 9; // UTC에 9시간 추가 (한국 시간대)
                            const minute = timeParts[1];
                            const second = timeParts[2];

                            // 시간이 24를 넘어가면 다음날로 조정 (간단한 처리)
                            let adjustedHour = hour;
                            let adjustedDate = date;

                            if (hour >= 24) {
                                adjustedHour = hour - 24;
                                // 날짜 조정은 복잡하므로 여기서는 간단히 처리
                            }

                            dateTime = `${adjustedDate} ${adjustedHour}:${minute}:${second}`;
                        }
                    }

                    // 타입과 이름 추출
                    if (mainParts.length >= 3) {
                        type = mainParts[1];
                        name = mainParts[2].replace('.txt', '');
                    } else if (mainParts.length >= 2) {
                        type = mainParts[1].replace('.txt', '');
                    }
                }
                console.log(type); // UNI, RES만 출력됨

                // UI 요소 생성
                const div = document.createElement('div');
                div.style.padding = '10px';
                div.style.borderBottom = '1px solid #ccc';
                div.style.cursor = 'pointer';

                // 날짜, 타입, 이름 분리해서 표시
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

                // 원본 파일명 저장
                div.dataset.filename = file;

                // 클릭 이벤트 추가
                div.addEventListener('click', async function () {
                    // console.log(this.dataset.filename);
                    // 클릭된 파일의 내용을 오른쪽 div에 표시
                    const url = `/logs/${this.dataset.filename}`;
                    try {
                        const response = await fetch(url);
                        const content = await response.text();
                        
                        // JSON 데이터 파싱 시도
                        let jsonData;
                        try {
                            jsonData = JSON.parse(content);
                        } catch (e) {
                            jsonData = null;
                        }
                        
                        rightDiv.innerHTML = '';
                        
                        if (jsonData) {
                            // JSON 편집기 생성
                            const editorContainer = document.createElement('div');
                            editorContainer.style.height = '100%';
                            editorContainer.style.display = 'flex';
                            editorContainer.style.flexDirection = 'column';
                            editorContainer.style.overflow = 'auto';
                            
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
                            
                            // systemPrompt 필드 생성
                            if (jsonData.systemPrompt !== undefined) {
                                const systemPromptDiv = document.createElement('div');
                                systemPromptDiv.style.marginBottom = '15px';
                                
                                const systemPromptLabel = document.createElement('label');
                                systemPromptLabel.textContent = 'systemPrompt:';
                                systemPromptLabel.style.display = 'block';
                                systemPromptLabel.style.marginBottom = '5px';
                                systemPromptLabel.style.fontWeight = 'bold';
                                
                                const systemPromptTextareaContainer = document.createElement('div');
                                systemPromptTextareaContainer.style.width = '100%';
                                systemPromptTextareaContainer.style.border = '1px solid #ccc';
                                systemPromptTextareaContainer.dataset.key = 'systemPrompt';
                                
                                systemPromptDiv.appendChild(systemPromptLabel);
                                systemPromptDiv.appendChild(systemPromptTextareaContainer);
                                formContainer.appendChild(systemPromptDiv);
                                
                                // CodeMirror 초기화는 DOM에 추가된 후에 수행
                                setTimeout(() => {
                                    const editor = CodeMirror(systemPromptTextareaContainer, {
                                        value: jsonData.systemPrompt || '',
                                        mode: 'markdown',
                                        lineWrapping: true,
                                        viewportMargin: Infinity
                                    });
                                    systemPromptTextareaContainer.editor = editor;
                                }, 0);
                            }
                            
                            // model 필드 생성
                            if (jsonData.model !== undefined) {
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
                                
                                const models = ['gemini', 'claude', 'openai'];
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model;
                                    option.textContent = model;
                                    if (jsonData.model === model) {
                                        option.selected = true;
                                    }
                                    modelSelect.appendChild(option);
                                });
                                
                                modelDiv.appendChild(modelLabel);
                                modelDiv.appendChild(modelSelect);
                                formContainer.appendChild(modelDiv);
                            }
                            
                            // messages 배열 처리
                            if (Array.isArray(jsonData.messages)) {
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
                                
                                jsonData.messages.forEach((message, index) => {
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
                                    
                                    // role 표시 (수정 불가)
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
                                    contentEditorContainer.style.border = '1px solid #ccc';
                                    contentEditorContainer.dataset.messageIndex = index;
                                    contentEditorContainer.dataset.field = 'content';
                                    
                                    contentDiv.appendChild(contentLabel);
                                    contentDiv.appendChild(contentEditorContainer);
                                    
                                    messageDiv.appendChild(messageHeader);
                                    messageDiv.appendChild(roleDiv);
                                    messageDiv.appendChild(contentDiv);
                                    
                                    messagesContainer.appendChild(messageDiv);
                                    
                                    // CodeMirror 초기화는 DOM에 추가된 후에 수행
                                    setTimeout(() => {
                                        const editor = CodeMirror(contentEditorContainer, {
                                            value: message.content || '',
                                            mode: 'markdown',
                                            lineWrapping: true,
                                            viewportMargin: Infinity
                                        });
                                        contentEditorContainer.editor = editor;
                                    }, 0);
                                });
                                
                                messagesDiv.appendChild(messagesContainer);
                                formContainer.appendChild(messagesDiv);
                            }
                            
                            // 다른 키들에 대한 처리
                            Object.keys(jsonData).forEach(key => {
                                if (key !== 'systemPrompt' && key !== 'model' && key !== 'messages' && key !== 'llm') {
                                    const fieldDiv = document.createElement('div');
                                    fieldDiv.style.marginBottom = '15px';
                                    
                                    const fieldLabel = document.createElement('label');
                                    fieldLabel.textContent = `${key}:`;
                                    fieldLabel.style.display = 'block';
                                    fieldLabel.style.marginBottom = '5px';
                                    fieldLabel.style.fontWeight = 'bold';
                                    
                                    if (typeof jsonData[key] === 'object' && jsonData[key] !== null) {
                                        const fieldEditorContainer = document.createElement('div');
                                        fieldEditorContainer.style.width = '100%';
                                        fieldEditorContainer.style.border = '1px solid #ccc';
                                        fieldEditorContainer.dataset.key = key;
                                        
                                        fieldDiv.appendChild(fieldLabel);
                                        fieldDiv.appendChild(fieldEditorContainer);
                                        
                                        // CodeMirror 초기화는 DOM에 추가된 후에 수행
                                        setTimeout(() => {
                                            const editor = CodeMirror(fieldEditorContainer, {
                                                value: JSON.stringify(jsonData[key], null, 2),
                                                mode: 'javascript',
                                                lineWrapping: true,
                                                viewportMargin: Infinity
                                            });
                                            fieldEditorContainer.editor = editor;
                                        }, 0);
                                    } else {
                                        const fieldInput = document.createElement('input');
                                        fieldInput.type = 'text';
                                        fieldInput.value = jsonData[key] !== null ? jsonData[key].toString() : '';
                                        fieldInput.style.width = '100%';
                                        fieldInput.style.padding = '8px';
                                        fieldInput.style.fontFamily = 'monospace';
                                        fieldInput.dataset.key = key;
                                        
                                        fieldDiv.appendChild(fieldLabel);
                                        fieldDiv.appendChild(fieldInput);
                                    }
                                    
                                    formContainer.appendChild(fieldDiv);
                                }
                            });
                            
                            // 버튼 영역
                            const buttonDiv = document.createElement('div');
                            buttonDiv.style.padding = '10px';
                            buttonDiv.style.display = 'flex';
                            buttonDiv.style.justifyContent = 'flex-end';
                            buttonDiv.style.gap = '10px';
                            buttonDiv.style.borderTop = '1px solid #ccc';
                            
                            // 저장 버튼
                            const saveBtn = document.createElement('button');
                            saveBtn.textContent = '저장';
                            saveBtn.onclick = function() {
                                try {
                                    // 데이터 수집 및 저장 로직
                                    const updatedData = {...jsonData};
                                    
                                    // 일반 필드 업데이트
                                    document.querySelectorAll('[data-key]').forEach(input => {
                                        const key = input.dataset.key;
                                        if (input.tagName === 'SELECT') {
                                            updatedData[key] = input.value;
                                        } else if (input.tagName === 'INPUT') {
                                            try {
                                                updatedData[key] = input.value;
                                            } catch (e) {
                                                updatedData[key] = input.value;
                                            }
                                        } else if (input.editor) {
                                            // CodeMirror 에디터인 경우
                                            try {
                                                const value = input.editor.getValue();
                                                if (typeof jsonData[key] === 'object' && jsonData[key] !== null) {
                                                    updatedData[key] = JSON.parse(value);
                                                } else {
                                                    updatedData[key] = value;
                                                }
                                            } catch (e) {
                                                updatedData[key] = input.editor.getValue();
                                            }
                                        }
                                    });
                                    
                                    // messages 배열 업데이트
                                    if (Array.isArray(jsonData.messages)) {
                                        updatedData.messages = [...jsonData.messages];
                                        document.querySelectorAll('[data-message-index]').forEach(input => {
                                            const index = parseInt(input.dataset.messageIndex);
                                            const field = input.dataset.field;
                                            if (field === 'content' && input.editor) {
                                                updatedData.messages[index][field] = input.editor.getValue();
                                            }
                                            // role은 수정 불가능하므로 업데이트하지 않음
                                        });
                                    }
                                    
                                    alert('저장 기능은 아직 구현되지 않았습니다. 업데이트된 데이터:');
                                    console.log(updatedData);
                                    // 여기에 저장 로직 추가 필요
                                } catch (e) {
                                    alert('데이터 처리 중 오류가 발생했습니다: ' + e.message);
                                }
                            };
                            
                            buttonDiv.appendChild(saveBtn);
                            
                            editorContainer.appendChild(titleDiv);
                            editorContainer.appendChild(formContainer);
                            editorContainer.appendChild(buttonDiv);
                            
                            rightDiv.appendChild(editorContainer);
                        } else {
                            // JSON이 아닌 경우 일반 텍스트로 표시
                            rightDiv.innerHTML = `<pre style="white-space: pre-wrap; padding: 10px;">${content}</pre>`;
                        }
                    } catch (error) {
                        console.error('파일 내용을 불러오는데 실패했습니다:', error);
                        rightDiv.innerHTML = '파일 내용을 불러오는데 실패했습니다.';
                    }
                });

                return div;
            });

        // 파일 목록을 날짜 기준으로 최신순 정렬
        fileList.sort((a, b) => {
            const filenameA = a.dataset.filename;
            const filenameB = b.dataset.filename;
            // 파일명에서 날짜 부분을 추출하여 비교 (최신이 위로 오도록 b - a 순서로 비교)
            return filenameB.localeCompare(filenameA);
        });

        leftDiv.innerHTML = '';
        fileList.forEach(div => leftDiv.appendChild(div));
    })
    .catch(error => {
        console.error('로그 파일 목록을 가져오는데 실패했습니다:', error);
        leftDiv.innerHTML = '로그 파일을 불러오는데 실패했습니다.';
    });