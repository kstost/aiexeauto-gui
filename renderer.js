import { callEvent } from './callEvent.js';

function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
}
let uniqueCounter = 0;
function randomId() {
    uniqueCounter++;
    return uniqueCounter + '_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
const BOTTOM_DISTANCE = 200;
let aborting_responsed = false;
let currentConfig = {};
window.electronAPI.receive('mission_aborting_response', (arg) => {
    aborting_responsed = true;
});

window.addEventListener('DOMContentLoaded', async () => {
    // 함수 선언만 먼저
    let loadConfigurations;

    const leftSide = document.createElement('div');
    leftSide.classList.add('left-side');
    document.body.appendChild(leftSide);

    // 새롭게 추가: 앱 제목 "AIEXE"를 상단에 추가
    const appTitle = document.createElement('h1');
    appTitle.textContent = 'AIEXEAUTO';
    appTitle.style.color = '#ffffff';
    appTitle.style.fontSize = '24px';
    appTitle.style.textAlign = 'center';
    appTitle.style.padding = '20px 0 10px';
    leftSide.appendChild(appTitle);

    // 새롭게 추가: 메뉴 컨테이너 생성
    const menuContainer = document.createElement('div');
    menuContainer.style.display = 'flex';
    menuContainer.style.flexDirection = 'column';
    menuContainer.style.rowGap = '10px';
    menuContainer.style.padding = '0 10px';
    leftSide.appendChild(menuContainer);

    // 메뉴 항목 배열
    const menuItems = [
        { text: '미션수행', mode: 'missionSolving' },
        { text: '환경설정', mode: 'configuration' },
        { text: '코드깎는노인 유튜브', mode: 'youtube' },
        { text: '코드깎는노인 클래스', mode: 'class' }
    ];

    // 각 메뉴 항목 생성 및 클릭 이벤트 등록
    menuItems.forEach(menuItem => {
        const menuItemElement = document.createElement('div');
        menuItemElement.textContent = menuItem.text;
        menuItemElement.style.padding = '10px';
        menuItemElement.style.borderRadius = '4px';
        menuItemElement.style.cursor = 'pointer';
        menuItemElement.style.color = '#ffffff';
        menuItemElement.style.backgroundColor = '#1c1c1c';
        menuItemElement.addEventListener('click', async () => {
            if (menuItem.mode === 'youtube') {
                window.electronAPI.send('openwebsite', { url: 'https://www.youtube.com/@%EC%BD%94%EB%93%9C%EA%B9%8E%EB%8A%94%EB%85%B8%EC%9D%B8' });
            } else if (menuItem.mode === 'class') {
                window.electronAPI.send('openwebsite', { url: 'https://cokac.com/' });
            } else {
                if (menuItem.mode === 'configuration') {
                    if (operationDoing) { alert('미션 수행중에는 환경설정을 변경할 수 없습니다.'); return; }
                    await loadConfigurations();
                    turnWindow(menuItem.mode);
                } else {
                    if (operationDoing) { alert('미션 수행중입니다.'); return; }
                    turnWindow(menuItem.mode);
                }
            }
        });
        // 호버 효과
        menuItemElement.addEventListener('mouseenter', () => {
            menuItemElement.style.backgroundColor = '#333333';
        });
        menuItemElement.addEventListener('mouseleave', () => {
            menuItemElement.style.backgroundColor = '#1c1c1c';
        });
        menuContainer.appendChild(menuItemElement);
    });

    // 구분선 추가
    const menuDivider = document.createElement('hr');
    menuDivider.style.margin = '15px 10px';
    menuDivider.style.border = 'none';
    menuDivider.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    menuContainer.appendChild(menuDivider);

    // 버전 정보 추가
    const versionInfo = document.createElement('div');
    versionInfo.textContent = '';
    versionInfo.style.color = 'rgba(255, 255, 255, 0.5)';
    versionInfo.style.fontSize = '12px';
    versionInfo.style.textAlign = 'center';
    versionInfo.style.padding = '0 10px';
    menuContainer.appendChild(versionInfo);

    const versionUpdate = document.createElement('div');
    versionUpdate.textContent = '';
    versionUpdate.style.color = 'yellow';
    versionUpdate.style.fontSize = '12px';
    versionUpdate.style.textAlign = 'center';
    versionUpdate.style.padding = '0 10px';
    menuContainer.appendChild(versionUpdate);

    const missionSolvingContainer = document.createElement('div');
    missionSolvingContainer.classList.add('right-side');
    missionSolvingContainer[Symbol.for('mode')] = 'missionSolving';
    document.body.appendChild(missionSolvingContainer);

    const configurationContainer = document.createElement('div');
    configurationContainer.classList.add('right-side');
    configurationContainer[Symbol.for('mode')] = 'configuration';
    document.body.appendChild(configurationContainer);

    function turnWindow(mode) {
        missionSolvingContainer.style.display = 'none';
        configurationContainer.style.display = 'none';
        if (mode === 'missionSolving') {
            missionSolvingContainer.style.display = 'block';
        } else if (mode === 'configuration') {
            configurationContainer.style.display = 'block';
        }
    }
    turnWindow('missionSolving');

    //----------------------------------------------------
    let displayState = {};

    class ContentBox {
        constructor() {
            this.resultContainer = document.createElement('div');
            this.resultContainer.classList.add('result-container');
            this.resultContainer.style.color = 'rgba(255, 255, 255, 0.7)';
            this.resultContainer.style.marginTop = '5px';
            this.resultContainer.style.padding = '5px';
            this.resultContainer.style.display = 'flex';
            this.resultContainer.style.alignItems = 'flex-start';
            this.resultContainer.style.gap = '8px';

            // Add icon
            const icon = document.createElement('span');
            icon.classList.add('material-symbols-outlined');
            icon.textContent = 'double_arrow';
            icon.style.color = 'rgba(255, 255, 255, 0.7)';
            icon.style.fontSize = '16px';
            icon.style.marginTop = '2px';
            this.resultContainer.appendChild(icon);

            // Create content div
            this.contentDiv = document.createElement('div');
            this.resultContainer.appendChild(this.contentDiv);

            conversations.appendChild(this.resultContainer);
        }

        getContainer() {
            return this.contentDiv;
        }
    }



    class PromptInput {
        constructor() {
            // 컨테이너 생성
            const container = document.createElement('label');
            container.classList.add('mdc-text-field', 'mdc-text-field--filled', 'mdc-text-field--textarea');
            container.style.width = '100%';
            container.style.marginTop = '7px';
            container.style.marginBottom = '6px';
            container.style.borderRadius = '5px';

            // 리플 효과를 위한 span 
            const ripple = document.createElement('span');
            ripple.classList.add('mdc-text-field__ripple');
            container.appendChild(ripple);

            // 입력 필드
            this.input = document.createElement('textarea');
            this.input.classList.add('mdc-text-field__input');
            this.input.setAttribute('aria-labelledby', 'prompt-label');
            container.appendChild(this.input);

            // 플로팅 라벨
            const label = document.createElement('span');
            label.classList.add('mdc-floating-label');
            label.id = 'prompt-label';
            label.textContent = 'Prompt';
            container.appendChild(label);

            this.container = container;
            this.on = (event, callback) => {
                this.container.addEventListener(event, callback);
            }

            // MDC 텍스트필드 초기화
            this.mdcTextField = new mdc.textField.MDCTextField(container);

            // 텍스트 영역 크기 자동 조절
            this.adjustHeight = () => {
                this.input.style.height = 'auto';
                const lines = this.input.value.split('\n').length;
                const lineHeight = parseInt(window.getComputedStyle(this.input).lineHeight);
                const padding = 20; // 상하 패딩값
                const minHeight = lineHeight * 3 + padding; // 최소 3줄
                const maxHeight = lineHeight * 10 + padding; // 최대 10줄
                const newHeight = Math.min(Math.max(lineHeight * lines + padding, minHeight), maxHeight);
                this.input.style.height = newHeight + 'px';
            };

            this.input.addEventListener('input', this.adjustHeight);

            // 키 이벤트 처리
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (e.isComposing) return; // 한글 입력 중에는 처리하지 않음
                    if (e.ctrlKey) {
                        // Ctrl + Enter: 개행
                        const start = this.input.selectionStart;
                        const end = this.input.selectionEnd;
                        const value = this.input.value;
                        this.input.value = value.substring(0, start) + '\n' + value.substring(end);
                        this.input.selectionStart = this.input.selectionEnd = start + 1;
                        // 개행 후 높이 조절
                        this.adjustHeight();
                    } else {
                        // Enter: fire -> enter 이벤트로 변경
                        e.preventDefault();
                        // enter 이벤트 발생
                        const event = new CustomEvent('enter', { detail: this.input.value });
                        this.container.dispatchEvent(event);
                    }
                }
            });

            // 초기 높이 설정
            this.adjustHeight();

            // 레이블 참조 추가 (setPlaceholder에서 사용)
            this.label = label;
        }
        setValue(value) {
            this.input.value = value;
            this.mdcTextField.layout(); // 텍스트필드 레이아웃 갱신 (플로팅 라벨 업데이트)
            this.adjustHeight();
        }

        // 추가: 입력 필드에 포커스를 주는 method
        setFocus() {
            this.input.focus();
        }

        // 추가: 입력 필드의 placeholder를 설정하는 메서드
        setPlaceholder(text) {
            this.label.textContent = text;
        }
    }



    class PercentBar {
        constructor({ template, total }) {
            // 컨테이너 생성
            this.barContainer = document.createElement('div');
            this.barContainer.style.width = '100%';
            this.barContainer.style.padding = '15px';
            this.barContainer.style.backgroundColor = 'rgba(0,0,0,0.2)';
            this.barContainer.style.borderRadius = '8px';
            this.barContainer.style.margin = '15px 0';
            this.barContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            conversations.appendChild(this.barContainer);

            // 라벨 컨테이너
            this.labelContainer = document.createElement('div');
            this.labelContainer.style.marginBottom = '8px';
            this.labelContainer.style.color = '#fff';
            this.labelContainer.style.fontSize = '14px';
            this.labelContainer.style.fontWeight = '500';
            this.barContainer.appendChild(this.labelContainer);

            // 프로그레스 바 컨테이너
            this.progressContainer = document.createElement('div');
            this.progressContainer.style.width = '100%';
            this.progressContainer.style.height = '8px';
            this.progressContainer.style.backgroundColor = 'rgba(255,255,255,0.1)';
            this.progressContainer.style.borderRadius = '4px';
            this.progressContainer.style.overflow = 'hidden';
            this.barContainer.appendChild(this.progressContainer);

            // 프로그레스 바
            this.bar = document.createElement('div');
            this.bar.style.width = '0%';
            this.bar.style.height = '100%';
            this.bar.style.backgroundColor = '#4CAF50';
            this.bar.style.borderRadius = '4px';
            this.bar.style.transition = 'width 0.3s ease';
            this.bar.style.boxShadow = '0 0 10px rgba(76,175,80,0.5)';
            this.progressContainer.appendChild(this.bar);

            this.template = template;
            this.total = total;
            this.left = total;
            this.update({ second: total });
        }

        update(data) {
            const percent = (data.second / this.total) * 100;
            this.bar.style.width = `${percent}%`;
            const label = this.template.replace('{{second}}', data.second);
            this.labelContainer.textContent = label;
        }

        destroy() {
            this.barContainer.remove();
        }
    }


    class DisplayState {
        constructor() {
            this.state = document.createElement('div');
            this.state.classList.add('state-display');
            this.state.style.display = 'flex';
            this.state.style.alignItems = 'center';
            this.state.style.gap = '8px';
            this.state.style.padding = '5px';
            this.state.style.borderRadius = '8px';
            this.state.style.border = '0px solid #64B5F6'; // 기본 border 색상 (로딩 상태)
            this.state.style.backgroundColor = '#333333';
            this.state.style.transition = 'all 0.3s cubic-bezier(.25,.8,.25,1)';
            this.state.style.marginTop = '5px';
            this.state.style.fontFamily = 'Roboto, sans-serif';
            this.state.style.fontSize = '14px';

            // 아이콘 컨테이너
            this.iconContainer = document.createElement('span');
            this.iconContainer.classList.add('material-icons');
            this.iconContainer.style.fontSize = '20px';

            // 텍스트 컨테이너
            this.textContainer = document.createElement('span');
            this.textContainer.style.fontWeight = '500';

            this.state.appendChild(this.iconContainer);
            this.state.appendChild(this.textContainer);
            conversations.appendChild(this.state);
        }
        dismiss() {
            this.state.style.display = 'none';
        }
        setState({ text, state }) {
            this.textContainer.textContent = text;
            this.state.style.display = 'flex';
            if (!text) this.state.style.display = 'none';

            switch (state) {
                case 'loading':
                    this.iconContainer.textContent = 'sync';
                    this.iconContainer.style.animation = 'spin 1s linear infinite';
                    this.state.style.background = 'linear-gradient(to right, rgba(22, 22, 22, 0.3), rgba(22, 22, 22, 0))';
                    this.state.style.color = '#64B5F6';
                    this.iconContainer.style.color = '#64B5F6';
                    this.state.style.borderColor = '#64B5F6';
                    break;

                case 'done':
                    this.iconContainer.textContent = 'check_circle';
                    this.iconContainer.style.animation = 'none';
                    this.state.style.background = 'linear-gradient(to right, rgba(46, 125, 50, 0.3), rgba(46, 125, 50, 0))';
                    this.state.style.color = 'rgba(255, 255, 255, 0.7)';
                    this.iconContainer.style.color = 'rgba(255, 255, 255, 0.7)';
                    this.state.style.borderColor = '#1B5E20';
                    break;

                case 'fail':
                    this.iconContainer.textContent = 'error';
                    this.iconContainer.style.animation = 'none';
                    this.state.style.background = 'linear-gradient(to right, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0))';
                    this.state.style.color = 'rgba(255, 255, 255, 0.7)';
                    this.iconContainer.style.color = 'rgba(255, 255, 255, 0.7)';
                    this.state.style.borderColor = '#8E0000';
                    break;
            }
        }
    }
    class TerminalStreamBox {
        constructor() {
            this.container = document.createElement('div');
            this.container.classList.add('terminal-stream-box');
            this.container.style.backgroundColor = '#1E1E1E';
            this.container.style.color = '#E0E0E0';
            this.container.style.padding = '12px';
            this.container.style.marginTop = '10px';
            this.container.style.borderRadius = '6px';
            this.container.style.fontFamily = 'Consolas, monospace';
            this.container.style.fontSize = '14px';
            this.container.style.border = '1px solid #333';
            this.container.style.position = 'relative'; // 상대 위치 설정
            conversations.appendChild(this.container);

            // 중지 버튼 생성
            this.stopButton = document.createElement('button');
            // this.stopButton.classList.add('mdc-button');
            this.stopButton.style.position = 'absolute';
            this.stopButton.style.right = '10px';
            this.stopButton.style.bottom = '10px';
            this.stopButton.style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
            this.stopButton.style.color = '#ffffff';
            this.stopButton.style.border = 'none';
            this.stopButton.style.borderRadius = '4px';
            this.stopButton.style.cursor = 'pointer';
            this.stopButton.style.display = 'flex';
            this.stopButton.style.alignItems = 'center';
            this.stopButton.style.gap = '4px';
            this.stopButton.style.padding = '4px 8px';
            this.stopButton.style.fontSize = '12px';
            this.stopButton.innerHTML = `
                <span class="material-icons" style="font-size: 20px;">stop</span>
                <span>중지</span>
            `;
            this.container.appendChild(this.stopButton);
            this.stopButton.addEventListener('click', async () => {
                // this.stopButton.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                // send abort message
                window.electronAPI.send('raise_sigint_aborting', {});
                this.removeStopButton();
                // console.log('aborting...');
                // let task = reqAPI('raise_sigint_aborting', {});
                // let taskId = task.taskId;
                // if (false) await abortTask(taskId);
                // console.log(await task.promise);


            });

            // 추가: 초기 placeholder 메시지 추가 (투명도 50%)
            this.placeholder = document.createElement('div');
            this.placeholder.textContent = "현재 처리를 대기중";
            this.placeholder.style.color = "rgba(224, 224, 224, 0.5)"; // 50% 투명도
            this.placeholder.style.padding = '3px';
            this.placeholder.style.paddingLeft = '10px';
            this.placeholder.style.marginTop = '1.5px';
            this.placeholder.style.marginBottom = '1.5px';
            this.placeholder.style.fontStyle = 'italic'; // 선택 사항: 기울임체
            this.container.appendChild(this.placeholder);
        }
        destroy() {
            this.container.remove();
        }
        removeStopButton() {
            if (this.stopButton) {
                this.stopButton.remove();
                this.stopButton = null;
            }
        }
        addStream(stream, state = 'stdout') {
            // placeholder가 있으면 제거
            if (this.placeholder && this.container.contains(this.placeholder)) {
                this.container.removeChild(this.placeholder);
                this.placeholder = null;
            }
            const streamBox = document.createElement('div');
            streamBox.classList.add('terminal-stream-box');
            streamBox.textContent = stream;
            streamBox.style.padding = '3px';
            streamBox.style.paddingLeft = '10px';
            streamBox.style.marginBottom = '1.5px';
            streamBox.style.marginTop = '1.5px';
            // streamBox.style.wordBreak = 'break-all';
            switch (state) {
                case 'stdout':
                    streamBox.style.borderLeft = '3px solid #4CAF50';
                    streamBox.style.backgroundColor = '#252525';
                    break;
                case 'stderr':
                    streamBox.style.borderLeft = '3px solid #F44336';
                    streamBox.style.backgroundColor = '#2A2020';
                    break;
                default:
                    streamBox.style.borderLeft = '3px solid #9E9E9E';
                    streamBox.style.backgroundColor = '#252525';
            }

            this.container.appendChild(streamBox);

            // streamBox 하위의 모든 요소 브레이크 올.
            // streamBox.style.wordBreak = 'break-all';
        }
    }
    //----------------------------------------------------
    // let inputFolderPath = '';
    // let outputFolderPath = '';

    function getInputFolderPath() {
        return pathDisplay[Symbol.for('path')] || '';
    }

    function getOutputFolderPath() {
        return outputPathDisplay[Symbol.for('path')] || '';
    }
    function getDistanceToBottom() {
        const body = document.body;
        const html = document.documentElement;

        const maxScroll = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );

        const currentScroll = window.scrollY + window.innerHeight;
        const distanceToBottom = maxScroll - currentScroll;
        return distanceToBottom;
    }
    function scrollBodyToBottomSmoothly(animation = true) {
        const body = missionSolvingContainer;
        const html = document.documentElement;

        const maxScroll = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );
        body.scrollTo({
            top: maxScroll,
            behavior: animation ? 'smooth' : 'instant'
        });
    }

    const terminalStreamBoxes = {};
    const percentBar = {};
    const { reqAPI, abortAllTask, abortTask } = callEvent({
        // async selected_folder(body) {
        //     console.log(body);
        // },
        async operation_done(body) {
            // console.log(body);
            for (const id in terminalStreamBoxes) {
                terminalStreamBoxes[id].removeStopButton();
            }
        },
        async out_stream(body) {
            const distanceToBottom = getDistanceToBottom();
            const { str, type } = JSON.parse(body.stream);
            const id = body.executionId;
            str.split('\n').forEach(line => {
                if (line.trim() === '') return;
                terminalStreamBoxes[id].addStream(line, type);
            });
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly(false);
        },
        async errnotify(body) {
            // console.log(body);
            return 1112;
        },
        async percent_bar(body) {
            const distanceToBottom = getDistanceToBottom();
            let id = randomId();
            let waitTime = body.total;
            percentBar[id] = new PercentBar({ template: body.template, total: waitTime });
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
            return id;
        },
        async out_print(body) {
            const distanceToBottom = getDistanceToBottom();
            const message = body.data;// body.message[0];
            const mode = body.mode;
            const inputBox = new ContentBox();
            const resultContainer = inputBox.getContainer();
            resultContainer.textContent = `${message}`;
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
        },
        async out_state(body) {
            const distanceToBottom = getDistanceToBottom();

            // console.log(10, body);
            // displayState = new DisplayState();
            let id = randomId();
            displayState[id] = new DisplayState();
            displayState[id].setState({ text: body.stateLabel, state: 'loading' });
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
            // setTimeout(() => displayState[id].setState({ text: '완료되었습니다', state: 'done' }), 2000);
            // setTimeout(() => displayState[id].setState({ text: '실패했습니다', state: 'fail' }), 4000);
            return id;
            // return 1112;
        },
        async await_prompt(body) {
            const distanceToBottom = getDistanceToBottom();
            let _resolve = null;
            let _reject = null;
            let promise = new Promise((resolve, reject) => {
                _resolve = resolve;
                _reject = reject;
            });

            const mode = body.mode; // "run_nodejs_code"
            const javascriptCodeToRun = body.javascriptCodeToRun;
            const pythonCode = body.pythonCode;
            const actname = body.actname;
            const whattodo = body.whattodo;

            function isCodeRequiredConfirm(actname) {
                const codeRequiredConfirm = [
                    'generate_nodejs_code',
                    'generate_nodejs_code_for_puppeteer',
                    'generate_python_code',
                    'run_command',
                ];
                if (currentConfig['planEditable']) {
                    codeRequiredConfirm.push('whattodo_confirm');
                }
                return codeRequiredConfirm.includes(actname);
            }
            function handleCodeConfirmation(editor, destroy = false) {
                const distanceToBottom = getDistanceToBottom();
                const executionId = randomId();
                terminalStreamBoxes[executionId] = new TerminalStreamBox();
                const sourceCode = editor.getValue();
                if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
                _resolve({ confirmedCode: sourceCode, executionId });
                if (destroy) {
                    // console.log(editor);
                    editor.getWrapperElement().parentElement.remove();
                    // const theTextArea = editor.getWrapperElement().querySelector('textarea');
                    // editor.toTextArea(); // codemirror instance destroy
                    // theTextArea.parentElement.remove();
                    // console.log(theTextArea);
                }
                return terminalStreamBoxes[executionId];
            }
            // console.log(actname);

            // let confirmed = await await_prompt({ mode: 'run_nodejs_code', actname: actData.name, containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames });

            if (!isCodeRequiredConfirm(actname)) {
                const { editor, runButton } = makeCodeBox(javascriptCodeToRun, 'javascript');
                editor.setSize('100%', '100%');
                handleCodeConfirmation(editor, true);
                if (currentConfig['autoCodeExecution']) runButton.click();
            }
            else if ((mode === 'whattodo_confirm')) {
                const { editor, runButton } = makeCodeBox(whattodo, 'text', false);
                editor.setSize('100%', '100%');
                editor.setEventOnRun(async (code) => {
                    handleCodeConfirmation(editor, false).destroy();;
                });
            }
            else if ((actname === 'run_command' && mode === 'run_nodejs_code')) {
                const { editor, runButton } = makeCodeBox(javascriptCodeToRun, 'javascript');
                editor.setSize('100%', '100%');
                handleCodeConfirmation(editor, true);
                if (currentConfig['autoCodeExecution']) runButton.click();
            } else {
                if (mode === 'run_nodejs_code') {
                    const { editor, runButton } = makeCodeBox(javascriptCodeToRun, 'javascript');
                    editor.setSize('100%', '100%');
                    editor.setEventOnRun(async (code) => {
                        handleCodeConfirmation(editor);
                    });
                    if (currentConfig['autoCodeExecution']) runButton.click();
                } else if (mode === 'run_python_code') {
                    const { editor, runButton } = makeCodeBox(pythonCode, 'python');
                    editor.setSize('100%', '100%');
                    editor.setEventOnRun(async (code) => {
                        handleCodeConfirmation(editor);
                    });
                    if (currentConfig['autoCodeExecution']) runButton.click();
                } else if (mode === 'run_command') {
                    const { editor, runButton } = makeCodeBox('# Linux Shell Script\n' + body.command, 'bash', false);
                    editor.setSize('100%', '100%');
                    editor.setEventOnRun(async (code) => {
                        handleCodeConfirmation(editor).destroy();
                    });
                    if (currentConfig['autoCodeExecution']) runButton.click();
                }
            }
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
            return promise;
        },
        destroypercentbar(body) {
            let id = body.labelId;
            if (!percentBar[id]) return;
            percentBar[id].destroy();
            delete percentBar[id];
        },
        onetick(body) {
            let id = body.labelId;
            if (!percentBar[id]) return;
            percentBar[id].left--;
            percentBar[id].update({ second: percentBar[id].left });
            if (percentBar[id].left <= 0) {
                this.destroypercentbar({ labelId: id });
                return false;
            }
            return true;
        },
        async dismiss(body) {
            let id = body.labelId;
            if (!displayState[id]) return;
            displayState[id].dismiss();
            delete displayState[id];
        },
        async succeed(body) {
            let id = body.labelId;
            if (!displayState[id]) return;
            const distanceToBottom = getDistanceToBottom();
            displayState[id].setState({ text: body.stateLabel, state: 'done' });
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
            delete displayState[id];
        },
        async fail(body) {
            let id = body.labelId;
            if (!displayState[id]) return;
            const distanceToBottom = getDistanceToBottom();
            displayState[id].setState({ text: body.stateLabel, state: 'fail' });
            if (distanceToBottom < BOTTOM_DISTANCE) scrollBodyToBottomSmoothly();
            delete displayState[id];
        },
    });







    //---------------------------------------
    // const fileElement = document.createElement('input');
    // fileElement.type = 'file';
    // fileElement.webkitdirectory = true; // 폴더 선택 활성화
    // fileElement.style.display = 'none';
    // rightSideContainer.appendChild(fileElement);

    // const selectFolderButton = document.createElement('button');
    // selectFolderButton.classList.add('mdc-button', 'mdc-button--raised');
    // selectFolderButton.style.backgroundColor = '#808080';
    // selectFolderButton.style.color = '#ffffff';
    // selectFolderButton.innerHTML = `
    //     <span class="mdc-button__ripple"></span>
    //     <span class="material-icons mdc-button__icon">folder</span>
    //     <span class="mdc-button__label">폴더 선택</span>
    // `;
    // rightSideContainer.appendChild(selectFolderButton);

    // selectFolderButton.addEventListener('click', () => {
    //     fileElement.click();
    // });

    // fileElement.addEventListener('change', (e) => {
    //     const files = e.target.files;

    //     // 첫 번째 파일이 있는 경우 해당 파일의 경로에서 폴더 경로 추출
    //     if (files.length > 0) {
    //         let folderPath = files[0].path.split('/');
    //         folderPath.pop();
    //         folderPath = folderPath.join('/');

    //         console.log('선택된 폴더:', folderPath);
    //         console.log('폴더 내 파일 수:', files.length);

    //         Array.from(files).forEach(file => {
    //             console.log('파일:', file.webkitRelativePath);
    //         });
    //     } else {
    //         // 빈 폴더인 경우 fileElement의 value에서 경로 추출
    //         const folderPath = fileElement.value;
    //         console.log('선택된 폴더:', folderPath);
    //         console.log('폴더가 비어있습니다');
    //     }
    // });
    // async function pickFolder() {
    //     try {
    //         // 폴더 선택 다이얼로그를 띄워 폴더 핸들을 얻음
    //         const directoryHandle = await window.showDirectoryPicker();
    //         console.log('선택한 폴더 핸들:', directoryHandle);

    //         // 폴더 내의 항목들을 열거(빈 폴더인 경우 아무 항목도 없을 수 있음)
    //         for await (const entry of directoryHandle.values()) {
    //             console.log('항목:', entry.kind, entry.name);
    //         }

    //         console.log('Full Path:', directoryHandle.name);
    //     } catch (err) {
    //         console.error('폴더 선택 중 오류 발생:', err);
    //     }
    // }

    function setFolderPath(path, displayElement) {
        displayElement[Symbol.for('path')] = '';
        displayElement.value = '';
        if (!path) {
        } else {
            displayElement.value = path;
            displayElement[Symbol.for('path')] = path;
        }
    }

    // 컨테이너 생성
    const folderSelectContainer = document.createElement('div');
    folderSelectContainer.style.display = 'flex';
    folderSelectContainer.style.alignItems = 'center';
    folderSelectContainer.style.gap = '7px';
    folderSelectContainer.style.marginTop = '7px';

    // 버튼 생성
    const selectFolderButton = document.createElement('button');
    selectFolderButton.classList.add('mdc-button');
    selectFolderButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
    selectFolderButton.style.color = 'rgba(255,255,255,0.7)';
    selectFolderButton.innerHTML = `
        <span class="material-icons mdc-button__icon">folder</span>
        <span class="mdc-button__label">입력 폴더</span>
    `;
    selectFolderButton.style.flexShrink = '0'; // 버튼 크기 고정

    // 경로 표시 영역 생성
    const pathDisplay = document.createElement('input');
    pathDisplay.placeholder = '폴더의 절대경로를 입력해주세요';
    pathDisplay.style.padding = '9px';
    pathDisplay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    pathDisplay.style.borderRadius = '4px';
    pathDisplay.style.color = '#888';
    pathDisplay.style.fontSize = '14px';
    pathDisplay.style.fontFamily = 'monospace';
    pathDisplay.style.flexGrow = '1';
    pathDisplay.style.overflow = 'hidden';
    pathDisplay.style.textOverflow = 'ellipsis';
    pathDisplay.style.whiteSpace = 'nowrap';
    pathDisplay.style.border = 'none';
    pathDisplay.style.outline = 'none';
    setFolderPath('', pathDisplay);

    // 컨테이너에 요소들 추가
    folderSelectContainer.appendChild(selectFolderButton);
    folderSelectContainer.appendChild(pathDisplay);
    missionSolvingContainer.appendChild(folderSelectContainer);

    selectFolderButton.addEventListener('click', async () => {
        let task = reqAPI('selector_folder', {});
        const choosenFolderAbsolutePath = await task.promise;
        if (choosenFolderAbsolutePath) {
            setFolderPath(choosenFolderAbsolutePath, pathDisplay);
        }
    });


    // 출력 폴더 선택을 위한 컨테이너 생성
    const outputFolderContainer = document.createElement('div');
    outputFolderContainer.style.display = 'flex';
    outputFolderContainer.style.alignItems = 'center';
    outputFolderContainer.style.gap = '7px';
    outputFolderContainer.style.marginTop = '7px';
    outputFolderContainer.style.display = 'none';

    // 출력 폴더 선택 버튼 생성
    const selectOutputButton = document.createElement('button');
    selectOutputButton.classList.add('mdc-button');
    selectOutputButton.style.backgroundColor = '#808080';
    selectOutputButton.style.color = '#ffffff';
    selectOutputButton.innerHTML = `
        <span class="material-icons mdc-button__icon">folder</span>
        <span class="mdc-button__label">출력 폴더</span>
    `;
    selectOutputButton.style.flexShrink = '0';

    // 출력 폴더 경로 표시 영역 생성
    const outputPathDisplay = document.createElement('div');
    outputPathDisplay.style.padding = '9px';
    outputPathDisplay.style.backgroundColor = 'rgba(255,255,255,0.5)';
    outputPathDisplay.style.borderRadius = '4px';
    outputPathDisplay.style.color = '#666';
    outputPathDisplay.style.fontSize = '14px';
    outputPathDisplay.style.fontFamily = 'monospace';
    outputPathDisplay.style.flexGrow = '1';
    outputPathDisplay.style.overflow = 'hidden';
    outputPathDisplay.style.textOverflow = 'ellipsis';
    outputPathDisplay.style.whiteSpace = 'nowrap';
    setFolderPath('', outputPathDisplay);

    // 컨테이너에 요소들 추가
    outputFolderContainer.appendChild(selectOutputButton);
    outputFolderContainer.appendChild(outputPathDisplay);
    missionSolvingContainer.appendChild(outputFolderContainer);

    selectOutputButton.addEventListener('click', async () => {
        let task = reqAPI('selector_folder', {});
        const choosenFolderAbsolutePath = await task.promise;
        if (choosenFolderAbsolutePath) {
            setFolderPath(choosenFolderAbsolutePath, outputPathDisplay);
        }
    });




    const promptInput = new PromptInput();
    missionSolvingContainer.appendChild(promptInput.container);
    promptInput.setFocus();
    promptInput.setValue('3,4를 더하고 거기서 2를 빼고 그리고 3을 곱하고 거기서 5나눠. 각 단계를 1초마다 출력. 파이썬코드로 만들어줘.');
    promptInput.setValue('현재 폴더의 목록을 확인해줘. 무엇이 있는지 확인하고 그 목록을 list.txt 파일로 만들어줘.');
    promptInput.setValue('1부터 100까지 1초마다 출력해줘.');
    promptInput.setValue('nodejs express로 서버를 만들어서 띄워줘.');
    promptInput.setValue('run df -h linux command');
    promptInput.setValue('이미지 파일 하나 있는데 해상도 구해줘.');
    promptInput.setValue('python으로 from PIL import Image 사용하는 코드 만들어줘.');
    promptInput.setValue('현재 폴더 안에 존재하는 파일 목록을 확인해서 그 목록을 file_list.txt에 기록해줘.');
    promptInput.setValue('print 1 to 1000 in every 1 second');
    promptInput.setValue('make 100 folders and save list of the folders in file_list.txt');
    promptInput.setValue('sum 4 6 7 3 and save result.txt and zip the txt file and rename the file as todays date.');
    promptInput.setValue('');
    promptInput.setPlaceholder('원하는 작업을 입력하세요');
    // promptInput.container.style.opacity = '0.8';

    let operationDoing = false;
    promptInput.on('enter', async (value) => {
        if (operationDoing) return;
        operationDoing = true;
        aborting_responsed = false;
        conversations.innerHTML = '';
        currentConfig['autoCodeExecution'] = await getConfig('autoCodeExecution');
        currentConfig['planEditable'] = await getConfig('planEditable');
        disableUIElements();


        // console.log(pathDisplay.value);
        setFolderPath(pathDisplay.value, pathDisplay);
        // return;

        // 화면의
        // 미션중지 버튼 생성
        const abortButton = document.createElement('button');
        abortButton.style.position = 'fixed';
        abortButton.style.top = '10px';
        abortButton.style.right = '10px';
        abortButton.style.backgroundColor = '#ef4444';
        abortButton.style.color = '#ffffff';
        abortButton.style.border = 'none';
        abortButton.style.borderRadius = '4px';
        abortButton.style.cursor = 'pointer';
        abortButton.style.display = 'flex';
        abortButton.style.alignItems = 'center';
        abortButton.style.gap = '4px';
        abortButton.style.padding = '4px 8px';
        abortButton.style.fontSize = '13px';
        abortButton.style.zIndex = '9999';
        abortButton.innerHTML = `
            <span class="material-icons" style="font-size: 20px;">stop</span>
            <span>미션중지</span>
        `;
        document.body.appendChild(abortButton);

        abortButton.addEventListener('click', async () => {
            window.electronAPI.send('mission_aborting', {});
            while (true) {
                if (aborting_responsed) break;
                await new Promise(resolve => setTimeout(resolve));
            }
            abortButton.style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
            abortButton.remove();
            [...document.querySelectorAll('.run-button')].forEach(button => {
                button.click();
            });

        });



        // console.log(value.detail);
        let task = reqAPI('ve1nppvpath', { prompt: value.detail, inputFolderPath: getInputFolderPath(), outputFolderPath: getOutputFolderPath() });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        // console.log(await task.promise);
        let resultPath = await task.promise;
        enableUIElements();
        promptInput.setFocus();
        scrollBodyToBottomSmoothly(false);
        abortButton.remove();
        if (resultPath) setFolderPath(resultPath, pathDisplay);
        operationDoing = false;
        // if (resultPath) {
        //     open(resultPath);
        // }
    });
    enableUIElements();


    const conversations = document.createElement('div');
    missionSolvingContainer.appendChild(conversations);



    async function checkVersion() {
        let task = reqAPI('get_version', {});
        let taskId = task.taskId;
        // if (false) await abortTask(taskId);
        // console.log(await task.promise);
        let resultPath = await task.promise;
        return resultPath;
        // console.log(resultPath);

    }








    //---------------------------------------
    function makeCodeBox(code, mode = 'javascript', lineNumbers = true) {
        // 컨테이너 생성
        const container = document.createElement('div');
        container.style.position = 'relative';
        conversations.appendChild(container);
        container.style.marginTop = '10px';

        const codebox = document.createElement('textarea');
        container.appendChild(codebox);
        codebox.value = code;
        const readOnly = false;
        const nonchat = null;
        const editor = CodeMirror.fromTextArea(codebox, {
            mode,
            theme: "monokai",
            lineNumbers: lineNumbers,
            lineWrapping: true,
            extraKeys: !nonchat ? {
                "Ctrl-Space": "autocomplete",
            } : {
                "Ctrl-Space": "autocomplete",
                "Enter": function (cm) {
                    nonchat(cm, cm.getValue());
                },
                "Shift-Enter": "newlineAndIndentContinueMarkdownList",
                // "Ctrl-Enter": "newlineAndIndentContinueMarkdownList",
            },
            readOnly: readOnly
        });

        if (!lineNumbers) {
            // container.style.paddingLeft = '25px';
            //set codemirror element's paddingLeft to 25px
            editor.getWrapperElement().style.paddingLeft = '25px';
        }


        // 에디터 생성 직후에 setEventOnRun 기능 추가
        editor.runCallback = null;
        editor.setEventOnRun = function (callback) {
            this.runCallback = callback;
        };

        // 버튼 컨테이너 생성
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '10px';
        buttonContainer.style.right = '10px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        container.appendChild(buttonContainer);

        // 취소 버튼
        const cancelButton = document.createElement('button');
        // cancelButton.classList.add('mdc-button', 'mdc-button--raised');
        // cancelButton.classList.add('mdc-theme--primary-bg');
        cancelButton.style.backgroundColor = '#808080'; // 회색 배경
        cancelButton.style.color = '#ffffff'; // 흰색 텍스트
        cancelButton.innerHTML = `
            <span class="material-icons mdc-button__icon" style="font-size:20px;">close</span>
            <span class="mdc-button__label">취소</span>
        `;
        buttonContainer.appendChild(cancelButton);
        // new mdc.ripple.MDCRipple(cancelButton);
        // 취소 버튼 스타일 업데이트 (중지 버튼과 동일한 크기로)
        cancelButton.style.display = 'flex';
        cancelButton.style.alignItems = 'center';
        cancelButton.style.gap = '4px';
        cancelButton.style.padding = '4px 8px';
        cancelButton.style.fontSize = '12px';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.border = 'none';
        cancelButton.style.cursor = 'pointer';

        cancelButton.remove();

        // 실행 버튼
        const runButton = document.createElement('button');
        runButton.classList.add('run-button');
        // runButton.classList.add('mdc-button', 'mdc-button--raised');
        // runButton.classList.add('mdc-theme--primary-bg');
        runButton.style.color = '#ffffff'; // 흰색 텍스트
        runButton.innerHTML = `
            <span class="material-icons mdc-button__icon" style="font-size:20px;">play_arrow</span>
            <span class="mdc-button__label">실행</span>
        `;
        buttonContainer.appendChild(runButton);
        // new mdc.ripple.MDCRipple(runButton);
        // 실행 버튼 스타일 업데이트 (중지 버튼과 동일한 크기로, 배경을 푸른 계열로 변경)
        runButton.style.display = 'flex';
        runButton.style.alignItems = 'center';
        runButton.style.gap = '4px';
        runButton.style.padding = '4px 8px';
        runButton.style.fontSize = '12px';
        runButton.style.borderRadius = '4px';
        runButton.style.border = 'none';
        runButton.style.cursor = 'pointer';
        runButton.style.backgroundColor = '#2196F3'; // 푸른 계열 색상

        // 실행 버튼 클릭 시 등록된 runCallback가 호출되도록 수정
        runButton.addEventListener('click', () => {
            runButton.remove();
            // 채ㅜ
            if (typeof editor.runCallback === 'function') {
                editor.runCallback(editor.getValue());
            } else {
                console.warn('실행 이벤트가 등록되지 않았습니다.');
            }
        });
        console.log(runButton);

        // 에디터 위아래 여백 설정
        const wrapper = editor.getWrapperElement();
        wrapper.style.paddingTop = '17px';
        wrapper.style.paddingBottom = '17px';
        wrapper.style.borderRadius = '10px';
        wrapper.style.border = '0px solid #ccc';
        // wrapper.style.boxShadow = '0 0 10px 0 rgba(0, 0, 0, 0.1)';

        return { editor, runButton };
    }
    // const editor = makeCodeBox('print("Hello, World!")');
    // editor.setSize('100%', '100%');


    // editor.on('change', (editor, data) => {
    //     // console.log(editor.getValue());
    // });
    // editor.on('focus', (editor, data) => {
    //     // console.log('focus');
    // });
    // editor.on('blur', (editor, data) => {
    //     // console.log('blur');
    // });
    // editor.on('cursorActivity', (editor, data) => {
    //     // console.log('cursorActivity');
    // });
    // editor.on('beforeChange', (editor, data) => {
    //     // console.log('beforeChange');
    // });
    // // editor set code
    // editor.setValue('print("Hello, Worl3adsfsdfd!")');
    // editor.setEventOnRun(async () => {
    //     const contentBox = new ContentBox();
    //     const resultContainer = contentBox.getContainer();
    //     resultContainer.innerText = "출력 결과: 실행 버튼이 눌렸습니다.";

    // })







    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // let displayState = new DisplayState();
    // displayState.setState({ text: '진행 중...', state: 'loading' });
    // setTimeout(() => displayState.setState({ text: '완료되었습니다', state: 'done' }), 2000);
    // setTimeout(() => displayState.setState({ text: '실패했습니다', state: 'fail' }), 4000);








    if (false) {
        let task = reqAPI('ve1nvpath', { key: 'sessionDate' });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        console.log(await task.promise);
    }
    if (false) {
        let task = reqAPI('ve1nppvpath', { prompt: '3,4를 더하고 거기서 2를 빼고 그리고 3을 곱하고 거기서 5나눠. 각 단계를 1초마다 출력.' });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        console.log(await task.promise);
    }
    if (false) {
        let task = reqAPI('ve1nppvpath', { prompt: 'sum 1,4,5 and print result' });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        console.log(await task.promise);
    }


    // {
    //     let ffdd = new DisplayState();
    //     ffdd.setState({ text: 'dsfsdfsf', state: 'loading' });
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'done' });
    //     }, 1000);
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'fail' });
    //     }, 2000);
    // }
    // {
    //     let ffdd = new DisplayState();
    //     ffdd.setState({ text: 'dsfsdfsf', state: 'loading' });
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'done' });
    //     }, 1000);
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'fail' });
    //     }, 2000);
    // }
    // {
    //     let ffdd = new DisplayState();
    //     ffdd.setState({ text: 'dsfsdfsf', state: 'loading' });
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'done' });
    //     }, 1000);
    //     setTimeout(() => {
    //         ffdd.setState({ text: 'dsfsdfsf', state: 'fail' });
    //     }, 2000);
    // }
    // const terminalSample = new TerminalStreamBox();
    // setTimeout(() => terminalSample.addStream('Hello, World!'), 1000);
    // setTimeout(() => terminalSample.addStream('Hello, World!'), 2000);
    // setTimeout(() => terminalSample.addStream('Hello, World!'), 3000);
    // setTimeout(() => terminalSample.addStream('Hello, World!'), 4000);
    // setTimeout(() => terminalSample.addStream('Hello, World!'), 5000);
    async function getConfig(key) {
        let task = reqAPI('getconfig', { key: key });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        return await task.promise;
    }
    async function setConfig(key, value) {
        let task = reqAPI('setconfig', { key: key, value: value });
        let taskId = task.taskId;
        if (false) await abortTask(taskId);
        return await task.promise;
    }


    // ---- 새 함수: UI 요소 활성화/비활성화 기능 추가 ----
    function disableUIElements() {
        // 폴더 선택 요소 비활성화
        folderSelectContainer.style.opacity = '0.4';
        folderSelectContainer.style.pointerEvents = 'none';
        selectFolderButton.disabled = true;
        selectFolderButton.style.opacity = '0.4';
        selectFolderButton.style.pointerEvents = 'none';

        outputFolderContainer.style.opacity = '0.4';
        outputFolderContainer.style.pointerEvents = 'none';
        selectOutputButton.disabled = true;
        selectOutputButton.style.opacity = '0.4';
        selectOutputButton.style.pointerEvents = 'none';

        // 프롬프트 입력창 비활성화
        promptInput.input.disabled = true;
        promptInput.container.style.backgroundColor = 'rgba(255,255,255,1)';
        promptInput.container.style.opacity = '0.5';
        //promptInput.container.style.color = 'rgba(255,255,255,1)';
        promptInput.container.style.pointerEvents = 'none';
    }

    function enableUIElements() {
        // 폴더 선택 요소 활성화
        folderSelectContainer.style.opacity = '1';
        folderSelectContainer.style.pointerEvents = 'auto';
        selectFolderButton.disabled = false;
        selectFolderButton.style.opacity = '1';
        selectFolderButton.style.pointerEvents = 'auto';

        outputFolderContainer.style.opacity = '1';
        outputFolderContainer.style.pointerEvents = 'auto';
        selectOutputButton.disabled = false;
        selectOutputButton.style.opacity = '1';
        selectOutputButton.style.pointerEvents = 'auto';

        // 프롬프트 입력창 활성화
        promptInput.input.disabled = false;
        promptInput.container.style.backgroundColor = 'rgba(255,255,255,1)';
        promptInput.container.style.opacity = '0.5';
        //promptInput.container.style.color = 'rgba(255,255,255,1)';
        promptInput.container.style.pointerEvents = 'auto';
    }

    // 전역에서 함수 호출이 가능하도록 window 객체에 할당
    window.disableUIElements = disableUIElements;
    window.enableUIElements = enableUIElements;
    // ---- 끝 ----

    // 환경설정 UI 추가: configurationContainer에 LLM 설정 관련 UI를 생성
    {
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
        configTitle.textContent = '환경설정';
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
            label.style.fontSize = '14px';

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
            select.style.fontSize = '14px';
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
            input.style.fontSize = '14px';
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

        // LLM 선택
        const { row: llmRow, inputContainer: llmContainer } = createConfigRow('사용할 LLM');
        const llmSelect = document.createElement('select');
        applyDarkModeSelect(llmSelect);
        llmSelect.innerHTML = `
            <option value="" disabled selected>사용할 LLM 선택</option>
            <option value="claude">Claude</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
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
        const { row: groqKeyRow, inputContainer: groqKeyContainer } = createConfigRow('Groq API Key');
        const groqApiKeyInput = document.createElement('input');
        groqApiKeyInput.type = 'password';
        groqApiKeyInput.placeholder = 'Enter Groq API Key';
        applyDarkModeInput(groqApiKeyInput);
        groqKeyContainer.appendChild(groqApiKeyInput);
        groqGroup.appendChild(groqKeyRow);

        // Groq Model 선택
        const { row: groqModelRow, inputContainer: groqModelContainer } = createConfigRow('Groq Model');
        const groqModelSelect = document.createElement('select');
        applyDarkModeSelect(groqModelSelect);
        groqModelSelect.innerHTML = `
            <option value="" disabled selected>모델 선택</option>
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

        const { row: claudeKeyRow, inputContainer: claudeKeyContainer } = createConfigRow('Claude API Key');
        const claudeApiKeyInput = document.createElement('input');
        claudeApiKeyInput.type = 'password';
        claudeApiKeyInput.placeholder = 'Enter Claude API Key';
        applyDarkModeInput(claudeApiKeyInput);
        claudeKeyContainer.appendChild(claudeApiKeyInput);
        claudeGroup.appendChild(claudeKeyRow);

        const { row: claudeModelRow, inputContainer: claudeModelContainer } = createConfigRow('Claude Model');
        const claudeModelSelect = document.createElement('select');
        applyDarkModeSelect(claudeModelSelect);
        claudeModelSelect.innerHTML = `
            <option value="" disabled selected>모델 선택</option>
            <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (Faster, cheaper)</option>
            <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (More refined tasks)</option>
        `;
        claudeModelContainer.appendChild(claudeModelSelect);
        claudeGroup.appendChild(claudeModelRow);

        // DeepSeek 설정
        const deepseekGroup = document.createElement('div');
        deepseekGroup.style.display = 'none';
        deepseekGroup.style.flexDirection = 'column';
        deepseekGroup.style.gap = '25px';
        configWrapper.appendChild(deepseekGroup);

        const { row: deepseekKeyRow, inputContainer: deepseekKeyContainer } = createConfigRow('DeepSeek API Key');
        const deepseekApiKeyInput = document.createElement('input');
        deepseekApiKeyInput.type = 'password';
        deepseekApiKeyInput.placeholder = 'Enter DeepSeek API Key';
        applyDarkModeInput(deepseekApiKeyInput);
        deepseekKeyContainer.appendChild(deepseekApiKeyInput);
        deepseekGroup.appendChild(deepseekKeyRow);

        const { row: deepseekModelRow, inputContainer: deepseekModelContainer } = createConfigRow('DeepSeek Model');
        const deepseekModelSelect = document.createElement('select');
        applyDarkModeSelect(deepseekModelSelect);
        deepseekModelSelect.innerHTML = `
            <option value="" disabled selected>모델 선택</option>
            <option value="deepseek-chat">deepseek-chat</option>
        `;
        deepseekModelContainer.appendChild(deepseekModelSelect);
        deepseekGroup.appendChild(deepseekModelRow);

        // OpenAI 설정
        const openaiGroup = document.createElement('div');
        openaiGroup.style.display = 'none';
        openaiGroup.style.flexDirection = 'column';
        openaiGroup.style.gap = '25px';
        configWrapper.appendChild(openaiGroup);

        const { row: openaiKeyRow, inputContainer: openaiKeyContainer } = createConfigRow('OpenAI API Key');
        const openaiApiKeyInput = document.createElement('input');
        openaiApiKeyInput.type = 'password';
        openaiApiKeyInput.placeholder = 'Enter OpenAI API Key';
        applyDarkModeInput(openaiApiKeyInput);
        openaiKeyContainer.appendChild(openaiApiKeyInput);
        openaiGroup.appendChild(openaiKeyRow);

        const { row: openaiModelRow, inputContainer: openaiModelContainer } = createConfigRow('OpenAI Model');
        const openaiModelSelect = document.createElement('select');
        applyDarkModeSelect(openaiModelSelect);
        openaiModelSelect.innerHTML = `
            <option value="" disabled selected>모델 선택</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
        `;
        openaiModelContainer.appendChild(openaiModelSelect);
        openaiGroup.appendChild(openaiModelRow);

        // Ollama 설정 그룹 추가
        const ollamaGroup = document.createElement('div');
        ollamaGroup.style.display = 'none';
        ollamaGroup.style.flexDirection = 'column';
        ollamaGroup.style.gap = '25px';
        configWrapper.appendChild(ollamaGroup);

        // Ollama 모델 선택
        const { row: ollamaModelRow, inputContainer: ollamaModelContainer } = createConfigRow('Ollama Model');
        const ollamaModelInput = document.createElement('input');
        ollamaModelInput.type = 'text';
        ollamaModelInput.placeholder = 'Enter Ollama Model Name (e.g., qwen2.5:14b, llama3.3:70b)';
        applyDarkModeInput(ollamaModelInput);
        ollamaModelContainer.appendChild(ollamaModelInput);
        ollamaGroup.appendChild(ollamaModelRow);

        // Ollama 모델 선택 부분 다음에 추가
        const ollamaModelInfo = document.createElement('div');
        ollamaModelInfo.style.fontSize = '12px';
        ollamaModelInfo.style.color = 'rgba(255, 255, 255, 0.5)';
        ollamaModelInfo.style.marginTop = '8px';
        ollamaModelInfo.style.paddingLeft = '12px';
        ollamaModelInfo.innerHTML = `Tools 지원 모델만 사용 가능합니다. 지원 모델 목록: <a href="https://ollama.com/search?c=tools" style="color: #64B5F6; text-decoration: none;" target="_blank">https://ollama.com/search?c=tools</a>`;
        ollamaModelContainer.appendChild(ollamaModelInfo);

        // Endpoint 설정 추가
        const { row: ollamaEndpointRow, inputContainer: ollamaEndpointContainer } = createConfigRow('Ollama Endpoint');
        const ollamaEndpointInput = document.createElement('input');
        ollamaEndpointInput.type = 'text';
        ollamaEndpointInput.placeholder = 'Enter Ollama API Endpoint (e.g., http://localhost:11434)';
        applyDarkModeInput(ollamaEndpointInput);
        ollamaEndpointContainer.appendChild(ollamaEndpointInput);
        ollamaGroup.appendChild(ollamaEndpointRow);

        // Docker 설정 부분을 수정
        // Docker 사용 여부 설정
        const { row: useDockerRow, inputContainer: useDockerContainer } = createConfigRow('Docker 사용');
        const useDockerCheckbox = document.createElement('input');
        useDockerCheckbox.type = 'checkbox';
        useDockerCheckbox.style.width = '20px';
        useDockerCheckbox.style.height = '20px';
        useDockerCheckbox.style.cursor = 'pointer';
        useDockerCheckbox.style.accentColor = '#2196F3';
        useDockerCheckbox.setAttribute('disabled', 'disabled');
        useDockerContainer.appendChild(useDockerCheckbox);
        configWrapper.appendChild(useDockerRow);

        // Docker Path 설정 추가
        const { row: dockerPathRow, inputContainer: dockerPathContainer } = createConfigRow('Docker Path');
        const dockerPathInput = document.createElement('input');
        dockerPathInput.type = 'text';
        dockerPathInput.placeholder = 'Enter Docker Path (e.g., /usr/local/bin/docker)';
        applyDarkModeInput(dockerPathInput);
        dockerPathContainer.appendChild(dockerPathInput);
        configWrapper.appendChild(dockerPathRow);

        // Docker Image 설정 (기존 코드)
        const { row: dockerRow, inputContainer: dockerContainer } = createConfigRow('Docker Image 이름');
        const dockerImageInput = document.createElement('input');
        dockerImageInput.type = 'text';
        dockerImageInput.placeholder = 'Enter Docker Image Name';
        applyDarkModeInput(dockerImageInput);
        dockerContainer.appendChild(dockerImageInput);
        configWrapper.appendChild(dockerRow);

        // Docker 사용 여부에 따라 Docker 관련 설정들 표시/숨김
        useDockerCheckbox.addEventListener('change', async () => {
            dockerRow.style.display = useDockerCheckbox.checked ? 'flex' : 'none';
            dockerPathRow.style.display = useDockerCheckbox.checked ? 'flex' : 'none';
            await setConfig('useDocker', useDockerCheckbox.checked);
        });

        // Docker Path 입력 이벤트 리스너 추가
        dockerPathInput.addEventListener('input', async () => {
            await setConfig('dockerPath', dockerPathInput.value);
        });

        // Docker Image 설정 다음에 추가
        const { row: autoCodeRow, inputContainer: autoCodeContainer } = createConfigRow('자동 코드 실행');
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
        autoCodeDescription.style.fontSize = '12px';
        autoCodeDescription.style.color = 'rgba(255, 255, 255, 0.5)';
        autoCodeDescription.textContent = '체크하면 코드가 자동으로 실행됩니다. 체크하지 않으면 수동으로 실행해야 합니다.';
        autoCodeDescription.style.flex = '1';
        autoCodeContainer.appendChild(autoCodeDescription);

        configWrapper.appendChild(autoCodeRow);

        const { row: planEditRow, inputContainer: planEditContainer } = createConfigRow('AI 계획 수정');
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
        planEditDescription.style.fontSize = '12px';
        planEditDescription.style.color = 'rgba(255, 255, 255, 0.5)';
        planEditDescription.textContent = '체크하면 AI가 판단한 계획을 수정할 수 있습니다.';
        planEditDescription.style.flex = '1';
        planEditContainer.appendChild(planEditDescription);

        configWrapper.appendChild(planEditRow);

        // loadConfigurations 함수 내부에 Groq 관련 설정 로드 추가
        loadConfigurations = async function () {
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
            } else {
                useDockerCheckbox.checked = true;
                dockerRow.style.display = 'flex';
                dockerPathRow.style.display = 'flex';
                await setConfig('useDocker', true);
            }

            // Docker Image 설정 로드
            const dockerImage = await getConfig('dockerImage');
            if (dockerImage) dockerImageInput.value = dockerImage;

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
        };

        // 초기 설정값 로드
        await loadConfigurations();

        llmSelect.addEventListener('change', async () => {
            await setConfig('llm', llmSelect.value);
            await loadConfigurations();
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
        clearDataButton.textContent = 'Output Data 모두 제거';
        clearDataButton.style.flex = '1'; // 50% 너비 차지
        clearDataButton.style.backgroundColor = '#DC2626';
        clearDataButton.style.color = '#ffffff';
        clearDataButton.style.padding = '12px 20px';
        clearDataButton.style.border = 'none';
        clearDataButton.style.borderRadius = '4px';
        clearDataButton.style.cursor = 'pointer';
        clearDataButton.style.fontSize = '14px';
        clearDataButton.style.fontWeight = '500';

        // Output Data 폴더 열기 버튼
        const openFolderButton = document.createElement('button');
        openFolderButton.textContent = 'Output Data 폴더 열기';
        openFolderButton.style.flex = '1'; // 50% 너비 차지
        openFolderButton.style.backgroundColor = '#4B5563'; // 회색 배경
        openFolderButton.style.color = '#ffffff';
        openFolderButton.style.padding = '12px 20px';
        openFolderButton.style.border = 'none';
        openFolderButton.style.borderRadius = '4px';
        openFolderButton.style.cursor = 'pointer';
        openFolderButton.style.fontSize = '14px';
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
            if (confirm('정말 삭제하시겠습니까?')) {
                let task = reqAPI('clear_output_data', {});
                let taskId = task.taskId;
                await task.promise;
            }
        });

        openFolderButton.addEventListener('click', async () => {
            let task = reqAPI('open_output_folder', {});
            let taskId = task.taskId;
            if (!await task.promise) {
                alert('폴더가 존재하지 않습니다.');
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
    }

    (async () => {
        const result = await checkVersion();
        if (!result) return;
        const { latest, client } = result;
        versionInfo.textContent = `Version ${client}`;
        if (latest > client) {
            versionUpdate.textContent = `New Version ${latest} is available`;
        }
    })();






    // {
    //     let id = randomId();
    //     let waitTime = 3;
    //     percentBar[id] = new PercentBar({ template: `대기 {{second}}초 남음`, total: waitTime });
    //     while (waitTime >= 0) {
    //         await new Promise(resolve => setTimeout(resolve, 1000));
    //         waitTime--;
    //         percentBar[id].update({ second: waitTime });
    //         if (waitTime <= 0) break;
    //     }
    //     percentBar[id].destroy();
    //     delete percentBar[id];
    //     // console.log(percentBar[id]);
    // }
    // console.log(await checkVersion());
    // {
    //     let task = reqAPI('get_version', {});
    //     let taskId = task.taskId;
    //     // if (false) await abortTask(taskId);
    //     // console.log(await task.promise);
    //     let resultPath = await task.promise;
    //     console.log(resultPath);
    // }
});