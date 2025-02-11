import { omitMiddlePart } from './solveLogic.js';
export function makeCodePrompt(mission, type, whatdidwedo, whattodo, evaluationText, processTransactions) {

    let output = processTransactions.at(-1).data;
    if (output) {
        output = omitMiddlePart(output);
    }

    const last = (
        processTransactions.at(-1).data !== null ?
            (output ? [
                // '---',
                'OUTPUT OF THE EXECUTION:',
                '```shell',
                // `$ node code.js`,
                output,
                '```',
            ] : [
                // '---',
                'PROCESS ENDS WITHOUT ANY OUTPUTS:',
                '```shell',
                // `$ node code.js`,
                // `$`,
                '```',
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
                evaluationText ? '---' : '',
                evaluationText ? 'EVALUATION OF THE PREVIOUS TASKS:' : '',
                evaluationText ? `${evaluationText}` : '',
                '',
                whatdidwedo ? '---' : '',
                whatdidwedo ? `DID SO FAR:` : '',
                whatdidwedo ? `${whatdidwedo}` : '',
                '',
                '---',
                `TASK TO DO NEXT STEP:`,
                `${whattodo.split('\n').join(' ')}`,
                '',
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
                'Does the progress so far and current output indicate mission completion?',
                'Judge what to do to complete the mission by the Output of the Execution and the history we did so far',
                // 'Judge what to do in among verdict or generate_validation_code or give_up_the_mission for the mission by Output of the Execution, We we did so far',
                '',
                `MISSION: "${mission}"`,
                '',
            ].join('\n'),
        };
    } else if (type === 'whatdidwedo') {
        return {
            role: "user",
            content: [
                ...last,
                '',
                `MISSION: "${mission}"`,
                '',
                '인공지능 에이전트로써 지금까지 수행한 작업을 요약해서 알려줘.',
                '',
                '작성 지침:',
                '- 핵심적인 내용만 짧게 작성해.',
                '- 핵심적 담백한 표현만 사용해.',
                '- 코드는 포함하지 마세요.',
            ].join('\n'),
        };
    } else if (type === 'whattodo') {
        return {
            role: "user",
            content: [
                '바로 직후 다음으로 수행할 **오직 절대로 딱 하나의** 작업이 무엇인지 말해!',
                '',
                '',
                ...last,
                '',
                `MISSION: "${mission}"`,
                '',
                'INSTRUCTION:',
                '- 미션과 지금까지의 진행 상황을 고려하여 다음으로 해야 할 단 한 가지 작업만 제공하세요.',
                '- 해야할 일을 논리적으로 판단하세요.',
                '- 선택적인 작업은 생략합니다.',
                '- 코드 포함하지 마세요.',
                '- 한국어로 한 문장만 응답하세요.',
                '',
                'OUTPUT',
                '...를 할게요.',
            ].join('\n'),
        };
    }
}