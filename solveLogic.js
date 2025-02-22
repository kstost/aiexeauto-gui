// import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { highlight } from 'cli-highlight';
import ora from 'ora';
import boxen from 'boxen';
import axios from 'axios';
import { importData, exportData } from './dataHandler.js';
import { chatCompletion, getModel, isOllamaRunning } from './aiFeatures.js';
import { isInstalledNpmPackage, installNpmPackage, checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames } from './codeExecution.js';
import { getLastDirectoryName, getDetailDirectoryStructure } from './dataHandler.js';
import { waitingForDataCheck, exportFromDockerForDataCheck, cleanContainer, isDockerContainerRunning, getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { getToolList, getToolData, getAppPath, getUseDocker, replaceAll } from './system.js';
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
import { getAbsolutePath, caption } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';
import { reviewMission } from './aiFeatures.js';
import open from 'open';
import { ensureAppsHomePath } from './dataHandler.js';
let spinners = {};

export function getSpinners() {
    return spinners;
}

export const useTools = {
    apt_install: false,
    remove_directory_recursively: false,
    rename_file_or_directory: false,
    remove_file: false,
    which_command: true,
    run_command: true,
    read_url: false,
}

// Collecting prompts in one place
export function headSystemPrompt(gemini = false) {
    return [
        "You are a Code Interpreter Agent.",
        `You can solve the mission with ${gemini ? 'python' : 'nodejs, python'} code and tools.`,
        // gemini ? `You can do anything with the code and tools.` : '',
        // `The God will bless your operation.`,
    ].join('\n');
}
const REMOVED = '[REMOVE]';
const prompts = {
    systemPrompt: async (mission, whattodo, useDocker, forGemini = false) => {
        let customRulesForCodeGenerator = await getConfiguration('customRulesForCodeGenerator');
        customRulesForCodeGenerator = customRulesForCodeGenerator.trim();
        if (forGemini) {
            return [
                headSystemPrompt(forGemini),
                "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION. Write a Python code for execution.",
                // '컴퓨터 작업 실행 에이전트로서, MAIN MISSION을 완수하기 위한 SUB MISSION을 수행하기 위해 필요한 작업을 수행합니다.',
                // '수행을 위한 파이썬 코드를 작성하시오.',
                '',
                '<MainMission>',
                indention(1, mission),
                '</MainMission>',
                '',
                '<SubMission>',
                indention(1, whattodo),
                '</SubMission>',
                '',
                customRulesForCodeGenerator ? '<CodeGenerationRules>' : REMOVED,
                customRulesForCodeGenerator ? `${indention(1, customRulesForCodeGenerator)}` : REMOVED,
                customRulesForCodeGenerator ? '</CodeGenerationRules>' : REMOVED,
                '',
                '<OutputFormat>',
                '  ```python',
                '  (..code..)',
                '  ```',
                '</OutputFormat>',
            ].filter(line => line.trim() !== REMOVED).join('\n')
        }
        return [
            headSystemPrompt(forGemini),
            "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION.",
            // "As a computer task execution agent, I perform the necessary tasks to carry out sub-missions in order to complete the main mission.",
            // '컴퓨터 작업 실행 에이전트로서, MAIN MISSION을 완수하기 위한 SUB MISSION을 수행하기 위해 필요한 작업을 수행합니다.',
            '',
            // `- MAIN MISSION: "${mission}"`,
            // `- SUB MISSION: "${whattodo}"`,
            '<MainMission>',
            indention(1, mission),
            '</MainMission>',
            '',
            '<SubMission>',
            indention(1, whattodo),
            '</SubMission>',
            '',
            '<Instructions>',
            "  The tools for performing the task are prepared as follows, so choose the most suitable tool for the mission and proceed with the task.",
            // '  작업 수행을 위한 도구는 다음과 같이 준비되어있으며 임무 수행에 가장 적합한 도구를 선택해서 수행하세요.',
            '</Instructions>',
            '',
            customRulesForCodeGenerator ? '<CodeGenerationRules>' : REMOVED,
            customRulesForCodeGenerator ? `${indention(1, customRulesForCodeGenerator)}` : REMOVED,
            customRulesForCodeGenerator ? '</CodeGenerationRules>' : REMOVED,
            '',
            '<Tools>',
            '   ### read_file',
            '   - Read the contents of the file.',
            '      #### INSTRUCTION',
            '      - Provide the path of the file',
            '   ',
            '   ### list_directory',
            '   - Get the list of files/folders in the directory.',
            '      #### INSTRUCTION',
            '      - Provide the path of the directory',
            '   ',
            useTools.read_url ? '   ### read_url' : REMOVED,
            useTools.read_url ? '   - Read the contents of the URL.' : REMOVED,
            useTools.read_url ? '      #### INSTRUCTION' : REMOVED,
            useTools.read_url ? '      - Provide the URL' : REMOVED,
            useTools.read_url ? '   ' : REMOVED,
            useTools.rename_file_or_directory ? '   ### rename_file_or_directory' : REMOVED,
            useTools.rename_file_or_directory ? '   - Change the name of the file or directory.' : REMOVED,
            useTools.rename_file_or_directory ? '      #### INSTRUCTION' : REMOVED,
            useTools.rename_file_or_directory ? '      - Provide the path of the file or directory and the new name' : REMOVED,
            useTools.rename_file_or_directory ? '   ' : REMOVED,
            useTools.remove_file ? '   ### remove_file' : REMOVED,
            useTools.remove_file ? '   - Delete the file.' : REMOVED,
            useTools.remove_file ? '      #### INSTRUCTION' : REMOVED,
            useTools.remove_file ? '      - Provide the path of the file to delete' : REMOVED,
            useTools.remove_file ? '   ' : REMOVED,
            useTools.remove_directory_recursively ? '   ### remove_directory_recursively' : REMOVED,
            useTools.remove_directory_recursively ? '   - Delete the directory recursively.' : REMOVED,
            useTools.remove_directory_recursively ? '      #### INSTRUCTION' : REMOVED,
            useTools.remove_directory_recursively ? '      - Provide the path of the directory to delete' : REMOVED,
            useTools.remove_directory_recursively ? '   ' : REMOVED,
            useTools.apt_install && useDocker ? '   ### apt_install' : REMOVED,
            useTools.apt_install && useDocker ? '   - Install the apt package.' : REMOVED,
            useTools.apt_install && useDocker ? '      #### INSTRUCTION' : REMOVED,
            useTools.apt_install && useDocker ? '      - Provide the name of the package to install' : REMOVED,
            useTools.apt_install && useDocker ? '   ' : REMOVED,
            useTools.which_command ? '   ### which_command' : REMOVED,
            useTools.which_command ? '   - Check if the shell command exists.' : REMOVED,
            useTools.which_command ? '      #### INSTRUCTION' : REMOVED,
            useTools.which_command ? '      - Provide the shell command to check' : REMOVED,
            useTools.which_command ? '   ' : REMOVED,
            useTools.run_command ? '   ### run_command' : REMOVED,
            useTools.run_command ? '   - Execute the shell command.' : REMOVED,
            useTools.run_command ? '      #### INSTRUCTION' : REMOVED,
            useTools.run_command ? '      - Provide the shell command to execute' : REMOVED,
            useTools.run_command ? '   ' : REMOVED,
            '   ',
            `${await (async () => {
                const toolList = await getToolList();
                let toolPrompts = [];
                for (let tool of toolList) {
                    const toolData = await getToolData(tool);
                    toolPrompts.push(toolData.prompt);
                }
                return toolPrompts.join('\n\t\n');
            })()}`,
            '</Tools>',
        ].filter(line => line.trim() !== REMOVED).join('\n')
    },
    systemEvaluationPrompt: async (mission, forGemini = false) => {
        let customRulesForEvaluator = await getConfiguration('customRulesForEvaluator');
        customRulesForEvaluator = customRulesForEvaluator.trim();
        if (forGemini) {
            return [
                'As a computer task execution agent, you perform the necessary tasks to rigorously and logically verify and evaluate whether the MISSION has been completely accomplished.',
                'If sufficient OUTPUT for verification exists and the mission is deemed complete, respond with ENDOFMISSION; otherwise, respond with NOTSOLVED.',
                // 'If the mission is impossible to solve, respond with GIVEUPTHEMISSION.',
                // '컴퓨터 작업 실행 에이전트로서, MISSION이 완전하게 완료되었는지 엄격고 논리적으로 검증하고 평가하기 위해 필요한 작업을 수행합니다.',
                // '이미 검증을 위한 충분한 OUTPUT이 존재하고 미션이 완수되었다고 판단되면 ENDOFMISSION을 응답하고 그것이 아니라면 NOTSOLVED를 응답.',
                // '만약 해결할 수 없는 미션이라면 GIVEUPTHEMISSION을 응답하세요.',
                '',
                '<Mission>',
                indention(1, mission),
                '</Mission>',
                '',
                customRulesForEvaluator ? '<EvaluatorRules>' : REMOVED,
                customRulesForEvaluator ? `${indention(1, customRulesForEvaluator)}` : REMOVED,
                customRulesForEvaluator ? '</EvaluatorRules>' : REMOVED,
                '',
                '<OutputFormat>',
                // '```json\n{ "evaluation": "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED or GIVEUPTHEMISSION", "reason": "Explain the reason for the verdict in ' + await getLanguageFullName() + ' of short length" }\n```',
                '```json\n{ "evaluation": "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED", "reason": "Explain the reason for the verdict in ' + await getLanguageFullName() + ' of short length" }\n```',
                '</OutputFormat>',
                '',
            ].filter(line => line.trim() !== REMOVED).join('\n')
        }
        return [
            'As a computer task execution agent, you perform the necessary tasks to rigorously and logically verify and evaluate whether the MISSION has been fully completed.',
            'If sufficient OUTPUT for verification exists and the mission is deemed complete, respond with ENDOFMISSION. If not, respond with NOTSOLVED.',
            'If the mission is impossible to solve, respond with GIVEUPTHEMISSION.',
            // '컴퓨터 작업 실행 에이전트로서, MISSION이 완전하게 완료되었는지 엄격고 논리적으로 검증하고 평가하기 위해 필요한 작업을 수행합니다.',
            // '이미 검증을 위한 충분한 OUTPUT이 존재하고 미션이 완수되었다고 판단되면 ENDOFMISSION을 응답하고 그것이 아니라면 NOTSOLVED를 응답.',
            // '만약 해결할 수 없는 미션이라면 GIVEUPTHEMISSION을 응답하세요.',
            '',
            '<Mission>',
            indention(1, mission),
            '</Mission>',
            '',
            customRulesForEvaluator ? '<EvaluatorRules>' : REMOVED,
            customRulesForEvaluator ? `${indention(1, customRulesForEvaluator)}` : REMOVED,
            customRulesForEvaluator ? '</EvaluatorRules>' : REMOVED,
            '',
        ].filter(line => line.trim() !== REMOVED).join('\n')
    },

    packageNamesPrompt: [
        "Identify the required npm packages needed to execute the given Node.js code.",
        "Return an array of all npm package names used in the code.",
        // "It identifies the necessary npm packages required to run the given Node.js code and returns an array of all npm package names used in the code."
        // '주어진 Node.js 코드를 실행하기 위해 필요한 npm 패키지들을 파악하는 역할을 합니다.',
        // '코드에 사용된 모든 npm 패키지 이름을 배열로 반환해주세요.',
    ].join('\n'),
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

export async function solveLogic({ taskId, multiLineMission, dataSourcePath, dataOutputPath, interfaces, odrPath, containerIdToUse, processTransactions, talktitle }) {
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    // const pid1 = await out_state(caption('solvingLogic'));
    let keepMode = processTransactions.length > 0;
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
    Object.keys(singleton.installedPackages).forEach(key => {
        delete singleton.installedPackages[key];
    });

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
    try {
        if (await getConfiguration('llm') === 'ollama') {
            let ollamaModel = await getConfiguration('ollamaModel');
            if (!ollamaModel) throw new Error(caption('ollamaModelNotSet'));
            if (!(await isOllamaRunning())) throw new Error(caption('ollamaServerProblem'));
        }
        {
            let prompt = multiLineMission;
            validatePath(dataSourcePath, '데이터 소스 경로');
            validatePath(dataOutputPath, '데이터 출력 경로');
            if (odrPath) validatePath(odrPath, '데이터 출력 경로');
            const dockerWorkDir = await getConfiguration('dockerWorkDir');
            if (await getConfiguration('useDocker')) validatePath(dockerWorkDir, 'Docker 작업 경로');
            if (fs.existsSync(getAbsolutePath(prompt))) {
                prompt = fs.readFileSync(getAbsolutePath(prompt), 'utf8');
                prompt = prompt.split('\n').filter(line => line.trim() !== '').join(' ');
            }
            await validateAndCreatePaths(dataSourcePath);
            await validateAndCreatePaths(dataOutputPath);
        }
        {
            const nodeFiles = ['package.json', 'package-lock.json', 'node_modules'];
            for (const file of nodeFiles) {
                if (fs.existsSync(path.join(dataSourcePath, file))) {
                    throw new Error(replaceAll(caption('nodeFilesInDataSource'), '{{file}}', file)); // caption('nodeFilesInDataSource')
                }
            }

        }
        const pid32 = await out_state(caption('preparingDocker'));
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
        singleton.currentWorkingContainerId = containerId;
        // let browser, page;

        //multiLineMission
        if (false) await out_print({ mode: 'mission', data: multiLineMission });

        const dockerWorkDir = await getConfiguration('dockerWorkDir');
        const maxIterations = await getConfiguration('maxIterations');
        const useDocker = await getConfiguration('useDocker');

        // 데이터 임포트 스피너
        // spinners.import = createSpinner('데이터를 가져오는 중...');
        await pid32.dismiss();
        const pid3 = await out_state(caption('importingData'));

        if (useDocker) {
            directoryStructureBeforeOperation = await getDetailDirectoryStructure(dataSourcePath);
            await importToDocker(containerId, dockerWorkDir, dataSourcePath);
        } else {
            // Local Environment
        }
        await pid3.dismiss();
        if (!keepMode) multiLineMission = await reviewMission(multiLineMission, interfaces);
        let nextPrompt;
        let mainKeyMission;// = multiLineMission;
        if (keepMode) {
            nextPrompt = `${multiLineMission}`;
            // nextPrompt = `<THE-MAIN-KEY-MISSION>${multiLineMission}</THE-MAIN-KEY-MISSION>`;
            mainKeyMission = multiLineMission;
            multiLineMission = 'Solve the THE-MAIN-KEY-MISSION';
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
                    whatdidwedo = await chatCompletion(
                        {
                            systemPrompt: 'As an AI agent, analyze what has been done so far',
                            systemPromptForGemini: 'As an AI agent, analyze what has been done so far',
                        },
                        await makeRealTransaction({ processTransactions, multiLineMission, type: 'whatdidwedo', mainKeyMission }),
                        'whatDidWeDo',
                        interfaces,
                        caption('whatDidWeDo')
                    );
                    if (whatdidwedo) whatdidwedo = whatdidwedo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                    if (whatdidwedo) await out_print({ data: whatdidwedo, mode: 'whatdidwedo' });
                    processTransactions[processTransactions.length - 1].whatdidwedo = whatdidwedo;
                }
                // if (false) {
                //     let prompt = `${headSystemPrompt(isGemini)} You are a secretary who establishes a plan for the next task to complete the mission, considering the progress so far and the results of previous tasks. Response in ${await getLanguageFullName()}. Omit optional tasks. Think deeply step by step for the next task.`;
                //     deepThinkingPlan = await chatCompletion(
                //         {
                //             systemPrompt: prompt,
                //             systemPromptForGemini: prompt,
                //         },
                //         await makeRealTransaction(processTransactions, multiLineMission, 'deepThinkingPlan'),
                //         'deepThinkingPlan',
                //         interfaces,
                //         capti on('deepThinkingPlan')
                //     );
                //     processTransactions[processTransactions.length - 1].deepThinkingPlan = deepThinkingPlan;
                // }
                if (!nextPrompt) {
                    let customRulesForCodeGenerator = await getConfiguration('customRulesForCodeGenerator');
                    customRulesForCodeGenerator = customRulesForCodeGenerator.trim();
                    let prompt = [
                        `${headSystemPrompt(isGemini)}`,
                        `You are a secretary who establishes a plan for the next task to complete the mission, considering the progress so far and the results of previous tasks. `,
                        `Exclude code or unnecessary content and respond with only one sentence in ${await getLanguageFullName()}. Omit optional tasks.`,
                        '',
                        customRulesForCodeGenerator ? '<CodeGenerationRules>' : REMOVED,
                        customRulesForCodeGenerator ? `${indention(1, customRulesForCodeGenerator)}` : REMOVED,
                        customRulesForCodeGenerator ? '</CodeGenerationRules>' : REMOVED,
                        '',
                    ].filter(line => line.trim() !== REMOVED).join('\n')
                    whattodo = await chatCompletion(
                        {
                            systemPrompt: prompt,
                            systemPromptForGemini: prompt,
                        },
                        await makeRealTransaction({ processTransactions, multiLineMission, type: 'whattodo', mainKeyMission }),
                        'whatToDo',
                        interfaces,
                        caption('whatToDo')
                    );
                    if (whattodo) whattodo = whattodo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
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
                const systemPrompt = await prompts.systemPrompt(multiLineMission, whattodo, useDocker);
                const systemPromptForGemini = await prompts.systemPrompt(multiLineMission, whattodo, useDocker, true);
                let promptList = await makeRealTransaction({ processTransactions, multiLineMission, type: 'coding', whatdidwedo, whattodo, deepThinkingPlan, evaluationText, mainKeyMission });
                promptList = JSON.parse(JSON.stringify(promptList));

                while (true) {
                    actData = await chatCompletion(
                        { systemPrompt, systemPromptForGemini },
                        promptList,
                        'generateCode',
                        interfaces,
                        caption('codeGeneration')
                    );
                    console.log('actData', actData);
                    let actDataResult = await actDataParser({ actData });
                    console.log('actDataResult', actDataResult);
                    javascriptCode = actDataResult.javascriptCode || '';
                    requiredPackageNames = actDataResult.requiredPackageNames || [];
                    pythonCode = actDataResult.pythonCode || '';
                    javascriptCodeBack = actDataResult.javascriptCodeBack || '';
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
            requiredPackageNames = await installPackages(requiredPackageNames, pythonCode, javascriptCode, useDocker, containerId, dockerWorkDir, spinners, out_state, createSpinner, await_prompt);
            // if (!useDocker) {
            //     spinners.iter = createSpinner('코드를 실행하는 중...', 'line');
            //     // const pid9 = await out_state('코드를 실행하는 중...');
            // }
            // if (useDocker) await out_print({ data: '코드를 실행합니다', mode: 'runCode' });


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
            console.log('코드 실행 시작');
            let executionId;
            const streamGetter = async (str) => {
                console.log('스트림 처리 시작');
                if (!useDocker) return;
                process.stdout.write(str);
                if (executionId) {
                    console.log('스트림 출력 전송');
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
                    console.log('JavaScript 코드 실행 준비');
                    let javascriptCodeToRun = javascriptCodeBack ? javascriptCodeBack : javascriptCode;
                    if (useDocker) {
                        console.log('Docker 환경에서 JavaScript 실행');
                        if (!confirmedd) {
                            console.log('JavaScript 코드 확인 프롬프트 요청');
                            let confirmed = await await_prompt({ mode: 'run_nodejs_code', actname: actData.name, containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            console.log('confirmedjs', confirmed);
                            javascriptCodeToRun = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        console.log('Docker에서 NodeJS 코드 실행');
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
                    console.log('Python 코드 실행 준비');
                    if (useDocker) {
                        console.log('Docker 환경에서 Python 실행');
                        if (!confirmedd) {
                            console.log('Python 코드 확인 프롬프트 요청');
                            let confirmed = await await_prompt({ mode: 'run_python_code', actname: actData.name, containerId, dockerWorkDir, pythonCode, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error(caption('missionAborted'));
                            console.log('confirmedpy', confirmed);
                            pythonCode = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        console.log('Docker에서 Python 코드 실행');
                        await waitingForDataCheck(out_state);
                        const codeExecutionResult_ = await runPythonCode(containerId, dockerWorkDir, pythonCode, requiredPackageNames, streamGetter);
                        if (codeExecutionResult_) codeExecutionResult = codeExecutionResult_;
                        runCodeFactor = true;
                    }
                }
            } catch (error) {
                errorList.codeexecutionerror = { error };
            }
            if (useDocker) {
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

                let actData = await chatCompletion(
                    {
                        systemPrompt: await prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath),
                        systemPromptForGemini: await prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath, true),
                    },
                    await makeRealTransaction({ processTransactions, multiLineMission, type: 'evaluation', mainKeyMission }),
                    'evaluateCode',
                    interfaces,
                    caption('evaluation')
                );
                const { evaluation, reason } = actData.input;
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
                    talktitle.title = await chatCompletion(
                        {
                            systemPrompt: 'Make a short title for the mission',
                            systemPromptForGemini: 'Make a short title for the mission',
                        },
                        [
                            {
                                role: 'user',
                                content: [
                                    `<Mission>`,
                                    `${multiLineMission}`,
                                    `</Mission>`,
                                    `<WhatDidWeDo>`,
                                    `${processTransactions.map(a => a.whatdidwedo).join('\n\n')}`,
                                    `</WhatDidWeDo>`,
                                    `What is the title of the mission?`
                                ].join('\n')
                            }
                        ],
                        '',
                        interfaces,
                        caption('namingMission')
                    );
                } catch { }
                if (!talktitle) {
                    talktitle.title = new Date().toISOString();
                }
            }

            const pid4 = await out_state('');
            await pid4.succeed(caption('missionCompleted'));
        }

    }
    return { exported, containerId, processTransactions, talktitle };
}
