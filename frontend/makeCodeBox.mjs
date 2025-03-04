import singleton from "./singleton.mjs";
import { caption } from "./system.mjs";
export function makeCodeBox(code, mode = 'javascript', lineNumbers = true) {
    // 컨테이너 생성
    const container = document.createElement('div');
    container.style.position = 'relative';
    singleton.conversations.appendChild(container);
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
        readOnly: readOnly,
        // 폰트 패밀리 설정 추가
        // styleActiveLine: true,
        // styleSelectedText: true,
        // CodeMirror의 기본 스타일링 옵션으로 폰트 설정
        // theme: "monokai intelone-mono"  // 기존 monokai 테마에 폰트 클래스 추가
    });

    // editor.getWrapperElement().style.fontFamily = 'intelone-mono-font-family-regular';
    // [...editor.getWrapperElement().querySelectorAll('*')].forEach(element => {
    //     element.style.fontFamily = 'intelone-mono-font-family-regular';
    // })



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
        <span class="mdc-button__label">${caption('cancel')}</span>
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
        <span style="margin-top:-3px; font-family: 'Noto Sans KR';">${caption('run')}</span>
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