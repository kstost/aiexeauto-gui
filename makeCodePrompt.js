import { makeTag, omitMiddlePart, getLanguageFullName } from './solveLogic.js';
import { getConfiguration } from './system.js';
import { templateBinding } from './system.js';
import { promptTemplate } from './system.js';
export function indention(num = 1, string = null, indentation = 2) {
    if (string) {
        return string.split('\n').map(line => ' '.repeat(num * indentation) + line).join('\n');
    } else {
        return ' '.repeat(num * indentation);
    }
}
export async function makeCodePrompt(mission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, processTransactions, mainKeyMission) {
    let output = processTransactions.at(-1).data;
    if (output) {
        output = omitMiddlePart(output);
    }
    const lastMessage = processTransactions.at(-1).data !== null ? makeTag('CodeExecutionOutput', output || '(no output)') : '';
    if (type === 'coding') {
        evaluationText = (evaluationText || '').trim();
        whatdidwedo = (whatdidwedo || '').trim();
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).codeGenerator.userPrompt, {
                last: lastMessage,
                evaluationText: makeTag('EvaluationOfPreviousTasks', evaluationText, !!evaluationText),
                whatdidwedo: makeTag('WorkDoneSoFar', whatdidwedo, !!whatdidwedo),
                deepThinkingPlan: makeTag('Plan', deepThinkingPlan, !!deepThinkingPlan),
                whattodo: (whattodo && mainKeyMission !== whattodo) ? makeTag('NextTasks', whattodo, !!whattodo) : '',
                mainKeyMission: makeTag('THE-MAIN-KEY-MISSION', mainKeyMission, !!mainKeyMission),
            }),
        };
    } else if (type === 'evaluation') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).evaluator.userPrompt, {
                last: lastMessage,
                mainKeyMission: makeTag('THE-MAIN-KEY-MISSION', mainKeyMission, !!mainKeyMission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'whatdidwedo') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).recollection.userPrompt, {
                last: lastMessage,
                mission: makeTag('OurGoal', mission, !!mission),
                mainKeyMission: makeTag('THE-MAIN-KEY-MISSION', mainKeyMission, !!mainKeyMission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'whattodo') {
        let deepThinkingPlan = processTransactions.at(-1).deepThinkingPlan;
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).planning.userPrompt, {
                last: lastMessage,
                mission: makeTag('OurGoal', mission, !!mission),
                mainKeyMission: makeTag('THE-MAIN-KEY-MISSION', mainKeyMission, !!mainKeyMission),
                deepThinkingPlan: deepThinkingPlan ? makeTag('Plan', deepThinkingPlan, !!deepThinkingPlan) : '',
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'deepThinkingPlan') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).deepThinkingPlan.userPrompt, {
                last: lastMessage,
                mission: makeTag('OurGoal', mission, !!mission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    }
}