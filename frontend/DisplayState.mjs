export class DisplayState {
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
        // this.state.style.transition = 'all 0.3s cubic-bezier(.25,.8,.25,1)';
        this.state.style.marginTop = '3px';
        this.state.style.marginBottom = '3px';
        this.state.style.fontSize = '16px';

        // 아이콘 컨테이너
        this.iconContainer = document.createElement('span');
        this.iconContainer.classList.add('material-icons');
        this.iconContainer.style.fontSize = '20px';

        // 텍스트 컨테이너
        this.textContainer = document.createElement('span');
        this.textContainer.style.fontWeight = '400';
        this.textContainer.style.fontFamily = 'Noto Sans KR';
        this.textContainer.style.marginTop = '-3px';
        this.textContainer.style.whiteSpace = 'nowrap';
        this.textContainer.style.overflow = 'hidden';
        this.textContainer.style.textOverflow = 'ellipsis';

        this.state.appendChild(this.iconContainer);
        this.state.appendChild(this.textContainer);
    }
    dismiss(justAlpha = true) {
        // justAlpha = false;
        if (justAlpha) {
            this.state.style.opacity = '0';
            return;
        }
        this.state.style.display = 'none';
    }
    setState({ text, state }) {
        this.textContainer.innerHTML = text;
        this.textContainer.querySelectorAll('a').forEach(a => {
            a.style.color = 'rgb(77, 150, 209)';
            a.style.textDecoration = 'none';
        });
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