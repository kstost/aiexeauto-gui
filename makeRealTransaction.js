import { omitMiddlePart } from './solveLogic.js';
import { makeCodePrompt } from './makeCodePrompt.js';
export function makeRealTransaction(processTransactions, multiLineMission, type, whatdidwedo, whattodo, evaluationText) {
    let realTransactions = [];
    for (let i = 0; i < processTransactions.length; i++) {
        const role = processTransactions[i].class === 'output' ? 'user' : 'assistant';
        const code = processTransactions[i].class === 'code' ? processTransactions[i].data : null;
        let output = processTransactions[i].class === 'output' ? processTransactions[i].data : null;
        if (output) {
            output = omitMiddlePart(output);
            output = output.trim();
        }

        let data = {
            role,
            content: (role === 'user' ? (output ? [
                'OUTPUT OF THE EXECUTION:',
                '```shell',
                `$ node code.js`,
                output,
                '```',
            ] : [
                'NO OUTPUT. THE EXECUTION COMPLETED WITHOUT ANY OUTPUT.',
                '```shell',
                `$ node code.js`,
                `$`,
                '```',
            ]) : [
                'CODE TO EXECUTE:',
                '```javascript',
                code,
                '```',
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
        } else {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        }
    }
    realTransactions[realTransactions.length - 1] = makeCodePrompt(multiLineMission, type, whatdidwedo, whattodo, evaluationText, processTransactions);
    return realTransactions;
}