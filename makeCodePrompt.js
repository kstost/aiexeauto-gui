import { makeTag, omitMiddlePart, getLanguageFullName } from './solveLogic.js';
import { getConfiguration } from './system.js';
import { templateBinding } from './system.js';
import { promptTemplate } from './system.js';
import { isSequentialthinking } from './system.js';
export function indention(num = 1, string = null, indentation = 2) {
    if (string) {
        return string.split('\n').map(line => ' '.repeat(num * indentation) + line).join('\n');
    } else {
        return ' '.repeat(num * indentation);
    }
}
export async function makeCodePrompt(mission, type, whatdidwedo, whattodo, evaluationText, processTransactions, check_list) {
    let output = processTransactions.at(-1).data;
    let summarized = processTransactions.at(-1).summarized;
    let outputDataId = processTransactions.at(-1).outputDataId;
    if (summarized) {
        output = summarized;
    }
    else if (output) {
        const { text, omitted } = omitMiddlePart(output, 1024, outputDataId);
        output = text;
        if (omitted) {
            // output = `${output}\n\n(The middle part of the output is omitted due to length. You can see the full output by clicking the button below.)`;
            // outputDataId
        }
        //outputDataId
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
                whattodo: whattodo ? makeTag('NextTasks', whattodo, !!whattodo) : '',
                sequentialthinking: await isSequentialthinking() ? `` : ``
                // sequentialthinking: await isSequentialthinking() ? `**Rely on the \`sequentialthinking\` function tool for strategizing**` : ``
            }),
        };
    } else if (type === 'evaluation') {
        check_list = (JSON.parse(JSON.stringify(check_list || []))).map(item => `- ${item}`).join('\n').trim();
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).evaluator.userPrompt, {
                check_list: makeTag('MissionCheckList', check_list, !!check_list),
                last: lastMessage,
                mission: makeTag('MustAchieveMission', mission, !!mission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'evalpreparation') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).evalpreparer.userPrompt, {
                last: lastMessage,
                mission: indention(1, mission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'whatdidwedo') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).recollection.userPrompt, {
                last: lastMessage,
                mission: makeTag('MustAchieveMission', mission, !!mission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    } else if (type === 'whattodo') {
        return {
            role: "user",
            content: templateBinding((await promptTemplate()).planning.userPrompt, {
                last: lastMessage,
                mission: makeTag('MustAchieveMission', mission, !!mission),
                languageFullName: await getLanguageFullName(),
            }),
        };
    }
}