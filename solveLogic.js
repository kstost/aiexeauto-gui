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
import { isInstalledNpmPackage, installNpmPackage, checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames } from './codeExecution.js';
import { getLastDirectoryName, getDetailDirectoryStructure } from './dataHandler.js';
import { isNodeInitialized, initNodeProject, restoreWorkspace, waitingForDataCheck, exportFromDockerForDataCheck, cleanContainer, isDockerContainerRunning, getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { cloneCustomTool, getToolList, getToolData, getAppPath, getUseDocker, replaceAll, promptTemplate } from './system.js';
import fs from 'fs';
import { getConfiguration } from './system.js';
import { actDataParser } from './actDataParser.js';
import { makeCodePrompt, indention } from './makeCodePrompt.js';
import { makeRealTransaction } from './makeRealTransaction.js';
import path from 'path';
// getAppPath
import { installPackages } from './packageManager.js';
import singleton from './singleton.js';
import { validatePath } from './system.js';
import { getAbsolutePath, caption, templateBinding } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';
import { reviewMission } from './aiFeatures.js';
import open from 'open';
import { ensureAppsHomePath } from './dataHandler.js';
import { checkSyntax } from './docker.js';
let spinners = {};

export function getSpinners() {
    return spinners;
}



export function makeTag(tagName, data, condition = true) {
    if (!condition) return;
    return `<${tagName}>\n${indention(1, data)}\n</${tagName}>`
}
const prompts = {
    systemCodeGeneratorPrompt: async (mission, whattodo, useDocker, forGemini = false) => {
        const customRulesForCodeGenerator = (await getConfiguration('customRulesForCodeGenerator') || '').trim();
        const tools = `${await (async () => {
            const toolList = await getToolList();
            let toolPrompts = [];
            for (let tool of toolList) {
                const toolData = await getToolData(tool);
                if (!toolData) continue;
                toolPrompts.push(toolData.prompt);
            }
            return toolPrompts.join('\n\t\n');
        })()}`;
        return templateBinding((await promptTemplate()).codeGenerator.systemPrompt, {
            mission: indention(1, mission),
            whattodo: indention(1, whattodo),
            customRulesForCodeGenerator: makeTag('CodeGenerationRules', customRulesForCodeGenerator, !!customRulesForCodeGenerator),
            tools: tools,
        });
    },
    systemEvaluationPrompt: async (mission, forGemini = false) => {
        const customRulesForEvaluator = (await getConfiguration('customRulesForEvaluator') || '').trim();
        return templateBinding((await promptTemplate()).evaluator.systemPrompt, {
            mission: indention(1, mission),
            customRulesForEvaluator: makeTag('EvaluatorRules', customRulesForEvaluator, !!customRulesForEvaluator),
            languageFullName: await getLanguageFullName(),
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

export function omitMiddlePart(text, length = 1024) {
    text = text.trim();
    return (text.length > length
        ? text.substring(0, length / 2) + '\n\n...(middle part omitted due to length)...\n\n' + text.substring(text.length - length / 2)
        : text).trim();
}

export async function solveLogic({ taskId, multiLineMission, dataSourcePath, dataOutputPath, interfaces, odrPath, containerIdToUse, processTransactions, talktitle, reduceLevel }) {
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    // const pid1 = await out_state(caption('solvingLogic'));
    if (!reduceLevel) reduceLevel = 0;
    let keepMode = processTransactions.length > 0;
    keepMode = false;
    processTransactions.forEach(transaction => {
        transaction.notcurrentmission = true;
        delete transaction.mainkeymission;
        // delete transaction.whattodo;
        delete transaction.whatdidwedo;
        delete transaction.deepThinkingPlan;
    });
    if (processTransactions.at(-1)) delete processTransactions.at(-1).notcurrentmission;// = false;

    // const taskId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 15)}`;
    // let uniqueSumNumber = 0;
    let containerId = containerIdToUse;

    // const pid54 = await out_state(`미션 착수 준비중...`);
    // while (singleton.installedPackages.length) singleton.installedPackages.splice(0, 1);
    // Object.keys(singleton.installedPackages).forEach(key => {
    //     delete singleton.installedPackages[key];
    // });

    const openaiApiKey = await getConfiguration('openaiApiKey');
    const retrivalFolder = getAppPath('retrival');
    if (false) await out_print({ mode: 'retrivalFolder', data: retrivalFolder });
    if (!fs.existsSync(retrivalFolder)) fs.mkdirSync(retrivalFolder);


    // const processTransactions = [];
    const pushProcessTransactions = (data) => {
        processTransactions.push(data);
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
        // await retriver.addContent(taskId, `transaction_${uniqueSumNumber}`, addContent);
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


        if (12313 < Math.random()) if (!keepMode) multiLineMission = await reviewMission(multiLineMission, interfaces);
        let nextPrompt;
        let mainKeyMission;// = multiLineMission;
        if (keepMode) {
            nextPrompt = `${multiLineMission}`;
            // nextPrompt = `<THE-MAIN-KEY-MISSION>${multiLineMission}</THE-MAIN-KEY-MISSION>`;
            mainKeyMission = multiLineMission + '. Do until it achieves the mission.';
            multiLineMission = 'Solve the THE-MAIN-KEY-MISSION until it achieves the mission.';
        }
        let nextCodeForValidation;
        let evaluationText = '';
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
            let javascriptCode = '';
            let javascriptCodeBack = '';
            let pythonCode = '';
            let requiredPackageNames;
            let whatdidwedo = '';
            let deepThinkingPlan = '';
            let whattodo = '';
            let validationMode = nextCodeForValidation ? true : false;
            let modelName = await getModel();

            let actData;
            function setCodeDefault(actDataResult = {}) {
                javascriptCode = actDataResult.javascriptCode || '';
                requiredPackageNames = actDataResult.requiredPackageNames || [];
                pythonCode = actDataResult.pythonCode || '';
                javascriptCodeBack = actDataResult.javascriptCodeBack || '';
            }
            if (!validationMode) {
                processTransactions.length === 0 && pushProcessTransactions({ class: 'output', data: null });
                if (processTransactions.length > 1 && !nextPrompt) {
                    const prompt = templateBinding((await promptTemplate()).recollection.systemPrompt, {});
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        whatdidwedo = await chatCompletion(
                            prompt,
                            await makeRealTransaction({ processTransactions: processTransactions_, multiLineMission, type: 'whatdidwedo', mainKeyMission }),
                            'whatDidWeDo',
                            interfaces,
                            caption('whatDidWeDo')
                        );
                    }, () => areBothSame(processTransactions, ++reduceLevel));
                    // if (whatdidwedo) whatdidwedo = whatdidwedo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                    whatdidwedo = cleanDescription(whatdidwedo);
                    if (whatdidwedo) await out_print({ data: whatdidwedo, mode: 'whatdidwedo' });
                    processTransactions[processTransactions.length - 1].whatdidwedo = whatdidwedo;
                }
                if (!nextPrompt) {
                    const tools = `${await (async () => {
                        const toolList = await getToolList();
                        let toolPrompts = [];
                        for (let tool of toolList) {
                            const toolData = await getToolData(tool);
                            if (!toolData) continue;
                            toolPrompts.push(toolData.prompt);
                        }
                        return toolPrompts.join('\n\t\n');
                    })()}`;

                    const customRulesForCodeGenerator = (await getConfiguration('customRulesForCodeGenerator') || '').trim();
                    const prompt = templateBinding((await promptTemplate()).planning.systemPrompt, {
                        customRulesForCodeGenerator: makeTag('CodeGenerationRules', customRulesForCodeGenerator, !!customRulesForCodeGenerator),
                        languageFullName: await getLanguageFullName(),
                        tools: tools,
                    });
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        whattodo = await chatCompletion(
                            prompt,
                            await makeRealTransaction({ processTransactions: processTransactions_, multiLineMission, type: 'whattodo', mainKeyMission }),
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
                        await out_print({ data: whattodo, mode: 'whattodo' });
                    }
                    processTransactions[processTransactions.length - 1].whattodo = whattodo;
                } else {
                    processTransactions[processTransactions.length - 1].whattodo = nextPrompt;
                    processTransactions[processTransactions.length - 1].mainkeymission = nextPrompt;
                    // whattodo = nextPrompt;
                    nextPrompt = null;
                }

                // spinners.iter = createSpinner(`${modelName}가 코드를 생성하는 중...`);
                let systemPrompt = await prompts.systemCodeGeneratorPrompt(multiLineMission, whattodo, useDocker);
                let systemPromptForGemini = await prompts.systemCodeGeneratorPrompt(multiLineMission, whattodo, useDocker, true);

                while (true) {
                    await exceedCatcher(async () => {
                        const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                        let promptList = await makeRealTransaction({ processTransactions: processTransactions_, multiLineMission, type: 'coding', whatdidwedo, whattodo, deepThinkingPlan, evaluationText, mainKeyMission });
                        promptList = JSON.parse(JSON.stringify(promptList));
                        actData = await chatCompletion(
                            { systemPrompt, systemPromptForGemini },
                            promptList,
                            'generateCode',
                            interfaces,
                            caption('codeGeneration')
                        );
                    }, () => areBothSame(processTransactions, ++reduceLevel));
                    // console.log('actData', actData);
                    let actDataResult = await actDataParser({ actData });
                    javascriptCode = actDataResult.javascriptCode || '';
                    requiredPackageNames = actDataResult.requiredPackageNames || [];
                    pythonCode = actDataResult.pythonCode || '';
                    javascriptCodeBack = actDataResult.javascriptCodeBack || '';
                    if (pythonCode) {
                        pythonCode = pythonCode.split('\n').filter(line => {
                            return line.trim() !== 'import default_api'
                        }).join('\n');
                    }
                    if (!pythonCode && !javascriptCode) {
                        const pp33 = await out_state('');
                        await pp33.fail(caption('codeGenerationFailed'));
                    } else {
                        break;
                    }
                }

            } else {
                javascriptCode = nextCodeForValidation;
                nextCodeForValidation = null;
            }
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

            // if (actData.name === 'generate_nodejs_code') {
            //     javascriptCode = actData.input.nodejs_code;
            //     requiredPackageNames = actData.input.npm_package_list;
            // } else if (actData.name === 'generate_nodejs_code_for_puppeteer') {
            //     javascriptCode = actData.input.nodejs_code;
            //     requiredPackageNames = actData.input.npm_package_list;
            // } else if (actData.name === 'generate_python_code') {
            //     pythonCode = actData.input.python_code;
            //     requiredPackageNames = actData.input.pip_package_list;








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
            const streamGetter = async (str) => {
                // if (!useDocker) return;
                process.stdout.write(str);
                if (executionId) {
                    await out_stream({ executionId, stream: str, state: 'stdout' });
                }
            }
            let confirmedd = false;
            try {
                if (actData.name === 'run_command') {
                    // actData.input.command;
                    let command = actData.input.command;
                    let confirmed = await await_prompt({ mode: 'run_command', actname: actData.name, containerId, dockerWorkDir, command });
                    if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                    actData.input.command = confirmed.confirmedCode;
                    // confirmedd = true;
                    // console.log('confirmed', confirmed);
                    let actDataResult = await actDataParser({ actData });
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
                            executionId = confirmed.executionId;
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await waitingForDataCheck(out_state);
                        const codeExecutionResult_ = await runNodeJSCode(containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames, streamGetter);
                        if (codeExecutionResult_) codeExecutionResult = codeExecutionResult_;
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
                    if (true) {
                        if (!confirmedd) {
                            let confirmed = await await_prompt({ mode: 'run_python_code', actname: actData.name, containerId, dockerWorkDir, pythonCode, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            pythonCode = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await waitingForDataCheck(out_state);
                        const codeExecutionResult_ = await runPythonCode(containerId, dockerWorkDir, pythonCode, requiredPackageNames, streamGetter);
                        if (codeExecutionResult_) codeExecutionResult = codeExecutionResult_;
                        runCodeFactor = true;
                    }
                }
            } catch (error) {
                errorList.codeexecutionerror = { error };
            }
            if (true) {
                let pid = await out_state(``);
                if (errorList.codeexecutionerror) {
                    await pid.fail(caption('codeExecutionAborted'));
                } else {
                    await pid.succeed(replaceAll(caption('codeExecutionCompleted'), '{{iterationCount}}', iterationCount)); // `코드 수행 #${iterationCount}차 완료`
                }
            }
            await operation_done({});
            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
            const data = javascriptCode || pythonCode;
            const weatherToPush = (!errorList.codeexecutionerror && data);
            const codeExecutionResultOutput = codeExecutionResult?.output?.replace(/\x1b\[[0-9;]*m/g, '') || '';
            if (weatherToPush) pushProcessTransactions({ class: 'code', data });
            if (weatherToPush) pushProcessTransactions({ class: 'output', data: codeExecutionResultOutput });
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
                let actData;
                await exceedCatcher(async () => {
                    const processTransactions_ = trimProcessTransactions(processTransactions, reduceLevel);
                    actData = await chatCompletion(
                        {
                            systemPrompt: await prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath),
                            systemPromptForGemini: await prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath, true),
                        },
                        await makeRealTransaction({ processTransactions: processTransactions_, multiLineMission, type: 'evaluation', mainKeyMission }),
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
                    await out_print(({ data: reason, mode: 'evaluation' }));
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
            if (!talktitle) {
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
                talktitle = {
                    filename: await getNewFileName(),
                    title: '',
                };

                try {
                    const prompt = templateBinding((await promptTemplate()).missionNaming.systemPrompt, {
                        languageFullName: await getLanguageFullName(),
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
                            '',
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
