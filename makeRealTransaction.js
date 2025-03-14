import { omitMiddlePart, makeTag } from './solveLogic.js';
import { makeCodePrompt, indention } from './makeCodePrompt.js';
import { templateBinding, promptTemplate } from './system.js';
export async function makeRealTransaction({ processTransactions, multiLineMission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, mainKeyMission, check_list }) {
    let realTransactions = [];
    for (let i = 0; i < processTransactions.length; i++) {
        const role = processTransactions[i].class === 'output' ? 'user' : 'assistant';
        const code = processTransactions[i].class === 'code' ? processTransactions[i].data : null;
        let output = processTransactions[i].class === 'output' ? processTransactions[i].data : null;
        let summarized = processTransactions[i].class === 'output' ? processTransactions[i].summarized : null;
        let whattodo = processTransactions[i].whattodo;
        let whatdidwedo = processTransactions[i].whatdidwedo;
        let mainkeymission = processTransactions[i].mainkeymission;
        let notcurrentmission = processTransactions[i].notcurrentmission;
        let outputDataId = processTransactions[i].class === 'output' ? processTransactions[i].outputDataId : null;
        mainkeymission = mainKeyMission;
        if (output) {
            if (summarized) {
                output = summarized;
                output = output.trim();
            } else {
                const { text, omitted } = omitMiddlePart(output, 1024, outputDataId);
                output = text;
                output = output.trim();
                if (omitted) {

                }
            }
            // output = output.trim();
            // output = summarized ? summarized : text;
        }

        const printWhatToDo = whattodo && mainkeymission !== whattodo;
        const usersTurn = role === 'user';
        let data = {
            role,
            content: usersTurn ? templateBinding((await promptTemplate()).transactions.userPrompt, {
                codeExecutionOutput: makeTag('CodeExecutionOutput', output || '(no output)'),
                whatdidwedo: makeTag('WorkDoneSoFar', whatdidwedo, !!whatdidwedo),
                nextTasks: printWhatToDo ? makeTag('NextTasks', whattodo, !!whattodo) : '',
                nextTasksToDo: !printWhatToDo && !notcurrentmission && mainkeymission ? makeTag('NextTasksToDo', mainkeymission, !!mainkeymission) : '',
            }) : templateBinding((await promptTemplate()).transactions.assistantPrompt, {
                codeForNextTasks: makeTag('CodeForNextTasks', code),
            }),
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
        } else if (type === 'evalpreparation') {
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
    realTransactions[realTransactions.length - 1] = await makeCodePrompt(multiLineMission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, processTransactions, mainKeyMission, check_list);
    return realTransactions;
}