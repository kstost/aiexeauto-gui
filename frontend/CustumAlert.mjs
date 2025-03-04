export function showAlert(message, type = 'info') {
    const alertContainer = document.createElement('div');
    alertContainer.style.position = 'fixed';
    alertContainer.style.left = '50%';
    alertContainer.style.top = '20px';
    alertContainer.style.transform = 'translateX(-50%)';
    alertContainer.style.padding = '15px 25px';
    alertContainer.style.borderRadius = '5px';
    alertContainer.style.color = '#444444';
    alertContainer.style.fontSize = '14px';
    alertContainer.style.fontWeight = '500';
    alertContainer.style.zIndex = '9999';
    alertContainer.style.opacity = '0';
    alertContainer.style.transition = 'opacity 0.3s ease-in-out';

    switch (type) {
        case 'success':
            alertContainer.style.backgroundColor = '#ffffff';
            break;
        case 'error':
            alertContainer.style.backgroundColor = '#ffffff';
            break;
        case 'warning':
            alertContainer.style.backgroundColor = '#ffffff';
            break;
        default:
            alertContainer.style.backgroundColor = '#ffffff';
    }

    alertContainer.textContent = message;
    document.body.appendChild(alertContainer);

    setTimeout(() => {
        alertContainer.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        alertContainer.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(alertContainer);
        }, 300);
    }, 3000);
}
