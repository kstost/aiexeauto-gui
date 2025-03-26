import { omitMiddlePart, makeTag, getRetriver } from './solveLogic.js';
import { makeCodePrompt, indention } from './makeCodePrompt.js';
import { templateBinding, promptTemplate, getConfiguration } from './system.js';
// import { getRetriver } from './retriver.js';
export async function archivingForRetriver({ data, talkSessionId, orderNumber }) {
    const retriver = await getRetriver();
    const { role, content } = data;
    // let orderNumber = 0;
    // try {
    //     const rData = await retriver.getDatabase(talkSessionId);
    //     orderNumber = Object.keys(rData.data).length;
    // } catch { }
    try {
        await retriver.getContent(talkSessionId, `message_${orderNumber}`);
        return;
    } catch {
    }
    const indention = (n) => ' '.repeat(n);
    const addContent = [
        `<message>`,
        `${indention(3)}<order>${orderNumber}</order>`,
        `${indention(3)}<role>${role}</role>`,
        `${indention(3)}<content>`,
        `${indention(0)}${!content ? '' : content.split('\n').map(line => `${indention(6)}${line}`).join('\n')}`,
        `${indention(3)}</content>`,
        `</message>`,
    ].join('\n');
    await retriver.addContent(talkSessionId, `message_${orderNumber}`, addContent);
    await retriver.embedAll(talkSessionId);
}
export async function makeRealTransaction({ processTransactions, processTransactionsReduced, multiLineMission, type, whatdidwedo, whattodo, evaluationText, check_list, talkSessionId, lastMessage }) {
    processTransactions = JSON.parse(JSON.stringify(processTransactions));
    processTransactionsReduced = JSON.parse(JSON.stringify(processTransactionsReduced));
    // let lll = processTransactions.length - (processTransactions.length - processTransactionsReduced.length);
    let latestMemoryDepth = await getConfiguration('latestMemoryDepth');
    // if (!latestMemoryDepth) latestMemoryDepth = 1;
    // if (latestMemoryDepth.constructor !== Number) latestMemoryDepth = Number(latestMemoryDepth);
    let topLatestDepth = (latestMemoryDepth * 2) + (processTransactions.length - processTransactionsReduced.length);//lll - 1;// + lll;
    if ((processTransactions.length - topLatestDepth) % 2 === 1) topLatestDepth++;
    let noRetriver = topLatestDepth >= processTransactions.length;
    // console.log('========');
    // console.log('noRetriver', noRetriver);
    // console.log('topLatestDepth', topLatestDepth);
    // console.log('processTransactions.length', processTransactions.length);
    let realTransactions = [];
    for (let i = 0; i < processTransactions.length; i++) {
        let topDepth = (processTransactions.length - topLatestDepth >= i);
        // if(processTransactions.length - topLatestDepth >= i){

        //     5-2

        //     3
        //     3 - 1
        // (processTransactions.length - topLatestDepth)
        //     i0
        //     i1
        //     i2
        //     i3
        //     i4

        // }
        const classData = processTransactions[i].class;
        const role = classData === 'output' ? 'user' : 'assistant';
        const code = classData === 'code' ? processTransactions[i].data : null;
        let output = classData === 'output' ? processTransactions[i].data : null;
        let summarized = classData === 'output' ? processTransactions[i].summarized : null;
        let whattodo = processTransactions[i].whattodo;
        let whatdidwedo = processTransactions[i].whatdidwedo;
        let outputDataId = classData === 'output' ? processTransactions[i].outputDataId : null;
        let maxOmitLength = await getConfiguration('maxOmitLength');
        let omitLevel = maxOmitLength;
        if (topDepth) omitLevel = maxOmitLength * 10;
        if (output) {
            if (summarized) {
                output = summarized;
                output = output.trim();
            } else {
                const { text, omitted } = omitMiddlePart(output, omitLevel, outputDataId);
                output = text;
                output = output.trim();
                if (omitted) {

                }
            }
            // output = output.trim();
            // output = summarized ? summarized : text;
        }

        const printWhatToDo = whattodo;
        const usersTurn = role === 'user';
        let data = {
            role,
            content: usersTurn ? templateBinding((await promptTemplate()).transactions.userPrompt, {
                codeExecutionOutput: makeTag('CodeExecutionOutput', output || '(no output)'),
                whatdidwedo: makeTag('WorkDoneSoFar', whatdidwedo, !!whatdidwedo),
                nextTasks: printWhatToDo ? makeTag('NextTasks', whattodo, !!whattodo) : '',
                nextTasksToDo: '',
            }) : templateBinding((await promptTemplate()).transactions.assistantPrompt, {
                codeForNextTasks: makeTag('CodeForNextTasks', code),
            }),
        };
        realTransactions.push(data);
    }
    if (realTransactions.length === 0) {
        if (lastMessage) return lastMessage;
        throw new Error('No transactions found');
    }
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
        } else {
            realTransactions[0].content = 'Response the first code for the first step of the mission.';
        }
    }
    if (lastMessage && lastMessage[0]) {
        realTransactions[realTransactions.length - 1] = lastMessage[0];
    } else {
        realTransactions[realTransactions.length - 1] = await makeCodePrompt(multiLineMission, type, whatdidwedo, whattodo, evaluationText, processTransactions, check_list);
    }
    let derived = [];
    for (let i = 0; i < realTransactions.length; i++) {
        let topDepth = (realTransactions.length - topLatestDepth >= i);
        if (topDepth) {
            // const {role,content}=realTransactions[i];
            await archivingForRetriver({
                data: realTransactions[i], talkSessionId, orderNumber: i
            })
        }
        else {
            derived.push(realTransactions[i]);
        }

    }
    if (!noRetriver) {
        const question = realTransactions[realTransactions.length - 1]?.content || '';
        const retriver = await getRetriver();
        const context = await retriver.vectorQuery(talkSessionId, question, {
            instruction: "Answer detailed and specific the question using only the provided context.",
            context: "{context}",
            question: "{input}",
            answer_format: "Provide a clear and concise answer.",
        })
        derived = [
            {
                role: 'user',
                content: 'Provide the Context so far.'
            },
            {
                role: 'assistant',
                content: context
            },
            ...derived
        ]
    }
    // console.log(123123);
    if (derived.length === 0 && lastMessage) return lastMessage;
    return derived;
}