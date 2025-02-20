import { omitMiddlePart, getLanguageFullName } from './solveLogic.js';

export function indention(num = 1, string = null) {
    if (string) {
        return string.split('\n').map(line => ' '.repeat(num * 2) + line).join('\n');
    } else {
        return ' '.repeat(num * 2);
    }
}
export async function makeCodePrompt(mission, type, whatdidwedo, whattodo, deepThinkingPlan, evaluationText, processTransactions, mainKeyMission) {

    let output = processTransactions.at(-1).data;
    if (output) {
        output = omitMiddlePart(output);
    }

    const last = (
        processTransactions.at(-1).data !== null ?
            (output ? [
                // '---',
                '<CodeExecutionOutput>',
                // indention() + '```shell',
                indention(1, output),
                // indention() + '```',
                '</CodeExecutionOutput>',
            ] : [
                // '---',
                '<CodeExecutionOutput>',
                // indention() + '```shell',
                // indention() + '```',
                indention(1, '(no output)'),
                '</CodeExecutionOutput>',
            ]) : []
    );
    if (type === 'coding') {
        evaluationText = (evaluationText || '').trim();
        whatdidwedo = (whatdidwedo || '').trim();

        return {
            role: "user",
            content: [
                // '# Subsequent Solving of the Mission',
                // ``,
                // ``,
                '',
                ...last,
                '',
                evaluationText ? '' : '',
                evaluationText ? '<EvaluationOfPreviousTasks>' : '',
                evaluationText ? indention(1, evaluationText) : '',
                evaluationText ? '</EvaluationOfPreviousTasks>' : '',
                '',
                whatdidwedo ? '' : '',
                whatdidwedo ? '<WorkDoneSoFar>' : '',
                whatdidwedo ? indention(1, whatdidwedo) : '',
                whatdidwedo ? '</WorkDoneSoFar>' : '',
                '',
                deepThinkingPlan ? '' : '',
                deepThinkingPlan ? '<Plan>' : '',
                deepThinkingPlan ? indention(1, deepThinkingPlan) : '',
                deepThinkingPlan ? '</Plan>' : '',
                '',
                whattodo && mainKeyMission !== whattodo ? '' : '',
                whattodo && mainKeyMission !== whattodo ? '<NextTasks>' : '',
                whattodo && mainKeyMission !== whattodo ? indention(1, whattodo) : '',
                whattodo && mainKeyMission !== whattodo ? '</NextTasks>' : '',
                '',
                mainKeyMission ? '' : '',
                mainKeyMission ? '<THE-MAIN-KEY-MISSION>' : '',
                mainKeyMission ? indention(1, mainKeyMission) : '',
                mainKeyMission ? '</THE-MAIN-KEY-MISSION>' : '',
                '',
                'Make the code.',
                // '---',
                // '',
                // 'To do this, choose proper action.',
            ].join('\n'),
        };
    } else if (type === 'evaluation') {
        return {
            role: "user",
            content: [
                ...last,
                '',
                mainKeyMission ? '' : '',
                mainKeyMission ? '<THE-MAIN-KEY-MISSION>' : '',
                mainKeyMission ? indention(1, mainKeyMission) : '',
                mainKeyMission ? '</THE-MAIN-KEY-MISSION>' : '',
                '',

                `<MissionEvaluation>`,
                `   <CompletionCheck>`,
                `      Does the progress so far and current output indicate mission completion?`,
                `   </CompletionCheck>`,
                `   <ActionDetermination>`,
                `      Judge what to do to complete the mission by the Output of the Execution and the history we did so far.`,
                `   </ActionDetermination>`,
                `</MissionEvaluation>`,
                ``,
                `Determine mission completion and decide next steps.`,
            ].join('\n'),
        };
    } else if (type === 'whatdidwedo') {
        return {
            role: "user",
            content: [
                ...last,
                '',
                `<OurGoal>`,
                indention(1, mission),
                `</OurGoal>`,
                '',
                mainKeyMission ? '' : '',
                mainKeyMission ? '<THE-MAIN-KEY-MISSION>' : '',
                mainKeyMission ? indention(1, mainKeyMission) : '',
                mainKeyMission ? '</THE-MAIN-KEY-MISSION>' : '',
                '',
                '<WritingGuidelines>',
                '  <Rule>Summarize the tasks performed so far.</Rule>',
                '  <Rule>Write only the core content in a concise manner.</Rule>',
                '  <Rule>Use only simple and plain expressions.</Rule>',
                '  <Rule>Do not include code.</Rule>',
                `  <Rule>Respond in one sentence in ${await getLanguageFullName()}.</Rule>`,
                '</WritingGuidelines>',
                '',
                'As an AI agent, please summarize the tasks performed so far.',
            ].join('\n'),
        };
    } else if (type === 'whattodo') {
        return {
            role: "user",
            content: [
                '',
                '',
                ...last,
                '',
                `<OurGoal>`,
                indention(1, mission),
                `</OurGoal>`,
                '',
                mainKeyMission ? '' : '',
                mainKeyMission ? '<THE-MAIN-KEY-MISSION>' : '',
                mainKeyMission ? indention(1, mainKeyMission) : '',
                mainKeyMission ? '</THE-MAIN-KEY-MISSION>' : '',
                '',
                processTransactions.at(-1).deepThinkingPlan ? '<Plan>' : '',
                processTransactions.at(-1).deepThinkingPlan ? indention(1, processTransactions.at(-1).deepThinkingPlan) : '',
                processTransactions.at(-1).deepThinkingPlan ? '</Plan>' : '',
                '',
                '<Instructions>',
                '  <Rule>Consider the mission and the current progress so far.</Rule>',
                '  <Rule>Determine what to do next logically.</Rule>',
                '  <Rule>Skip optional tasks.</Rule>',
                '  <Rule>Do not include code.</Rule>',
                `  <Rule>Respond in one sentence in ${await getLanguageFullName()}.</Rule>`,
                '</Instructions>',
                '',
                // '<OutputFormat>',
                // '  ...를 할게요.',
                // '</OutputFormat>',
                '',
                'Tell me what task to perform next right away!',
            ].join('\n'),
        };
    } else if (type === 'deepThinkingPlan') {
        return {
            role: "user",
            content: [
                '',
                '',
                ...last,
                '',
                `<OurGoal>`,
                indention(1, mission),
                `</OurGoal>`,
                '',
                '<Instructions>',
                '  <Rule>Consider the mission and the current progress so far.</Rule>',
                '  <Rule>Think deeply step by step for the next task.</Rule>',
                '  <Rule>Skip optional tasks.</Rule>',
                '  <Rule>Do not include code.</Rule>',
                `  <Rule>Respond in ${await getLanguageFullName()}.</Rule>`,
                '</Instructions>',
                '',
                // '<OutputFormat>',
                // '  ...를 할게요.',
                // '</OutputFormat>',
                '',
                // `Let's think deeply step by step for the next task.`,
                `Let's think step by step.`,
            ].join('\n'),
        };
    }
}