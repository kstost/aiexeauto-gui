import { callEvent } from './callEvent.js';
import { PromptInput } from './frontend/PromptInput.mjs';
import { PercentBar } from './frontend/PercentBar.mjs';
import { DisplayState } from './frontend/DisplayState.mjs';
import { TerminalStreamBox } from './frontend/TerminalStreamBox.mjs';
import { ContentBox } from './frontend/ContentBox.mjs';
import { makeConfigUI } from './frontend/makeConfigUI.mjs';
import { customRulesUI } from './frontend/customRulesUI.mjs';
import singleton from './frontend/singleton.mjs';
import { getConfig, setConfig, caption } from './frontend/system.mjs';
import { makeCodeBox } from './frontend/makeCodeBox.mjs';

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
let aborting_responsed = false;
let currentConfig = {};
const dockerContainers = {};
window.electronAPI.receive('mission_aborting_response', (arg) => {
    aborting_responsed = true;
});

window.addEventListener('DOMContentLoaded', async () => {
    window.document.body.style.overflow = 'hidden';
    // 함수 선언만 먼저
    let forceScroll = true;
    // let loadConfigurations;
    const terminalStreamBoxes = {};
    const percentBar = {};
    let isBottom = false;
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

            const { str, type } = JSON.parse(body.stream);
            const id = body.executionId;
            str.split('\n').forEach(line => {
                if (line.trim() === '') return;
                terminalStreamBoxes[id].addStream(line, type);
            });
            scrollBodyToBottomSmoothly(false);
        },
        async errnotify(body) {
            // console.log(body);
            return 1112;
        },
        async percent_bar(body) {

            let id = randomId();
            let waitTime = body.total;
            percentBar[id] = new PercentBar({ template: body.template, total: waitTime });
            conversations.appendChild(percentBar[id].barContainer);

            scrollBodyToBottomSmoothly();
            return id;
        },
        async out_print(body) {

            const message = body.data;// body.message[0];
            const mode = body.mode;
            if (!message) return;
            const inputBox = new ContentBox();
            conversations.appendChild(inputBox.resultContainer);

            const resultContainer = inputBox.getContainer();
            resultContainer.textContent = `${message}`;
            scrollBodyToBottomSmoothly();
        },
        async out_state(body) {


            // console.log(10, body);
            // displayState = new DisplayState();
            let id = randomId();
            displayState[id] = new DisplayState();
            conversations.appendChild(displayState[id].state);

            displayState[id].setState({ text: body.stateLabel, state: 'loading' });
            scrollBodyToBottomSmoothly();
            // setTimeout(() => displayState[id].setState({ text: '완료되었습니다', state: 'done' }), 2000);
            // setTimeout(() => displayState[id].setState({ text: '실패했습니다', state: 'fail' }), 4000);
            return id;
            // return 1112;
        },
        async await_prompt(body) {
            // currentConfig['autoCodeExecution'] = await getConfig('autoCodeExecution');
            // currentConfig['planEditable'] = await getConfig('planEditable');

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

                const executionId = randomId();
                terminalStreamBoxes[executionId] = new TerminalStreamBox();
                conversations.appendChild(terminalStreamBoxes[executionId].container);

                const sourceCode = editor.getValue();
                scrollBodyToBottomSmoothly();
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
            scrollBodyToBottomSmoothly();
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

            displayState[id].setState({ text: body.stateLabel, state: 'done' });
            scrollBodyToBottomSmoothly();
            delete displayState[id];
        },
        async fail(body) {
            let id = body.labelId;
            if (!displayState[id]) return;

            displayState[id].setState({ text: body.stateLabel, state: 'fail' });
            scrollBodyToBottomSmoothly();
            delete displayState[id];
        },
    }, {
        async data_check(body) {
            // turnDataCheckButton(false);
            document.getElementById('dataCheckButton')[Symbol.for('changeMethod')](false);
            console.log('data_check', body);
        }
    });
    // { reqAPI, abortAllTask, abortTask }
    singleton.reqAPI = reqAPI;
    singleton.abortAllTask = abortAllTask;
    singleton.abortTask = abortTask;
    singleton.lang = await getConfig('captionLanguage');



    const leftSide = document.createElement('div');
    leftSide.classList.add('left-side');
    document.body.appendChild(leftSide);

    // 새롭게 추가: 앱 제목 "AIEXE"를 상단에 추가
    const appTitle = document.createElement('h1');
    const titleSpan1 = document.createElement('span');
    titleSpan1.textContent = 'AIEXE';
    titleSpan1.classList.add('extra-bold');
    titleSpan1.style.fontSize = '24px';
    const titleSpan2 = document.createElement('span');
    titleSpan2.textContent = 'AUTO';
    titleSpan2.classList.add('thin');
    titleSpan2.style.fontSize = '24px';
    appTitle.appendChild(titleSpan1);
    appTitle.appendChild(titleSpan2);
    appTitle.style.color = '#ffffff';
    appTitle.style.textAlign = 'center';
    appTitle.style.padding = '20px 0 10px';
    appTitle.style.borderBottom = '5px solid rgba(255, 255, 255, 0.1)';
    appTitle.style.marginLeft = '30px';
    appTitle.style.marginRight = '30px';
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
        { text: caption('missionSolving'), mode: 'missionSolving' },
        { text: caption('configuration'), mode: 'configuration' },
        { text: caption('customrules'), mode: 'customrules' },
        { text: caption('youtube'), mode: 'youtube' },
        { text: caption('class'), mode: 'class' }
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
                    if (operationDoing) { alert(caption('configChangeNotAllowed')); return; }
                    await singleton.loadConfigurations();
                    turnWindow(menuItem.mode);
                } else if (menuItem.mode === 'customrules') {
                    if (operationDoing) { alert(caption('configChangeNotAllowed')); return; }
                    turnWindow(menuItem.mode);
                    {
                        const data = `${await getConfig('customRulesForCodeGenerator')}`;
                        customRulesSet.customRulesForCodeGenerator.setValue(data);
                        // customRulesSet.customRulesForCodeGenerator.focus();
                    }
                    {
                        const data = `${await getConfig('customRulesForEvaluator')}`;
                        customRulesSet.customRulesForEvaluator.setValue(data);
                        // customRulesSet.customRulesForEvaluator.focus();
                    }
                } else {
                    if (operationDoing) { alert(caption('missionDoing')); return; }
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

    const parentContainer = document.createElement('div');
    parentContainer.className = 'conversation-container';
    parentContainer.style.padding = '30px';
    // parentContainer.style.display = 'flex';
    // parentContainer.style.flexDirection = 'column';
    // parentContainer.style.gap = '25px'; // 모든 직계 자식 요소 사이의 간격을 25px로 통일
    missionSolvingContainer.appendChild(parentContainer);

    {
        const conversationTitle = document.createElement('h2');
        conversationTitle.textContent = caption('missionSolving');
        conversationTitle.style.margin = '0'; // 기존 margin 제거
        conversationTitle.style.marginBottom = '5px'; // 제목 아래 간격만 추가
        parentContainer.appendChild(conversationTitle);

    }

    // config-container
    // function scrollEvent(e) {

    // }
    missionSolvingContainer.addEventListener('scroll', (e) => {
        if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 100) {
            isBottom = true;
        } else if (e.target.scrollTop <= 100) {
            isBottom = false;
        } else {
            isBottom = false;
        }
    });

    const configurationContainer = document.createElement('div');
    configurationContainer.classList.add('right-side');
    configurationContainer[Symbol.for('mode')] = 'configuration';
    document.body.appendChild(configurationContainer);

    const customrulesContainer = document.createElement('div');
    customrulesContainer.classList.add('right-side');
    customrulesContainer[Symbol.for('mode')] = 'customrules';
    document.body.appendChild(customrulesContainer);

    function turnWindow(mode) {
        missionSolvingContainer.style.display = 'none';
        configurationContainer.style.display = 'none';
        customrulesContainer.style.display = 'none';
        if (mode === 'missionSolving') {
            missionSolvingContainer.style.display = 'block';
        } else if (mode === 'configuration') {
            configurationContainer.style.display = 'block';
        } else if (mode === 'customrules') {
            customrulesContainer.style.display = 'block';
        }
    }
    turnWindow('missionSolving');

    //----------------------------------------------------
    let displayState = {};














    //----------------------------------------------------
    // let inputFolderPath = '';
    // let outputFolderPath = '';

    function getInputFolderPath() {
        return pathDisplay[Symbol.for('path')] || '';
    }


    function setForceScroll() {
        forceScroll = missionSolvingContainer.getBoundingClientRect().height > parentContainer.getBoundingClientRect().height;
    }
    function scrollBodyToBottomSmoothly(animation = true) {
        if (!isBottom && !forceScroll) return;
        const body = missionSolvingContainer;
        const html = document.documentElement;

        const maxScroll = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );
        setForceScroll();
        body.scrollTo({
            top: maxScroll,
            behavior: animation ? 'smooth' : 'instant'
        });
    }









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
        <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">${caption('inputFolder')}</span>
    `;
    selectFolderButton.style.flexShrink = '0'; // 버튼 크기 고정

    // 경로 표시 영역 생성
    const pathDisplay = document.createElement('input');
    pathDisplay.placeholder = caption('inputFolderPlaceholder');
    pathDisplay.style.padding = '9px';
    pathDisplay.style.backgroundColor = 'rgba(0,0,0,0.3)';
    pathDisplay.style.borderRadius = '4px';
    pathDisplay.style.color = '#888';
    pathDisplay.style.fontSize = '16px';
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
    parentContainer.appendChild(folderSelectContainer);

    selectFolderButton.addEventListener('click', async () => {
        let task = reqAPI('selector_folder', {});
        const choosenFolderAbsolutePath = await task.promise;
        if (choosenFolderAbsolutePath) {
            setFolderPath(choosenFolderAbsolutePath, pathDisplay);
        }
    });








    const promptInput = new PromptInput();
    parentContainer.appendChild(promptInput.container);
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
    promptInput.setPlaceholder(caption('promptPlaceholder'));
    // promptInput.container.style.opacity = '0.8';

    let operationDoing = false;
    {
        const startOperationButton = document.createElement('button');
        startOperationButton.style.backgroundColor = '#388e3c';
        startOperationButton.style.color = '#ffffff';
        startOperationButton.textContent = caption('getStartOperation');
        startOperationButton.style.width = '100%';
        startOperationButton.style.padding = '10px';
        startOperationButton.style.border = 'none';
        startOperationButton.style.borderRadius = '4px';
        startOperationButton.style.cursor = 'pointer';
        parentContainer.appendChild(startOperationButton);
        startOperationButton.addEventListener('click', async () => {
            if (operationDoing) return;
            operationDoing = true;
            aborting_responsed = false;
            conversations.innerHTML = '';
            startOperationButton.style.backgroundColor = '#666666';
            startOperationButton.style.opacity = '0.5';
            // await new Promise(resolve => window.requestAnimationFrame(resolve));
            setForceScroll();
            currentConfig['autoCodeExecution'] = await getConfig('autoCodeExecution');
            currentConfig['planEditable'] = await getConfig('planEditable');
            disableUIElements();


            // console.log(pathDisplay.value);
            setFolderPath(pathDisplay.value, pathDisplay);
            // return;

            // 화면의
            //----------------------------------------------
            // 버튼들의 컨테이너 생성
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '15px';
            buttonContainer.style.position = 'fixed';
            buttonContainer.style.top = '0px';
            buttonContainer.style.right = '0px';
            buttonContainer.style.left = '200px';
            buttonContainer.style.zIndex = '9999';
            buttonContainer.style.backdropFilter = 'blur(3px)';
            buttonContainer.style.backgroundColor = 'rgba(255,255,255,0.1)';
            buttonContainer.style.padding = '10px';
            buttonContainer.style.fontSize = '13px';
            buttonContainer.style.textAlign = 'right';
            buttonContainer.style.justifyContent = 'flex-end';

            // 계획수정 체크박스 생성
            const planEditCheckbox = document.createElement('div');
            planEditCheckbox.style.display = 'flex';
            planEditCheckbox.style.alignItems = 'center';
            planEditCheckbox.style.gap = '4px';
            planEditCheckbox.style.color = '#ffffff';
            planEditCheckbox.style.fontSize = '13px';
            planEditCheckbox.style.fontFamily = 'Noto Sans KR, serif';
            planEditCheckbox.innerHTML = `
                <input type="checkbox" id="planEditableCheckbox" style="cursor: pointer;">
                <label for="planEditableCheckbox" style="cursor: pointer;">계획수정</label>
            `;
            const checkboxForPlanEdit = planEditCheckbox.querySelector('#planEditableCheckbox');
            checkboxForPlanEdit.checked = await getConfig('planEditable');;//currentConfig['planEditable'];
            checkboxForPlanEdit.addEventListener('change', () => {
                console.log('planEditableCheckbox', checkboxForPlanEdit.checked);
                currentConfig['planEditable'] = checkboxForPlanEdit.checked;
                window.electronAPI.send('onewayreq', { mode: 'planEditable', arg: { checked: checkboxForPlanEdit.checked } });
            });

            // 코드수정 체크박스 생성
            const codeEditCheckbox = document.createElement('div');
            codeEditCheckbox.style.display = 'flex';
            codeEditCheckbox.style.alignItems = 'center';
            codeEditCheckbox.style.gap = '4px';
            codeEditCheckbox.style.color = '#ffffff';
            codeEditCheckbox.style.fontSize = '13px';
            codeEditCheckbox.style.fontFamily = 'Noto Sans KR, serif';
            codeEditCheckbox.innerHTML = `
                <input type="checkbox" id="autoCodeExecutionCheckbox" style="cursor: pointer;">
                <label for="autoCodeExecutionCheckbox" style="cursor: pointer;">코드자동실행</label>
            `;
            const checkboxForCodeEdit = codeEditCheckbox.querySelector('#autoCodeExecutionCheckbox');
            checkboxForCodeEdit.checked = await getConfig('autoCodeExecution');
            checkboxForCodeEdit.addEventListener('change', () => {
                console.log('autoCodeExecutionCheckbox', checkboxForCodeEdit.checked);
                currentConfig['autoCodeExecution'] = checkboxForCodeEdit.checked;
                window.electronAPI.send('onewayreq', { mode: 'autoCodeExecution', arg: { checked: checkboxForCodeEdit.checked } });
            });

            // modify mission button
            const modifyMissionButton = document.createElement('button');
            modifyMissionButton.style.backgroundColor = '#8b5cf6';
            modifyMissionButton.style.color = '#ffffff';
            modifyMissionButton.style.border = 'none';
            modifyMissionButton.style.borderRadius = '4px';
            modifyMissionButton.style.cursor = 'pointer';
            modifyMissionButton.style.display = 'flex';
            modifyMissionButton.style.alignItems = 'center';
            modifyMissionButton.style.gap = '4px';
            modifyMissionButton.style.padding = '4px 8px';
            modifyMissionButton.style.fontSize = '13px';
            modifyMissionButton.innerHTML = `
                <span class="material-icons" style="font-size: 20px;">refresh</span>
                <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">미션조정</span>
            `;
            modifyMissionButton.addEventListener('click', async () => {
                window.electronAPI.send('onewayreq', { mode: 'modify_mission', arg: {} });
            });
            modifyMissionButton.style.display = 'none';

            // 


            // 데이터 확인버튼
            const dataCheckButton = document.createElement('button');
            dataCheckButton.id = 'dataCheckButton';
            dataCheckButton[Symbol.for('changeMethod')] = function (mode) {
                dataCheckButton[Symbol.for('state')] = mode;
                if (mode) {
                    // 데이터 확인중
                    dataCheckButton.innerHTML = `
                    <span class="material-icons" style="font-size: 20px;">sync</span>
                    <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">데이터확인중</span>
                    `;
                    dataCheckButton.style.opacity = '0.5';
                } else {
                    // 보통 상태
                    dataCheckButton.innerHTML = `
                    <span class="material-icons" style="font-size: 20px;">folder_open</span>
                    <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">데이터확인</span>
                    `;
                    dataCheckButton.style.opacity = '1';
                }
            }
            dataCheckButton.style.backgroundColor = '#22a55e';
            dataCheckButton.style.color = '#ffffff';
            dataCheckButton.style.border = 'none';
            dataCheckButton.style.borderRadius = '4px';
            dataCheckButton.style.cursor = 'pointer';
            dataCheckButton.style.display = 'flex';
            dataCheckButton.style.alignItems = 'center';
            dataCheckButton.style.gap = '4px';
            dataCheckButton.style.padding = '4px 8px';
            dataCheckButton.style.fontSize = '13px';
            dataCheckButton[Symbol.for('changeMethod')](false);
            dataCheckButton.addEventListener('click', async () => {
                if (dataCheckButton[Symbol.for('state')]) return;
                dataCheckButton[Symbol.for('changeMethod')](true);
                window.electronAPI.send('onewayreq', { mode: 'data_check', arg: {} });
            });

            // 미션중지 버튼 생성
            const abortButton = document.createElement('button');
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
                <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">${caption('abortMission')}</span>
            `;

            buttonContainer.appendChild(planEditCheckbox);
            buttonContainer.appendChild(codeEditCheckbox);
            buttonContainer.appendChild(modifyMissionButton);
            buttonContainer.appendChild(dataCheckButton);
            buttonContainer.appendChild(abortButton);
            document.body.appendChild(buttonContainer);

            abortButton.addEventListener('click', async () => {
                {
                    let id = randomId();
                    displayState[id] = new DisplayState();
                    conversations.appendChild(displayState[id].state);
                    displayState[id].setState({ text: 'Operation Aborting...', state: 'loading' });
                    scrollBodyToBottomSmoothly();
                }
                window.electronAPI.send('mission_aborting', {});
                while (true) {
                    if (aborting_responsed) break;
                    await new Promise(resolve => setTimeout(resolve));
                }
                // abortButton.style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
                buttonContainer.remove();
                [...document.querySelectorAll('.run-button')].forEach(button => {
                    button.click();
                });

            });
            //-----------------------------------------------------------------------------------------
            // console.log(value.detail);
            const containerIdToUse = Object.keys(dockerContainers)[0];
            let task = reqAPI('ve1nppvpath', { prompt: promptInput.input.value, inputFolderPath: getInputFolderPath(), outputFolderPath: '', containerIdToUse });
            let taskId = task.taskId;
            if (false) await abortTask(taskId);
            // console.log(await task.promise);
            let { resultPath, containerId } = await task.promise;
            dockerContainers[containerId] = true;
            // console.log(containerId);
            enableUIElements();
            promptInput.setFocus();
            scrollBodyToBottomSmoothly(false);
            buttonContainer.remove();
            operationDoing = false;

            Object.keys(displayState).forEach(key => {
                displayState[key].dismiss();
                delete displayState[key];
            });
            startOperationButton.style.backgroundColor = '#388e3c';
            startOperationButton.style.opacity = '1';

            {
                const openResultFolderButton = document.createElement('button');
                openResultFolderButton.style.backgroundColor = '#388e3c';
                openResultFolderButton.style.color = '#ffffff';
                openResultFolderButton.textContent = caption('openResultFolder');
                openResultFolderButton.style.width = '100%';
                openResultFolderButton.style.padding = '10px';
                openResultFolderButton.style.border = 'none';
                openResultFolderButton.style.borderRadius = '4px';
                openResultFolderButton.style.cursor = 'pointer';
                conversations.appendChild(openResultFolderButton);
                openResultFolderButton.addEventListener('click', async () => {
                    reqAPI('openFolder', { resultPath });
                });
                if (resultPath) setFolderPath(resultPath, pathDisplay);
                if (!resultPath) openResultFolderButton.remove();
                scrollBodyToBottomSmoothly();

                // const openResultFolderButton = document.createElement('button');
                // // openResultFolderButton.style.position = 'fixed';
                // // openResultFolderButton.style.top = '10px';
                // // openResultFolderButton.style.right = '10px';
                // openResultFolderButton.style.backgroundColor = '#4caf50';
                // openResultFolderButton.style.color = '#ffffff';
                // // openResultFolderButton.style.border = 'none';
                // openResultFolderButton.style.borderRadius = '4px';
                // openResultFolderButton.style.cursor = 'pointer';
                // conversations.appendChild(openResultFolderButton);
                // openResultFolderButton.style.display = 'flex';
                // openResultFolderButton.style.alignItems = 'center';
                // openResultFolderButton.style.gap = '4px';
                // openResultFolderButton.style.padding = '4px 8px';
                // openResultFolderButton.style.fontSize = '13px';
            }

            // if (resultPath) {
            //     open(resultPath);
            // }
        });
    }

    // promptInput.on('enter', );
    enableUIElements();


    const conversations = document.createElement('div');
    singleton.conversations = conversations;
    parentContainer.appendChild(conversations);



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


    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);






    // ---- 새 함수: UI 요소 활성화/비활성화 기능 추가 ----
    function disableUIElements() {
        // 폴더 선택 요소 비활성화
        folderSelectContainer.style.opacity = '0.4';
        folderSelectContainer.style.pointerEvents = 'none';
        selectFolderButton.disabled = true;
        selectFolderButton.style.opacity = '0.4';
        selectFolderButton.style.pointerEvents = 'none';

        // 프롬프트 입력창 비활성화
        promptInput.input.disabled = true;
        promptInput.container.style.backgroundColor = 'rgba(255,255,255,1)';
        promptInput.container.style.opacity = '0.5';
        promptInput.container.style.pointerEvents = 'none';
    }

    function enableUIElements() {
        // 폴더 선택 요소 활성화
        folderSelectContainer.style.opacity = '1';
        folderSelectContainer.style.pointerEvents = 'auto';
        selectFolderButton.disabled = false;
        selectFolderButton.style.opacity = '1';
        selectFolderButton.style.pointerEvents = 'auto';

        // 프롬프트 입력창 활성화
        promptInput.input.disabled = false;
        promptInput.container.style.backgroundColor = 'rgba(255,255,255,1)';
        promptInput.container.style.opacity = '0.5';
        promptInput.container.style.pointerEvents = 'auto';
    }

    // 전역에서 함수 호출이 가능하도록 window 객체에 할당
    window.disableUIElements = disableUIElements;
    window.enableUIElements = enableUIElements;
    // ---- 끝 ----

    // 환경설정 UI 추가: configurationContainer에 LLM 설정 관련 UI를 생성
    await makeConfigUI(configurationContainer);
    const customRulesSet = await customRulesUI(customrulesContainer);

    (async () => {
        const result = await checkVersion();
        if (!result) return;
        const { latest, client } = result;
        versionInfo.textContent = `${caption('version')} ${client}`;
        if (latest > client) {
            versionUpdate.textContent = `${caption('newVersion')} ${latest} ${caption('isAvailable')}`;
        }
    })();



    missionSolvingContainer.dispatchEvent(new CustomEvent('scroll', { detail: {} }));
    // console.log(isBottom);

    await new Promise(resolve => window.requestAnimationFrame(resolve));
    document.body.style.transform = 'scale(1.1)';
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    document.body.style.transformOrigin = 'center';
    document.body.style.transition = 'transform 0.3s ease-in-out';
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    document.body.style.transform = 'scale(1)';
    document.getElementById('vail').style.opacity = '0';
    let rdt = false;
    document.getElementById('vail').addEventListener('transitionend', () => {
        if (rdt) return;
        rdt = true;
        document.getElementById('vail').remove();
        window.document.body.style.overflow = 'auto';
    });






});










