import singleton from './singleton.mjs';
import { getConfig, setConfig, caption } from './system.mjs';
import { showAlert } from './CustumAlert.mjs';
import { showConfirm } from './CustomConfirm.mjs';
export async function makeConfigUI(configurationContainer) {
    const { reqAPI } = singleton;
    // configWrapper: 전체 설정 UI를 감싸는 컨테이너 (CSS 클래스 적용)
    const configWrapper = document.createElement('div');
    configWrapper.className = 'config-container';
    configWrapper.style.padding = '30px';
    configWrapper.style.display = 'flex';
    configWrapper.style.flexDirection = 'column';
    configWrapper.style.gap = '25px'; // 모든 직계 자식 요소 사이의 간격을 25px로 통일
    configurationContainer.appendChild(configWrapper);

    // 제목
    const configTitle = document.createElement('h2');
    configTitle.textContent = caption('configuration');
    configTitle.style.margin = '0'; // 기존 margin 제거
    configTitle.style.marginBottom = '5px'; // 제목 아래 간격만 추가
    configWrapper.appendChild(configTitle);

    // 설정 요소 생성 함수 수정
    function createConfigRow(labelText) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        // marginBottom 제거 (gap으로 대체)

        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.width = '200px';
        label.style.flexShrink = '0';
        label.style.color = '#ffffff';
        label.style.fontSize = '16px';

        const inputContainer = document.createElement('div');
        inputContainer.style.flex = '1';

        row.appendChild(label);
        row.appendChild(inputContainer);

        return { row, inputContainer };
    }

    // 다크모드 스타일을 적용할 함수들
    function applyDarkModeSelect(select) {
        select.style.width = '100%';
        select.style.padding = '8px 12px';
        select.style.backgroundColor = '#2A2A2A';
        select.style.border = '1px solid #3A3A3A';
        select.style.borderRadius = '4px';
        select.style.color = '#E0E0E0';
        select.style.fontSize = '16px';
        select.style.outline = 'none';
        // 포커스 효과 제거
        select.style.transition = 'background-color 0.2s';
        select.addEventListener('focus', () => {
            select.style.backgroundColor = '#333333';
        });
        select.addEventListener('blur', () => {
            select.style.backgroundColor = '#2A2A2A';
        });
    }

    function applyDarkModeInput(input) {
        input.style.width = '100%';
        input.style.padding = '8px 12px';
        input.style.backgroundColor = '#2A2A2A';
        input.style.border = '1px solid #3A3A3A';
        input.style.borderRadius = '4px';
        input.style.color = '#E0E0E0';
        input.style.fontSize = '16px';
        input.style.outline = 'none';
        // 포커스 효과 제거
        input.style.transition = 'background-color 0.2s';
        input.addEventListener('focus', () => {
            input.style.backgroundColor = '#333333';
        });
        input.addEventListener('blur', () => {
            input.style.backgroundColor = '#2A2A2A';
        });
    }

    // Docker 설정 전에 언어 설정 추가
    const { row: languageRow, inputContainer: languageContainer } = createConfigRow(caption('language'));
    const languageSelect = document.createElement('select');
    applyDarkModeSelect(languageSelect);
    languageSelect.innerHTML = `
        <option value="en">English</option>
        <option value="ko">한국어</option>
        <option value="ja">日本語</option>
        <option value="vi">Tiếng Việt</option>
        <option value="zh">中文</option>
    `;
    languageContainer.appendChild(languageSelect);
    configWrapper.appendChild(languageRow);

    // LLM 선택
    const { row: llmRow, inputContainer: llmContainer } = createConfigRow(caption('useLLM'));
    const llmSelect = document.createElement('select');
    applyDarkModeSelect(llmSelect);
    llmSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectLLM')}</option>
        <option value="claude">Claude</option>
        <option value="deepseek">DeepSeek</option>
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
        <option value="groq">Groq</option>
        <option value="gemini">Gemini</option>
    `;
    llmSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectLLM')}</option>
        <option value="openai">OpenAI</option>
        <option value="gemini">Gemini</option>
    `;
    llmContainer.appendChild(llmSelect);
    configWrapper.appendChild(llmRow);

    // Groq 설정 그룹 추가 (LLM 선택 바로 다음에)
    const groqGroup = document.createElement('div');
    groqGroup.style.display = 'none';
    groqGroup.style.flexDirection = 'column';
    groqGroup.style.gap = '25px';
    configWrapper.appendChild(groqGroup);

    // Groq API Key 설정
    const { row: groqKeyRow, inputContainer: groqKeyContainer } = createConfigRow(caption('groqAPIKey'));
    const groqApiKeyInput = document.createElement('input');
    groqApiKeyInput.type = 'password';
    groqApiKeyInput.placeholder = caption('groqAPIKeyPlaceholder');// 'Enter Groq API Key'
    applyDarkModeInput(groqApiKeyInput);
    groqKeyContainer.appendChild(groqApiKeyInput);
    groqGroup.appendChild(groqKeyRow);

    // Groq Model 선택
    const { row: groqModelRow, inputContainer: groqModelContainer } = createConfigRow(caption('groqModel'));
    const groqModelSelect = document.createElement('select');
    applyDarkModeSelect(groqModelSelect);
    groqModelSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectModel')}</option>
        <option value="qwen-2.5-32b">qwen-2.5-32b</option>
        <option value="deepseek-r1-distill-qwen-32b">deepseek-r1-distill-qwen-32b</option>
        <option value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b</option>
        <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
        <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
    `;
    groqModelContainer.appendChild(groqModelSelect);
    groqGroup.appendChild(groqModelRow);

    // Claude 설정
    const claudeGroup = document.createElement('div');
    claudeGroup.style.display = 'flex';
    claudeGroup.style.flexDirection = 'column';
    claudeGroup.style.gap = '25px';
    configWrapper.appendChild(claudeGroup);

    const { row: claudeKeyRow, inputContainer: claudeKeyContainer } = createConfigRow(caption('claudeAPIKey'));
    const claudeApiKeyInput = document.createElement('input');
    claudeApiKeyInput.type = 'password';
    claudeApiKeyInput.placeholder = caption('claudeAPIKeyPlaceholder');// 'Enter Claude API Key'
    applyDarkModeInput(claudeApiKeyInput);
    claudeKeyContainer.appendChild(claudeApiKeyInput);
    claudeGroup.appendChild(claudeKeyRow);

    const { row: claudeModelRow, inputContainer: claudeModelContainer } = createConfigRow(caption('claudeModel'));
    const claudeModelSelect = document.createElement('select');
    applyDarkModeSelect(claudeModelSelect);
    claudeModelSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectModel')}</option>
        <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (Faster, cheaper)</option>
        <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (More refined tasks)</option>
        <option value="claude-3-7-sonnet-20250219">claude-3-7-sonnet-20250219 (More refined tasks)</option>
    `;
    claudeModelContainer.appendChild(claudeModelSelect);
    claudeGroup.appendChild(claudeModelRow);

    // DeepSeek 설정
    const deepseekGroup = document.createElement('div');
    deepseekGroup.style.display = 'none';
    deepseekGroup.style.flexDirection = 'column';
    deepseekGroup.style.gap = '25px';
    configWrapper.appendChild(deepseekGroup);

    const { row: deepseekKeyRow, inputContainer: deepseekKeyContainer } = createConfigRow(caption('deepseekAPIKey'));
    const deepseekApiKeyInput = document.createElement('input');
    deepseekApiKeyInput.type = 'password';
    deepseekApiKeyInput.placeholder = caption('deepseekAPIKeyPlaceholder');// 'Enter DeepSeek API Key'
    applyDarkModeInput(deepseekApiKeyInput);
    deepseekKeyContainer.appendChild(deepseekApiKeyInput);
    deepseekGroup.appendChild(deepseekKeyRow);

    const { row: deepseekModelRow, inputContainer: deepseekModelContainer } = createConfigRow(caption('deepseekModel'));
    const deepseekModelSelect = document.createElement('select');
    applyDarkModeSelect(deepseekModelSelect);
    deepseekModelSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectModel')}</option>
        <option value="deepseek-chat">deepseek-chat</option>
    `;
    deepseekModelContainer.appendChild(deepseekModelSelect);
    deepseekGroup.appendChild(deepseekModelRow);

    // Gemini 설정
    const geminiGroup = document.createElement('div');
    geminiGroup.style.display = 'none';
    geminiGroup.style.flexDirection = 'column';
    geminiGroup.style.gap = '25px';
    configWrapper.appendChild(geminiGroup);

    const { row: geminiKeyRow, inputContainer: geminiKeyContainer } = createConfigRow(caption('geminiAPIKey'));
    const geminiApiKeyInput = document.createElement('input');
    geminiApiKeyInput.type = 'password';
    geminiApiKeyInput.placeholder = caption('geminiAPIKeyPlaceholder');// 'Enter Gemini API Key'
    applyDarkModeInput(geminiApiKeyInput);
    geminiKeyContainer.appendChild(geminiApiKeyInput);
    geminiGroup.appendChild(geminiKeyRow);

    const { row: geminiModelRow, inputContainer: geminiModelContainer } = createConfigRow(caption('geminiModel'));
    const geminiModelSelect = document.createElement('select');
    applyDarkModeSelect(geminiModelSelect);
    geminiModelSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectModel')}</option>
        <option value="gemini-2.5-pro-exp-03-25">gemini-2.5-pro-exp-03-25</option>
        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
    `;
    geminiModelContainer.appendChild(geminiModelSelect);
    geminiGroup.appendChild(geminiModelRow);

    // OpenAI 설정
    const openaiGroup = document.createElement('div');
    openaiGroup.style.display = 'none';
    openaiGroup.style.flexDirection = 'column';
    openaiGroup.style.gap = '25px';
    configWrapper.appendChild(openaiGroup);

    const { row: openaiKeyRow, inputContainer: openaiKeyContainer } = createConfigRow(caption('openaiAPIKey'));
    const openaiApiKeyInput = document.createElement('input');
    openaiApiKeyInput.type = 'password';
    openaiApiKeyInput.placeholder = caption('openaiAPIKeyPlaceholder');// 'Enter OpenAI API Key'
    applyDarkModeInput(openaiApiKeyInput);
    openaiKeyContainer.appendChild(openaiApiKeyInput);
    openaiGroup.appendChild(openaiKeyRow);

    const { row: openaiModelRow, inputContainer: openaiModelContainer } = createConfigRow(caption('openaiModel'));
    const openaiModelSelect = document.createElement('select');
    applyDarkModeSelect(openaiModelSelect);
    openaiModelSelect.innerHTML = `
        <option value="" disabled selected>${caption('selectModel')}</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4.1-2025-04-14">gpt-4.1-2025-04-14</option>
        <option value="gpt-4.1-mini-2025-04-14">gpt-4.1-mini-2025-04-14</option>
        <option value="gpt-4.1-nano-2025-04-14">gpt-4.1-nano-2025-04-14</option>
    `;
    // 'gpt-4.1-2025-04-14',
    // 'gpt-4.1-mini-2025-04-14',
    // 'gpt-4.1-nano-2025-04-14',
    openaiModelContainer.appendChild(openaiModelSelect);
    openaiGroup.appendChild(openaiModelRow);

    // Ollama 설정 그룹 추가
    const ollamaGroup = document.createElement('div');
    ollamaGroup.style.display = 'none';
    ollamaGroup.style.flexDirection = 'column';
    ollamaGroup.style.gap = '25px';
    configWrapper.appendChild(ollamaGroup);

    // Ollama 모델 선택
    const { row: ollamaModelRow, inputContainer: ollamaModelContainer } = createConfigRow(caption('ollamaModel'));
    const ollamaModelInput = document.createElement('input');
    ollamaModelInput.type = 'text';
    ollamaModelInput.placeholder = caption('ollamaModelPlaceholder');// 'Enter Ollama Model Name (e.g., qwen2.5:14b, llama3.3:70b)'
    applyDarkModeInput(ollamaModelInput);
    ollamaModelContainer.appendChild(ollamaModelInput);
    ollamaGroup.appendChild(ollamaModelRow);

    // Ollama 모델 선택 부분 다음에 추가
    const ollamaModelInfo = document.createElement('div');
    ollamaModelInfo.style.fontSize = '12px';
    ollamaModelInfo.style.color = 'rgba(255, 255, 255, 0.5)';
    ollamaModelInfo.style.marginTop = '8px';
    ollamaModelInfo.style.paddingLeft = '12px';
    ollamaModelInfo.innerHTML = `${caption('ollamaModelInfo')}: <a href="https://ollama.com/search?c=tools" style="color: #64B5F6; text-decoration: none;" target="_blank">https://ollama.com/search?c=tools</a>`;
    ollamaModelContainer.appendChild(ollamaModelInfo);

    // Endpoint 설정 추가
    const { row: ollamaEndpointRow, inputContainer: ollamaEndpointContainer } = createConfigRow(caption('ollamaEndpoint'));
    const ollamaEndpointInput = document.createElement('input');
    ollamaEndpointInput.type = 'text';
    ollamaEndpointInput.placeholder = caption('ollamaEndpointPlaceholder');// 'Enter Ollama API Endpoint (e.g., http://localhost:11434)'
    applyDarkModeInput(ollamaEndpointInput);
    ollamaEndpointContainer.appendChild(ollamaEndpointInput);
    ollamaGroup.appendChild(ollamaEndpointRow);

    // Docker 설정 부분을 수정
    // Docker 사용 여부 설정
    const { row: useDockerRow, inputContainer: useDockerContainer } = createConfigRow(caption('useDocker'));
    useDockerContainer.style.display = 'flex';
    useDockerContainer.style.alignItems = 'center';
    useDockerContainer.style.gap = '12px';

    const useDockerCheckbox = document.createElement('input');
    useDockerCheckbox.type = 'checkbox';
    useDockerCheckbox.style.width = '20px';
    useDockerCheckbox.style.height = '20px';
    useDockerCheckbox.style.cursor = 'pointer';
    useDockerCheckbox.style.accentColor = '#2196F3';
    useDockerCheckbox.style.flexShrink = '0';
    useDockerContainer.appendChild(useDockerCheckbox);

    // 설명 추가
    const useDockerDescription = document.createElement('div');
    useDockerDescription.style.fontSize = '14px';
    useDockerDescription.style.color = 'rgba(255, 255, 255, 0.5)';
    useDockerDescription.textContent = caption('useDockerDescription');
    useDockerDescription.style.flex = '1';
    useDockerContainer.appendChild(useDockerDescription);

    configWrapper.appendChild(useDockerRow);

    // 로컬 실행 파일 경로 설정 추가
    const { row: nodePathRow, inputContainer: nodePathContainer } = createConfigRow(caption('nodePath'));
    const nodePathInput = document.createElement('input');
    nodePathInput.type = 'text';
    nodePathInput.placeholder = caption('nodePathPlaceholder');// 'Enter Node.js binary path (e.g., /usr/local/bin/node)'
    applyDarkModeInput(nodePathInput);
    nodePathContainer.appendChild(nodePathInput);
    configWrapper.appendChild(nodePathRow);

    const { row: npmPathRow, inputContainer: npmPathContainer } = createConfigRow(caption('npmPath'));
    const npmPathInput = document.createElement('input');
    npmPathInput.type = 'text';
    npmPathInput.placeholder = caption('npmPathPlaceholder');// 'Enter npm binary path (e.g., /usr/local/bin/npm)'
    applyDarkModeInput(npmPathInput);
    npmPathContainer.appendChild(npmPathInput);
    configWrapper.appendChild(npmPathRow);

    const { row: pythonPathRow, inputContainer: pythonPathContainer } = createConfigRow(caption('pythonPath'));
    const pythonPathInput = document.createElement('input');
    pythonPathInput.type = 'text';
    pythonPathInput.placeholder = caption('pythonPathPlaceholder');// 'Enter Python binary path (e.g., /usr/local/bin/python3)'
    applyDarkModeInput(pythonPathInput);
    pythonPathContainer.appendChild(pythonPathInput);
    configWrapper.appendChild(pythonPathRow);


    // Docker Path 설정 추가
    const { row: dockerPathRow, inputContainer: dockerPathContainer } = createConfigRow(caption('dockerPath'));
    const dockerPathInput = document.createElement('input');
    dockerPathInput.type = 'text';
    dockerPathInput.placeholder = caption('dockerPathPlaceholder');// 'Enter Docker Path (e.g., /usr/local/bin/docker)'
    applyDarkModeInput(dockerPathInput);
    dockerPathContainer.appendChild(dockerPathInput);
    configWrapper.appendChild(dockerPathRow);

    // Docker Image 설정 (기존 코드)
    const { row: dockerRow, inputContainer: dockerContainer } = createConfigRow(caption('dockerImageName'));
    const dockerImageInput = document.createElement('input');
    dockerImageInput.type = 'text';
    dockerImageInput.placeholder = caption('dockerImageNamePlaceholder');// 'Enter Docker Image Name'
    applyDarkModeInput(dockerImageInput);
    dockerContainer.appendChild(dockerImageInput);
    configWrapper.appendChild(dockerRow);

    // Docker Image 설정 다음에 추가
    const { row: keepDockerRow, inputContainer: keepDockerContainer } = createConfigRow(caption('keepDockerContainer'));
    keepDockerContainer.style.display = 'flex';
    keepDockerContainer.style.alignItems = 'center';
    keepDockerContainer.style.gap = '12px';

    const keepDockerCheckbox = document.createElement('input');
    keepDockerCheckbox.type = 'checkbox';
    keepDockerCheckbox.style.width = '20px';
    keepDockerCheckbox.style.height = '20px';
    keepDockerCheckbox.style.cursor = 'pointer';
    keepDockerCheckbox.style.accentColor = '#2196F3';
    keepDockerCheckbox.style.flexShrink = '0';
    keepDockerContainer.appendChild(keepDockerCheckbox);

    // 설명 추가
    const keepDockerDescription = document.createElement('div');
    keepDockerDescription.style.fontSize = '14px';
    keepDockerDescription.style.color = 'rgba(255, 255, 255, 0.5)';
    keepDockerDescription.textContent = caption('keepDockerContainerDescription');
    keepDockerDescription.style.flex = '1';
    keepDockerContainer.appendChild(keepDockerDescription);

    configWrapper.appendChild(keepDockerRow);
    keepDockerRow.remove();

    // Docker 사용 여부에 따라 Docker 관련 설정들 표시/숨김
    useDockerCheckbox.addEventListener('change', async () => {
        dockerRow.style.display = useDockerCheckbox.checked ? 'flex' : 'none';
        dockerPathRow.style.display = useDockerCheckbox.checked ? 'flex' : 'none';
        keepDockerRow.style.display = useDockerCheckbox.checked ? 'flex' : 'none';
        nodePathRow.style.display = useDockerCheckbox.checked ? 'none' : 'flex';
        npmPathRow.style.display = useDockerCheckbox.checked ? 'none' : 'flex';
        pythonPathRow.style.display = useDockerCheckbox.checked ? 'none' : 'flex';
        await setConfig('useDocker', useDockerCheckbox.checked);
    });

    // Docker Path 입력 이벤트 리스너 추가
    dockerPathInput.addEventListener('input', async () => {
        await setConfig('dockerPath', dockerPathInput.value);
    });

    // 로컬 실행 파일 경로 입력 이벤트 리스너 추가
    nodePathInput.addEventListener('input', async () => {
        await setConfig('nodePath', nodePathInput.value);
    });

    npmPathInput.addEventListener('input', async () => {
        await setConfig('npmPath', npmPathInput.value);
    });

    pythonPathInput.addEventListener('input', async () => {
        await setConfig('pythonPath', pythonPathInput.value);
    });

    // Docker Image 설정 다음에 추가
    const { row: autoCodeRow, inputContainer: autoCodeContainer } = createConfigRow(caption('autoCodeExecution'));
    autoCodeContainer.style.display = 'flex';
    autoCodeContainer.style.alignItems = 'center';
    autoCodeContainer.style.gap = '12px';

    const autoCodeCheckbox = document.createElement('input');
    autoCodeCheckbox.type = 'checkbox';
    autoCodeCheckbox.style.width = '20px';
    autoCodeCheckbox.style.height = '20px';
    autoCodeCheckbox.style.cursor = 'pointer';
    autoCodeCheckbox.style.accentColor = '#2196F3';
    autoCodeCheckbox.style.flexShrink = '0';
    autoCodeContainer.appendChild(autoCodeCheckbox);

    // 설명 추가
    const autoCodeDescription = document.createElement('div');
    autoCodeDescription.style.fontSize = '14px';
    autoCodeDescription.style.color = 'rgba(255, 255, 255, 0.5)';
    autoCodeDescription.textContent = caption('autoCodeExecutionDescription');
    autoCodeDescription.style.flex = '1';
    autoCodeContainer.appendChild(autoCodeDescription);

    configWrapper.appendChild(autoCodeRow);

    const { row: planEditRow, inputContainer: planEditContainer } = createConfigRow(caption('planEditable'));
    planEditContainer.style.display = 'flex';
    planEditContainer.style.alignItems = 'center';
    planEditContainer.style.gap = '12px';

    const planEditCheckbox = document.createElement('input');
    planEditCheckbox.type = 'checkbox';
    planEditCheckbox.style.width = '20px';
    planEditCheckbox.style.height = '20px';
    planEditCheckbox.style.cursor = 'pointer';
    planEditCheckbox.style.accentColor = '#2196F3';
    planEditCheckbox.style.flexShrink = '0';
    planEditContainer.appendChild(planEditCheckbox);

    // 설명 추가
    const planEditDescription = document.createElement('div');
    planEditDescription.style.fontSize = '14px';
    planEditDescription.style.color = 'rgba(255, 255, 255, 0.5)';
    planEditDescription.textContent = caption('planEditableDescription');
    planEditDescription.style.flex = '1';
    planEditContainer.appendChild(planEditDescription);

    configWrapper.appendChild(planEditRow);

    // loadConfigurations 함수 내부에 Groq 관련 설정 로드 추가
    singleton.loadConfigurations = async function () {
        // LLM 선택 로드
        const selectedLLM = await getConfig('llm');
        if (selectedLLM) {
            llmSelect.value = selectedLLM;
            // LLM 선택에 따른 UI 표시/숨김 처리
            claudeGroup.style.display = selectedLLM === 'claude' ? 'flex' : 'none';
            deepseekGroup.style.display = selectedLLM === 'deepseek' ? 'flex' : 'none';
            openaiGroup.style.display = selectedLLM === 'openai' ? 'flex' : 'none';
            ollamaGroup.style.display = selectedLLM === 'ollama' ? 'flex' : 'none';
            groqGroup.style.display = selectedLLM === 'groq' ? 'flex' : 'none';
            geminiGroup.style.display = selectedLLM === 'gemini' ? 'flex' : 'none';
        }

        // Claude 설정 로드
        const claudeApiKey = await getConfig('claudeApiKey');
        if (claudeApiKey) claudeApiKeyInput.value = claudeApiKey;

        const claudeModel = await getConfig('model');
        if (claudeModel) claudeModelSelect.value = claudeModel;

        // DeepSeek 설정 로드
        const deepseekApiKey = await getConfig('deepseekApiKey');
        if (deepseekApiKey) deepseekApiKeyInput.value = deepseekApiKey;

        const deepseekModel = await getConfig('deepseekModel');
        if (deepseekModel) deepseekModelSelect.value = deepseekModel;

        // Gemini 설정 로드
        const geminiApiKey = await getConfig('geminiApiKey');
        if (geminiApiKey) geminiApiKeyInput.value = geminiApiKey;

        const geminiModel = await getConfig('geminiModel');
        if (geminiModel) geminiModelSelect.value = geminiModel;

        // OpenAI 설정 로드
        const openaiApiKey = await getConfig('openaiApiKey');
        if (openaiApiKey) openaiApiKeyInput.value = openaiApiKey;

        const openaiModel = await getConfig('openaiModel');
        if (openaiModel) openaiModelSelect.value = openaiModel;

        // Ollama 설정 로드
        const ollamaModel = await getConfig('ollamaModel');
        if (ollamaModel) ollamaModelInput.value = ollamaModel;

        // Ollama endpoint 설정 로드
        const ollamaEndpoint = await getConfig('ollamaEndpoint');
        if (ollamaEndpoint) ollamaEndpointInput.value = ollamaEndpoint;

        // Docker Path 설정 로드
        const dockerPath = await getConfig('dockerPath');
        if (dockerPath) dockerPathInput.value = dockerPath;

        // Docker 사용 여부에 따른 UI 표시/숨김
        const useDocker = await getConfig('useDocker');
        if (useDocker !== undefined) {
            useDockerCheckbox.checked = useDocker;
            dockerRow.style.display = useDocker ? 'flex' : 'none';
            dockerPathRow.style.display = useDocker ? 'flex' : 'none';
            keepDockerRow.style.display = useDocker ? 'flex' : 'none';
            nodePathRow.style.display = useDocker ? 'none' : 'flex';
            npmPathRow.style.display = useDocker ? 'none' : 'flex';
            pythonPathRow.style.display = useDocker ? 'none' : 'flex';
        } else {
            useDockerCheckbox.checked = true;
            dockerRow.style.display = 'flex';
            dockerPathRow.style.display = 'flex';
            keepDockerRow.style.display = 'flex';
            nodePathRow.style.display = 'none';
            npmPathRow.style.display = 'none';
            pythonPathRow.style.display = 'none';
            await setConfig('useDocker', true);
        }

        // Docker Image 설정 로드
        const dockerImage = await getConfig('dockerImage');
        if (dockerImage) dockerImageInput.value = dockerImage;

        // 로컬 실행 파일 경로 설정 로드
        const nodePath = await getConfig('nodePath');
        if (nodePath) nodePathInput.value = nodePath;

        const npmPath = await getConfig('npmPath');
        if (npmPath) npmPathInput.value = npmPath;

        const pythonPath = await getConfig('pythonPath');
        if (pythonPath) pythonPathInput.value = pythonPath;

        // 자동 코드 실행 설정 로드
        const autoCodeExecution = await getConfig('autoCodeExecution');
        if (autoCodeExecution !== undefined) {
            autoCodeCheckbox.checked = autoCodeExecution;
        }

        // AI 계획 수정 설정 로드
        const planEditable = await getConfig('planEditable');
        if (planEditable !== undefined) {
            planEditCheckbox.checked = planEditable;
        }

        // Groq 설정 로드
        const groqApiKey = await getConfig('groqApiKey');
        if (groqApiKey) groqApiKeyInput.value = groqApiKey;

        const groqModel = await getConfig('groqModel');
        if (groqModel) groqModelSelect.value = groqModel;

        // 언어 설정 로드
        const language = await getConfig('captionLanguage');
        if (language) {
            languageSelect.value = language;
        } else {
            // 기본값을 영어로 설정
            languageSelect.value = 'en';
            await setConfig('captionLanguage', 'en');
        }

        // Docker 컨테이너 유지 설정 로드
        const keepDocker = await getConfig('keepDockerContainer');
        if (keepDocker !== undefined) {
            keepDockerCheckbox.checked = keepDocker;
        }
    };

    // 초기 설정값 로드
    await singleton.loadConfigurations();

    llmSelect.addEventListener('change', async (e) => {
        if (true || llmSelect.value === 'gemini' || llmSelect.value === 'openai') {
            await setConfig('llm', llmSelect.value);
            await singleton.loadConfigurations();
        } else {
            // gemini나 openai가 아닌 경우 선택을 변경하지 않음
            showAlert('LLMs other than OpenAI and Gemini are not supported.', 'warning');
            // showAlert(caption('configChangeNotAllowed'), 'warning');
            const currentLLM = await getConfig('llm');
            if (currentLLM) {
                llmSelect.value = currentLLM;
            }
            e.preventDefault();
            return;
        }
    });

    // 이벤트 리스너 등록
    claudeApiKeyInput.addEventListener('input', async () => {
        await setConfig('claudeApiKey', claudeApiKeyInput.value);
    });

    claudeModelSelect.addEventListener('change', async () => {
        await setConfig('model', claudeModelSelect.value);
    });

    deepseekApiKeyInput.addEventListener('input', async () => {
        await setConfig('deepseekApiKey', deepseekApiKeyInput.value);
    });

    deepseekModelSelect.addEventListener('change', async () => {
        await setConfig('deepseekModel', deepseekModelSelect.value);
    });

    geminiApiKeyInput.addEventListener('input', async () => {
        await setConfig('geminiApiKey', geminiApiKeyInput.value);
    });

    geminiModelSelect.addEventListener('change', async () => {
        await setConfig('geminiModel', geminiModelSelect.value);
    });

    openaiApiKeyInput.addEventListener('input', async () => {
        await setConfig('openaiApiKey', openaiApiKeyInput.value);
    });

    openaiModelSelect.addEventListener('change', async () => {
        await setConfig('openaiModel', openaiModelSelect.value);
    });

    ollamaModelInput.addEventListener('input', async () => {
        await setConfig('ollamaModel', ollamaModelInput.value);
    });

    dockerImageInput.addEventListener('input', async () => {
        await setConfig('dockerImage', dockerImageInput.value);
    });

    // Ollama endpoint 입력 이벤트 리스너 추가
    ollamaEndpointInput.addEventListener('input', async () => {
        await setConfig('ollamaEndpoint', ollamaEndpointInput.value);
    });

    // 구분선 추가
    const divider = document.createElement('hr');
    divider.style.margin = '10px 0';
    divider.style.border = 'none';
    divider.style.borderTop = '1px solid #3A3A3A';
    configWrapper.appendChild(divider);

    // 버튼을 감싸는 컨테이너
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px'; // 버튼 사이 간격
    buttonContainer.style.width = '100%';

    // Output Data 제거 버튼
    const clearDataButton = document.createElement('button');
    clearDataButton.textContent = caption('clearDataButton');
    clearDataButton.style.flex = '1'; // 50% 너비 차지
    clearDataButton.style.backgroundColor = '#DC2626';
    clearDataButton.style.color = '#ffffff';
    clearDataButton.style.padding = '12px 20px';
    clearDataButton.style.border = 'none';
    clearDataButton.style.borderRadius = '4px';
    clearDataButton.style.cursor = 'pointer';
    clearDataButton.style.fontSize = '16px';
    clearDataButton.style.fontWeight = '500';

    // Output Data 폴더 열기 버튼
    const openFolderButton = document.createElement('button');
    openFolderButton.textContent = caption('openFolderButton');
    openFolderButton.style.flex = '1'; // 50% 너비 차지
    openFolderButton.style.backgroundColor = '#4B5563'; // 회색 배경
    openFolderButton.style.color = '#ffffff';
    openFolderButton.style.padding = '12px 20px';
    openFolderButton.style.border = 'none';
    openFolderButton.style.borderRadius = '4px';
    openFolderButton.style.cursor = 'pointer';
    openFolderButton.style.fontSize = '16px';
    openFolderButton.style.fontWeight = '500';

    // 호버 효과
    clearDataButton.addEventListener('mouseenter', () => {
        clearDataButton.style.backgroundColor = '#B91C1C';
    });
    clearDataButton.addEventListener('mouseleave', () => {
        clearDataButton.style.backgroundColor = '#DC2626';
    });

    openFolderButton.addEventListener('mouseenter', () => {
        openFolderButton.style.backgroundColor = '#374151';
    });
    openFolderButton.addEventListener('mouseleave', () => {
        openFolderButton.style.backgroundColor = '#4B5563';
    });

    // 클릭 효과
    clearDataButton.addEventListener('click', async () => {
        if (await showConfirm(caption('clearDataButtonConfirm'))) {
            let task = reqAPI('clear_output_data', {});
            let taskId = task.taskId;
            await task.promise;
        }
    });

    openFolderButton.addEventListener('click', async () => {
        let task = reqAPI('open_output_folder', {});
        let taskId = task.taskId;
        if (!await task.promise) {
            showAlert(caption('outputFolderNotFound'), 'warning');
        }
    });

    // 버튼들을 컨테이너에 추가
    buttonContainer.appendChild(clearDataButton);
    buttonContainer.appendChild(openFolderButton);

    // 컨테이너를 configWrapper에 추가
    configWrapper.appendChild(buttonContainer);

    // 이벤트 리스너 추가
    autoCodeCheckbox.addEventListener('change', async () => {
        await setConfig('autoCodeExecution', autoCodeCheckbox.checked);
    });

    planEditCheckbox.addEventListener('change', async () => {
        await setConfig('planEditable', planEditCheckbox.checked);
    });

    // Groq 설정 변경 이벤트 리스너 추가
    groqApiKeyInput.addEventListener('input', async () => {
        await setConfig('groqApiKey', groqApiKeyInput.value);
    });

    groqModelSelect.addEventListener('change', async () => {
        await setConfig('groqModel', groqModelSelect.value);
    });

    // 언어 변경 이벤트 리스너 추가
    languageSelect.addEventListener('change', async () => {
        await setConfig('captionLanguage', languageSelect.value);
        await fadeOut(0.5);
        window.location.reload();
    });

    // 이벤트 리스너 추가 부분에 keepDocker 이벤트 리스너 추가
    keepDockerCheckbox.addEventListener('change', async () => {
        await setConfig('keepDockerContainer', keepDockerCheckbox.checked);
    });
}

async function fadeOut(duration = 1) {
    // await new Promise(resolve => window.requestAnimationFrame(resolve));
    // document.body.style.transform = 'scale(1.1)';
    // await new Promise(resolve => window.requestAnimationFrame(resolve));
    // document.body.style.transformOrigin = 'center';
    // document.body.style.transition = 'transform 0.5s ease-in-out';
    // await new Promise(resolve => window.requestAnimationFrame(resolve));
    // document.body.style.transform = 'scale(1)';
    // document.getElementById('vail').style.opacity = '0';
    // document.getElementById('vail').addEventListener('transitionend', () => {
    //     document.getElementById('vail').remove();
    // });

    window.document.body.style.overflow = 'hidden';
    document.body.style.transform = 'scale(1.1)';
    const children = [...window.document.body.children];
    children.forEach(child => child.style.transition = `${duration}s`);
    window.document.body.style.transition = `${duration}s`;
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    window.document.body.style.backgroundColor = 'black';
    children.forEach(child => child.style.opacity = '0');
    return new Promise(resolve => window.document.body.addEventListener('transitionend', () => resolve()));
}