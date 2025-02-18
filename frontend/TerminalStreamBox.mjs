import { caption } from './system.mjs';

export class TerminalStreamBox {
    constructor() {
        this.container = document.createElement('div');
        this.container.classList.add('terminal-stream-box');
        this.container.style.backgroundColor = '#1E1E1E';
        this.container.style.color = '#E0E0E0';
        this.container.style.padding = '12px';
        this.container.style.marginTop = '10px';
        this.container.style.borderRadius = '6px';
        this.container.style.fontSize = '16px';
        this.container.style.border = '1px solid #333';
        this.container.style.position = 'relative'; // 상대 위치 설정

        // 중지 버튼 생성
        this.stopButton = document.createElement('button');
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
                <span style="margin-top:-3px; font-family: 'Noto Sans KR', serif;">${caption('stopButton')}</span>
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
        this.placeholder.textContent = caption('waiting');
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
        // streamBox.style.whiteSpace = 'pre';
        streamBox.style.wordBreak = 'break-all';
        streamBox.classList.add('terminal-stream-box');
        streamBox.textContent = stream;
        streamBox.style.padding = '2px';
        streamBox.style.paddingLeft = '10px';
        streamBox.style.marginBottom = '1px';
        streamBox.style.marginTop = '1px';
        // streamBox.style.marginBottom = '0px';
        // streamBox.style.marginTop = '0px';
        streamBox.style.fontFamily = 'intelone-mono-font-family-regular';
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
        // streamBox.style.opacity = '0';
        // streamBox.style.transition = 'opacity 0.15s ease';
        // window.requestAnimationFrame(() => {
        //     streamBox.style.opacity = '1';
        // });

        // streamBox 하위의 모든 요소 브레이크 올.
        // streamBox.style.wordBreak = 'break-all';
    }
}