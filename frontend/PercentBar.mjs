export class PercentBar {
    constructor({ template, total }) {
        // 컨테이너 생성
        this.barContainer = document.createElement('div');
        this.barContainer.style.width = '100%';
        this.barContainer.style.padding = '15px';
        this.barContainer.style.backgroundColor = 'rgba(0,0,0,0.2)';
        this.barContainer.style.borderRadius = '8px';
        this.barContainer.style.margin = '15px 0';
        this.barContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

        // 라벨 컨테이너
        this.labelContainer = document.createElement('div');
        this.labelContainer.style.marginBottom = '8px';
        this.labelContainer.style.color = '#fff';
        this.labelContainer.style.fontSize = '16px';
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