export function showConfirm(message) {
    return new Promise((resolve) => {
        const confirmContainer = document.createElement('div');
        confirmContainer.style.position = 'fixed';
        confirmContainer.style.left = '50%';
        confirmContainer.style.top = '50%';
        confirmContainer.style.transform = 'translate(-50%, -50%)';
        confirmContainer.style.backgroundColor = '#ffffff';
        confirmContainer.style.padding = '20px';
        confirmContainer.style.borderRadius = '8px';
        confirmContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        confirmContainer.style.zIndex = '10000';
        confirmContainer.style.minWidth = '300px';
        confirmContainer.style.textAlign = 'center';

        const messageElement = document.createElement('p');
        messageElement.style.margin = '0 0 20px 0';
        messageElement.style.color = '#374151';
        messageElement.style.fontSize = '16px';
        messageElement.textContent = message;
        confirmContainer.appendChild(messageElement);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'center';

        const confirmButton = document.createElement('button');
        confirmButton.textContent = '확인';
        confirmButton.style.padding = '8px 16px';
        confirmButton.style.backgroundColor = '#DC2626';
        confirmButton.style.color = '#ffffff';
        confirmButton.style.border = 'none';
        confirmButton.style.borderRadius = '4px';
        confirmButton.style.cursor = 'pointer';
        confirmButton.style.fontSize = '14px';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '취소';
        cancelButton.style.padding = '8px 16px';
        cancelButton.style.backgroundColor = '#4B5563';
        cancelButton.style.color = '#ffffff';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontSize = '14px';

        confirmButton.addEventListener('mouseenter', () => {
            confirmButton.style.backgroundColor = '#B91C1C';
        });
        confirmButton.addEventListener('mouseleave', () => {
            confirmButton.style.backgroundColor = '#DC2626';
        });

        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = '#374151';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = '#4B5563';
        });

        confirmButton.addEventListener('click', () => {
            document.body.removeChild(confirmContainer);
            resolve(true);
        });

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(confirmContainer);
            resolve(false);
        });

        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        confirmContainer.appendChild(buttonContainer);

        document.body.appendChild(confirmContainer);
    });
}
