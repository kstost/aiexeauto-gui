import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs/promises";
import path from "path";
import singleton from "./singleton.js";
import { is_dir } from "./codeExecution.js";
// getCodePath
import { getHomePath, getConfiguration, isWindows } from "./system.js";

export async function convertToolsInfoToAIEXEStyle(toolsInfo) {
    // AIEXE 스타일의 기본 toolspec 객체 구조
    const toolspec = {
        name: toolsInfo.name || "unnamed_tool", // 도구 이름 (기본값 제공)
        description: toolsInfo.description || "No description provided.", // 설명 (기본값 제공)
        instructions: [], // 사용 지침 (동적으로 생성)
        input_schema: [], // 입력 스키마 예시 (동적으로 생성)
        activate: true, // 기본적으로 활성화
        only_use_in_code: false, // 기본값
        // return_description: "Result of the tool execution.", // 기본 반환 설명
        // return_type: "string", // 기본 반환 타입 (추후 조정 가능)
        tooling_in_realworld: true, // 실세계 도구 사용 여부
        pip_package_list: [], // Python 패키지 목록 (기본 빈 배열)
        npm_package_list: [] // NPM 패키지 목록 (기본 빈 배열)
    };

    // 설명이 "설명 없음"인 경우 기본값으로 교체
    if (!toolspec.description) toolspec.description = `Executes the ${toolspec.name} tool with provided inputs.`;

    // inputSchema를 기반으로 instructions와 input_schema 생성
    if (toolsInfo.inputSchema && toolsInfo.inputSchema.properties) {
        const properties = toolsInfo.inputSchema.properties;
        const required = toolsInfo.inputSchema.required || [];

        // instructions 생성
        // toolspec.instructions.push(`Provide the required inputs for the ${toolspec.name} tool.`);
        for (const [key, value] of Object.entries(properties)) {
            const isRequired = required.includes(key) ? " (required)" : " (optional)";
            toolspec.instructions.push(`${key}: ${value.type}${isRequired} - ${value.description || "No description"}`);
        }
        // toolspec.instructions.push(`Use this tool when you need to ${toolspec.description.toLowerCase()}`);

        // input_schema 예시 생성
        const exampleInput = {};
        const detailedExampleInput = {};
        for (const [key, value] of Object.entries(properties)) {
            // 간단한 예시

            // if string then exampleInput[key] = "";
            // if number then exampleInput[key] = 0;
            // if boolean then exampleInput[key] = true;
            // if object then exampleInput[key] = {};
            // if array then exampleInput[key] = [];
            // if null then exampleInput[key] = null;
            // if undefined then exampleInput[key] = undefined;
            if (value.type === "string") {
                exampleInput[key] = "";
            } else if (value.type === "number" || value.type === "integer") {
                exampleInput[key] = 0;
            } else if (value.type === "boolean") {
                exampleInput[key] = true;
            } else if (value.type === "object" || value.type === "dict") {
                exampleInput[key] = {};
            } else if (value.type === "array" || value.type === "list") {
                exampleInput[key] = [];
            } else if (value.type === "null") {
                exampleInput[key] = null;
            } else if (value.type === "undefined") {
                exampleInput[key] = undefined;
            }
            // 상세 예시 (기본값 또는 타입에 따른 예시 제공)
            detailedExampleInput[key] = value.description || `Enter a value for ${key}`;
        }
        toolspec.input_schema.push(exampleInput);
        if (Object.keys(detailedExampleInput).length > 0) {
            toolspec.input_schema.push(detailedExampleInput);
        } else {
            toolspec.input_schema.push({});
        }
    } else {
        toolspec.input_schema.push({});
        toolspec.input_schema.push({});
    }
    toolspec.return_description = ``;
    toolspec.return_type = ""; // 필요에 따라 toolsInfo에서 힌트를 얻어 변경 가능
    toolspec.input__schema = toolsInfo.inputSchema
    return toolspec;
}

export async function getAllToolNames(serverClients) {
    const mcpList = Object.keys(serverClients);
    const toolNames = [];
    for (const mcp of mcpList) {
        const { toolsInfo } = serverClients[mcp];
        toolNames.push(...toolsInfo.map(tool => tool.name));
    }
    return toolNames;
}
export async function getToolsClientByToolName(serverClients, toolName) {
    const mcpList = Object.keys(serverClients);
    for (const mcp of mcpList) {
        const { toolsInfo, client } = serverClients[mcp];
        const toolInfo = toolsInfo.filter(tool => tool.name === toolName)[0];
        if (toolInfo) { return client; }
    }
}
export async function getToolsInfoByToolName(serverClients, toolName) {
    const mcpList = Object.keys(serverClients);
    for (const mcp of mcpList) {
        const { toolsInfo, client } = serverClients[mcp];
        const toolInfo = toolsInfo.filter(tool => tool.name === toolName)[0];
        if (toolInfo) { return toolInfo; }
    }
}
export async function getMCPNameByToolName(serverClients, toolName) {
    const mcpList = Object.keys(serverClients);
    for (const mcp of mcpList) {
        const { toolsInfo, client } = serverClients[mcp];
        const toolInfo = toolsInfo.filter(tool => tool.name === toolName)[0];
        if (toolInfo) { return mcp; }
    }
}

export async function connectAllServers(args) {
    const { interfaces } = args;
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    const serverConfig = await loadServerConfig();
    const serverClients = {};

    for (const config of serverConfig) {
        // config.name
        const pd = await out_state(`Connecting to ${config.name} MCP`);
        let client;
        try {
            client = await runClient(config.name);
        } catch (e) {
            console.log(process.env);
            console.error(e);
        }
        if (!client) {
            pd.dismiss();
            continue;
        }
        let toolsResponse;
        try {
            toolsResponse = await client.listTools();
        } catch (e) { }
        // 툴 정보를 구조화
        const toolsInfo = toolsResponse.tools.map(tool => ({
            name: `${tool.name}`,
            description: `${tool.name} ${tool.description}` || "no description",
            inputSchema: tool.inputSchema || { type: "object", properties: {} },
        }));

        serverClients[config.name] = {
            client,
            config,
            toolsInfo
        };
        // console.log('interfaces', interfaces);
        pd.dismiss();
    }

    return serverClients;
}
export async function closeAllServers() {
    const serverClients = singleton.serverClients;
    if (!serverClients) return;
    for (const { client } of Object.values(serverClients)) {
        await client.close();
    }
    delete singleton.serverClients
}
export async function getServerList() {
    const serverConfig = await loadServerConfig();
    return serverConfig.map(config => config.name);
}
export async function runClient(serverName) {
    const serverConfig = await loadServer(serverName);
    const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: {
            ...(process.env || {}),
            ...(serverConfig.env || {}),
        },
    });
    const client = new Client(
        {
            name: "custom-client",
            version: "1.0.0",
        },
        {
            capabilities: { prompts: {}, resources: {}, tools: {} },
        }
    );
    await client.connect(transport);
    return client;
}

export async function loadServer(serverName) {
    const serverConfig = await loadServerConfig();
    return serverConfig.filter(config => config.name === serverName)[0];
}

export async function loadServerConfig() {
    try {
        const customToolPath = getHomePath('.aiexeauto/custom_tools/aiexe_mcp_config.json');
        const configData = await fs.readFile(customToolPath, "utf-8");
        const config = JSON.parse(configData);
        const servers = config.mcpServers || {};
        if (Object.keys(servers).length === 0) {
            return []; // 서버가 없으면 빈 배열 반환
        }

        // 모든 서버 구성을 배열로 반환
        let nodePath = isWindows() ? await getConfiguration('nodePath') : '';
        return Object.keys(servers).map(serverName => {
            const serverConfig = servers[serverName];
            if (isWindows()) {
                return {
                    name: serverName,
                    command: nodePath,
                    args: [
                        "-e",
                        `require('child_process').execSync('"${serverConfig.command}" ${(serverConfig.args || []).map(d => `"${d}"`).join(' ')}', {stdio: 'inherit'})`
                    ],
                    env: serverConfig.env,
                };
            }
            return {
                name: serverName,
                command: serverConfig.command,
                args: serverConfig.args || [],
                env: serverConfig.env,
            };
        });
    } catch (err) {
        console.error(`설정 로드 실패: ${err.message}`);
        return []; // 에러 발생 시 빈 배열 반환
    }
}
