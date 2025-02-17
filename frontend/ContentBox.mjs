export class ContentBox {
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

    }

    getContainer() {
        return this.contentDiv;
    }
}