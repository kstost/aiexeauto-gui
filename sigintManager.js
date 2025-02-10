process.on('SIGINT', async () => {
    if (handlerOrder.length === 0) {
        return;
    }
    if (handlerOrder.length > 0) {
        const handler = handlerOrder[0];
        await handler();
        removeFirstHandler();
    }
});
const handlerOrder = [];
export function setHandler(handler) {
    handlerOrder.push(handler);
}
export function removeHandler(handler) {
    const index = handlerOrder.indexOf(handler);
    if (index > -1) handlerOrder.splice(index, 1);
}
export function removeFirstHandler() {
    handlerOrder.shift();
}
