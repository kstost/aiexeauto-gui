import net from 'net';
import chalk from 'chalk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import os from 'os';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { writeEnsuredFile, ensureAppsHomePath } from './dataHandler.js';
import singleton from './singleton.js';
import { i18nCaptions } from './frontend/i18nCaptions.mjs';
import { app } from 'electron';
import envConst from './envConst.js';
import { indention } from './makeCodePrompt.js';
import { is_file, is_dir } from './codeExecution.js';
import { getDockerPath } from './executableFinder.js';
import { getNodePath, getNPMPath, getPythonPath } from './executableFinder.js';
export function getSystemLangCode() {
    try {
        return app.getLocale().split('-')[0] || 'en'
    } catch { }
    return 'en';
}
export function replaceAll(str, search, replace) {
    if (!str) return '';
    return str.split(search).join(replace);
}
export function caption(key) {
    const lang = singleton.lang;
    return i18nCaptions[lang]?.[key] || i18nCaptions['en']?.[key] || '';
}
export function getHomeDir() {
    return os.homedir();
}
export function getHomePath(itemPath) {
    return path.join(getHomeDir(), itemPath);
}
export function getConfigFilePath() {
    const folder = getHomePath('.aiexeauto');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    return path.join(folder, '.aiexeauto.cokac.config.json');
}

export async function setConfiguration(key, value, readByMethod = true) {
    const configPath = getConfigFilePath();
    let config
    if (readByMethod) { config = await loadConfiguration(); }
    else if (!(await is_file(configPath))) { config = await loadConfiguration(true); }
    else {
        config = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
    }
    try {
        value = JSON.parse(value);
    } catch { }
    config[key] = value;
    await writeEnsuredFile(configPath, JSON.stringify(config, null, 2));
}
export async function getConfiguration(key) {
    const config = await loadConfiguration();
    return config[key];
}
export async function getUseDocker() {
    return await getConfiguration('useDocker');
}
//---------------------------------
// # groq model list
// - qwen-2.5-32b
// - deepseek-r1-distill-qwen-32b
// - deepseek-r1-distill-llama-70b
// - llama-3.3-70b-versatile
// - llama-3.1-8b-instant
//---------------------------------
function arrayAsText(array) {
    return array.join('\n');
}
export function templateBinding(template, data) {
    Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`;
        while (template.includes(placeholder)) {
            template = template.split(placeholder).join(data[key] || '');
        }
    });
    return template;
}
export async function promptTemplate() {
    let llm = await getConfiguration('llm');
    // let customRulesForCodeGenerator = await getConfiguration('customRulesForCodeGenerator');
    // let customRulesForEvaluator = await getConfiguration('customRulesForEvaluator');

    // await getcon
    const templateBase = {};
    templateBase.transactions = {};
    templateBase.transactions.userPrompt = arrayAsText([
        '{{codeExecutionOutput}}',
        '',
        '{{whatdidwedo}}',
        '',
        '{{nextTasks}}',
        '',
        '{{nextTasksToDo}}',
        '',
    ]);
    templateBase.transactions.assistantPrompt = arrayAsText([
        '{{codeForNextTasks}}',
    ]);

    templateBase.missionNaming = {};
    templateBase.missionNaming.systemPrompt = arrayAsText([
        'Make a short title for the mission',
        '',
        'Response in one short plain text sentence in {{languageFullName}}.',
    ]);


    templateBase.deepThinkingPlan = {};
    templateBase.deepThinkingPlan.userPrompt = arrayAsText([
        '',
        '{{last}}',
        '',
        '{{mission}}',
        '',
        '<Instructions>',
        '  <Rule>Consider the mission and the current progress so far.</Rule>',
        '  <Rule>Think deeply step by step for the next task.</Rule>',
        '  <Rule>Skip optional tasks.</Rule>',
        '  <Rule>Do not include code.</Rule>',
        `  <Rule>Respond in {{languageFullName}}.</Rule>`,
        '</Instructions>',
        '',
        `Let's think step by step.`,
    ]);

    templateBase.recollection = {};
    templateBase.recollection.systemPrompt = arrayAsText([
        'As an AI agent, analyze what has been done so far'
    ]);
    templateBase.recollection.userPrompt = arrayAsText([
        '{{last}}',
        '',
        '{{mission}}',
        '',
        '{{mainKeyMission}}',
        '',
        '<WritingGuidelines>',
        '  <Rule>Summarize the tasks performed so far.</Rule>',
        '  <Rule>Write only the core content in a concise manner.</Rule>',
        '  <Rule>Use only simple and plain expressions.</Rule>',
        '  <Rule>Do not include code.</Rule>',
        `  <Rule>Respond in one sentence in {{languageFullName}}.</Rule>`,
        '</WritingGuidelines>',
        '',
        'As an AI agent, please summarize the tasks performed so far.',
    ]);
    if (llm === 'gemini') {
        templateBase.recollection.userPrompt = arrayAsText([
            '{{last}}',
            '',
            '{{mission}}',
            '',
            '{{mainKeyMission}}',
            '',
            '<WritingGuidelines>',
            '  <Rule>Summarize the tasks performed so far.</Rule>',
            '  <Rule>Write only the core content in a concise manner.</Rule>',
            '  <Rule>Use only simple and plain expressions.</Rule>',
            '  <Rule>Do not include code.</Rule>',
            '  <Rule>You can NOT interact with the user.</Rule>',
            `  <Rule>Respond in one sentence in {{languageFullName}}.</Rule>`,
            '</WritingGuidelines>',
            '',
            'As an AI agent, please summarize the tasks performed so far.',
        ]);
    }


    templateBase.planning = {};
    templateBase.planning.userPrompt = arrayAsText([
        '',
        '{{last}}',
        '',
        '{{mission}}',
        '',
        '{{mainKeyMission}}',
        '',
        '{{deepThinkingPlan}}',
        '',
        '<Instructions>',
        '  <Rule>Consider the mission and the current progress so far.</Rule>',
        '  <Rule>Determine what to do next logically.</Rule>',
        '  <Rule>Skip optional tasks.</Rule>',
        '  <Rule>Do not include code.</Rule>',
        '  <Rule>Do not mention technical methods.</Rule>',
        `  <Rule>Respond in one sentence in {{languageFullName}}.</Rule>`,
        '</Instructions>',
        '',
        'Tell me what task to perform next right away!',
    ]);
    templateBase.planning.systemPrompt = arrayAsText([
        "You are a Code Interpreter Agent.",
        `You can solve the mission with Python code or Function calling Tools.`,
        `You are a secretary who establishes a plan for the next task to complete the mission, considering the progress so far and the results of previous tasks. `,
        `Exclude code or unnecessary content and respond with only one sentence in {{languageFullName}}. Omit optional tasks.`,
        '',
        '{{customRulesForCodeGenerator}}',
        '',
        '<Tools>',
        '{{tools}}',
        '</Tools>',

    ]);
    if ((envConst.whether_to_tool_use_in_gemini && llm === 'gemini')) {
        templateBase.planning.userPrompt = arrayAsText([
            '',
            '{{last}}',
            '',
            '{{mission}}',
            '',
            '{{mainKeyMission}}',
            '',
            '{{deepThinkingPlan}}',
            '',
            '<Instructions>',
            '  <Rule>Consider the mission and the current progress so far.</Rule>',
            '  <Rule>Determine what to do next logically.</Rule>',
            '  <Rule>Skip optional tasks.</Rule>',
            '  <Rule>Do not include code.</Rule>',
            '  <Rule>You can NOT interact with the user.</Rule>',
            '  <Rule>Do not mention technical methods.</Rule>',
            `  <Rule>Respond in one sentence in {{languageFullName}}.</Rule>`,
            '</Instructions>',
            '',
            'Tell me what task to perform next right away!',
        ]);
        templateBase.planning.systemPrompt = arrayAsText([
            "You are a Code Interpreter Agent.",
            `You can solve the mission with Python code or Function calling Tools.`,
            `You are a secretary who establishes a plan for the next task to complete the mission, considering the progress so far and the results of previous tasks. `,
            `Exclude code or unnecessary content and respond with only one sentence in {{languageFullName}}. Omit optional tasks.`,
            '',
            '{{customRulesForCodeGenerator}}',
            '',
            '<Tools>',
            '{{tools}}',
            '</Tools>',
        ]);

    }
    else if ((!envConst.whether_to_tool_use_in_gemini && llm === 'gemini')) {
        templateBase.planning.userPrompt = arrayAsText([
            '',
            '{{last}}',
            '',
            '{{mission}}',
            '',
            '{{mainKeyMission}}',
            '',
            '{{deepThinkingPlan}}',
            '',
            '<Instructions>',
            '  <Rule>Consider the mission and the current progress so far.</Rule>',
            '  <Rule>Determine what to do next logically.</Rule>',
            '  <Rule>Skip optional tasks.</Rule>',
            '  <Rule>Do not include code.</Rule>',
            '  <Rule>You can NOT interact with the user.</Rule>',
            `  <Rule>Respond in one sentence in {{languageFullName}}.</Rule>`,
            '</Instructions>',
            '',
            'Tell me what task to perform next right away!',
        ]);
        templateBase.planning.systemPrompt = arrayAsText([
            "You are a Code Interpreter Agent.",
            `You can solve the mission with Python code or Function calling Tools.`,
            `You are a secretary who establishes a plan for the next task to complete the mission, considering the progress so far and the results of previous tasks. `,
            `Exclude code or unnecessary content and respond with only one sentence in {{languageFullName}}. Omit optional tasks.`,
            '',
            '{{customRulesForCodeGenerator}}',
            '',
        ]);

    }


    templateBase.evaluator = {};
    templateBase.evaluator.userPrompt = arrayAsText([
        '{{last}}',
        '',
        '{{mainKeyMission}}',
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
        '<OutputFormat>',
        '```json',
        '{ "evaluation": "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED", "reason": "Explain the reason for the verdict in {{languageFullName}} of short length" }',
        '```',
        '</OutputFormat>',
        ``,
        `**Refer closely to the previous output, as it contains key clues for determining success or failure**.`,
        ``,
        `Determine mission completion and decide next steps.`,
    ]);
    templateBase.evaluator.systemPrompt = arrayAsText([
        'As a computer task execution agent, you perform the necessary tasks to rigorously and logically verify and evaluate whether the MISSION has been fully completed.',
        'If sufficient OUTPUT for verification exists and the mission is deemed complete, respond with ENDOFMISSION. If not, respond with NOTSOLVED.',
        'If the mission is impossible to solve, respond with GIVEUPTHEMISSION.',
        '',
        '<Mission>',
        '{{mission}}',
        '</Mission>',
        '',
        '{{customRulesForEvaluator}}',
        '',
        '<OutputFormat>',
        '```json',
        '{ "evaluation": "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED", "reason": "Explain the reason for the verdict in {{languageFullName}} of short length" }',
        '```',
        '</OutputFormat>',
        '',
    ]);
    if (llm === 'gemini') {
        templateBase.evaluator.systemPrompt = arrayAsText([
            'As a computer task execution agent, you perform the necessary tasks to rigorously and logically verify and evaluate whether the MISSION has been completely accomplished.',
            'If sufficient OUTPUT for verification exists and the mission is deemed complete, respond with ENDOFMISSION; otherwise, respond with NOTSOLVED.',
            '',
            '<Mission>',
            '{{mission}}',
            '</Mission>',
            '',
            '{{customRulesForEvaluator}}',
            '',
            '<OutputFormat>',
            '```json',
            '{ "evaluation": "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED", "reason": "Explain the reason for the verdict in {{languageFullName}} of short length" }',
            '```',
            '</OutputFormat>',
            '',
        ]);
    } else if (llm === 'claude') {
        templateBase.evaluator.systemPrompt = arrayAsText([
            'As a computer task execution agent, you perform the necessary tasks to rigorously and logically verify and evaluate whether the MISSION has been completely accomplished.',
            'If sufficient OUTPUT for verification exists and the mission is deemed complete, respond with ENDOFMISSION; otherwise, respond with NOTSOLVED.',
            '',
            '<Mission>',
            '{{mission}}',
            '</Mission>',
            '',
            '{{customRulesForEvaluator}}',
            '',
        ]);
    }

    templateBase.codeGenerator = {};
    templateBase.codeGenerator.userPrompt = arrayAsText([
        '',
        '{{last}}',
        '',
        '{{evaluationText}}',
        '',
        '{{whatdidwedo}}',
        '',
        '{{deepThinkingPlan}}',
        '',
        '{{whattodo}}',
        '',
        '{{mainKeyMission}}',
        '',
        'Make the code.',
    ]);
    templateBase.codeGenerator.systemPrompt = arrayAsText([
        "You are a Code Interpreter Agent.",
        `You can solve the mission with Javascript or Python code or Function calling Tools.`,
        "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION.",
        '',
        '<MainMission>',
        '{{mission}}',
        '</MainMission>',
        '',
        '<SubMission>',
        '{{whattodo}}',
        '</SubMission>',
        '',
        '{{customRulesForCodeGenerator}}',
        '',
        '<OutputFormat>',
        '  ```python',
        '  (..code..)',
        '  ```',
        '</OutputFormat>',
        '',
        '<Tools>',
        '{{tools}}',
        '</Tools>',
        '',
        '<ToolsUsageInCode>',
        '  - If you need to use tools in the code, use `default_api` class.',
        '  - The `default_api` class is already set up in the code environment so that you can just use it like `print(default_api.tool_name(name=value, name=value, ...))`. If you want to use a tool, write your code using this class.',
        '  - Make `default_api` methods work seamlessly with other code.',
        '  - Mind the **return types** when using `default_api` methods.',
        '</ToolsUsageInCode>',
    ]);
    if ((!envConst.whether_to_tool_use_in_gemini && llm === 'gemini')) {
        templateBase.codeGenerator.systemPrompt = arrayAsText([
            "You are a Code Interpreter Agent.",
            `You can solve the mission with Python code or Function calling Tools.`,
            "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION. Write a Python code for execution.",
            '',
            '<MainMission>',
            '{{mission}}',
            '</MainMission>',
            '',
            '<SubMission>',
            '{{whattodo}}',
            '</SubMission>',
            '',
            '{{customRulesForCodeGenerator}}',
            '',
            '<PythonCodeGenerationRules>',
            '  - Do not repeat tasks that have already been performed in previous steps.',
            '  - The code must be a complete, executable Python file.',
            '  - Use `print` to display status values and progress at each step.',
            '  - Print all results that serve as a basis for the agent performing the task.',
            '  - Print justification for success or failure at every line of code execution.',
            '  - Use `subprocess` when executing shell commands.',
            '  - The process must be terminated after code execution.',
            '  - Do not hardcode data in the source code.',
            '  - Skip optional tasks.',
            '</PythonCodeGenerationRules>',
            '',
            '<OutputFormat>',
            '  ```python',
            '  (..code..)',
            '  ```',
            '</OutputFormat>',
        ])
        templateBase.codeGenerator.userPrompt = arrayAsText([
            '',
            '{{last}}',
            '',
            '{{evaluationText}}',
            '',
            '{{whatdidwedo}}',
            '',
            '{{deepThinkingPlan}}',
            '',
            '{{whattodo}}',
            '',
            '{{mainKeyMission}}',
            '',
            'Make the Python code.',
        ]);
    } else if ((envConst.whether_to_tool_use_in_gemini && llm === 'gemini')) {
        templateBase.codeGenerator.systemPrompt = arrayAsText([
            "You are a Code Interpreter Agent.",
            `You can solve the mission with Python code or Function calling Tools.`,
            "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION.",
            '',
            '<MainMission>',
            '{{mission}}',
            '</MainMission>',
            '',
            '<SubMission>',
            '{{whattodo}}',
            '</SubMission>',
            '',
            '{{customRulesForCodeGenerator}}',
            '',
            '<Tools>',
            '{{tools}}',
            '</Tools>',
            '',
            '<ToolsUsageInCode>',
            '  - If you need to use tools in the code, use `default_api` class.',
            '  - The `default_api` class is already set up in the code environment so that you can just use it like `print(default_api.tool_name(name=value, name=value, ...))`. If you want to use a tool, write your code using this class.',
            '  - Make `default_api` methods work seamlessly with other code.',
            '  - Mind the **return types** when using `default_api` methods.',
            '</ToolsUsageInCode>',
            '',
            '<Reminder>',
            // '- Remeber that you can not use `default_api` in the code.',
            '- Remeber that you can not use `input` for confirmation in the code.',
            '- If the task can be accomplished with tools, select from the available tools.',
            '</Reminder>',
        ]);
        templateBase.codeGenerator.userPrompt = arrayAsText([
            '',
            '{{last}}',
            '',
            '{{evaluationText}}',
            '',
            '{{whatdidwedo}}',
            '',
            '{{deepThinkingPlan}}',
            '',
            '{{whattodo}}',
            '',
            '{{mainKeyMission}}',
            '',
            'Make the Python code.',
        ]);
    } else if (llm === 'claude') {
        templateBase.codeGenerator.systemPrompt = arrayAsText([
            "You are a Code Interpreter Agent.",
            `You can solve the mission with Javascript or Python code or Function calling Tools.`,
            "As a computer task execution agent, it performs the necessary tasks to carry out the SUB MISSION in order to complete the MAIN MISSION.",
            '',
            '<MainMission>',
            '{{mission}}',
            '</MainMission>',
            '',
            '<SubMission>',
            '{{whattodo}}',
            '</SubMission>',
            '',
            '{{customRulesForCodeGenerator}}',
            '',
            '<Tools>',
            '{{tools}}',
            '</Tools>',
            '',
            '<ToolsUsageInCode>',
            '  - If you need to use tools in the code, use `default_api` class.',
            '  - The `default_api` class is already set up in the code environment so that you can just use it like `print(default_api.tool_name(name=value, name=value, ...))`. If you want to use a tool, write your code using this class.',
            '  - Make `default_api` methods work seamlessly with other code.',
            '  - Mind the **return types** when using `default_api` methods.',
            '</ToolsUsageInCode>',
        ]);

    } else {
        // templateBase.codeGenerator.systemPrompt = ;
    }


    templateBase.reviewMission = {};
    templateBase.reviewMission.systemPrompt = arrayAsText([
        'You are a prompt-engineer.',
        'Your task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent.'
    ]);
    templateBase.reviewMission.userPrompt = arrayAsText([
        '{{multiLineMission}}',
        '',
        '------',
        'Make the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.',
        '',
        'Response **only the prompt**.'
    ]);
    if (llm === 'gemini') {
        templateBase.reviewMission.userPrompt = arrayAsText([
            '{{multiLineMission}}',
            '',
            '------',
            'Make the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.',
            '',
            '<WritingGuidelines>',
            '  <Rule>Write only the core content in a concise manner.</Rule>',
            '  <Rule>Do not include code.</Rule>',
            '  <Rule>You can NOT interact with the user.</Rule>',
            '</WritingGuidelines>',
            '',
            'Response **only the prompt**.'
        ]);
    }

    // const templateBase = {
    //     codeGenerator: {
    //         // systemPrompt: arrayAsText([
    //         //     'You are a prompt-engineer.',
    //         //     'Your task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent.'
    //         // ]),
    //         // userPrompt: arrayAsText([
    //         //     '{{multiLineMission}}',
    //         // ]),
    //     },
    //     reviewMission: {
    //     },
    // }
    return templateBase;

}
export async function supportLanguage() {
    const llm = await getConfiguration('llm');
    return ({
        claude: { js: true, python: true, bash: true },
        groq: { js: false, python: true, bash: false },
        deepseek: { js: false, python: true, bash: false },
        openai: { js: false, python: true, bash: false },
        ollama: { js: false, python: true, bash: false },
        gemini: { js: false, python: true, bash: false },
    })[llm] || { js: false, python: false, bash: false };
}
export async function toolSupport() {
    const llm = await getConfiguration('llm');
    return ({
        claude: true,
        groq: false,
        deepseek: false,
        openai: false,
        ollama: false,
        gemini: false,
    })[llm] || false;
}
export async function loadConfiguration(justReturnDefault = false) {
    let config = {
        claudeApiKey: "",
        groqApiKey: "",
        deepseekApiKey: "",
        openaiApiKey: "",
        ollamaApiKey: "",
        geminiApiKey: "",
        geminiModel: "gemini-2.0-flash", // 원하는 모델 e.g. gemini-2.0-flash, gemini-2.0-flash-latest
        model: "claude-3-5-haiku-20241022",
        deepseekModel: "deepseek-chat",
        openaiModel: "gpt-4o-mini",
        ollamaModel: "qwen2.5:14b",
        groqModel: "llama-3.3-70b-versatile",
        llm: "claude",
        maxIterations: 0,
        dockerImage: 'my-node-ubuntu',
        useDocker: true, // Docker 사용 여부 (false: 도커 아닌 웹컨테이너 사용, true: 도커 사용함)
        keepDockerContainer: true,
        dockerPath: '', // 도커 경로
        dockerWorkDir: '/home/ubuntu/work',
        overwriteOutputDir: false, // 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀)
        trackLog: false,
        ollamaEndpoint: 'http://localhost:11434',
        autoCodeExecution: false, // 자동 코드 실행 여부 (false: 자동 실행 안함, true: 자동 실행함)
        planEditable: false, // AI가 판단한 계획 수정 가능 여부 (false: 수정 불가능, true: 수정 가능)
        captionLanguage: getSystemLangCode(), // 캡션 언어 (ko: 한국어, en: 영어)
        customRulesForCodeGenerator: '', // 사용자 정의 규칙
        customRulesForEvaluator: '', // 사용자 정의 규칙
        nodePath: '', // Node.js 경로
        npmPath: '', // npm 경로
        pythonPath: '', // Python 경로
    }
    if (justReturnDefault) return config;
    let dataType = {
        claudeApiKey: "string",
        groqApiKey: "string",
        deepseekApiKey: "string",
        openaiApiKey: "string",
        ollamaApiKey: "string",
        geminiApiKey: "string",
        geminiModel: "string", // 원하는 모델 e.g. gemini-2.0-flash, gemini-2.0-flash-latest
        model: "string",
        deepseekModel: "string",
        openaiModel: "string",
        ollamaModel: "string",
        groqModel: "string",
        llm: "string",
        maxIterations: "number",
        dockerImage: 'string',
        useDocker: "boolean", // Docker 사용 여부 (false: 도커 아닌 웹컨테이너 사용, true: 도커 사용함)
        keepDockerContainer: "boolean",
        dockerPath: 'string', // 도커 경로
        dockerWorkDir: 'string',
        overwriteOutputDir: "boolean", // 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀)
        trackLog: "boolean",
        ollamaEndpoint: 'string',
        autoCodeExecution: "boolean", // 자동 코드 실행 여부 (false: 자동 실행 안함, true: 자동 실행함)
        planEditable: "boolean", // AI가 판단한 계획 수정 가능 여부 (false: 수정 불가능, true: 수정 가능)
        captionLanguage: "string", // 캡션 언어 (ko: 한국어, en: 영어)
        customRulesForCodeGenerator: "string", // 사용자 정의 규칙
        customRulesForEvaluator: "string", // 사용자 정의 규칙
        nodePath: "string", // Node.js 경로
        npmPath: "string", // npm 경로
        pythonPath: "string", // Python 경로
    }
    let config_ = {};
    try {
        const configPath = getConfigFilePath();
        const data = await fs.promises.readFile(configPath, 'utf8');
        config_ = JSON.parse(data);
        if (!config_ || (config_ && config_.constructor !== Object)) config_ = {};
    } catch { }
    for (let key in config) {
        if (config_[key] === undefined) config_[key] = config[key];
    }
    {
        if (!config_.dockerPath) {
            config_.dockerPath = await getDockerPath();
            await setConfiguration('dockerPath', config_.dockerPath, false);
        }
        if (!config_.nodePath) {
            config_.nodePath = await getNodePath();
            await setConfiguration('nodePath', config_.nodePath, false);
        }
        if (!config_.npmPath) {
            config_.npmPath = await getNPMPath();
            await setConfiguration('npmPath', config_.npmPath, false);
        }
        if (!config_.pythonPath) {
            config_.pythonPath = await getPythonPath();
            await setConfiguration('pythonPath', config_.pythonPath, false);
        }
    }
    for (let key in config_) {
        if (dataType[key]) {
            if (dataType[key] === 'string') {
                config_[key] = `${config_[key]}`;
            } else if (dataType[key] === 'number') {
                config_[key] = Number(config_[key]);
            } else if (dataType[key] === 'boolean') {
                config_[key] = !!config_[key];
            }
        }
    }

    return config_;
}
export async function getToolCode(toolName) {
    // `                saveData = loaded`,
    // `                randomAlphabetFileName = '${Math.random().toString(36).substring(2, 7)}.txt'`,
    // `                os.makedirs('/tmpmem/', exist_ok=True)`,
    // `                with open('/tmpmem/'+randomAlphabetFileName, 'w') as f:`,
    // `                    if isinstance(saveData, str):`,
    // `                        f.write(saveData)`,
    // `                    elif isinstance(saveData, dict):`,
    // `                        f.write(json.dumps(saveData))`,
    // `                    elif isinstance(saveData, list):`,
    // `                        f.write(json.dumps(saveData))`,
    // `                    else:`,
    // `                        f.write(str(saveData))`,
    // `                print('📄 The return value of ${toolName} is saved in file /tmpmem/'+randomAlphabetFileName)`,    
    let code = await (async () => {
        try {
            const toolCodeFilePath = getCodePath(`tool_code/${toolName}.js`);
            const toolCode = await fs.promises.readFile(toolCodeFilePath, 'utf8');
            return toolCode;
        } catch {
            try {
                const data = await getCustomToolList(toolName);
                return data[toolName].js;
            } catch { }
        }
        return '';
    })();
    if (!code) return code;
    // let tmpmemPath = '/tmpmem/';
    // let randomAlphabetFileName = `${Math.random().toString(36).substring(2, 7)}.txt`;
    let tmpmem = !(await getConfiguration('useDocker')) ? getAppPath('/tmpmem/') : '/tmpmem/';
    tmpmem = tmpmem.split('\\').join('/');
    let code__ = `
        (async (params)=>{
            try {
                const savingAvailable = false;
                const fs = require('fs');
                let tmpmemPath = '${tmpmem}';
                if(savingAvailable) if(!fs.existsSync(tmpmemPath)) fs.mkdirSync(tmpmemPath, { recursive: true });
                let saveData = await (${code})(params);
                let returnData = saveData;
                if(!savingAvailable) return returnData;
                saveData = saveData === undefined ? '' : saveData;
                saveData = saveData === null ? '' : saveData;
                if (saveData.constructor === String) {
                    let randomAlphabetFileName = Math.random().toString(36).substring(2, 7)+'.txt';
                    fs.writeFileSync(tmpmemPath + randomAlphabetFileName, saveData);
                    console.log('- The return value of ${toolName} is saved in file /tmpmem/'+randomAlphabetFileName);
                } else if (saveData.constructor === Object || saveData.constructor === Array) {
                    let randomAlphabetFileName = Math.random().toString(36).substring(2, 7)+'.txt';
                    fs.writeFileSync(tmpmemPath + randomAlphabetFileName, JSON.stringify(saveData));
                    console.log('- The return value of ${toolName} is saved in file /tmpmem/'+randomAlphabetFileName);
                } else {
                    let randomAlphabetFileName = Math.random().toString(36).substring(2, 7)+'.txt';
                    fs.writeFileSync(tmpmemPath + randomAlphabetFileName, saveData+'');
                    console.log('- The return value of ${toolName} is saved in file /tmpmem/'+randomAlphabetFileName);
                }
                return returnData;
            } catch (error) {
                console.log(error)
                return '';
            }
        })
    `;
    // console.log(code__);
    return code__;
}
//----------------------
export async function cloneCustomTool() {
    const customPath = '.aiexeauto/custom_tools';
    const workspace = getHomePath(customPath);
    if (fs.existsSync(workspace)) {
        const source = getCodePath(`custom_tools/Guide-Docs.txt`);
        const target = getHomePath(`${customPath}/Guide-Docs.txt`);
        if (ensureAppsHomePath(target)) {
            await fs.promises.copyFile(source, target);
        } else {
            console.log(`[cloneCustomTool.002!] cp - ${source} ${target}`);
        }
        return;
    }
    fs.mkdirSync(workspace, { recursive: true });
    const customToolPath = getCodePath(`custom_tools/`);
    const customToolList = await fs.promises.readdir(customToolPath);
    for (const tool of customToolList) {
        const source = getCodePath(`custom_tools/${tool}`);
        const target = getHomePath(`${customPath}/${tool}`);
        if (ensureAppsHomePath(target)) {
            await fs.promises.copyFile(source, target);
        } else {
            console.log(`[cloneCustomTool.001!] cp - ${source} ${target}`);
        }
    }
}
export async function getCustomToolList(toolName) {
    const candidateList = {};
    try {
        const customPath = '.aiexeauto/custom_tools';
        const workspace = getHomePath(customPath);
        if (!(await fs.promises.stat(workspace)).isDirectory()) return candidateList;
        const customToolList = await fs.promises.readdir(workspace);
        for (const tool of customToolList) {
            if (!tool.endsWith('.json')) continue;
            const name = tool.replace(/\.json$/, '');
            if (toolName && toolName !== name) continue;
            const codePath = getHomePath(customPath + '/' + name + '.js');
            if (!(await fs.promises.stat(codePath)).isFile()) continue;
            const toolSpecPath = getHomePath(`${customPath}/${tool}`);
            const data = await fs.promises.readFile(toolSpecPath, 'utf8');
            const parsed = JSON.parse(data);
            if (!parsed.activate) continue;
            const toolspec = JSON.parse(JSON.stringify(parsed));
            delete toolspec.instructions;
            toolspec.input_schema = toolspec.input;
            delete toolspec.input;
            toolspec.name = name;
            candidateList[name] = {};
            candidateList[name].js = await fs.promises.readFile(codePath, 'utf8');
            candidateList[name].spec = toolspec;
        }
    } catch { }
    return candidateList;
}
export async function makeMdWithSpec(name) {
    const parsed = await getToolSpec(name);
    // console.log('DDDDDDDDDDDDDD', parsed);
    if (!parsed) return '';
    let rule = Object.keys(parsed.input_schema[0]).map(key => {
        let type = parsed.input_schema[0][key].constructor.name
        return `${key}:${type}`;
    }).join(', ');
    let markdownDocument = [
        `## \`${name}\` function tool`,
        indention(1, `* Use: ${parsed.description}`, 3), // `${parsed.description}`
        parsed.return_description && parsed.return_type ? indention(1, '* Spec: ' + `result:${parsed.return_type} = default_api.${name}(${rule})`, 3) : '',
        // parsed.return_description && parsed.return_type ? indention(1, '  - ' + `result:${parsed.return_type} = default_api.${name}(${rule})`, 3) : '',
        parsed.return_description && parsed.return_type ? indention(1, `* Return: \`${parsed.return_type}\` type, ${parsed.return_description}`, 3) : '',
        // parsed.return_description && parsed.return_type ? indention(1, '  - ' + `${parsed.return_description}`, 3) : '',
        parsed.instructions && parsed.instructions.length > 0 ? indention(1, '* Instructions:', 3) : '',
        parsed.instructions && indention(1, parsed.instructions.map(instruction => `  - ${instruction}`).join('\n'), 3),
    ].filter(line => line?.trim()).join('\n');
    markdownDocument = indention(1, markdownDocument, 3);
    return markdownDocument;
}
//------------------------------------------------
export async function getPromptToolPath() {
    const llm = await getConfiguration('llm');
    // const useDocker = await getConfiguration('useDocker');
    const container = true ? 'docker' : 'localenv';
    let candidate1 = getCodePath(`prompt_tools/${container}/default`);
    let candidate2 = getCodePath(`prompt_tools/${container}/${llm}`);
    let list = [];
    if (await is_dir(candidate2)) list.push(candidate2);
    if (await is_dir(candidate1)) list.push(candidate1);
    return list;
}
export async function getToolList() {
    let list = await getPromptToolPath();
    let rlist = [];
    for (const path of list) {
        const toolList = await fs.promises.readdir(path);
        let clist = toolList.filter(tool => tool.endsWith('.toolspec.json')).map(tool => tool.replace(/\.toolspec\.json$/, ''));
        rlist.push(...clist);
    }
    Object.keys(await getCustomToolList()).forEach(tool => {
        rlist.push(tool);
    });

    const useDocker = await getConfiguration('useDocker');
    const list_ = [...new Set(rlist)];
    if (useDocker) {
        return list_;
    } else {
        let nlist = [];
        for (const tool of list_) {
            const spec = await getToolSpec(tool);
            if (!spec.tooling_in_realworld) continue;
            nlist.push(tool);
        }
        return nlist;
    }
}
export async function getToolSpec(toolName) {
    const pathList = await getPromptToolPath();
    let data;
    for (const path of pathList) {
        const toolSpecPath = `${path}/${toolName}.toolspec.json`;
        if (!(await is_file(toolSpecPath))) continue;
        const toolSpec = await fs.promises.readFile(toolSpecPath, 'utf8');
        data = JSON.parse(toolSpec);
    }
    data = data || (await getCustomToolList(toolName))[toolName].spec;
    if (data) {
        if (!data.input_schema) data.input_schema = data.input;
        if (!data.input) data.input = data.input_schema;
    }
    return data;
}
export async function getToolData(toolName) {
    let paths = await getPromptToolPath();
    for (const path of paths) {
        const toolSpecPath = `${path}/${toolName}.toolspec.json`;
        if (!(await is_file(toolSpecPath))) continue;
        const toolSpec = await fs.promises.readFile(toolSpecPath, 'utf8');
        const prompt = await makeMdWithSpec(toolName);
        const spec = JSON.parse(toolSpec);
        const activate = !!spec.activate;//.includes(llm);
        const npm_package_list = spec.npm_package_list;
        const return_description = spec.return_description;
        const return_type = spec.return_type;
        const only_use_in_code = spec.only_use_in_code;
        const tooling_in_realworld = spec.tooling_in_realworld;
        delete spec.activate;
        delete spec.npm_package_list;
        delete spec.return_description;
        delete spec.return_type;
        delete spec.only_use_in_code;
        delete spec.instructions;
        delete spec.tooling_in_realworld;
        if (!activate) return null;
        return {
            prompt,
            spec,
            npm_package_list,
            return_description,
            return_type,
            only_use_in_code,
            tooling_in_realworld
        };
    }
    let data = await getCustomToolList(toolName);
    const spec = data[toolName].spec;
    const activate = !!spec.activate;//.includes(llm);
    const npm_package_list = spec.npm_package_list;
    const return_description = spec.return_description;
    const return_type = spec.return_type;
    const only_use_in_code = spec.only_use_in_code;
    const tooling_in_realworld = spec.tooling_in_realworld;
    delete spec.activate;
    delete spec.npm_package_list;
    delete spec.return_description;
    delete spec.return_type;
    delete spec.only_use_in_code;
    delete spec.instructions;
    delete spec.tooling_in_realworld;
    if (!activate) return null;
    return {
        prompt: await makeMdWithSpec(toolName),
        spec,
        npm_package_list,
        return_description,
        return_type,
        only_use_in_code,
        tooling_in_realworld
    };
}
export function getCodePath(itemPath) {
    return getAbsolutePath(path.join(__dirname, itemPath));
}
export function getAppPath(itemPath) {
    const workspace = getHomePath('.aiexeauto/workspace');
    if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
    return getAbsolutePath(path.join(workspace, itemPath));
}
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}
export async function findAvailablePort(startPort) {

    let port = startPort;
    while (!(await isPortAvailable(port))) {
        port++;
        if (port > 65535) {
            throw new Error('No available ports found.');
        }
    }
    return port;
}
export function getAbsolutePath(itemPath) {
    if (!itemPath) return;
    if (!path.isAbsolute(itemPath)) {
        return path.join(process.cwd(), itemPath);
    }
    return itemPath;
}
export async function flushFolder(folderList) {
    for (const folder of folderList) {
        try {
            const files = await fs.promises.readdir(folder);
            if (files.length === 0) await fs.promises.rmdir(folder);
        } catch (error) { }
    }
}
export function validatePath(path, pathType) {
    const invalidChars = isWindows() ? ['"', "'"] : ['"', "'", ' '];
    if (invalidChars.some(char => path.includes(char))) {
        if (isWindows()) {
            throw new Error(`${pathType} 경로에는 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`);
        } else {
            throw new Error(`${pathType} 경로에는 공백(" "), 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`);
        }
    }
}
export function getOS() {
    return process.platform;
}
export function isWindows() {
    return getOS() === 'win32';
}
export function getOSPathSeparator() {
    return isWindows() ? '\\' : '/';
}

export async function prepareOutputDir(outputDir, overwrite, doNotCreate = false) {
    // 끝의 모든 슬래시 제거
    let baseDir = outputDir;
    while (baseDir.endsWith('/') || baseDir.endsWith('\\')) {
        baseDir = baseDir.slice(0, -1).trim();
    }

    // 사용 가능한 디렉토리명 찾기
    let targetDir = baseDir;
    if (!overwrite) {
        let suffix = 1;

        while (fs.existsSync(targetDir)) {
            targetDir = `${baseDir}_${suffix++}`;
        }

        // 디렉토리 생성
        if (!doNotCreate) await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    } else {
        if (ensureAppsHomePath(targetDir)) {
            console.log(`[remove.005] rm - ${targetDir}`);
            await fs.promises.rm(targetDir, { recursive: true, force: true });
        } else {
            console.log(`[remove.005!] rm - ${targetDir}`);
        }
        if (!doNotCreate) await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    }
}

// export function convertJsonToResponseFormat(struct) {
//     const getType = (value) => {
//         if (value === null) return "null";
//         if (Array.isArray(value)) return "array";
//         if (typeof value === "boolean") return "boolean";
//         if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
//         if (typeof value === "string") return "string";
//         if (typeof value === "object") return "object";
//         return "unknown";
//     };

//     const generateSchema = (data) => {
//         const dataType = getType(data);

//         if (dataType === "object") {
//             const properties = {};
//             const required = [];
//             for (const key in data) {
//                 if (data.hasOwnProperty(key)) {
//                     properties[key] = generateSchema(data[key]);
//                     required.push(key);
//                 }
//             }
//             return {
//                 type: "object",
//                 properties: properties,
//                 required: required
//             };
//         } else if (dataType === "array") {
//             if (data.length === 0) {
//                 return { type: "array", items: {} };
//             }
//             const itemSchemas = data.map(item => generateSchema(item));
//             const firstItemSchemaStr = JSON.stringify(itemSchemas[0]);
//             const allSame = itemSchemas.every(
//                 itemSchema => JSON.stringify(itemSchema) === firstItemSchemaStr
//             );
//             return {
//                 type: "array",
//                 items: allSame ? itemSchemas[0] : {}
//             };
//         } else {
//             return { type: dataType };
//         }
//     };

//     const schema = generateSchema(struct);
//     schema["$schema"] = "http://json-schema.org/draft-07/schema#";
//     schema["additionalProperties"] = false;

//     return {
//         type: "json_schema",
//         json_schema: {
//             name: "response",
//             schema: schema,
//             strict: true
//         }
//     };
// }

// // 함수 호출 예시
// // console.log(convertJsonToResponseFormat({ result: true }));











































export function sortKeyOfObject(obj) {
    // 배열인 경우, 각 요소를 재귀적으로 처리
    if (Array.isArray(obj)) {
        return obj.map(item => sortKeyOfObject(item));
    }

    // 객체인 경우, key를 정렬한 뒤 재귀적으로 처리
    if (obj !== null && typeof obj === 'object') {
        const sortedObject = {};
        const keys = Object.keys(obj).sort();

        keys.forEach(key => {
            sortedObject[key] = sortKeyOfObject(obj[key]);
        });

        return sortedObject;
    }

    // 기본 자료형(문자열, 숫자 등)은 그대로 반환
    return obj;
}



export function convertJsonToResponseFormat(struct, descriptions = {}) {
    const getType = (value) => {
        if (value === null) return "null";
        if (Array.isArray(value)) return "array";
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
        if (typeof value === "string") return "string";
        if (typeof value === "object") return "object";
        return "unknown";
    };

    const generateSchema = (data, desc) => {
        const dataType = getType(data);
        let schema = {};

        if (dataType === "object") {
            const properties = {};
            const required = [];
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    const propertyDesc = desc && desc[key] ? desc[key] : {};
                    properties[key] = generateSchema(data[key], propertyDesc);
                    required.push(key);
                }
            }
            schema = {
                type: "object",
                properties: properties,
                required: required
            };
        } else if (dataType === "array") {
            if (data.length === 0) {
                schema = { type: "array", items: {} };
            } else {
                const itemSchemas = data.map(item => generateSchema(item, desc));
                const firstItemSchemaStr = JSON.stringify(itemSchemas[0]);
                const allSame = itemSchemas.every(
                    itemSchema => JSON.stringify(itemSchema) === firstItemSchemaStr
                );
                schema = {
                    type: "array",
                    items: allSame ? itemSchemas[0] : {}
                };
            }
        } else {
            schema = { type: dataType };
        }

        // Add description if provided
        if (desc && typeof desc === 'string') {
            schema.description = desc;
        }

        return schema;
    };

    const schema = generateSchema(struct, descriptions);
    schema["$schema"] = "http://json-schema.org/draft-07/schema#";
    schema["additionalProperties"] = false;

    return {
        type: "json_schema",
        json_schema: {
            name: "response",
            schema: schema,
            strict: true
        }
    };
}

// 함수 호출 예시
// console.log(convertJsonToResponseFormat({ result: true }, { result: "description" }));
// function adsfioajsfij(){
//     asdfsdf;
// }