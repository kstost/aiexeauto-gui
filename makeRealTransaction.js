import { omitMiddlePart } from './solveLogic.js';
import { makeCodePrompt, indention } from './makeCodePrompt.js';
export async function makeRealTransaction({ processTransactions, multiLineMission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, mainKeyMission }) {
    let realTransactions = [];
    for (let i = 0; i < processTransactions.length; i++) {
        const role = processTransactions[i].class === 'output' ? 'user' : 'assistant';
        const code = processTransactions[i].class === 'code' ? processTransactions[i].data : null;
        let output = processTransactions[i].class === 'output' ? processTransactions[i].data : null;
        let whattodo = processTransactions[i].whattodo;
        let whatdidwedo = processTransactions[i].whatdidwedo;
        let mainkeymission = processTransactions[i].mainkeymission;
        let notcurrentmission = processTransactions[i].notcurrentmission;
        mainkeymission = mainKeyMission;
        if (output) {
            output = omitMiddlePart(output);
            output = output.trim();
        }

        const printWhatToDo = whattodo && mainkeymission !== whattodo;
        let data = {
            role,
            content: (role === 'user' ? (output ? [
                '<CodeExecutionOutput>',
                // 'OUTPUT OF THE EXECUTION:',
                // '```shell',
                // `$ node code.js`,
                indention(1, output),//output
                // '```',
                '</CodeExecutionOutput>',
                '',
                whatdidwedo ? '<WorkDoneSoFar>' : '',
                whatdidwedo ? indention(1, whatdidwedo) : '',
                whatdidwedo ? '</WorkDoneSoFar>' : '',
                '',
                printWhatToDo ? '<NextTasks>' : '',
                printWhatToDo ? indention(1, whattodo) : '',
                printWhatToDo ? '</NextTasks>' : '',
                '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? '<NextTasksToDo>' : '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? indention(1, mainkeymission) : '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? '</NextTasksToDo>' : '',
            ] : [
                '<CodeExecutionOutput>',
                // 'NO OUTPUT. THE EXECUTION COMPLETED WITHOUT ANY OUTPUT.',
                // '```shell',
                // `$ node code.js`,
                // `$`,
                // '```',
                indention(1, '(no output)'),
                '</CodeExecutionOutput>',
                '',
                whatdidwedo ? '<WorkDoneSoFar>' : '',
                whatdidwedo ? indention(1, whatdidwedo) : '',
                whatdidwedo ? '</WorkDoneSoFar>' : '',
                '',
                printWhatToDo ? '<NextTasks>' : '',
                printWhatToDo ? indention(1, whattodo) : '',
                printWhatToDo ? '</NextTasks>' : '',
                '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? '<NextTasksToDo>' : '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? indention(1, mainkeymission) : '',
                !printWhatToDo && !notcurrentmission && mainkeymission ? '</NextTasksToDo>' : '',
            ]) : [
                '<CodeForNextTasks>',
                indention(1, code),
                '</CodeForNextTasks>',
                // '',
                // whatdidwedo ? 'WHAT DID WE DO:' : '',
                // whatdidwedo ? whatdidwedo : '',
                // '',
                // 'WHAT TO DO:',
                // whattodo,
            ]).join('\n'),
        };
        realTransactions.push(data);
    }
    if (realTransactions.length === 0) throw new Error('No transactions found');
    if (realTransactions[realTransactions.length - 1].role !== 'user') throw new Error('Last transaction is not user');
    if (realTransactions.length > 1) {
        if (type === 'coding') {
            realTransactions[0].content = 'From now on, I will provide code to handle the very first step of the mission, followed by subsequent codes for each step to complete the mission sequentially. Once you run the provided code and share the results, I will analyze them to generate the next step\'s code accordingly.';
        } else if (type === 'evaluation') {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        } else if (type === 'whattodo') {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        } else if (type === 'whatdidwedo') {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        } else if (type === 'deepThinkingPlan') {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        } else {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        }
    }
    realTransactions[realTransactions.length - 1] = await makeCodePrompt(multiLineMission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, processTransactions, mainKeyMission);
    return realTransactions;
}