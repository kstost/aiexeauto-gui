// 기본 스타일 설정
export function initializeStyles() {
    // body 스타일 설정
    document.body.style.height = '100vh';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
}

// 컨테이너 스타일 설정
export function createContainerStyles() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = '#f0f0f0';
    container.style.overflow = 'hidden';
    return container;
}

// 왼쪽 패널 스타일 설정
export function createLeftPanelStyles(div) {
    div.style.width = '200px';
    div.style.height = '100%';
    div.style.backgroundColor = '#e0e0e0';
    div.style.flexShrink = '0';
    div.style.overflow = 'auto';
    return div;
}

// 오른쪽 패널 스타일 설정
export function createRightPanelStyles(div) {
    div.style.flex = '1';
    div.style.height = '100%';
    div.style.backgroundColor = '#ffffff';
    div.style.overflow = 'auto';
    return div;
}

// 파일 항목 스타일 설정
export function applyFileItemStyles(div) {
    div.style.padding = '10px';
    div.style.borderBottom = '1px solid #ccc';
    div.style.cursor = 'pointer';
    return div;
}

// 에디터 컨테이너 스타일 설정
export function createEditorContainerStyles(container) {
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'auto';
    return container;
} 