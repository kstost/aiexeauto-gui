import singleton from './singleton.js';
import { getAppPath, convertJsonToResponseFormat, getConfiguration, getToolList, getToolData } from './system.js';
import { writeEnsuredFile } from './dataHandler.js';
import fs from 'fs';
import { useTools } from './solveLogic.js';
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
        if (true) {
            const aiLogFolder = getAppPath('logs');
            if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
            const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
            data = JSON.parse(JSON.stringify(data));
            data.callMode = callMode;
            await writeEnsuredFile(`${aiLogFolder}/${date}.json`, JSON.stringify(data, undefined, 3));
        }
        if (true) {
            const aiLogFolder = getAppPath('logs.txt');
            if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
            const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
            data = JSON.parse(JSON.stringify(data));
            data.callMode = callMode;
            // if (!data.messages) return;
            if (data.messages) {
                let contentToLeave = `## callMode: ${callMode}\n\n`;
                for (let i = 0; i < data.messages.length; i++) {
                    contentToLeave += `${'-'.repeat(120)}\n## ${data.messages[i].role} ##\n${data.messages[i].content}\n\n`;
                }
                await writeEnsuredFile(`${aiLogFolder}/${date}.txt`, contentToLeave);
            } else {
                // {
                //     "resultText": "{\n  \"id\": \"chatcmpl-Az1gp3Z4RtTj8zw2KFLlfgTiSKfaH\",\n  \"object\": \"chat.completion\",\n  \"created\": 1739107867,\n  \"model\": \"gpt-4o-mini-2024-07-18\",\n  \"choices\": [\n    {\n      \"index\": 0,\n      \"message\": {\n        \"role\": \"assistant\",\n        \"content\": \"현재 폴더의 목록을 확인할게요.\",\n        \"refusal\": null\n      },\n      \"logprobs\": null,\n      \"finish_reason\": \"stop\"\n    }\n  ],\n  \"usage\": {\n    \"prompt_tokens\": 209,\n    \"completion_tokens\": 13,\n    \"total_tokens\": 222,\n    \"prompt_tokens_details\": {\n      \"cached_tokens\": 0,\n      \"audio_tokens\": 0\n    },\n    \"completion_tokens_details\": {\n      \"reasoning_tokens\": 0,\n      \"audio_tokens\": 0,\n      \"accepted_prediction_tokens\": 0,\n      \"rejected_prediction_tokens\": 0\n    }\n  },\n  \"service_tier\": \"default\",\n  \"system_fingerprint\": \"fp_72ed7ab54c\"\n}\n",
                //     "callMode": "whatToDo"
                //  }
                await writeEnsuredFile(`${aiLogFolder}/${date}.response.txt`, data.resultText);
            }
        }
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
                        : null;
    return model;
}
export async function chatCompletion(systemPrompt, promptList, callMode, interfaces = {}, stateLabel = '') {
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    async function requestChatCompletion(systemPrompt, promptList, model) {
        const llm = await getConfiguration('llm');
        let claudeApiKey = await getConfiguration('claudeApiKey');
        let deepseekApiKey = await getConfiguration('deepseekApiKey');
        let openaiApiKey = await getConfiguration('openaiApiKey');
        let ollamaApiKey = await getConfiguration('ollamaApiKey');
        let groqApiKey = await getConfiguration('groqApiKey');

        let useDocker = await getConfiguration('useDocker');
        let dockerPath = await getConfiguration('dockerPath');
        claudeApiKey = claudeApiKey.trim();
        deepseekApiKey = deepseekApiKey.trim();
        openaiApiKey = openaiApiKey.trim();
        ollamaApiKey = ollamaApiKey.trim();
        groqApiKey = groqApiKey.trim();

        if (llm === 'claude' && !claudeApiKey) throw new Error('Claude API 키가 설정되어 있지 않습니다.');
        if (llm === 'deepseek' && !deepseekApiKey) throw new Error('DeepSeek API 키가 설정되어 있지 않습니다.');
        if (llm === 'openai' && !openaiApiKey) throw new Error('OpenAI API 키가 설정되어 있지 않습니다.');
        if (llm === 'ollama' && !ollamaApiKey && false) throw new Error('Ollama API 키가 설정되어 있지 않습니다.');
        if (llm === 'groq' && !groqApiKey) throw new Error('Groq API 키가 설정되어 있지 않습니다.');
        if (useDocker && !dockerPath) throw new Error('Docker 경로가 설정되어 있지 않습니다.');



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
                        { evaluation: "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED or GIVEUPTHEMISSION", reason: "Explain the reason for the verdict in korean of short length" }
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
                useDocker ? {
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
            while (true) {
                if (llm === 'ollama' && !(await isOllamaRunning())) {
                    throw new Error('Ollama API서버 확인에 문제가 있습니다.');
                }
                let pid6 = await out_state(`${stateLabel}를 ${model}가 처리중...`);
                let response;
                let result;
                //\n\n---\nTOOL NAME TO USE:\ngenerate_python_code\n
                function dataPayload(data) {
                    if (!toolNameForce) return data;
                    const dataCloned = JSON.parse(JSON.stringify(data));
                    let lastMessage = dataCloned.messages[dataCloned.messages.length - 1];
                    lastMessage.content += `\n\n---\nTOOL NAME TO USE:\n${toolNameForce}\n`;
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
                } catch (err) {
                    pid6.fail(`${stateLabel}를 ${model}가 처리 중단 (${err.message})`);
                    throw new Error('미션 중단');
                } finally {
                    pid6.dismiss();
                }
                if (!result) {
                    let pid64 = await out_state(``);
                    pid64.fail(`${model}가 ${stateLabel} 처리한 결과가 없음`);
                    let pid643 = await out_state(`${model}가 ${stateLabel} 처리 재시도 대기`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    pid643.dismiss();
                    continue;
                }
                await leaveLog({ callMode, data: { resultText: result } });
                let pid64 = await out_state(`${stateLabel} 처리 데이터 분석 중`);
                try {
                    result = JSON.parse(result);
                } catch {
                    pid64.fail(`${stateLabel} 처리 데이터 분석 실패`);
                    await leaveLog({ callMode, data: { resultErrorJSON: result } });
                    let pid643 = await out_state(`${model}가 ${stateLabel} 처리 재시도 대기`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    pid643.dismiss();
                    continue;
                } finally {
                    pid64.dismiss();
                }
                const errorMessage = result?.error?.message || '';
                let pid65 = await out_state(``);
                if (errorMessage) {
                    const forRateLimit = errorMessage.includes('Rate limit') || errorMessage.includes('rate limit');
                    if (forRateLimit || errorMessage.includes('Overloaded')) {
                        pid65.fail(errorMessage);
                        await leaveLog({ callMode, data: { resultErrorSystem: result } });
                        let waitTime = Math.ceil(extractWaitTime(errorMessage));
                        if (!waitTime && waitTime !== 0) waitTime = 5;
                        let percentBar = await percent_bar({ template: `${model}가 ${stateLabel} 처리 재시도 대기 {{second}}초 남음`, total: waitTime });
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
                            if (!data) throw null;
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
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            toolNameForce = 'generate_python_code';
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
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            toolNameForce = 'generate_python_code';
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
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            toolNameForce = 'generate_python_code';
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
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            toolNameForce = 'generate_python_code';
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
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

