import singleton from './singleton.js';
import { getAppPath, convertJsonToResponseFormat, getConfiguration, getToolList, getToolData } from './system.js';
import { writeEnsuredFile } from './dataHandler.js';
import fs from 'fs';
import { useTools, getLanguageFullName } from './solveLogic.js';
import { caption, replaceAll } from './system.js';


export async function reviewMission(multiLineMission, interfaces) {
    const systemPrompt = [
        'You are a prompt-engineer.',
        'Your task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent.'
    ].join('\n');

    const userContent = [
        multiLineMission,
        '',
        '------',
        'Make the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.',
        '',
        'Response **only the prompt**.'
    ].join('\n');

    const result = await chatCompletion(
        {
            systemPrompt,
            systemPromptForGemini: systemPrompt
        },
        [{
            role: 'user',
            content: userContent
        }],
        'promptEngineer',
        interfaces,
        caption('reviewMission')
    );

    return result;
}



function extractWaitTime(errorMessage) {
    const regex = /Please try again in ([\d.]+)\s*(ms|s|m|h|d)?/i;
    const match = errorMessage.match(regex);
    if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2] ? match[2].toLowerCase() : 's'; // 기본 단위는 초(s)
        switch (unit) {
            case 'ms':
                return value / 1000; // 밀리초를 초로 변환
            case 's':
                return value; // 초 단위는 그대로 반환
            case 'm':
                return value * 60; // 분을 초로 변환
            case 'h':
                return value * 3600; // 시간을 초로 변환
            case 'd':
                return value * 86400; // 일을 초로 변환
            default:
                return null;
        }
    } else {
        return null;
    }
    // return null;
}
export function unifiedStructure(data) {
    const gemini = !!data.system_instruction;
    const claude = !!data.system;
    function getModel() {
        if (gemini) {
            return 'gemini'
        } else if (claude) {
            return data.model
        } else {
            return data.model
        }
    }
    function getTool() {
        if (gemini) {
            return { tools: data.tools, tool_config: data.tool_config }
        } else if (claude) {
            return { tools: data.tools, tool_config: data.tool_choice }
        } else {
            return { tools: data.tools }
        }
    }
    function getSystemPrompt() {
        if (gemini) {
            return data.system_instruction.parts[0].text
        } else if (claude) {
            return data.system;
        } else {
            return data.messages.filter(m => m.role === 'system')[0].content;
        }
    }
    function getMessages() {
        if (gemini) {
            return data.contents.map(talk => {
                return {
                    role: talk.role === 'user' ? 'user' : 'assistant',
                    content: talk.parts[0].text
                };
            });
        } else if (claude) {
            return data.messages;
        } else {
            return data.messages.filter(m => m.role !== 'system');
        }
    }
    return {
        model: getModel(),
        tool: getTool(),
        systemPrompt: getSystemPrompt(),
        messages: getMessages()
    }
}
async function leaveLog({ callMode, data }) {
    const trackLog = await getConfiguration('trackLog');
    if (!trackLog) return;
    if (false) {
        const aiLogFolder = getAppPath('logs');
        if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
        const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
        let contentToLeave = `## callMode: ${callMode}\n\n`;
        {
            await writeEnsuredFile(`${aiLogFolder}/${date}.json`, JSON.stringify(data));
            let messages = data.messages;
            for (let i = 0; i < messages.length; i++) {
                contentToLeave += `${'-'.repeat(800)}\n## ${messages[i].role} ##\n${messages[i].content}\n\n`;
            }
            await writeEnsuredFile(`${aiLogFolder}/${date}.txt`, contentToLeave);
        }
    } else {
        try {
            const aiLogFolder = getAppPath('logs_txt');
            if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
            const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
            if (!data.resultText) {
                data = JSON.parse(JSON.stringify(data));
                data.callMode = callMode;
                //---------
                let unified = unifiedStructure(data);
                let contentToLeave = `## callMode: ${callMode}\n\n`;
                contentToLeave += `${'-'.repeat(120)}\n## system ##\n${unified.systemPrompt}\n\n`;
                for (let i = 0; i < unified.messages.length; i++) {
                    contentToLeave += `${'-'.repeat(120)}\n## ${unified.messages[i].role} ##\n${unified.messages[i].content}\n\n`;
                }
                if (false) {
                    contentToLeave += '\n\n';
                    contentToLeave += '----------------\n';
                    contentToLeave += JSON.stringify(data, undefined, 3);
                    contentToLeave += '\n\n';
                    contentToLeave += '----------------\n';
                    contentToLeave += JSON.stringify(unified, undefined, 3);
                }
                await writeEnsuredFile(`${aiLogFolder}/${date}_REQ_${unified.model}_${callMode}.txt`, contentToLeave);
            } else {
                let contentToLeave = '';
                let parsed = JSON.parse(data.resultText);
                let llm;
                if (parsed?.candidates) llm = 'gemini';
                else if (parsed?.type === 'message' && parsed?.role === 'assistant') llm = 'claude';
                else llm = '';
                // "type": "message",
                // "role": "assistant",

                if (llm === 'gemini') {
                    let parts = parsed?.candidates?.[0]?.content?.parts;
                    for (let i = 0; i < parts.length; i++) {
                        if (!parts[i]) continue;
                        contentToLeave += '-------------------\n';
                        contentToLeave += `[[type]]: ${parts[i].functionCall ? 'functionCall' : 'text'}\n`;
                        contentToLeave += '-------------------\n';
                        if (parts[i].functionCall) {
                            let name = parts[i].functionCall?.name
                            let args = parts[i].functionCall?.args
                            contentToLeave += `[[name]]: ${name}\n`;
                            Object.keys(args).forEach(key => {
                                contentToLeave += ` - key: "${key}"\n${args[key]}\n`;
                            });
                        }
                        if (parts[i].text) {
                            contentToLeave += `${parts[i].text}\n`;
                        }
                    }
                } else if (llm === 'claude') {
                    let parts = [parsed?.content?.[0]];//?.content?.parts;
                    for (let i = 0; i < parts.length; i++) {
                        if (!parts[i]) continue;
                        const type = parts[i].type; // tool_use, text
                        const text = parts[i].text;
                        const name = parts[i].name;
                        const input = parts[i].input;
                        contentToLeave += '-------------------\n';
                        contentToLeave += `[[type]]: ${type}\n`;
                        contentToLeave += '-------------------\n';
                        if (type === 'tool_use') {
                            contentToLeave += `[[name]]: ${name}\n`;
                            Object.keys(input).forEach(key => {
                                contentToLeave += ` - key: "${key}"\n${input[key]}\n`;
                            });
                        }
                        if (type === 'text') {
                            contentToLeave += `${text}\n`;
                        }
                    }
                    // contentToLeave = `\n\n\n------------------\n${JSON.stringify(JSON.parse(data.resultText), undefined, 3)}`;
                } else {
                    let parts = [parsed?.choices?.[0]?.message];//?.content?.parts;
                    for (let i = 0; i < parts.length; i++) {
                        if (!parts[i]) continue;
                        const name = parts[i].tool_calls?.[0]?.function?.name;
                        const type = name ? 'tool_calls' : 'text';
                        let input = parts[i].tool_calls?.[0]?.function?.arguments;
                        const text = parts[i].content;
                        try {
                            input = JSON.parse(input);
                        } catch { }
                        contentToLeave += '-------------------\n';
                        contentToLeave += `[[type]]: ${type}\n`;
                        contentToLeave += '-------------------\n';
                        if (type === 'tool_calls') {
                            contentToLeave += `[[name]]: ${name}\n`;
                            if (input) {
                                if (input.constructor === Object) {
                                    Object.keys(input).forEach(key => {
                                        contentToLeave += ` - key: "${key}"\n${input[key]}\n`;
                                    });
                                } else {
                                    contentToLeave += `** input is not Object **`;
                                }
                            } else {
                                contentToLeave += `** input is undefined or null **`;
                            }
                        }
                        if (type === 'text') {
                            contentToLeave += `${text}\n`;
                        }
                    }
                }
                // if (parsed.type === 'tool_use') {
                //     contentToLeave += `## tool_use ##\n${parsed.name}\n${JSON.stringify(parsed.input, undefined, 3)}\n\n`;
                // } else if (parsed.type === 'tool_result') {
                //     contentToLeave += `## tool_result ##\n${parsed.name}\n${JSON.stringify(parsed.input, undefined, 3)}\n\n`;
                // }
                // if(data.resultText)
                contentToLeave += `\n\n\n------------------\n${JSON.stringify(JSON.parse(data.resultText), undefined, 3)}`;
                await writeEnsuredFile(`${aiLogFolder}/${date}_RES_${callMode}.txt`, contentToLeave);
                if (false) await writeEnsuredFile(`${aiLogFolder}/${date}_RES_${callMode}.json`, JSON.stringify(JSON.parse(data.resultText), undefined, 3));
            }
        } catch { }
    }
}
export async function isOllamaRunning() {
    const url = await getConfiguration('ollamaEndpoint'); // Ollama의 기본 API 서버 주소
    try {
        const response = await fetch(url, { method: 'GET' });
        const body = await response.text();
        // 응답에 "Ollama is running"이 포함되어 있으면 실행 중
        return body.includes('Ollama is running');
    } catch (err) {
        return false; // 연결 실패 시 실행 중이 아님
    }
}
/**
 * 주어진 문자열에서 가장 첫 번째 Fenced Code Block(3개 이상의 백틱) 안에 있는
 * 언어명과 소스코드를 함께 추출하여 반환합니다.
 *
 * 예: 
 *    ```javascript
 *    console.log("Hello");
 *    ```
 *
 * - 3개 이상의 백틱(```이상)으로 시작하고 동일한 수의 백틱으로 끝나는 부분을 찾습니다.
 * - 백틱 뒤에 붙어 있는 텍스트(언어명, 옵션 등)를 추출합니다.
 * - 그 내부에 있는 전체 소스코드를 추출합니다.
 *
 * @param {string} text - 코드 블록을 포함할 수 있는 원본 문자열
 * @returns {{ languageName: string, code: string } | null}
 *          - { languageName, code } 형태의 객체
 *          - 코드 블록이 없으면 null
 */
function stripSourceCodeInFencedCodeBlock(text) {
    // 1. `(`{3,}) 로 3개 이상의 백틱을 탐색 (캡처 그룹 1)
    // 2. ([^\n\r]*) 는 "```" 다음에 오는 언어명 혹은 다른 문자(옵션)를 캡처 (캡처 그룹 2)
    // 3. [\r\n]+ 다음 줄로 넘어감
    // 4. ([\s\S]*?) 실제 코드 내용(개행 포함) 캡처 (non-greedy) (캡처 그룹 3)
    // 5. [\r\n]+ 다음 줄로 넘어감
    // 6. \1 로 같은 개수의 백틱이 다시 나오는지 확인
    const regex = /(`{3,})([^\n\r]*)[\r\n]+([\s\S]*?)[\r\n]+\1/;
    const match = regex.exec(text);

    // match:
    //   0 전체 매칭된 문자열
    //   1 백틱들 (예: "```")
    //   2 언어명 또는 기타 옵션 (예: "javascript")
    //   3 코드 내용
    if (match) {
        const languageName = match[2].trim(); // "javascript" 등
        const code = match[3];               // 실제 코드 내용

        return {
            languageName,
            code
        };
    }

    // 코드 블록을 찾지 못한 경우
    return null;
}
function plainParser(text, callMode) {
    let plain = langParser(text, callMode);
    if (plain) {
        if (callMode === 'generateCode') {
            return {
                type: 'tool_use',
                name: plain.name,
                input: plain.args
            }
        } else if (callMode === 'evaluateCode') {
            return {
                type: 'tool_use',
                name: 'completion_verdict',
                input: {
                    evaluation: plain.args.evaluation || '',
                    reason: plain.args.reason || ''
                }
            }
        }
    }
}
function langParser(text, callMode) {
    try {
        let { languageName, code } = stripSourceCodeInFencedCodeBlock(text);
        let toolCall = {
            name: null,
            args: null
        }
        if (callMode === 'generateCode') {
            if (['python', 'py'].includes(languageName.toLowerCase())) {
                toolCall.name = 'generate_python_code';
                toolCall.args = {
                    python_code: code,
                    pip_package_list: []
                }
            }
            else if (['json'].includes(languageName.toLowerCase())) {
                toolCall.name = 'generate_python_code';
                toolCall.args = {
                    python_code: code,
                    pip_package_list: []
                }
            }
            else if (['javascript', 'js'].includes(languageName.toLowerCase())) {
                toolCall.name = 'generate_nodejs_code';
                toolCall.args = {
                    nodejs_code: code,
                    npm_package_list: []
                }
            } else {
                function isValidJavaScriptUsingNewFunction(code) {
                    try {
                        new Function(code);
                        return true;  // 문법적으로 유효
                    } catch (e) {
                        return false; // 문법 오류
                    }
                }
                if (2 < Math.random() && isValidJavaScriptUsingNewFunction(code)) {
                    toolCall.name = 'generate_nodejs_code';
                    toolCall.args = {
                        nodejs_code: code,
                        npm_package_list: []
                    }
                } else {
                    toolCall.name = 'generate_python_code';
                    toolCall.args = {
                        python_code: code,
                        pip_package_list: []
                    }
                    // throw new Error('Invalid JavaScript code');
                }
            }
        } else if (callMode === 'evaluateCode') {
            let parsed = {};
            try {
                parsed = JSON.parse(code);
            } catch { }
            toolCall.name = 'completion_verdict';
            toolCall.args = {
                evaluation: parsed.evaluation || '',
                reason: parsed.reason || ''
            }
        }
        return toolCall;
    } catch { }
}
export async function getModel() {
    const llm = await getConfiguration('llm');
    const model = llm === 'claude'
        ? await getConfiguration('model')
        : llm === 'deepseek'
            ? await getConfiguration('deepseekModel')
            : llm === 'openai'
                ? await getConfiguration('openaiModel')
                : llm === 'ollama'
                    ? await getConfiguration('ollamaModel')
                    : llm === 'groq'
                        ? await getConfiguration('groqModel')
                        : llm === 'gemini'
                            ? await getConfiguration('geminiModel')
                            : null;
    return model;
}
export async function chatCompletion(systemPrompt_, promptList, callMode, interfaces = {}, stateLabel = '') {
    let systemPrompt;
    let systemPromptForGemini;
    let malformed_function_called = false;
    if (systemPrompt_.constructor === String) {
        systemPrompt = systemPrompt_;
    } else {
        systemPrompt = systemPrompt_.systemPrompt;
        systemPromptForGemini = systemPrompt_.systemPromptForGemini;
    }
    if (!systemPromptForGemini) systemPromptForGemini = systemPrompt;

    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    async function requestChatCompletion(systemPrompt, promptList, model) {
        const llm = await getConfiguration('llm');
        let claudeApiKey = await getConfiguration('claudeApiKey');
        let deepseekApiKey = await getConfiguration('deepseekApiKey');
        let openaiApiKey = await getConfiguration('openaiApiKey');
        let ollamaApiKey = await getConfiguration('ollamaApiKey');
        let groqApiKey = await getConfiguration('groqApiKey');
        let geminiApiKey = await getConfiguration('geminiApiKey');

        let useDocker = await getConfiguration('useDocker');
        let dockerPath = await getConfiguration('dockerPath');
        claudeApiKey = claudeApiKey.trim();
        deepseekApiKey = deepseekApiKey.trim();
        openaiApiKey = openaiApiKey.trim();
        ollamaApiKey = ollamaApiKey.trim();
        groqApiKey = groqApiKey.trim();
        geminiApiKey = geminiApiKey.trim();

        if (llm === 'claude' && !claudeApiKey) throw new Error(caption('claudeApiKeyNotSet'));
        if (llm === 'deepseek' && !deepseekApiKey) throw new Error(caption('deepseekApiKeyNotSet'));
        if (llm === 'openai' && !openaiApiKey) throw new Error(caption('openaiApiKeyNotSet'));
        if (llm === 'ollama' && !ollamaApiKey && false) throw new Error(caption('ollamaApiKeyNotSet'));
        if (llm === 'groq' && !groqApiKey) throw new Error(caption('groqApiKeyNotSet'));
        if (llm === 'gemini' && !geminiApiKey) throw new Error(caption('geminiApiKeyNotSet'));
        if (useDocker && !dockerPath) throw new Error(caption('dockerPathNotSet'));

        let tool_choice_list = {
            getRequiredPackageNames: { type: "tool", name: "npm_package_names" },
            evaluateCode: { type: "tool", name: "completion_verdict" },
            generateCode: { type: "any" }
        };
        let toolsList = {
            getRequiredPackageNames: [
                {
                    "name": "npm_package_names",
                    "description": "get the names of npm packages used in the code.",
                    "input_schema": convertJsonToResponseFormat({ npm_package_list: [""] }, { npm_package_list: "array of npm package names used in the code" }).json_schema.schema
                },
            ],
            evaluateCode: [
                {
                    "name": "completion_verdict",
                    "description": "verdict whether the mission is solved.",
                    "input_schema": convertJsonToResponseFormat(
                        { evaluation: "", reason: "" },
                        { evaluation: "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED or GIVEUPTHEMISSION", reason: `Explain the reason for the verdict in ${await getLanguageFullName()} of short length` }
                    ).json_schema.schema
                },
            ],
            generateCode: [
                {
                    "name": "read_file",
                    "description": "Read a file.",
                    "input_schema": convertJsonToResponseFormat({ file_path: "" }, { file_path: "file path to read, e.g, ./program/package.json" }).json_schema.schema
                },
                {
                    "name": "list_directory",
                    "description": "List a directory.",
                    "input_schema": convertJsonToResponseFormat({ directory_path: "" }, { directory_path: "directory path to list, e.g, ./program" }).json_schema.schema
                },
                useTools.read_url ? {
                    "name": "read_url",
                    "description": "Read a URL.",
                    "input_schema": convertJsonToResponseFormat({ url: "" }, { url: "url to read, e.g, https://cokac.com/robots.txt" }).json_schema.schema
                } : null,
                useTools.rename_file_or_directory ? {
                    "name": "rename_file_or_directory",
                    "description": "Rename a file or directory.",
                    "input_schema": convertJsonToResponseFormat({ old_path: "", new_path: "" }, { old_path: "old file or directory path to rename, e.g, ./program/package.json", new_path: "new file or directory path to rename, e.g, ./program/package2.json" }).json_schema.schema
                } : null,
                useTools.remove_file ? {
                    "name": "remove_file",
                    "description": "Remove a file.",
                    "input_schema": convertJsonToResponseFormat({ file_path: "" }, { file_path: "file path to remove, e.g, ./program/package.json" }).json_schema.schema
                } : null,
                useTools.remove_directory_recursively ? {
                    "name": "remove_directory_recursively",
                    "description": "Remove a directory recursively.",
                    "input_schema": convertJsonToResponseFormat({ directory_path: "" }, { directory_path: "directory path to remove recursively, e.g, ./program" }).json_schema.schema
                } : null,
                useTools.apt_install && useDocker ? {
                    "name": "apt_install",
                    "description": "Install a package using apt.",
                    "input_schema": convertJsonToResponseFormat({ package_name: "" }, { package_name: "package name to install, e.g, ffmpeg" }).json_schema.schema
                } : null,
                useTools.which_command ? {
                    "name": "which_command",
                    "description": "Check if a command exists.",
                    "input_schema": convertJsonToResponseFormat({ command: "" }, { command: "command to check, e.g, ffmpeg" }).json_schema.schema
                } : null,
                useTools.run_command ? {
                    "name": "run_command",
                    "description": "Run a shell command.",
                    "input_schema": convertJsonToResponseFormat({ command: "" }, { command: "shell command to run, e.g, ls -al" }).json_schema.schema
                } : null,
                ...(await (async () => {
                    const toolList = await getToolList();
                    let toolPrompts = [];
                    for (let tool of toolList) {
                        const toolData = await getToolData(tool);
                        toolData.spec.input_schema = convertJsonToResponseFormat(...toolData.spec.input_schema).json_schema.schema;
                        toolPrompts.push(toolData.spec);
                    }
                    return toolPrompts;
                })())
            ].filter(t => t !== null),
        }
        let tools = toolsList[callMode];

        const requestAI = async (llm, callMode, data, url, headers) => {
            let toolNameForce = ''; // 페이로드에 tool을 지정해줬음에도 무시해버리는 경우가 있다. 그런경우는 toolNameForce에 지정해주면 지정해준 툴을 사용할 확률이 올라감.
            let forRetry = 0;
            let exponentialBackoffCount = 1;
            while (true) {
                if (llm === 'gemini' && malformed_function_called) {
                    console.log('mallformed fix');
                    delete data.tools;
                    delete data.tool_config;
                    data = {
                        ...data,
                        system_instruction: {
                            parts: [{ text: systemPromptForGemini }]
                        },
                    };
                }
                if (llm === 'ollama' && !(await isOllamaRunning())) {
                    let ollamaServerNotRunning = caption('ollamaServerNotRunning');
                    ollamaServerNotRunning = replaceAll(ollamaServerNotRunning, '{{stateLabel}}', stateLabel);
                    ollamaServerNotRunning = replaceAll(ollamaServerNotRunning, '{{model}}', model);
                    throw new Error(ollamaServerNotRunning);
                }
                let aiProcessing = caption('aiProcessing');
                aiProcessing = replaceAll(aiProcessing, '{{stateLabel}}', stateLabel);
                aiProcessing = replaceAll(aiProcessing, '{{model}}', model);
                let pid6 = await out_state(aiProcessing); // `${stateLabel}를 ${model}가 처리중...`
                let response;
                let result;
                //\n\n---\nTOOL NAME TO USE:\ngenerate_python_code\n
                function setDefaultToolName() {
                    forRetry++;
                    if (callMode === 'generateCode') {
                        toolNameForce = 'generate_python_code';
                    } else {
                        toolNameForce = tools[0].name;
                    }
                }
                function dataPayload(data) {
                    if (!toolNameForce) return data;
                    const dataCloned = JSON.parse(JSON.stringify(data));

                    // Gemini API 형식 처리
                    if (dataCloned.contents) {
                        let lastMessage = dataCloned.contents[dataCloned.contents.length - 1];
                        lastMessage.parts[0].text += `\n\n---\nTOOL NAME TO USE:\n${toolNameForce}\n`;
                    }
                    // 다른 API 형식 처리
                    else if (dataCloned.messages) {
                        let lastMessage = dataCloned.messages[dataCloned.messages.length - 1];
                        lastMessage.content += `\n\n---\nTOOL NAME TO USE:\n${toolNameForce}\n`;
                    }
                    return dataCloned;
                }
                try {
                    if (singleton.missionAborting) throw null;
                    const controller = new AbortController();
                    if (!singleton.abortController) singleton.abortController = [];
                    singleton.abortController.push(controller);
                    console.log('url', url);
                    const body = dataPayload(data);
                    await leaveLog({ callMode, data: body });
                    response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                    singleton.abortController = singleton.abortController.filter(c => c !== controller);
                    result = await response.text();
                    console.log('result', result);
                } catch (err) {
                    // aiMissionAborted:`${stateLabel}를 ${model}가 처리 중단 (${err.message})`
                    let aiMissionAborted = caption('aiMissionAborted');
                    aiMissionAborted = replaceAll(aiMissionAborted, '{{stateLabel}}', stateLabel);
                    aiMissionAborted = replaceAll(aiMissionAborted, '{{model}}', model);
                    aiMissionAborted = replaceAll(aiMissionAborted, '{{errorMessage}}', err.message);
                    pid6.fail(aiMissionAborted);
                    throw new Error(caption('missionAborted'));
                } finally {
                    pid6.dismiss();
                }
                if (!result) {
                    let pid64 = await out_state(``);
                    // aiNoResult:`${model}가 ${stateLabel} 처리한 결과가 없음`
                    let aiNoResult = caption('aiNoResult');
                    aiNoResult = replaceAll(aiNoResult, '{{model}}', model);
                    aiNoResult = replaceAll(aiNoResult, '{{stateLabel}}', stateLabel);
                    pid64.fail(aiNoResult);
                    let aiRetryWaiting = caption('aiRetryWaiting');
                    aiRetryWaiting = replaceAll(aiRetryWaiting, '{{model}}', model);
                    aiRetryWaiting = replaceAll(aiRetryWaiting, '{{stateLabel}}', stateLabel);
                    let pid643 = await out_state(aiRetryWaiting);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    pid643.dismiss();
                    continue;
                }
                await leaveLog({ callMode, data: { resultText: result } });

                // aiAnalyzingResult:`${stateLabel} 처리 데이터 분석 중`
                let aiAnalyzingResult = caption('aiAnalyzingResult');
                aiAnalyzingResult = replaceAll(aiAnalyzingResult, '{{stateLabel}}', stateLabel);
                let pid64 = await out_state(aiAnalyzingResult);
                try {
                    result = JSON.parse(result);
                } catch {
                    // aiAnalyzingResultFailed:`${stateLabel} 처리 데이터 분석 실패`
                    let aiAnalyzingResultFailed = caption('aiAnalyzingResultFailed');
                    aiAnalyzingResultFailed = replaceAll(aiAnalyzingResultFailed, '{{stateLabel}}', stateLabel);
                    pid64.fail(aiAnalyzingResultFailed);
                    await leaveLog({ callMode, data: { resultErrorJSON: result } });
                    let aiRetryWaiting = caption('aiRetryWaiting');
                    aiRetryWaiting = replaceAll(aiRetryWaiting, '{{model}}', model);
                    aiRetryWaiting = replaceAll(aiRetryWaiting, '{{stateLabel}}', stateLabel);
                    let pid643 = await out_state(aiRetryWaiting);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    pid643.dismiss();
                    continue;
                } finally {
                    pid64.dismiss();
                }
                const errorMessage = result?.error?.message || '';
                const errorStatus = result?.error?.status || '';
                const finishReason = result?.candidates?.[0]?.finishReason || '';
                const RESOURCE_EXHAUSTED = errorStatus === 'RESOURCE_EXHAUSTED';
                const MALFORMED_FUNCTION_CALL = finishReason === 'MALFORMED_FUNCTION_CALL';
                if (MALFORMED_FUNCTION_CALL) {
                    malformed_function_called = true;
                    // no_use_tool
                    continue;
                }
                let pid65 = await out_state(``);

                // 429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit (https://docs.anthropic.com/en/api/rate-limits); see the response headers for current usage. Please reduce the prompt length or the maximum tokens requested, or try again later. You may also contact sales at https://www.anthropic.com/contact-sales to discuss your options for a rate limit increase."}}                
                if (errorMessage) {
                    const forRateLimit = errorMessage.includes('Rate limit') || errorMessage.includes('rate limit');
                    if (forRateLimit || errorMessage.includes('Overloaded') || RESOURCE_EXHAUSTED) {
                        pid65.fail(errorMessage);
                        await leaveLog({ callMode, data: { resultErrorSystem: result } });
                        let waitTime = Math.ceil(extractWaitTime(errorMessage));
                        if (!waitTime && waitTime !== 0) waitTime = 5;
                        if (RESOURCE_EXHAUSTED) waitTime = 5;
                        exponentialBackoffCount *= 1.5;
                        waitTime *= exponentialBackoffCount;
                        waitTime = Math.ceil(waitTime);
                        // ollamaServerNotRunning:'Ollama API서버 확인에 문제가 있습니다.'
                        // processing:`${stateLabel}를 ${model}가 처리중...`
                        // aiMissionAborted:`${stateLabel}를 ${model}가 처리 중단 (${err.message})`
                        // aiNoResult:`${model}가 ${stateLabel} 처리한 결과가 없음`
                        // aiRetryWaiting:`${model}가 ${stateLabel} 처리 재시도 대기`
                        // aiAnalyzingResult:`${stateLabel} 처리 데이터 분석 중`
                        // aiAnalyzingResultFailed:`${stateLabel} 처리 데이터 분석 실패`
                        // aiRetryWaiting:`${model}가 ${stateLabel} 처리 재시도 대기`
                        // aiRetryWaitingSecondLeft:`${model}가 ${stateLabel} 처리 재시도 대기 {{second}}초 남음`
                        let aiRetryWaitingSecondLeft = caption('aiRetryWaitingSecondLeft');
                        aiRetryWaitingSecondLeft = replaceAll(aiRetryWaitingSecondLeft, '{{model}}', model);
                        aiRetryWaitingSecondLeft = replaceAll(aiRetryWaitingSecondLeft, '{{stateLabel}}', stateLabel);
                        let percentBar = await percent_bar({ template: aiRetryWaitingSecondLeft, total: waitTime });
                        while (await percentBar.onetick()) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            if (singleton.missionAborting) {
                                percentBar.destroypercentbar();
                                throw null;
                            }
                        }
                        continue;
                    } else {
                        pid65.dismiss();
                    }
                    throw new Error(errorMessage);
                } else {
                    pid65.dismiss();
                }
                if (llm === 'claude') {
                    if (tools) {
                        try {
                            let data = result?.content?.filter(c => c.type === 'tool_use')[0];
                            let rt = !data ? plainParser(result?.content?.[0]?.text, callMode) : null;
                            if (rt) return rt;
                            if (!data && forRetry < 1) throw null;
                            return data;
                        } catch {
                            continue;
                        }
                    }
                    let text = result?.content?.[0]?.text;
                    return text || '';
                }
                if (llm === 'deepseek') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? plainParser(result?.choices?.[0]?.message?.content, callMode) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }
                if (llm === 'groq') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? plainParser(result?.choices?.[0]?.message?.content, callMode) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }
                if (llm === 'ollama') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? plainParser(result?.choices?.[0]?.message?.content, callMode) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }

                // New branch for OpenAI
                if (llm === 'openai') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? plainParser(result?.choices?.[0]?.message?.content, callMode) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }

                if (llm === 'gemini') {
                    if (tools) {
                        try {
                            const parts = result?.candidates?.[0]?.content?.parts;
                            let toolCall = parts.filter(part => part.functionCall)[0]?.functionCall;
                            let rt = !toolCall ? plainParser(parts.filter(part => part.text)[0].text, callMode) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.name,
                                input: toolCall.args
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                    return text || '';
                }
            }

        };

        // => Now for openai:
        if (llm === 'openai') {
            // The request URL
            const url = "https://api.openai.com/v1/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiApiKey}`
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }

        if (llm === 'deepseek') {
            const url = "https://api.deepseek.com/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${deepseekApiKey}`
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'groq') {
            const url = "https://api.groq.com/openai/v1/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqApiKey}`
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'ollama') {
            const endpoint = await getConfiguration('ollamaEndpoint');
            const url = `${endpoint}/v1/chat/completions`;
            const headers = {
                "Content-Type": "application/json",
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'claude') {
            const url = "https://api.anthropic.com/v1/messages";
            const CLAUDE_API_KEY = claudeApiKey;
            const headers = {
                "x-api-key": `${CLAUDE_API_KEY}`,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            };
            const data = {
                model: model,
                system: systemPrompt,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                max_tokens: 4096, // 토큰 수를 늘림
                tools: tools,
                tool_choice: tool_choice_list[callMode]
            };
            return await requestAI(llm, callMode, data, url, headers);
        }

        // Gemini API 통합
        if (llm === 'gemini') {
            const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
            const url = `${baseUrl}/models/${model}:generateContent?key=${geminiApiKey}`;
            const headers = {
                'Content-Type': 'application/json'
            };

            // Gemini API 형식에 맞게 메시지 변환 
            const messages = promptList.map(p => ({
                role: p.role === "assistant" ? "model" : "user",
                parts: [{ text: p.content }]
            }));

            // tools가 있는 경우 Gemini 형식으로 변환
            let toolConfig = null;
            if (tools) {
                toolConfig = {
                    tools: [{
                        function_declarations: tools.map(tool => ({
                            name: tool.name,
                            description: tool.description,
                            parameters: {
                                type: "object",
                                properties: tool.input_schema.properties || {},
                                required: tool.input_schema.required || []
                            }
                        }))
                    }],
                    tool_config: {
                        function_calling_config: {
                            mode: "auto"
                        }
                    }
                };
            }

            const data = {
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: messages,
                ...toolConfig,
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.6,
                    topK: 10
                }
            };
            console.log('data', JSON.stringify(data, null, 2));
            return await requestAI(llm, callMode, data, url, headers);
        }
    }
    const model = await getModel();
    const responseData = await requestChatCompletion(systemPrompt, promptList, model);
    let actData = responseData;
    if (actData && actData?.input && actData?.input?.constructor === Object) {
        Object.keys(actData.input).forEach(key => {
            let alphanumeric = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
            let newKey = '';
            for (let i = 0; i < key.length; i++) {
                if (alphanumeric.includes(key[i])) {
                    newKey += key[i];
                }
            }
            if (newKey !== key) {
                // console.log('newKey!!', newKey, key);
                actData.input[newKey] = actData.input[key];
                delete actData.input[key];
            }
        });
    }

    return responseData;
}

