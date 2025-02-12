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
import { getLastDirectoryName } from './dataHandler.js';
import { getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { getToolList, getToolData, getAppPath, getUseDocker } from './system.js';
import fs from 'fs';
import { getConfiguration } from './system.js';
import { actDataParser } from './actDataParser.js';
import { makeCodePrompt } from './makeCodePrompt.js';
import { makeRealTransaction } from './makeRealTransaction.js';
import path from 'path';
// getAppPath
import { installPackages } from './packageManager.js';
import singleton from './singleton.js';
import { validatePath } from './system.js';
import { getAbsolutePath } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';



let spinners = {};

export function getSpinners() {
    return spinners;
}

// Collecting prompts in one place
const prompts = {
    systemPrompt: async (mission, whattodo, useDocker) => [
        '컴퓨터 작업 실행 에이전트로서, MAIN MISSION을 완수하기 위한 SUB MISSION을 수행하기 위해 필요한 작업을 수행합니다.',
        '',
        `- MAIN MISSION: "${mission}"`,
        `- SUB MISSION: "${whattodo}"`,
        '',
        '## INSTRUCTION',
        '- 작업 수행을 위한 도구는 다음과 같이 준비되어있으며 임무 수행에 가장 적합한 도구를 선택해서 수행하세요.',
        '',
        '## Tools',
        '   ### read_file',
        '   - 파일의 내용을 읽어옵니다.',
        '      #### INSTRUCTION',
        '      - 파일의 경로를 제공해주세요',
        '   ',
        '   ### list_directory',
        '   - 디렉토리의 파일/폴더 목록을 가져옵니다.',
        '      #### INSTRUCTION',
        '      - 디렉토리의 경로를 제공해주세요',
        '   ',
        '   ### read_url',
        '   - URL의 내용을 읽어옵니다.',
        '      #### INSTRUCTION',
        '      - URL을 제공해주세요',
        '   ',
        '   ### rename_file_or_directory',
        '   - 파일 또는 디렉토리의 이름을 변경합니다.',
        '      #### INSTRUCTION',
        '      - 변경할 파일 또는 디렉토리의 경로와 변경할 이름을 제공해주세요',
        '   ',
        '   ### remove_file',
        '   - 파일을 삭제합니다.',
        '      #### INSTRUCTION',
        '      - 삭제할 파일의 경로를 제공해주세요',
        '   ',
        '   ### remove_directory_recursively',
        '   - 디렉토리를 재귀적으로 삭제합니다.',
        '      #### INSTRUCTION',
        '      - 삭제할 디렉토리의 경로를 제공해주세요',
        '   ',
        // '   ### cdnjs_finder',
        // '   - CDN 라이브러리 URL을 찾습니다.',
        // '      #### INSTRUCTION',
        // '      - 패키지 이름을 제공해주세요',
        // '   ',
        useDocker ? '   ### apt_install' : '[REMOVE]',
        useDocker ? '   - apt 패키지를 설치합니다.' : '[REMOVE]',
        useDocker ? '      #### INSTRUCTION' : '[REMOVE]',
        useDocker ? '      - 설치할 패키지 이름을 제공해주세요' : '[REMOVE]',
        useDocker ? '   ' : '[REMOVE]',
        true ? '   ### which_command' : '[REMOVE]',
        true ? '   - 쉘 명령어가 존재하는지 확인합니다.' : '[REMOVE]',
        true ? '      #### INSTRUCTION' : '[REMOVE]',
        true ? '      - which로 확인할 쉘 명령어를 제공해주세요' : '[REMOVE]',
        true ? '   ' : '[REMOVE]',
        true ? '   ### run_command' : '[REMOVE]',
        true ? '   - 쉘 명령어를 실행합니다.' : '[REMOVE]',
        true ? '      #### INSTRUCTION' : '[REMOVE]',
        true ? '      - 실행할 쉘 명령어를 제공해주세요' : '[REMOVE]',
        true ? '   ' : '[REMOVE]',
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
    ].filter(line => line.trim() !== '[REMOVE]').join('\n'),
    systemEvaluationPrompt: (mission) => [
        '컴퓨터 작업 실행 에이전트로서, MISSION이 완전하게 완료되었는지 엄격고 논리적으로 검증하고 평가하기 위해 필요한 작업을 수행합니다.',
        '이미 검증을 위한 충분한 OUTPUT이 존재하고 미션이 완수되었다고 판단되면 ENDOFMISSION을 응답하고 그것이 아니라면 NOTSOLVED를 응답.',
        '만약 해결할 수 없는 미션이라면 GIVEUPTHEMISSION을 응답하세요.',
        '',
        `- MISSION: "${mission}"`,
        '',
    ].join('\n'),

    packageNamesPrompt: [
        '주어진 Node.js 코드를 실행하기 위해 필요한 npm 패키지들을 파악하는 역할을 합니다.',
        '코드에 사용된 모든 npm 패키지 이름을 배열로 반환해주세요.',
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

export async function solveLogic({ taskId, multiLineMission, dataSourcePath, dataOutputPath, interfaces, odrPath }) {
    const { out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;

    // const taskId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 15)}`;
    // let uniqueSumNumber = 0;
    let containerId;

    // const pid54 = await out_state(`미션 착수 준비중...`);

    const openaiApiKey = await getConfiguration('openaiApiKey');
    const retrivalFolder = getAppPath('retrival');
    if (false) await out_print({ mode: 'retrivalFolder', data: retrivalFolder });
    if (!fs.existsSync(retrivalFolder)) fs.mkdirSync(retrivalFolder);


    const processTransactions = [];
    const pushProcessTransactions = async (data) => {
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

    let iterationCount = 0;
    let finishedByError = '';

    try {
        if (await getConfiguration('llm') === 'ollama') {
            let ollamaModel = await getConfiguration('ollamaModel');
            if (!ollamaModel) throw new Error('Ollama 모델이 설정되지 않았습니다.');
            if (!(await isOllamaRunning())) throw new Error('Ollama가 실행되지 않았습니다. 컴퓨터에서 Ollama를 실행해주세요.');
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
                    throw new Error(`데이터 소스 경로에 Node.js 관련 파일(${file})이 포함되어 있습니다.`);
                }
            }

        }
        if (await getUseDocker()) {
            let dockerImage = await getConfiguration('dockerImage');
            dockerImage = dockerImage.trim();
            if (!dockerImage) {
                throw new Error('도커 이미지가 설정되지 않았습니다.');
            }
            const { isRunning } = await getDockerInfo();
            if (!isRunning) {
                throw new Error('도커가 실행중이지 않습니다.');
            }
            if (!(await doesDockerImageExist(dockerImage))) {
                throw new Error(`도커 이미지 ${dockerImage}가 존재하지 않습니다.`);
            }
            containerId = await runDockerContainerDemon(dockerImage);
        }
        // let browser, page;

        //multiLineMission
        if (false) await out_print({ mode: 'mission', data: multiLineMission });

        const dockerWorkDir = await getConfiguration('dockerWorkDir');
        const maxIterations = await getConfiguration('maxIterations');
        const useDocker = await getConfiguration('useDocker');

        // 데이터 임포트 스피너
        spinners.import = createSpinner('데이터를 가져오는 중...');
        const pid3 = await out_state('데이터를 가져오는 중...');
        if (useDocker) {
            await importToDocker(containerId, dockerWorkDir, dataSourcePath);
        } else {
            // Local Environment
        }
        if (spinners.import) {
            spinners.import.succeed('데이터를 성공적으로 가져왔습니다.');
            if (false) await pid3.succeed('데이터를 성공적으로 가져왔습니다.');
            await pid3.dismiss();
        }
        let nextCodeForValidation;
        let evaluationText = '';
        while (iterationCount < maxIterations || !maxIterations) {
            if (singleton.missionAborting) throw new Error('미션 중단');
            iterationCount++;
            let javascriptCode = '';
            let javascriptCodeBack = '';
            let pythonCode = '';
            let requiredPackageNames;
            let whatdidwedo = '';
            let whattodo = '';
            let validationMode = nextCodeForValidation ? true : false;
            let modelName = await getModel();

            let actData;
            if (!validationMode) {
                processTransactions.length === 0 && await pushProcessTransactions({ class: 'output', data: null });
                if (processTransactions.length > 1) {
                    spinners.iter = createSpinner(`${modelName}가 작업 회고 중...`);
                    whatdidwedo = await chatCompletion(
                        'As an AI agent, analyze what has been done so far',
                        makeRealTransaction(processTransactions, multiLineMission, 'whatdidwedo'),
                        'whatDidWeDo',
                        interfaces,
                        `작업회고`
                    );
                    if (whatdidwedo) whatdidwedo = whatdidwedo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                    if (spinners.iter) {
                        spinners.iter.succeed('작업 회고 완료.');
                    }
                }
                spinners.iter = createSpinner(`${modelName}가 다음 계획수립 중...`);

                whattodo = await chatCompletion(
                    "당신은 미션 완수를 위해 다음으로 해야 할 단 한 가지의 작업만을 제공하는 AI 비서입니다. 지금까지의 진행 상황과 이전 작업의 결과를 고려하세요. 코드나 불필요한 내용은 제외하고, 한국어로 한 문장만 응답하세요. 선택적인 작업은 생략합니다.",
                    makeRealTransaction(processTransactions, multiLineMission, 'whattodo'),
                    'whatToDo',
                    interfaces,
                    `다음 계획수립`
                );
                if (spinners.iter) {
                    spinners.iter.succeed(`${modelName}가 다음 계획수립 완료.`);
                }
                if (whattodo) whattodo = whattodo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                if (whatdidwedo) await out_print({ data: whatdidwedo, mode: 'whatdidwedo' });
                await out_print({ data: whattodo, mode: 'whattodo' });
                spinners.iter = createSpinner(`${modelName}가 코드를 생성하는 중...`);
                const systemPrompt = await prompts.systemPrompt(multiLineMission, whattodo, useDocker);
                let promptList = makeRealTransaction(processTransactions, multiLineMission, 'coding', whatdidwedo, whattodo, evaluationText);
                promptList = JSON.parse(JSON.stringify(promptList));

                while (true) {
                    actData = await chatCompletion(
                        systemPrompt,
                        promptList,
                        'generateCode',
                        interfaces,
                        `코드생성`
                    );
                    console.log('actData', actData);
                    if (spinners.iter) {
                        spinners.iter.succeed(`${modelName}가 코드 생성을 완료(${actData.name})했습니다`);
                    }
                    let actDataResult = await actDataParser({ actData });
                    console.log('actDataResult', actDataResult);
                    javascriptCode = actDataResult.javascriptCode || '';
                    requiredPackageNames = actDataResult.requiredPackageNames || [];
                    pythonCode = actDataResult.pythonCode || '';
                    javascriptCodeBack = actDataResult.javascriptCodeBack || '';
                    if (!pythonCode && !javascriptCode) {
                        const pp33 = await out_state('코드 생성 중...');
                        await pp33.fail('코드 생성 실패');
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
            let result;
            let killed = false;
            let brokenAIResponse = false;
            try {
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
                if (actData.name === 'run_command') {
                    // actData.input.command;
                    let command = actData.input.command;
                    let confirmed = await await_prompt({ mode: 'run_command', actname: actData.name, containerId, dockerWorkDir, command });
                    if (singleton.missionAborting) throw new Error('미션 중단');
                    actData.input.command = confirmed.confirmedCode;
                    // confirmedd = true;
                    // console.log('confirmed', confirmed);
                    let actDataResult = await actDataParser({ actData });
                    javascriptCode = actDataResult.javascriptCode || '';
                    requiredPackageNames = actDataResult.requiredPackageNames || [];
                    pythonCode = actDataResult.pythonCode || '';
                    javascriptCodeBack = actDataResult.javascriptCodeBack || '';

                }
                if (!pythonCode && javascriptCode) {
                    console.log('JavaScript 코드 실행 준비');
                    let javascriptCodeToRun = javascriptCodeBack ? javascriptCodeBack : javascriptCode;
                    if (useDocker) {
                        console.log('Docker 환경에서 JavaScript 실행');
                        if (!confirmedd) {
                            console.log('JavaScript 코드 확인 프롬프트 요청');
                            let confirmed = await await_prompt({ mode: 'run_nodejs_code', actname: actData.name, containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames });
                            if (singleton.missionAborting) throw new Error('미션 중단');
                            console.log('confirmedjs', confirmed);
                            javascriptCodeToRun = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        console.log('Docker에서 NodeJS 코드 실행');
                        result = await runNodeJSCode(containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames, streamGetter);
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
                            if (singleton.missionAborting) throw new Error('미션 중단');
                            console.log('confirmedpy', confirmed);
                            pythonCode = confirmed.confirmedCode;
                            executionId = confirmed.executionId;
                        }
                        console.log('Docker에서 Python 코드 실행');
                        result = await runPythonCode(containerId, dockerWorkDir, pythonCode, requiredPackageNames, streamGetter);
                    }
                } else {
                    console.log('ddddddddddddddddddddddd');
                    console.log('javascriptCode', javascriptCode);
                    console.log('pythonCode', pythonCode);
                    brokenAIResponse = true;
                }
            } catch (error) {
                console.log('코드 실행 중 에러 발생:', error);
                killed = true;
                result = error
            }
            const noCodeExecution = (brokenAIResponse && !result);
            if (result || killed) {
                let pid11;
                if (useDocker) {
                    // spinners.iter = createSpinner(`실행 #${iterationCount}차 ${killed ? '중단' : '완료'}`);
                    pid11 = await out_state(``);
                    if (killed) {
                        await pid11.fail(`코드 수행 중단`);
                    } else {
                        await pid11.succeed(`코드 수행 #${iterationCount}차 완료`);
                    }
                }
            }
            if (noCodeExecution) {
                result = {
                    stdout: '',
                    stderr: '',
                    output: '',
                    code: 0,
                    error: null
                };
            }
            await operation_done({});
            if (javascriptCode) {
                await pushProcessTransactions({ class: 'code', data: javascriptCode });
            } else if (pythonCode) {
                await pushProcessTransactions({ class: 'code', data: pythonCode });
            }

            if (singleton.missionAborting) throw new Error('미션 중단');

            // 결과 출력 및 평가
            result.output = result.output.replace(/\x1b\[[0-9;]*m/g, '');


            // 실행 결과를 boxen으로 감싸기
            if (!useDocker) {
                const outputPreview = omitMiddlePart(result.output);

                await out_print({ data: outputPreview, mode: 'outputPreview' });
            }
            if (!noCodeExecution && result.output.trim().length === 0) {
                await out_print({ data: '❌ 실행결과 출력된 내용이 존재하지 않습니다', mode: 'outputPreview' });
            }

            await pushProcessTransactions({ class: 'output', data: result.output });

            // if (false) {
            // const review = await retriver.retrieve(taskId, '지금까지 수행한 모든 작업을 회고하세요.');
            // await out_print('회고고고', chalk.bold.cyanBright(review));
            // }
            if (true) {
                spinners.iter = createSpinner('작업 검증중입니다.');

                let actData = await chatCompletion(
                    prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath),
                    makeRealTransaction(processTransactions, multiLineMission, 'evaluation'),
                    'evaluateCode',
                    interfaces,
                    `작업검증`
                );
                const { evaluation, reason } = actData.input;
                if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'ENDOFMISSION') {
                    if (spinners.iter) {
                        spinners.iter.succeed(`작업완료.`);
                    }
                    await out_print({ data: reason, mode: 'evaluation1' });
                    const pid4 = await out_state(`Mission Completed`);
                    await pid4.succeed(`Mission Completed`);
                    break;
                } else if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'GIVEUPTHEMISSION') {
                    if (spinners.iter) {
                        spinners.iter.succeed(`작업 포기.`);
                    }
                    await out_print({ data: reason, mode: 'evaluation1' });
                    const pid4 = await out_state(`Mission Aborted`);
                    await pid4.fail(`Mission Aborted`);
                    break;
                } else {
                    if (spinners.iter) {
                        spinners.iter.succeed(`검증완료`);
                    }
                    await out_print(({ data: reason, mode: 'evaluation' }));
                    evaluationText = reason;
                }

            }
        }


        // 데이터 내보내기 스피너
        spinners.export = createSpinner('결과를 저장하는 중...');

        // 정리 작업 스피너
        spinners.cleanup = createSpinner('정리 작업을 수행하는 중...');
        const pid13 = await out_state('정리 작업을 수행하는 중...');
        // if (browser) await browser.close();
        // server.close();
        if (spinners.cleanup) {
            spinners.cleanup.succeed('모든 작업이 완료되었습니다.');
            if (false) await pid13.succeed('모든 작업이 완료되었습니다.');
            await pid13.dismiss();
            // console.log(chalk.green(`결과물이 저장된 경로: ${chalk.bold(dataOutputPath)}`));
        }
    } catch (err) {
        // 현재 실행 중인 모든 스피너 중지
        Object.values(spinners).forEach(spinner => {
            if (spinner && spinner.isSpinning) {
                spinner.fail('작업이 중단되었습니다.');
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
            const pid12 = await out_state('결과를 저장하는 중...');
            if (await getConfiguration('useDocker')) {
                await exportFromDocker(containerId, await getConfiguration('dockerWorkDir'), dataOutputPath);
            }
            await pid12.dismiss();
        }
        if (containerId) {
            spinners.docker = createSpinner('도커 컨테이너를 종료하는 중...');
            const pid14 = await out_state('도커 컨테이너를 종료하는 중...');
            await killDockerContainer(containerId);
            if (spinners.docker) {
                spinners.docker.succeed('도커 컨테이너가 종료되었습니다.');
                if (false) await pid14.succeed('도커 컨테이너가 종료되었습니다.');
                await pid14.dismiss();
            }
        }
        if (finishedByError) {
            const pid4 = await out_state(`작업이 완전히 종료되었습니다.`);
            await pid4.fail(`${finishedByError}`);
        } else {
            const pid4 = await out_state(`작업이 완전히 종료되었습니다.`);
            await pid4.succeed(`작업이 완전히 종료되었습니다.`);
        }

    }
}
