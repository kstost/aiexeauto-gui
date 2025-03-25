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
import { virtualPython, is_file, is_dir } from './codeExecution.js';
import { getDockerPath } from './executableFinder.js';
import { getNodePath, getNPMPath, getPythonPath } from './executableFinder.js';
import { connectAllServers, closeAllServers, convertToolsInfoToAIEXEStyle, getAllToolNames, getToolsClientByToolName, getToolsInfoByToolName, getMCPNameByToolName } from './mcp.js';
import { homedir } from 'os';
export async function getEnv() {
    /*
                    env > ~/.aiexeauto/.env
                    Get-ChildItem Env: | ForEach-Object { "$($_.Name)=$($_.Value)" } > ~/.aiexeauto/.env
    */
    try {
        // Read the .env file from the home directory
        const homePath = homedir();
        const envFilePath = `${homePath}/.aiexeauto/.env`;

        // Read the file contents as a string
        const data = await fs.promises.readFile(envFilePath, 'utf8');

        // Parse the file line by line
        const lines = data.split('\n');
        const envObject = {};

        // Process each line
        for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;

            // Handle lines without an equals sign
            if (!line.includes('=')) {
                envObject[line.trim()] = '';
                continue;
            }

            // Split by the first equals sign
            const separatorIndex = line.indexOf('=');
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();

            // Add to the environment object
            envObject[key] = value;
        }

        return envObject;
    } catch (error) {
        // console.error('Error reading or parsing .env file:', error);
        // throw error;
    }
    return {};
}

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
    return pathSanitizing(os.homedir());
}
export function getHomePath(itemPath) {
    let pt = path.join(getHomeDir(), itemPath);
    return pathSanitizing(pt);
}
export function getConfigFilePath() {
    const folder = getHomePath('.aiexeauto');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    return path.join(folder, '.aiexeauto.cokac.config.json');
}

export async function setConfiguration(key, value, readByMethod = true) {
    const configPath = getConfigFilePath();
    let config
    if (readByMethod) config = await loadConfiguration();
    if (!readByMethod) {
        if (await is_file(configPath)) {
        } else {
            const config = await loadConfiguration(true);
            // await writeEnsuredFile(configPath, JSON.stringify(config, null, 2));
            await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
        }
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
export async function loadPrompt(promptPath) {
    const llm = await getConfiguration('llm');
    const llmSpecificPath = getCodePath(`prompts/${promptPath}.${llm}`);
    const defaultPath = getCodePath(`prompts/${promptPath}`);

    try {
        if (await is_file(llmSpecificPath)) {
            const content = await fs.promises.readFile(llmSpecificPath, 'utf8');
            return content.split('\n');
        }
        const content = await fs.promises.readFile(defaultPath, 'utf8');
        return content.split('\n');
    } catch (error) {
        return [];
    }
}
export async function promptTemplate() {
    const promptStore = getCodePath(`prompts/`);
    const promptList = await fs.promises.readdir(promptStore);
    const templateBase = {};
    for (const prompt of promptList) {
        const splited = prompt.split('.');
        let objPoint = {};
        if (!templateBase[splited[0]]) templateBase[splited[0]] = objPoint
        else objPoint = templateBase[splited[0]];
        if (splited.length >= 2) {
            const prompt = arrayAsText(await loadPrompt(`${splited[0]}.${splited[1]}`))
            objPoint[splited[1]] = prompt;
        }
    }
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
export function debugLog(message) {
    // return;
    // const homePath = getHomePath('aiexeauto.debug.txt');
    // fs.appendFileSync(homePath, message + '\n');
}
export async function loadConfiguration(getDefault = false) {
    let config = JSON.parse(JSON.stringify(envConst.defaultConfig));
    config.captionLanguage = getSystemLangCode();
    if (getDefault) return config;
    let dataType = {};
    Object.keys(config).forEach(key => {
        if (!config[key]) return;
        if (config[key].constructor === Array) dataType[key] = 'array';
        if (config[key].constructor === Object) dataType[key] = 'object';
        if (config[key].constructor === Boolean) dataType[key] = 'boolean';
        if (config[key].constructor === Number) dataType[key] = 'number';
        if (config[key].constructor === String) dataType[key] = 'string';
        if (config[key].constructor === Function) dataType[key] = 'function';
    });
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
export function pathSanitizing(path) {
    if (!path) return '';
    path = path.split('\\').join('/');
    while (true) {
        if (path.indexOf('//') === -1) break;
        path = path.split('//').join('/');
    }
    return path;
};

export async function getToolCode(toolName) {
    let extracted = await (async () => {
        let codeData = '';
        let kind = '';
        const jsPath = getCodePath(`tool_code/${toolName}.js`);
        const pyPath = getCodePath(`tool_code/${toolName}.py`);
        const jsCode = await is_file(jsPath);
        const pyCode = await is_file(pyPath);
        if (jsCode) { codeData = await fs.promises.readFile(jsPath, 'utf8'); kind = 'js'; }
        else if (pyCode) { codeData = await fs.promises.readFile(pyPath, 'utf8'); kind = 'py'; }
        else {
            try {
                const data = await getCustomToolList(toolName);
                if (data[toolName].js) { codeData = data[toolName].js; kind = 'js'; }
                if (data[toolName].py) { codeData = data[toolName].py; kind = 'py'; }
            } catch { }
        }
        return { code: codeData, kind };
    })();
    if (!extracted.code) return {};
    let useDocker;
    let npmPath;
    let nodePath;
    let virtualPythonPath;
    useDocker = await getConfiguration('useDocker');
    if (!useDocker) npmPath = pathSanitizing(await getConfiguration('npmPath'));
    if (!useDocker) nodePath = pathSanitizing(await getConfiguration('nodePath'));
    if (!useDocker) virtualPythonPath = pathSanitizing(await virtualPython());
    let code__;
    if (extracted.kind === 'js') code__ = `
        (async (params)=>{
            if(params)params = {...params,useDocker: ${useDocker ? 'true' : 'false'}, isWindows: ${isWindows() ? 'true' : 'false'}, npmPath: '${npmPath}', virtualPythonPath: '${virtualPythonPath}', nodePath: '${nodePath}'};
            try {
                return await (${extracted.code})(params);
            } catch (error) {
                console.log(error)
                return '';
            }
        })
    `;
    if (extracted.kind === 'py') code__ = [
        `${extracted.code}`,
    ].join('\n');
    return { code: code__, kind: extracted.kind };
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
        {
            const source = getCodePath(`custom_tools/aiexe_mcp_config.json`);
            const target = getHomePath(`${customPath}/aiexe_mcp_config.json`);
            if (ensureAppsHomePath(target) && !(await is_file(target))) {
                await fs.promises.copyFile(source, target);
            } else {
                console.log(`[cloneCustomTool.002!] cp - ${source} ${target}`);
            }

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
export async function getMCPToolList(toolName_ = null) {
    let candidateList = {};
    const serverClients = singleton.serverClients;
    if (!serverClients) return candidateList;
    const toolNames = await getAllToolNames(serverClients);
    for (const toolName of toolNames) {
        if (toolName_ && toolName_ !== toolName) continue;
        const toolInfo = await getToolsInfoByToolName(serverClients, toolName)
        const result = await convertToolsInfoToAIEXEStyle(toolInfo)
        candidateList[toolName] = {
            spec: result
        };
    }
    return candidateList;
}
export async function getCustomToolList(toolName) {
    const candidateList = {};
    try {
        const customPath = '.aiexeauto/custom_tools';
        const workspace = getHomePath(customPath);
        if (!(await fs.promises.stat(workspace)).isDirectory()) return candidateList;
        const customToolList = await fs.promises.readdir(workspace);
        for (const tool of customToolList) {
            // console.log('tool$$$$$$$$$$$$$$$$$$$$$$$$$$$', tool);
            if (!tool.endsWith('.json')) continue;
            const name = tool.replace(/\.json$/, '');
            if (toolName && toolName !== name) continue;
            const codePathJS = getHomePath(customPath + '/' + name + '.js');
            const codePathPY = getHomePath(customPath + '/' + name + '.py');
            // console.log('codePathJS$$$$$$$$$$$$$$$$$$$$$$$$$$$', codePathJS);
            // console.log('codePathPY$$$$$$$$$$$$$$$$$$$$$$$$$$$', codePathPY);
            if (!(await is_file(codePathJS)) && !(await is_file(codePathPY))) continue;

            // if (!(await fs.promises.stat(codePathJS)).isFile() && !(await fs.promises.stat(codePathPY)).isFile()) continue;
            const toolSpecPath = getHomePath(`${customPath}/${tool}`);
            // console.log('toolSpecPath$$$$$$$$$$$$$$$$$$$$$$$$$$$', toolSpecPath);
            const data = await fs.promises.readFile(toolSpecPath, 'utf8');
            const parsed = JSON.parse(data);
            // console.log('parsed$$$$$$$$$$$$$$$$$$$$$$$$$$$', parsed);
            if (!parsed.activate) continue;
            const toolspec = JSON.parse(JSON.stringify(parsed));
            delete toolspec.instructions;
            toolspec.input_schema = toolspec.input;
            delete toolspec.input;
            toolspec.name = name;
            candidateList[name] = {};
            try { candidateList[name].js = await fs.promises.readFile(codePathJS, 'utf8'); } catch { }
            try { candidateList[name].py = await fs.promises.readFile(codePathPY, 'utf8'); } catch { }
            candidateList[name].spec = toolspec;
        }
    } catch { }
    return candidateList;
}
export async function makeMdWithSpec(name) {
    const parsed = await getToolSpec(name);
    if (!parsed) return '';
    let rule = Object.keys(parsed.input_schema[0]).map(key => {
        let type = parsed.input_schema[0][key].constructor.name
        return `${key}:${type}`;
    }).join(', ');
    let isFile = await is_file(getCodePath(`tool_code/${name}.js`)) || await is_file(getCodePath(`tool_code/${name}.py`));
    if (!isFile) {
        const customPath = '.aiexeauto/custom_tools';
        const codePathJS = getHomePath(customPath + '/' + name + '.js');
        const codePathPY = getHomePath(customPath + '/' + name + '.py');
        isFile = await is_file(codePathJS) || await is_file(codePathPY);
    }
    // console.log('ddddddddfsdfsdfsdf', name, isFile);
    let markdownDocument = [
        `## \`${name}\` function tool`,
        indention(1, `* Use: ${parsed.description}`, 3), // `${parsed.description}`
        isFile && parsed.return_description && parsed.return_type ? indention(1, '* Spec: ' + `result:${parsed.return_type} = default_api.${name}(${rule})`, 3) : '',
        isFile && parsed.return_description && parsed.return_type ? indention(1, `* Return: \`${parsed.return_type}\` type, ${parsed.return_description}`, 3) : '',
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
    const list = await (async () => {
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
        Object.keys(await getMCPToolList()).forEach(tool => {
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
    })();
    return list;
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
    data = data || (await getCustomToolList(toolName))?.[toolName]?.spec || (await getMCPToolList(toolName))?.[toolName]?.spec;
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
        const pip_package_list = spec.pip_package_list;
        const return_description = spec.return_description;
        const return_type = spec.return_type;
        const only_use_in_code = spec.only_use_in_code;
        const tooling_in_realworld = spec.tooling_in_realworld;
        const lazy_mode = spec.lazy_mode;
        const retrieve_mode = spec.retrieve_mode;
        const ignore_output_type = spec.ignore_output_type;
        const environment_variables = spec.environment_variables;
        delete spec.activate;
        delete spec.npm_package_list;
        delete spec.pip_package_list;
        delete spec.return_description;
        delete spec.return_type;
        delete spec.only_use_in_code;
        delete spec.instructions;
        delete spec.tooling_in_realworld;
        delete spec.lazy_mode;
        delete spec.retrieve_mode;
        delete spec.ignore_output_type;
        delete spec.environment_variables;
        if (!activate) return null;
        return {
            prompt,
            spec,
            npm_package_list,
            pip_package_list,
            return_description,
            return_type,
            only_use_in_code,
            tooling_in_realworld,
            lazy_mode,
            retrieve_mode,
            ignore_output_type,
            environment_variables
        };
    }
    let spec = (await getCustomToolList(toolName))?.[toolName]?.spec || (await getMCPToolList(toolName))?.[toolName]?.spec;
    if (!spec) return null;
    const activate = !!spec.activate;//.includes(llm);
    const npm_package_list = spec.npm_package_list;
    const pip_package_list = spec.pip_package_list;
    const return_description = spec.return_description;
    const return_type = spec.return_type;
    const only_use_in_code = spec.only_use_in_code;
    const tooling_in_realworld = spec.tooling_in_realworld;
    const lazy_mode = spec.lazy_mode;
    const retrieve_mode = spec.retrieve_mode;
    const ignore_output_type = spec.ignore_output_type;
    const environment_variables = spec.environment_variables;
    delete spec.activate;
    delete spec.npm_package_list;
    delete spec.pip_package_list;
    delete spec.return_description;
    delete spec.return_type;
    delete spec.only_use_in_code;
    delete spec.instructions;
    delete spec.tooling_in_realworld;
    delete spec.lazy_mode;
    delete spec.retrieve_mode;
    delete spec.ignore_output_type;
    delete spec.environment_variables;
    if (!activate) return null;
    return {
        prompt: await makeMdWithSpec(toolName),
        spec,
        npm_package_list,
        pip_package_list,
        return_description,
        return_type,
        only_use_in_code,
        tooling_in_realworld,
        lazy_mode,
        retrieve_mode,
        ignore_output_type,
        environment_variables
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




























// 편집 거리(Levenshtein Distance) 계산 함수
function getEditDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    // 2차원 배열(DP 테이블) 준비
    const dp = Array.from({ length: len1 + 1 }, () =>
        Array(len2 + 1).fill(0)
    );

    // 초기값 설정
    for (let i = 0; i <= len1; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        dp[0][j] = j;
    }

    // dp 테이블 채우기
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,    // 삭제
                dp[i][j - 1] + 1,    // 삽입
                dp[i - 1][j - 1] + cost // 교체
            );
        }
    }

    return dp[len1][len2];
}

export async function isSequentialthinking() {
    const candidates = await getToolList();
    return candidates.includes('sequentialthinking');
}

// getSimilar 함수
export async function getSimilar(target) {
    const candidates = await getToolList();
    let bestMatch = null;
    let minDistance = Infinity;

    for (let c of candidates) {
        const distance = getEditDistance(target, c);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = c;
        }
    }

    return bestMatch;
}

// // 예시
// const result = getSimilar('bana1na', ['apple', 'mango', 'banana', 'php']);
// console.log(result); // "banana"
