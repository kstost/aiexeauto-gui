import { caption } from './system.mjs';
export class PromptInput {
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
        label.textContent = caption('promptLabel');
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
            if (Math.random() < 1.1) return;
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