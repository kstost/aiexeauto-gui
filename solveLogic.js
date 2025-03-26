// import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { highlight } from 'cli-highlight';
import ora from 'ora';
import boxen from 'boxen';
import axios from 'axios';
import { importData, exportData } from './dataHandler.js';
import { chatCompletion, getModel, isOllamaRunning, exceedCatcher, trimProcessTransactions, areBothSame, cleanDescription, stripTags } from './aiFeatures.js';
import { isInstalledNpmPackage, installNpmPackage, checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames, isWindows } from './codeExecution.js';
import { getLastDirectoryName, getDetailDirectoryStructure } from './dataHandler.js';
import { isNodeInitialized, initNodeProject, restoreWorkspace, waitingForDataCheck, exportFromDockerForDataCheck, cleanContainer, isDockerContainerRunning, getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { cloneCustomTool, getToolList, getToolData, getAppPath, getUseDocker, replaceAll, promptTemplate } from './system.js';
import fs from 'fs';
import { connectAllServers } from './mcp.js';
import { getConfiguration, isSequentialthinking } from './system.js';
import { actDataParser } from './actDataParser.js';
import { makeCodePrompt, indention } from './makeCodePrompt.js';
import { getToolsClientByToolName, getToolsInfoByToolName } from './mcp.js';
import { makeRealTransaction } from './makeRealTransaction.js';
import path from 'path';
// getAppPath
import { installPackages } from './packageManager.js';
import singleton from './singleton.js';
import { validatePath } from './system.js';
import { getAbsolutePath, caption, templateBinding } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';
import open from 'open';
import { ensureAppsHomePath } from './dataHandler.js';
import { checkSyntax } from './docker.js';
import { Retriver } from "./retriver.js";
import crypto from 'crypto';
let spinners = {};
function outputParse(output) {
    let errorData, decoded, parsed;
    errorData = isErrorData(output);
    decoded = Buffer.from(output, 'base64').toString('utf-8');
    try { parsed = JSON.parse(decoded); } catch { }
    return { errorData, decoded, parsed };
}
function isErrorData(output) {
    try {
        let parsed = JSON.parse(output);
        if (parsed.constructor === Array) {
            return parsed[0];
        }
    } catch {
    }
}
async function getNewFileName() {
    const path = getAppPath('list');
    if (!fs.existsSync(path)) {
        await fs.promises.mkdir(path, { recursive: true });
    }
    let resultPath;
    while (true) {
        let randomName = Math.random().toString();
        resultPath = randomName + '.json';
        if (!fs.existsSync(path + '/' + resultPath)) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 10)); // 약간의 딜레이
    }
    if (ensureAppsHomePath(path + '/' + resultPath)) {
        await fs.promises.writeFile(path + '/' + resultPath, '{}');
        return resultPath;
    }

}
export function getSpinners() {
    return spinners;
}
export async function getRetriver() {
    const retriver = new Retriver({
        dbPath: getAppPath('retrival'),
        APIKey: await getConfiguration('openaiApiKey'),
        modelName: await getConfiguration('openaiModel'),
        embeddingModelName: "text-embedding-3-small",
        temperature: 0,
    });
    return retriver;
}
export async function retriving(key, data, question) {
    try {
        const retriver = await getRetriver();
        if (!question) question = `Extract the essential parts from this document and compile them into a comprehensive detailed report format.`;
        const md5Hash = crypto.createHash('md5').update(key).digest('hex');
        const rId = `task_${md5Hash}`;
        let exist = false;
        try {
            await retriver.getContent(rId, 'data');
            exist = true;
        } catch {
            exist = false;
        }
        if (!exist) await retriver.addContent(rId, 'data', data);
        const answer = await retriver.retrieve(rId, question);
        return answer;
    } catch (e) {
    }
    return '';
}

export function makeTag(tagName, data, condition = true) {
    if (!condition) return;
    return `<${tagName}>\n${indention(1, data)}\n</${tagName}>`
}
export async function getOperatingSystem() {
    const useDocker = await getConfiguration('useDocker');
    if (useDocker) return 'Ubuntu Linux (Docker)';
    if (isWindows()) return 'Windows';
    return 'macOS';
}
export async function toolsForPrompt() {
    return `${await (async () => {
        const toolList = await getToolList();
        let toolPrompts = [];
        for (let tool of toolList) {
            const toolData = await getToolData(tool);
            if (!toolData) continue;
            toolPrompts.push(toolData.prompt);
        }
        return toolPrompts.join('\n\t\n');
    })()}`;
}
export async function getBinderDefault() {
    return {
        operatingSystem: await getOperatingSystem(),
        languageFullName: await getLanguageFullName(),
        tools: await toolsForPrompt(),
    };
}
const prompts = {
    systemCodeGeneratorPrompt: async (mission, whattodo, useDocker, forGemini = false) => {
        const customRulesForCodeGenerator = (await getConfiguration('customRulesForCodeGenerator') || '').trim();
        return templateBinding((await promptTemplate()).codeGenerator.systemPrompt, {
            mission: indention(1, mission),
            whattodo: indention(1, whattodo),
            customRulesForCodeGenerator: makeTag('CodeGenerationRules', customRulesForCodeGenerator, !!customRulesForCodeGenerator),
            ...(await getBinderDefault()),
        });
    },
    systemEvaluationPrompt: async (mission, check_list, forGemini = false) => {
        const customRulesForEvaluator = (await getConfiguration('customRulesForEvaluator') || '').trim();
        check_list = (JSON.parse(JSON.stringify(check_list || []))).map(item => `- ${item}`).join('\n').trim();
        return templateBinding((await promptTemplate()).evaluator.systemPrompt, {
            check_list: makeTag('MissionCheckList', check_list, !!check_list),
            mission: indention(1, mission),
            customRulesForEvaluator: makeTag('EvaluatorRules', customRulesForEvaluator, !!customRulesForEvaluator),
            ...(await getBinderDefault()),
        });
    },
    systemEvalpreparePrompt: async (mission, forGemini = false) => {
        return templateBinding((await promptTemplate()).evalpreparer.systemPrompt, {
            mission: indention(1, mission),
            ...(await getBinderDefault()),
        });
    },
};

const highlightCode = (code, language) => {
    return highlight(code, {
        language: language,
        theme: {
            keyword: chalk.blue,
            string: chalk.green,
            number: chalk.yellow,
            comment: chalk.gray,
            function: chalk.magenta
        }
    });
};

export const getLanguageFullName = async () => {
    const langConfig = await getConfiguration('captionLanguage');
    const fullNameTable = {
        'ko': 'Korean',
        'en': 'English',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'vi': 'Vietnamese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'pt': 'Portuguese',
        'nl': 'Dutch',
        'pl': 'Polish',
        'tr': 'Turkish',
    };
    return fullNameTable[langConfig] || 'Korean';
}

// 스피너 생성 함수
export const createSpinner = (text, spinnerType = 'dots') => {
    return {
        succeed: () => { },
        fail: () => { },
        dismiss: () => { },
        start: () => { },
    };
    // const spinner = ora({
    //     text,
    //     color: 'cyan',
    //     spinner: spinnerType,
    //     stream: process.stdout // 명시적으로 출력 스트림 지정
    // }).start();
    // return spinner;
};

export function omitMiddlePart(text, length = 1024, outputDataId) {
    text = text.trim();
    let lineCount = text.split('\n').length;
    let omitted = false;
    if (text.length > length) {
        text = text.substring(0, length / 2) + `\n\n...(middle part omitted due to length. Total line count: ${lineCount} Lines. You can see the other part by call 'show_output_range' function with outputDataId "${outputDataId}", and start line number n, end line number m)...\n\n` + text.substring(text.length - length / 2)
        text = text.trim();
        omitted = true;
    } else {
        text = text.trim()
    }
    return { text, omitted };
}

export async function solveLogic({ taskId, multiLineMission, dataSourcePath, dataOutputPath, interfaces, odrPath, containerIdToUse, processTransactions, talktitle, reduceLevel }) {
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    // const pid1 = await out_state(caption('solvingLogic'));
    // 채ㅜ내
    singleton.serverClients = await connectAllServers({ interfaces });
    if (false) if (await isSequentialthinking()) {
        multiLineMission = [
            multiLineMission,
            // '---',
            // '**Rely very heavily on the sequential thinking tool when strategizing.**'
        ].join('\n');
    }

    if (!talktitle) talktitle = {
        filename: await getNewFileName(),
        title: '',
    };
    const talkSessionId = crypto.createHash('md5').update(talktitle.filename).digest('hex');
    if (!reduceLevel) reduceLevel = 0;
    let keepMode = processTransactions.length > 0;
    keepMode = false;
    processTransactions.forEach(transaction => {
        transaction.notcurrentmission = true;
        delete transaction.whatdidwedo;
    });
    if (processTransactions.at(-1)) delete processTransactions.at(-1).notcurrentmission;// = false;

    const taskId_ = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 15)}`;
    let uniqueSumNumber = 0;
    let containerId = containerIdToUse;

    // const pid54 = await out_state(`미션 착수 준비중...`);
    // while (singleton.installedPackages.length) singleton.installedPackages.splice(0, 1);
    // Object.keys(singleton.installedPackages).forEach(key => {
    //     delete singleton.installedPackages[key];
    // });

    // const openaiApiKey = await getConfiguration('openaiApiKey');
    // const retrivalFolder = getAppPath('retrival');
    // if (false) await out_print({ mode: 'retrivalFolder', data: retrivalFolder });




    // const processTransactions = [];
    const pushProcessTransactions = async (data) => {
        processTransactions.push(data);
        return;
        // if (!retriver) return;
        // uniqueSumNumber++;
        // const indention = (n) => ' '.repeat(n);
        // const addContent = [
        //     `<transaction>`,
        //     `${indention(3)}<order>${uniqueSumNumber}</order>`,
        //     `${indention(3)}<type>${data.class}</type>`,
        //     `${indention(3)}<code>`,
        //     `${indention(0)}${!data.data ? '' : data.data.split('\n').map(line => `${indention(6)}${line}`).join('\n')}`,
        //     `${indention(3)}</code>`,
        //     `</transaction>`,
        // ].join('\n');
        // const retriver = await getRetriver();
        // await retriver.addContent(taskId_, `transaction_${uniqueSumNumber}`, addContent);
    };

    // await pid54.dismiss();
    // delete singleton.reservedDataCheck;// = false;
    delete singleton.currentWorkingContainerId;
    delete singleton.beingDataCheck;

    let iterationCount = 0;
    let finishedByError = '';
    let directoryStructureBeforeOperation;
    let exported = false;
    let llm = await getConfiguration('llm');
    let isGemini = llm === 'gemini';
    let ifUseDocker = await getUseDocker();
    try {
        if (await getConfiguration('llm') === 'ollama') {
            let ollamaModel = await getConfiguration('ollamaModel');
            if (!ollamaModel) throw new Error(caption('ollamaModelNotSet'));
            if (!(await isOllamaRunning())) throw new Error(caption('ollamaServerProblem'));
        }
        {
            let prompt = multiLineMission;
            if (ifUseDocker) validatePath(dataSourcePath, '데이터 소스 경로');
            if (ifUseDocker) validatePath(dataOutputPath, '데이터 출력 경로');
            if (ifUseDocker) if (odrPath) validatePath(odrPath, '데이터 출력 경로');
            const dockerWorkDir = await getConfiguration('dockerWorkDir');
            if (await getConfiguration('useDocker')) validatePath(dockerWorkDir, 'Docker 작업 경로');
            if (fs.existsSync(getAbsolutePath(prompt))) {
                prompt = fs.readFileSync(getAbsolutePath(prompt), 'utf8');
                prompt = prompt.split('\n').filter(line => line.trim() !== '').join(' ');
            }
            if (ifUseDocker) await validateAndCreatePaths(dataSourcePath);
            if (ifUseDocker) await validateAndCreatePaths(dataOutputPath);
        }
        if (ifUseDocker) {
            const nodeFiles = ['package.json', 'package-lock.json', 'node_modules'];
            for (const file of nodeFiles) {
                if (fs.existsSync(path.join(dataSourcePath, file))) {
                    throw new Error(replaceAll(caption('nodeFilesInDataSource'), '{{file}}', file)); // caption('nodeFilesInDataSource')
                }
            }

        }
        const pid32 = ifUseDocker ? await out_state(caption('preparingDocker')) : null;
        if (await getUseDocker()) {
            let dockerImage = await getConfiguration('dockerImage');
            dockerImage = dockerImage.trim();
            if (!dockerImage) {
                throw new Error(caption('dockerImageNotSet'));
            }
            const { isRunning } = await getDockerInfo();
            if (!isRunning) {
                throw new Error(caption('dockerNotRunning'));
            }
            if (!(await doesDockerImageExist(dockerImage))) {
                throw new Error(replaceAll(caption('dockerImageNotFound'), '{{dockerImage}}', dockerImage)); // caption('dockerImageNotFound')
            }
            if (containerId) {
                if (!(await isDockerContainerRunning(containerId))) {
                    containerId = await runDockerContainerDemon(dockerImage);
                    console.log('없어.')
                } else {
                    console.log('있어.')
                }
            } else {
                containerId = await runDockerContainerDemon(dockerImage);
            }
            await cleanContainer(containerId);
        }
        if (ifUseDocker) singleton.currentWorkingContainerId = containerId;

        // let browser, page;


        //multiLineMission
        if (false) await out_print({ mode: 'mission', data: multiLineMission });

        const dockerWorkDir = await getConfiguration('dockerWorkDir');
        const maxIterations = await getConfiguration('maxIterations');
        const useDocker = await getConfiguration('useDocker');

        if (ifUseDocker) if (!(await restoreWorkspace(containerId, dockerWorkDir))) {
            await initNodeProject(containerId, dockerWorkDir);
        }
        // {
        //     let ajosfd = await checkSyntax(containerId, 'ls -al; df', 'javascript');
        //     console.log(ajosfd);
        //     process.exit(0);
        // }

        // 데이터 임포트 스피너
        // spinners.import = createSpinner('데이터를 가져오는 중...');
        await pid32?.dismiss();
        const pid63 = useDocker ? await out_state(caption('importingData')) : null;

        if (useDocker) {
            directoryStructureBeforeOperation = await getDetailDirectoryStructure(dataSourcePath);
            await importToDocker(containerId, dockerWorkDir, dataSourcePath);
        } else {
            // Local Environment
        }
        await pid63?.dismiss();


        let nextPrompt;
        let nextCodeForValidation;
        let evaluationText = '';

        if (true) {
            let actDataEvalPrepare;
            const systemPrompt = templateBinding((await promptTemplate()).measureKeyPointOfMission.systemPrompt, {
                ...(await getBinderDefault()),
            });
            const userPrompt = templateBinding((await promptTemplate()).measureKeyPointOfMission.userPrompt, {
                mission: multiLineMission,
                ...(await getBinderDefault()),
            });
            const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
            await exceedCatcher(async () => {
                actDataEvalPrepare = await chatCompletion(
                    systemPrompt,
                    await makeRealTransaction({
                        processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'whatdidwedo', talkSessionId, lastMessage: [{
                            role: 'user', content: [
                                userPrompt,
                                // ``,
                                // `You are an AI agent that processes data with Computer and Tools.`,
                                // `Clearfy the key point of the mission user requested.`,
                                // `You need to return the key point of the task in Korean.`,
                                // `Never include other than user's request.`,
                                // ``,
                                // `Response the key point of the task in three sentences.`,
                            ].join('\n'),
                        }]
                    }),
                    'measureKeyPointOfMission',
                    interfaces,
                    caption('firstPlanning')
                );
            }, () => areBothSame(processTransactions, ++reduceLevel));
            actDataEvalPrepare = actDataEvalPrepare.replace(/\[\s*\]/g, '');
            console.log(actDataEvalPrepare);
            multiLineMission = `${multiLineMission}\n\n${actDataEvalPrepare}`;
        }
        if (true) {
            let actDataEvalPrepare;
            const systemPrompt = templateBinding((await promptTemplate()).makeTodoList.systemPrompt, {
                ...(await getBinderDefault()),
            });
            const userPrompt = templateBinding((await promptTemplate()).makeTodoList.userPrompt, {
                mission: multiLineMission,
                ...(await getBinderDefault()),
            });
            const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
            await exceedCatcher(async () => {
                actDataEvalPrepare = await chatCompletion(
                    systemPrompt,
                    await makeRealTransaction({
                        processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'whatdidwedo', talkSessionId, lastMessage: [{
                            role: 'user', content: [
                                userPrompt,
                            ].join('\n'),
                        }]
                    }),
                    'makeTodoList',
                    interfaces,
                    caption('firstPlanning')
                );
            }, () => areBothSame(processTransactions, ++reduceLevel));
            actDataEvalPrepare = actDataEvalPrepare.replace(/\[\s*\]/g, '');
            console.log(actDataEvalPrepare);
            multiLineMission = `${multiLineMission}\n\n${actDataEvalPrepare}`;
        }
        let nextPlan;
        while (iterationCount < maxIterations || !maxIterations) {
            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
            await waitingForDataCheck(out_state);
            // if (10 < Math.random() && singleton.reservedDataCheck) {
            //     // first make 123.txt file in this folder and print from 1 to 10 every 1second
            //     // make 123 folder and make 45 and make 455 folder. do it seperately.
            //     const pid12 = await out_state(caption('savingResults'));
            //     await exportFromDockerForDataCheck(containerId, dataOutputPath)
            //     await pid12.dismiss();
            //     delete singleton.reservedDataCheck;
            // }
            iterationCount++;
            let lazyMode = false;
            let mcpInfo;// = {};
            let javascriptCode = '';
            let javascriptCodeBack = '';
            let pythonCode = '';
            let pythonCodeBack = '';
            let requiredPackageNames;
            let whatdidwedo = '';
            let whattodo = '';
            let validationMode = nextCodeForValidation ? true : false;
            let modelName = await getModel();

            let actData;
            function setCodeDefault(actDataResult = {}) {
                javascriptCode = actDataResult.javascriptCode || '';
                // 채ㅜ내
                requiredPackageNames = actDataResult.requiredPackageNames || [];
                pythonCode = actDataResult.pythonCode || '';
                javascriptCodeBack = actDataResult.javascriptCodeBack || '';
                pythonCodeBack = actDataResult.pythonCodeBack || '';
            }
            if (!validationMode) {
                processTransactions.length === 0 && await pushProcessTransactions({ class: 'output', data: null });
                if (processTransactions.length > 1 && !nextPrompt) {
                    const prompt = templateBinding((await promptTemplate()).recollection.systemPrompt, {
                        ...(await getBinderDefault()),
                    });
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        whatdidwedo = await chatCompletion(
                            prompt,
                            await makeRealTransaction({ processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'whatdidwedo', talkSessionId }),
                            'whatDidWeDo',
                            interfaces,
                            caption('whatDidWeDo')
                        );
                    }, () => areBothSame(processTransactions, ++reduceLevel));
                    // if (whatdidwedo) whatdidwedo = whatdidwedo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                    whatdidwedo = cleanDescription(whatdidwedo);
                    if (whatdidwedo) await out_print({ data: `📜 ${whatdidwedo}`, mode: 'whatdidwedo' });
                    processTransactions[processTransactions.length - 1].whatdidwedo = whatdidwedo;
                }
                if (!nextPrompt) {
                    const customRulesForCodeGenerator = (await getConfiguration('customRulesForCodeGenerator') || '').trim();
                    const prompt = templateBinding((await promptTemplate()).planning.systemPrompt, {
                        customRulesForCodeGenerator: makeTag('CodeGenerationRules', customRulesForCodeGenerator, !!customRulesForCodeGenerator),
                        ...(await getBinderDefault()),
                    });
                    if (nextPlan) {
                        whattodo = nextPlan;
                        nextPlan = null;
                    } else {

                        await exceedCatcher(async () => {
                            const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                            whattodo = await chatCompletion(
                                prompt,
                                await makeRealTransaction({ processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'whattodo', talkSessionId }),
                                'whatToDo',
                                interfaces,
                                caption('whatToDo')
                            );
                        }, () => areBothSame(processTransactions, ++reduceLevel));
                        // if (whattodo) {
                        //     whattodo = `${whattodo}`;
                        //     whattodo = `${stripTags(whattodo) || ''}`;
                        //     whattodo = whattodo.trim();
                        //     while (whattodo.startsWith('//')) whattodo = whattodo.slice(1);
                        //     whattodo = whattodo.trim();
                        //     whattodo = whattodo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                        // }
                        whattodo = cleanDescription(whattodo);
                        if (await getConfiguration('planEditable')) {
                            let confirmed = await await_prompt({ mode: 'whattodo_confirm', actname: 'whattodo_confirm', containerId, dockerWorkDir, whattodo });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            whattodo = confirmed.confirmedCode;
                            if (whattodo) whattodo = whattodo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                        } else {
                            if (whattodo.trim().startsWith('# Call') || whattodo.trim().startsWith('#Call')) { } else {
                                if (whattodo.trim()) await out_print({ data: `📝 ${whattodo}`, mode: 'whattodo' });
                            }
                        }
                    }
                    processTransactions[processTransactions.length - 1].whattodo = whattodo;
                } else {
                    processTransactions[processTransactions.length - 1].whattodo = nextPrompt;
                    nextPrompt = null;
                }

                // spinners.iter = createSpinner(`${modelName}가 코드를 생성하는 중...`);
                let systemPrompt = await prompts.systemCodeGeneratorPrompt(multiLineMission, whattodo, useDocker);
                let systemPromptForGemini = await prompts.systemCodeGeneratorPrompt(multiLineMission, whattodo, useDocker, true);

                while (true) {
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        let promptList = await makeRealTransaction({ processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'coding', whatdidwedo, whattodo, evaluationText, talkSessionId });
                        promptList = JSON.parse(JSON.stringify(promptList));
                        actData = await chatCompletion(
                            { systemPrompt, systemPromptForGemini },
                            promptList,
                            'generateCode',
                            interfaces,
                            caption('codeGeneration')
                        );
                    }, () => areBothSame(processTransactions, ++reduceLevel));
                    let actDataResult = await actDataParser({ actData, processTransactions, out_state, containerId });
                    // 채ㅜㄴ 
                    mcpInfo = actDataResult.mcpInfo;
                    lazyMode = actDataResult.lazyMode;
                    javascriptCode = actDataResult.javascriptCode || '';

                    requiredPackageNames = actDataResult.requiredPackageNames || [];
                    pythonCode = actDataResult.pythonCode || '';
                    javascriptCodeBack = actDataResult.javascriptCodeBack || '';
                    pythonCodeBack = actDataResult.pythonCodeBack || '';
                    if (pythonCode) {
                        pythonCode = pythonCode.split('\n').filter(line => {
                            return line.trim() !== 'import default_api'
                        }).join('\n');
                    }
                    if (!pythonCode && !javascriptCode && !mcpInfo) {
                    } else {
                        break;
                    }
                }
            } else {
                javascriptCode = nextCodeForValidation;
                nextCodeForValidation = null;
            }

            let toolInfo;
            try { toolInfo = await getToolData(actData.name); } catch { } finally { if (!toolInfo) toolInfo = {} }
            // if (!lazyMode) {
            //     lazyMode = toolInfo.lazy_mode;
            // }
            // try {
            //     const asoidf = await getToolData('sdfsdfs'+actData.name);
            //     console.log('asoid!3333333333333333333!!!!!!!!!!!!!!!!!!!!!!!!!f', asoidf);
            // } catch {

            // }
            javascriptCode = stripFencedCodeBlocks(javascriptCode);
            // const pid9 = await out_state(`packages : ${requiredPackageNames.join(', ')}`);
            requiredPackageNames = await installPackages(requiredPackageNames, pythonCode, javascriptCode, useDocker, containerId, dockerWorkDir, spinners, out_state, createSpinner, await_prompt);
            // await pid9.succeed(`packages : ${requiredPackageNames.join(', ')}`);
            // if (!useDocker) {
            //     spinners.iter = createSpinner('코드를 실행하는 중...', 'line');
            //     // const pid9 = await out_state('코드를 실행하는 중...');
            // }
            // if (useDocker) await out_print({ data: '코드를 실행합니다', mode: 'runCode' });
            // console.log(pythonCode);
            // console.log(javascriptCode);

            //------------------------------------------


            const codeRequiredConfirm = [
                'generate_nodejs_code',
                'generate_nodejs_code_for_puppeteer',
                'generate_python_code',
            ];
            function isCodeRequiredConfirm(actData) {
                if (!actData) return false;
                return codeRequiredConfirm.includes(actData.name);
            }






            //------------------------------------------
            let codeExecutionResult = {
                stdout: '',
                stderr: '',
                output: '',
                code: 0,
                error: null
            };
            let runCodeFactor = false;
            let errorList = {};
            let executionId;
            let pi3d13;
            const streamGetter = async (str, force = false) => {
                try {
                    if (toolInfo.ignore_output_type && !force) {
                        const parsed = JSON.parse(str);
                        if (toolInfo.ignore_output_type.includes(parsed.type)) {
                            return;
                        }
                    }
                } catch { }
                if ((toolInfo.retrieve_mode || lazyMode) && !force) return;
                if (pi3d13) pi3d13?.dismiss();
                process.stdout.write(str);
                if (executionId) {
                    await out_stream({ executionId, stream: str, state: 'stdout' });
                }
            }
            let confirmedd = false;
            let canceled = false;
            try {
                if (actData.name === 'shell_command_execute') {
                    // actData.input.command;
                    let command = actData.input.command;
                    let confirmed = await await_prompt({ mode: 'shell_command_execute', actname: actData.name, containerId, dockerWorkDir, command });
                    if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                    actData.input.command = confirmed.confirmedCode;
                    canceled = confirmed.cancel;
                    // confirmedd = true;
                    // console.log('confirmed', confirmed);
                    let actDataResult = await actDataParser({ actData, processTransactions, out_state, containerId });
                    setCodeDefault(actDataResult);
                }
            } catch (error) {
                errorList.runcommand = error;
                actData.input.command = '';
                setCodeDefault();
            }
            if (!pythonCode && !javascriptCode) {
                errorList.nocodeerror = true;
            }
            try {

                if (!pythonCode && javascriptCode) {

                    let javascriptCodeToRun = javascriptCodeBack ? javascriptCodeBack : javascriptCode;
                    if (true) {
                        if (!confirmedd) {
                            let confirmed = await await_prompt({ mode: 'run_nodejs_code', actname: actData.name, containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            javascriptCodeToRun = confirmed.confirmedCode;
                            // javascriptCode = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        pi3d13 = await out_state(caption('runningCode'));
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await waitingForDataCheck(out_state);
                        const codeExecutionResult_ = await runNodeJSCode(containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames, streamGetter);
                        if (codeExecutionResult_) codeExecutionResult = codeExecutionResult_;
                        if (actData.name === 'shell_command_execute') {
                            javascriptCodeToRun = '';
                            javascriptCode = '';
                            pythonCodeBack = '';
                            pythonCode = actData.input.command;
                        }
                        runCodeFactor = true;
                    } else {
                        // console.log('로컬 환경에서 JavaScript 실행');
                        // if (!confirmedd) {
                        //     console.log('JavaScript 코드 확인 프롬프트 요청');
                        //     let confirmed = await await_prompt({ mode: 'run_code', actname: actData.name, page, javascriptCodeToRun, requiredPackageNames });
                        // }
                        // console.log('로컬에서 코드 실행');
                        // result = await runCode(page, javascriptCodeToRun, requiredPackageNames);
                    }
                } else if (!javascriptCode && pythonCode) {
                    let pythonCodeToRun = pythonCodeBack ? pythonCodeBack : pythonCode;
                    console.log('pythonCodeToRun', pythonCodeToRun);
                    // console.log('pythonCode', pythonCode);
                    // console.log('pythonCodeBack', pythonCodeBack);
                    if (true) {
                        if (!confirmedd) {
                            let confirmed = await await_prompt({ mode: 'run_python_code', actname: actData.name, containerId, dockerWorkDir, pythonCodeToRun, requiredPackageNames });
                            console.log('confirmed!!!!!!!!!!!!!', confirmed);
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            pythonCodeToRun = confirmed.confirmedCode;
                            // pythonCode = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        pi3d13 = await out_state(caption('runningCode'));
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await waitingForDataCheck(out_state);
                        const codeExecutionResult_ = await runPythonCode(containerId, dockerWorkDir, pythonCodeToRun, requiredPackageNames, streamGetter);
                        if (codeExecutionResult_) codeExecutionResult = codeExecutionResult_;
                        runCodeFactor = true;
                    }
                } else if (mcpInfo) {
                    let addResult;
                    let client
                    try {
                        if (!confirmedd) {
                            const toolInfo = await getToolsInfoByToolName(singleton.serverClients, actData.name);
                            let aoidfsja
                            if (actData.name === 'sequentialthinking') {
                                aoidfsja = [
                                    `"${mcpInfo.args.thought}"`,
                                ].filter(Boolean).join('\n');
                                if (false) nextPlan = aoidfsja;
                            } else {
                                const desc = toolInfo?.description?.split('\n')?.[0] || '';
                                aoidfsja = [
                                    `'''`,
                                    `# MCP Code Execution`,
                                    `Name: ${toolInfo.name}`,
                                    desc && `Description: ${desc}`,
                                    `${JSON.stringify(mcpInfo.args)}`,
                                    `'''`,
                                ].filter(Boolean).join('\n');
                            }

                            let confirmed = await await_prompt({ mode: 'mcp_code_execution', actname: 'mcp_code_execution', mcpname: actData.name, containerId, dockerWorkDir, pythonCodeToRun: aoidfsja, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            executionId = confirmed.executionId;
                            canceled = confirmed.cancel;
                        }
                        if (!canceled) {

                            pi3d13 = await out_state(caption('runningCode'));
                            await new Promise(resolve => setTimeout(resolve, 500));
                            await waitingForDataCheck(out_state);
                            client = await getToolsClientByToolName(singleton.serverClients, actData.name);
                            addResult = await client.callTool({
                                name: mcpInfo.name,
                                arguments: mcpInfo.args,
                            });
                            streamGetter(JSON.stringify({ str: addResult?.content?.[0]?.text || '', type: 'stdout' }));
                            runCodeFactor = true;
                        }
                        else {
                            mcpInfo.code = [
                                `# ToolName: ${mcpInfo.name}`,
                                `# Args: ${JSON.stringify(mcpInfo.args)}`,
                                `#`,
                                `# This Call is Cancelled to execute`,
                            ].join('\n');
                            console.log('cannnnnn', mcpInfo.code);
                        }
                        runCodeFactor = true;
                    } catch (error) {
                        console.log('error', error);
                    }
                    runCodeFactor = true;
                    pythonCode = mcpInfo.code;
                    codeExecutionResult = {
                        stdout: addResult?.content?.[0]?.text || '',
                        stderr: '',
                        output: addResult?.content?.[0]?.text || '',
                        code: 0,
                        error: null
                    };
                }
            } catch (error) {
                errorList.codeexecutionerror = { error };
            }
            if (!lazyMode && !toolInfo.retrieve_mode) {
                let pid = await out_state(``);
                if (errorList.codeexecutionerror) {
                    await pid.fail(caption('codeExecutionAborted'));
                } else {
                    await pid.dismiss();
                    if (false) await pid.succeed(replaceAll(caption('codeExecutionCompleted'), '{{iterationCount}}', iterationCount)); // `코드 수행 #${iterationCount}차 완료`
                }
            }
            await operation_done({});
            if (pi3d13) pi3d13?.dismiss();
            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
            const data = javascriptCode || pythonCode;
            // console.

            const weatherToPush = (!errorList.codeexecutionerror && data);
            let { summarized, errorData, decoded, parsed } = lazyMode ? outputParse(codeExecutionResult?.output) : {};
            const handlers = {
                async show_output_range() {
                    summarized = decoded;
                    streamGetter(JSON.stringify({ str: summarized, type: 'stdout' }), true);
                },
                async retrieve_from_webpage() {
                    if (!parsed) return;
                    let pid6 = await out_state(caption('retrievingFromWebpage') + ' <a href="' + parsed.url + '" target="_blank">🔗 ' + parsed.url + '</a>');
                    summarized = `❌ Page Not Found: ${errorData}`;
                    if (!errorData) {
                        let answered = await retriving(parsed.url, parsed.data, parsed.question);
                        summarized = [
                            `🔗 url: ${parsed.url}`,
                            `💬 question: ${parsed.question}`,
                            `💡 answer: ${answered}`,
                        ].join('\n');
                    }
                    streamGetter(JSON.stringify({ str: summarized, type: errorData ? 'stderr' : 'stdout' }), true);
                    if (pid6) await pid6.dismiss();
                }
            }

            // toolInfo
            if (lazyMode) {
                if (lazyMode.constructor.name === 'String') {
                    if (codeExecutionResult?.output) await handlers[lazyMode]();
                }
            }
            if (toolInfo.retrieve_mode) {
                const otherKeys = Object.keys(actData.input).filter(key => key !== 'question');
                let pickedName = otherKeys.length === 1 ? otherKeys[0] : '';
                const dataNameKey = pickedName;//Object.keys(actData.input).filter(key => key !== 'question')[0] || '';
                let output = codeExecutionResult?.output;
                let pid6 = await out_state(caption('retrievingData') + ' 💬 ' + (dataNameKey ? (actData.input[dataNameKey] + ' : ') : '') + actData.input.question);
                const md5Hash = crypto.createHash('md5').update(output).digest('hex');
                let answered = await retriving(dataNameKey ? actData.input[dataNameKey] : md5Hash, output, actData.input.question);
                summarized = [
                    dataNameKey ? `📄 ${dataNameKey}: ${actData.input[dataNameKey]}` : '',
                    `💬 question: ${actData.input.question}`,
                    `💡 answer: ${answered}`,
                ].filter(Boolean).join('\n');
                streamGetter(JSON.stringify({ str: summarized, type: 'stdout' }), true);
                await pid6.dismiss();
            }
            if (actData.name === 'web_search' && codeExecutionResult?.output) {
                summarized = codeExecutionResult?.output;
                summarized = `${summarized}\n\nNext Step: You can access the URL with the question by \`retrieve_from_webpage(url, question)\``
            }
            if (actData.name === 'browser_use' && codeExecutionResult?.output) {
                summarized = `${codeExecutionResult?.output}`.split('\n');
                let add = false;
                let sum = [];
                for (let line of summarized) {
                    if (add) sum.push(line);
                    if (line.trim() === ':[FINAL RESULT]:') add = true;
                }
                summarized = sum.join('\n');
            }

            const codeExecutionResultOutput = codeExecutionResult?.output?.replace(/\x1b\[[0-9;]*m/g, '') || '';

            //whattodo
            const outputDataId = Math.random().toString(36).substring(2, 7).toUpperCase();
            if (weatherToPush) await pushProcessTransactions({ class: 'code', data });
            if (weatherToPush) await pushProcessTransactions({ class: 'output', data: codeExecutionResultOutput, summarized, outputDataId });
            if (runCodeFactor && !(codeExecutionResultOutput.trim().length)) {
                await out_print({ data: caption('noResult'), mode: 'outputPreview' });
            }
            //--------------------------------------------------------------------------------------------------

            // if (false) {
            // const review = await retriver.retrieve(taskId, '지금까지 수행한 모든 작업을 회고하세요.');
            // await out_print('회고고고', chalk.bold.cyanBright(review));
            // }
            if (true) {
                // spinners.iter = createSpinner('작업 검증중입니다.');
                let actDataEvalPrepare;
                await exceedCatcher(async () => {
                    const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                    actDataEvalPrepare = await chatCompletion(
                        {
                            systemPrompt: await prompts.systemEvalpreparePrompt(multiLineMission, dataSourcePath),
                            systemPromptForGemini: await prompts.systemEvalpreparePrompt(multiLineMission, dataSourcePath, true),
                        },
                        await makeRealTransaction({ processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'evalpreparation', talkSessionId }),
                        'evalprepareCode',
                        interfaces,
                        caption('evaluation')
                    );
                }, () => areBothSame(processTransactions, ++reduceLevel));

                let { check_list } = actDataEvalPrepare.input;
                check_list = check_list || [];
                let actData;
                await exceedCatcher(async () => {
                    const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                    actData = await chatCompletion(
                        {
                            systemPrompt: await prompts.systemEvaluationPrompt(multiLineMission, check_list, dataSourcePath),
                            systemPromptForGemini: await prompts.systemEvaluationPrompt(multiLineMission, check_list, dataSourcePath, true),
                        },
                        await makeRealTransaction({ processTransactions, processTransactionsReduced: processTransactions_, multiLineMission, type: 'evaluation', check_list, talkSessionId }),
                        'evaluateCode',
                        interfaces,
                        caption('evaluation')
                    );
                }, () => areBothSame(processTransactions, ++reduceLevel));

                let { evaluation, reason } = actData.input;
                evaluation = evaluation || '';
                reason = reason || '';
                if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'ENDOFMISSION') {
                    // if (spinners.iter) {
                    //     spinners.iter.succeed(`작업완료.`);
                    // }
                    await out_print({ data: reason, mode: 'evaluation1' });
                    const pid4 = await out_state(``);
                    await pid4.succeed(caption('missionCompletedPeriodMessage'));
                    break;
                } else if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'GIVEUPTHEMISSION') {
                    // if (spinners.iter) {
                    //     spinners.iter.succeed(`작업 포기.`);
                    // }
                    await out_print({ data: reason, mode: 'evaluation1' });
                    const pid4 = await out_state(``);
                    await pid4.fail(caption('missionAbortedPeriodMessage'));
                    break;
                } else {
                    // if (spinners.iter) {
                    //     spinners.iter.succeed(`검증완료`);
                    // }
                    await out_print(({ data: `🔍 ${reason}`, mode: 'evaluation' }));
                    evaluationText = reason;
                }

            }
        }


        // 데이터 내보내기 스피너
        // spinners.export = createSpinner('결과를 저장하는 중...');

        // 정리 작업 스피너
        // spinners.cleanup = createSpinner('정리 작업을 수행하는 중...');
        const pid13 = await out_state(caption('cleaningUp'));
        await pid13.dismiss();
        // if (browser) await browser.close();
        // server.close();
        // if (spinners.cleanup) {
        //     // console.log(chalk.green(`결과물이 저장된 경로: ${chalk.bold(dataOutputPath)}`));
        // }
    } catch (err) {
        // 현재 실행 중인 모든 스피너 중지
        Object.values(spinners).forEach(spinner => {
            if (spinner && spinner.isSpinning) {
                spinner.fail(caption('missionAborted'));
            }
        });
        if (await getConfiguration('trackLog')) {
            console.error(err);
        }
        console.error(chalk.red('✖'), chalk.redBright(err.message));
        finishedByError = err.message;
        // process.exit(1);
    }
    finally {
        if (containerId) {
            const pid12 = await out_state(caption('savingResults'));
            if (await getConfiguration('useDocker')) {
                exported = await exportFromDocker(containerId, await getConfiguration('dockerWorkDir'), dataOutputPath, directoryStructureBeforeOperation);
            }
            await pid12.dismiss();
        }
        if (containerId && !(await getConfiguration('keepDockerContainer'))) {
            const pid14 = await out_state(caption('stoppingDockerContainer'));
            await killDockerContainer(containerId);
            containerId = null;
            await pid14.dismiss();
        }
        if (finishedByError) {
            const pid4 = await out_state('');
            await pid4.fail(`${finishedByError}`);
        } else {
            if (!(talktitle?.title)) {


                try {
                    const prompt = templateBinding((await promptTemplate()).missionNaming.systemPrompt, {
                        ...(await getBinderDefault()),
                    });
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        talktitle.title = await chatCompletion(
                            prompt,
                            [
                                {
                                    role: 'user',
                                    content: [
                                        `<Mission>`,
                                        `${multiLineMission}`,
                                        `</Mission>`,
                                        `<WhatDidWeDo>`,
                                        `${processTransactions_.map(a => a.whatdidwedo).join('\n\n')}`,
                                        `</WhatDidWeDo>`,
                                        `What is the title of the mission?`
                                    ].join('\n')
                                }
                            ],
                            'missionNaming',
                            interfaces,
                            caption('namingMission')
                        );
                    }, () => areBothSame(processTransactions, ++reduceLevel));
                } catch { }
                if (!talktitle) {
                    talktitle.title = new Date().toISOString();
                }
            }

            const pid4 = await out_state('');
            await pid4.succeed(caption('missionCompleted'));
        }

    }
    return { exported, containerId, processTransactions, talktitle, reduceLevel };
}
