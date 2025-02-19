export function callEvent(apiMethods, onewayreqresMethods) {
    let counter = 0;
    let queue = {};
    let abortedTasks = {};
    function getUnique() {
        counter++;
        return `${counter}.${new Date().getTime()}.${Math.random()}`;
    }
    async function abortAllTask() {
        await Promise.all(Object.keys(queue).map(abortTask));
    }
    async function abortTask(taskId) {
        if (abortedTasks[taskId]) { return; }
        if (!queue[taskId]) { return; }
        let _resolve;
        let promise = new Promise(resolve => _resolve = resolve);
        abortedTasks[taskId] = _resolve;
        window.electronAPI.send('aborting', { taskId: taskId });
        return await promise;
    }
    let reqAPIQueue = [];
    function reqAPI(mode, arg) {
        let taskId;
        taskId = getUnique();
        const promise = (async function () {
            reqAPIQueue.push({ mode, arg });
            let _resolve;
            let _reject;
            let promise = new Promise((resolve, reject) => {
                _resolve = resolve;
                _reject = reject;
            });
            queue[taskId] = { _resolve, _reject };
            while (true) {
                if (reqAPIQueue[0].mode === mode && reqAPIQueue[0].arg === arg) {
                    break;
                } else {
                    await new Promise(resolve => setTimeout(resolve));
                }
            }
            if (!queue[taskId]) {
                reqAPIQueue.shift();
                throw new Error('aborted');
            }
            window.electronAPI.send('request', { mode, taskId, arg });
            let dt;
            let throwed = false;
            try { dt = await promise; } catch { throwed = true; }
            reqAPIQueue.shift();
            if (throwed) throw new Error('aborted');
            return dt;
        })();
        return {
            taskId,
            promise
        }
    }
    window.electronAPI.receive('requesting', async (arg) => {
        let resValue = '';
        let reqValue = arg.arg;
        let result = null;
        if (true) {
            resValue = reqValue;
            let jdsf = JSON.parse(JSON.stringify(resValue));
            delete jdsf.__taskId;
            if (apiMethods[arg.mode]) result = await apiMethods[arg.mode](jdsf);
        }
        window.electronAPI.send('resolving', { taskId: arg.taskId, arg: result });
    });
    window.electronAPI.receive('aborting_queued', (arg) => {
        let taskId = arg.taskId;
        if (abortedTasks[taskId]) abortedTasks[taskId]();
        queue[taskId]._reject();
        delete abortedTasks[taskId];
        delete queue[taskId];
    });
    window.electronAPI.receive('response', (arg) => {
        let fnd = queue[arg.taskId];
        if (!fnd) return;
        delete queue[arg.taskId];
        fnd._resolve(arg.arg);
    });
    window.electronAPI.receive('onewayreqres', (arg) => {
        if (onewayreqresMethods[arg.mode]) onewayreqresMethods[arg.mode](arg.arg);
    });
    return {
        reqAPI, abortAllTask, abortTask
    }
}
