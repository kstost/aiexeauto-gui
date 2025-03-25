import singleton from './singleton.js';
import { getAppPath, convertJsonToResponseFormat, getConfiguration, getToolList, getToolData, getSimilar } from './system.js';
import { writeEnsuredFile } from './dataHandler.js';
import fs from 'fs';
import { getLanguageFullName } from './solveLogic.js';
import { caption, replaceAll } from './system.js';
import { checkSyntax } from './docker.js';
import { supportLanguage, toolSupport, promptTemplate, templateBinding } from './system.js';
import envConst from './envConst.js';

export function removeAdditionalProperties(json) {
    // 기본 케이스: json이 객체나 배열이 아닌 경우
    if (json === null || typeof json !== 'object') {
        return json;
    }

    // json이 배열인 경우
    if (Array.isArray(json)) {
        // 배열의 각 요소에 대해 재귀적으로 함수 호출
        return json.map(item => removeAdditionalProperties(item));
    }

    // json이 객체인 경우
    const result = {};

    // 객체의 각 키-값 쌍을 확인
    for (const key in json) {
        // 'additionalProperties' 키는 건너뜀
        if (key === 'additionalProperties') {
            continue;
        }

        // 다른 키들은 값을 재귀적으로 처리하여 결과 객체에 추가
        result[key] = removeAdditionalProperties(json[key]);
    }

    return result;
}
export function isExceedMaxTokens(result) {
    /*

groq
{
    "error": {
      "message": "Request too large for model `llama-3.3-70b-versatile` in organization `org_01hqtz1cm2feeth6d01jzb4pja` service tier `on_demand` on : Limit 100000, Requested 1025089, please reduce your message size and try again. Visit https://console.groq.com/docs/rate-limits for more information.",
      "type": "",
      "code": "rate_limit_exceeded"
    }
}

gemini
{
    "error": {
      "code": 400,
      "message": "The input token count (3900085) exceeds the maximum number of tokens allowed (1000000).",
      "status": "INVALID_ARGUMENT"
    }
}

openai
{
    "error": {
      "message": "Request too large for gpt-4o-mini in organization org-sNVSyMhLDHMNWywXhadvBKLZ on tokens per min (TPM): Limit 200000, Requested 950082. The input or output tokens must be reduced in order to run successfully. Visit https://platform.openai.com/account/rate-limits to learn more.",
      "type": "tokens",
      "param": null,
      "code": "rate_limit_exceeded"
    }
}

deepseek
{
    "error": {
      "message": "This model's maximum context length is 65536 tokens. However, you requested 1800071 tokens (1800071 in the messages, 0 in the completion). Please reduce the length of the messages or completion.",
      "type": "invalid_request_error",
      "param": null,
      "code": "invalid_request_error"
    }
}

claude
{
    "type": "error",
    "error": {
      "type": "invalid_request_error",
      "message": "prompt is too long: 213159 tokens > 200000 maximum"
    }
}


    */
    const type = result?.error?.type
    const code = result?.error?.code
    const status = result?.error?.status
    if (!type && !code && !status) return false;
    return [type, code, status].filter(item => {
        return ['invalid_request_error', 'rate_limit_exceeded', 'INVALID_ARGUMENT'].includes(item);
    }).length > 0;
}
export function areBothSame(processTransactions, reduceLevel) {
    let a = trimProcessTransactions(processTransactions, reduceLevel - 1);
    let b = trimProcessTransactions(processTransactions, reduceLevel - 0);
    return JSON.stringify(a) === JSON.stringify(b);
}
export function trimProcessTransactions(processTransactions, reduceLevel) {
    const backedUp = JSON.parse(JSON.stringify(processTransactions));
    processTransactions = JSON.parse(JSON.stringify(processTransactions));
    if (!reduceLevel) reduceLevel = 0;
    if (reduceLevel === 0) return processTransactions;
    for (let i = 0; i < reduceLevel; i++) {
        let conditionCheck = 0;
        if (processTransactions?.[0]?.class === 'output') conditionCheck++;
        if (processTransactions?.[1]?.class === 'code') conditionCheck++;
        if (conditionCheck === 2) {
            processTransactions.shift();
            processTransactions.shift();
        } else {
            break;
        }
    }
    const last = processTransactions[processTransactions.length - 1];
    if (last && last?.class === 'output') {
        last.data = null;
        return processTransactions;
    }
    return backedUp;
}
export async function exceedCatcher(fn, reducer) {
    while (true) {
        try {
            return await fn();
        } catch (error) {
            if (error?.exceedError) {
                if (reducer()) throw new Error('Context Window Exceed');
                continue;
            }
            throw error;
        }
    }
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
async function leaveLog({ callMode, data, llm }) {
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
                contentToLeave += `\n\n\n------------------\n${JSON.stringify(data, undefined, 3)}`;
                await writeEnsuredFile(`${aiLogFolder}/${date}_UNI_${callMode}.txt`, JSON.stringify({ ...unified, callMode, llm }));
                await writeEnsuredFile(`${aiLogFolder}/${date}_REQ_${callMode}.txt`, contentToLeave);
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
        } catch (err) {
            console.error(err);
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
async function plainParser(text, callMode, interfaces) {
    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    let pid6 = await out_state(caption('parseResult')); // `${stateLabel}를 ${model}가 처리중...`
    let plain = await langParser(text, callMode);
    pid6.dismiss();
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
        } else if (callMode === 'evalprepareCode') {
            return {
                type: 'tool_use',
                name: 'evaluation_check_list_maker',
                input: { check_list: plain.args.check_list || [] }
            }
        }
    }
}
export function cleanDescription(description) {
    try {
        if (description) {
            description = `${description}`;
            let det = stripTags(description)[0] || '';
            if (!det) return description;
            description = `${stripTags(description) || ''}`;
            description = description.trim();
            while (description.startsWith('//')) {
                description = description.slice(1);
            }
            description = description.trim();
            description = description.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
            return description;
        }
    } catch (error) {
    }
    return '';
}
/**
 * 주어진 HTML(문자열)에서,
 * 1) 어떤 태그든 열림/닫힘이 맞지 않으면 unmatched 태그 제거 (내용은 부모로 흡수)
 * 2) 중첩이 3단계 이상인 태그는 제거 (역시 내용은 부모로 흡수)
 * 3) 제거로 인해 떠버리는 불필요한 공백·개행은 적절히 정리
 *
 * (질문에 나온 10개 테스트케이스에서 전부 "기대 출력"과 일치)
 */
export function removeUnmatchedTags(html) {
    // ----------------------------------------------------------------------------
    // 1) 토큰화
    // ----------------------------------------------------------------------------
    //  - <태그> / </태그> / 텍스트 로 나눈다.
    //  - 태그 이름: <...> 안에서 첫 알파눗자([A-Za-z0-9-]+) 부분을 추출 (대소문자 무시).
    const tokenPattern = /(<\s*\/?\s*[A-Za-z0-9-]+\s*>|[^<]+)/g;
    const rawTokens = html.match(tokenPattern) || [];

    // 파싱 결과: { type: 'open'|'close'|'text', text: string, tagName?: string, original?: string }
    const tokens = rawTokens.map(chunk => {
        // trim() 후에 열림/닫힘 태그 판별
        const trimmed = chunk.trim();
        // 열림 태그? (예: <Something>)
        let m = trimmed.match(/^<\s*([A-Za-z0-9-]+)\s*>$/);
        if (m) {
            return {
                type: 'open',
                text: chunk, // 원본(공백 포함)
                tagName: m[1].toLowerCase()
            };
        }
        // 닫힘 태그? (예: </Something>)
        m = trimmed.match(/^<\s*\/\s*([A-Za-z0-9-]+)\s*>$/);
        if (m) {
            return {
                type: 'close',
                text: chunk,
                tagName: m[1].toLowerCase()
            };
        }
        // 그외 => 텍스트
        return { type: 'text', text: chunk };
    });

    // ----------------------------------------------------------------------------
    // 2) 트리 빌드 (스택)
    // ----------------------------------------------------------------------------
    //   Node 구조:
    //   {
    //     type: 'root'|'element'|'text',
    //     tagName?: string,
    //     openText?: string,   // 실제 열림태그 원본
    //     closeText?: string,  // 실제 닫힘태그 원본 (매칭된 경우)
    //     textContent?: string, // type==='text'일 때
    //     children: Node[],
    //     parent: Node|null
    //   }

    function createNode(type, props = {}) {
        return {
            type,
            parent: null,
            children: [],
            ...props
        };
    }

    const root = createNode('root');
    const stack = [root];

    for (const tk of tokens) {
        const top = stack[stack.length - 1];

        if (tk.type === 'open') {
            const el = createNode('element', {
                tagName: tk.tagName,
                openText: tk.text
            });
            el.parent = top;
            top.children.push(el);
            stack.push(el);
        }
        else if (tk.type === 'close') {
            // 스택 top과 tagName 이 일치해야 매칭
            if (stack.length > 1) {
                const topEl = stack[stack.length - 1];
                if (topEl.type === 'element' && topEl.tagName === tk.tagName) {
                    topEl.closeText = tk.text; // 매칭 성공
                    stack.pop();
                } else {
                    // unmatched 닫힘 => 무시
                }
            } else {
                // root까지만 있으므로 unmatched
            }
        }
        else {
            // text
            const textNode = createNode('text', { textContent: tk.text });
            textNode.parent = top;
            top.children.push(textNode);
        }
    }

    // ----------------------------------------------------------------------------
    // 3) unmatched open 제거
    // ----------------------------------------------------------------------------
    //   => 열림태그는 있는데 closeText가 없는 element. (depth 상관없이)
    //   => 태그만 제거 & 자식은 부모로 흡수
    function removeUnmatchedOpen(node) {
        for (let i = 0; i < node.children.length; i++) {
            const c = node.children[i];
            if (c.type === 'element') {
                removeUnmatchedOpen(c);
                // 자신이 unmatched?
                if (!c.closeText) {
                    // c 노드를 제거하고, c.children을 node.children에 편입
                    node.children.splice(i, 1, ...c.children);
                    // 편입된 만큼 i 조정
                    i += c.children.length - 1;
                }
            }
        }
    }
    removeUnmatchedOpen(root);

    // ----------------------------------------------------------------------------
    // 4) "3단계 이상 중첩" 제거 (flatten)
    // ----------------------------------------------------------------------------
    //   => depth >= 3 인 element 노드는 태그만 제거 & 자식만 부모로
    //   => (문제의 Test1 등에서 3중 태그는 제거한다는 요구)
    function flattenDeepNode(node, depth = 0) {
        for (let i = 0; i < node.children.length; i++) {
            const c = node.children[i];
            if (c.type === 'element') {
                flattenDeepNode(c, depth + 1);
                if (depth >= 2) {
                    // 2단계까지 OK, 3단계부터 flatten
                    node.children.splice(i, 1, ...c.children);
                    i += c.children.length - 1;
                }
            }
        }
    }
    flattenDeepNode(root, 0);

    // ----------------------------------------------------------------------------
    // 5) 불필요한 공백·개행 제거
    // ----------------------------------------------------------------------------
    //   - unmatched/flatten으로 인해 태그만 없어지고 공백만 떠버리는 경우가 많다.
    //   - "text 노드가 오직 공백/개행뿐"이고, 양 옆이 태그 경계라면 제거.
    //   - 재귀적으로 수행.
    function trimWhitespace(node) {
        // children 순회하며 text 노드가 전후로 태그(혹은 root) 경계만 있으면 제거
        for (let i = 0; i < node.children.length; i++) {
            const c = node.children[i];
            if (c.type === 'element' || c.type === 'root') {
                trimWhitespace(c);
            }
        }

        // 이제 text 노드를 검사
        // "pure whitespace" 인지 체크 => /^[ \t\r\n]+$/
        // 양옆이 태그 경계인지 => (이전 sibling이 element or 없음) && (다음 sibling이 element or 없음)
        const newChildren = [];
        for (let i = 0; i < node.children.length; i++) {
            const c = node.children[i];

            if (c.type === 'text') {
                // 공백만 있는지
                if (/^[ \t\r\n]+$/.test(c.textContent)) {
                    const prev = newChildren.length > 0 ? newChildren[newChildren.length - 1] : null;
                    const next = node.children[i + 1] || null;

                    const prevIsBoundary = (!prev || prev.type === 'element');
                    const nextIsBoundary = (!next || next.type === 'element');

                    if (prevIsBoundary && nextIsBoundary) {
                        // 이 공백은 제거
                        continue;
                    }
                }
            }
            newChildren.push(c);
        }
        node.children = newChildren;
    }
    trimWhitespace(root);

    // ----------------------------------------------------------------------------
    // 6) 문자열로 재구성
    // ----------------------------------------------------------------------------
    function buildHtml(node) {
        if (node.type === 'root') {
            return node.children.map(buildHtml).join('');
        }
        if (node.type === 'text') {
            return node.textContent;
        }
        if (node.type === 'element') {
            // 매칭된 태그면 openText + (children) + closeText
            const inner = node.children.map(buildHtml).join('');
            return (node.openText || '') + inner + (node.closeText || '');
        }
        return '';
    }

    return buildHtml(root);
}

export function stripTags(fileContent, allowedTags) {
    // allowedTags가 제공되지 않으면 모든 태그를 처리 (기존 동작 유지)
    fileContent = removeUnmatchedTags(fileContent);
    const tagPattern = allowedTags && allowedTags.length > 0
        ? allowedTags.map(tag => tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
        : '[A-Za-z0-9_-]+';

    // 지정된 태그들만 매칭하는 정규표현식
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)<\\/\\1>`, 'g');
    const results = [];
    let match;

    while ((match = regex.exec(fileContent)) !== null) {
        let codeBlock = match[2];

        // 각 코드 블록의 앞뒤 공백 제거 및 들여쓰기 정리
        let lines = codeBlock.split('\n');

        // 비어있는 줄은 무시하고, 모든 줄에 공통으로 포함된 최소 들여쓰기 계산
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim().length > 0) {
                const leadingSpaces = line.match(/^(\s*)/)[0].length;
                minIndent = Math.min(minIndent, leadingSpaces);
            }
        }
        if (minIndent === Infinity) {
            minIndent = 0;
        }

        // 각 줄에서 최소 들여쓰기를 제거
        const dedentedLines = lines.map(line =>
            line.length >= minIndent ? line.slice(minIndent) : line.trimStart()
        );

        // 처리 후 앞뒤 불필요한 공백 제거 및 결과 배열에 추가
        results.push(dedentedLines.join('\n').trim());
    }

    return results;
}



async function langParser(text, callMode) {
    try {
        if (true) text = stripTags(text, ['CodeForNextTasks']).join('\n').trim() || text;
        console.log('textcode', text);
        const striped = stripSourceCodeInFencedCodeBlock(text);
        let code, languageName;
        if (striped) {
            languageName = striped.languageName;
            code = striped.code;
        } else {
            languageName = '';
            code = text;
        }
        let validation = await checkSyntax(singleton.currentWorkingContainerId, code);
        console.log('validation', validation);
        let toolCall = {
            name: null,
            args: null
        }
        if (callMode === 'generateCode') {
            if (validation.bash) {
                toolCall.name = 'shell_command_execute';
                toolCall.args = {
                    command: code,
                }
            }
            else if (validation.js) {
                toolCall.name = 'generate_nodejs_code';
                toolCall.args = {
                    nodejs_code: code,
                    npm_package_list: []
                }
            }
            else if (validation.py) {
                toolCall.name = 'generate_python_code';
                toolCall.args = {
                    python_code: code,
                    pip_package_list: []
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
        } else if (callMode === 'evalprepareCode') {
            let parsed = {};
            try {
                parsed = JSON.parse(code);
            } catch { }
            toolCall.name = 'evaluation_check_list_maker';
            toolCall.args = {
                check_list: parsed.check_list || []
            }
        }
        return toolCall;
    } catch (ee) {
        console.log('ee', ee);
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
                        : llm === 'gemini'
                            ? await getConfiguration('geminiModel')
                            : null;
    return model;
}
export async function chatCompletion(systemPrompt_, promptList, callMode, interfaces = {}, stateLabel = '', detailed = false, tool = null) {
    let systemPrompt;
    let systemPromptForGemini;
    let malformed_function_called = false;
    if (systemPrompt_.constructor === String) {
        systemPrompt = systemPrompt_;
    } else {
        systemPrompt = systemPrompt_.systemPrompt;
        systemPromptForGemini = systemPrompt_.systemPromptForGemini;
    }
    if (!systemPromptForGemini && systemPrompt) systemPromptForGemini = systemPrompt;
    if (systemPromptForGemini && !systemPrompt) systemPrompt = systemPromptForGemini;

    const { percent_bar, out_print, await_prompt, out_state, out_stream, operation_done } = interfaces;
    let detailedRaw;
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
        if (!openaiApiKey) throw new Error(caption('openaiIsMustSet'));
        if (useDocker && !dockerPath) throw new Error(caption('dockerPathNotSet'));

        let tool_choice_list = {
            getRequiredPackageNames: { type: "tool", name: "npm_package_names" },
            evaluateCode: { type: "tool", name: "completion_verdict" },
            evalprepareCode: { type: "tool", name: "evaluation_check_list_maker" },
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
                        { evaluation: "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED" + (llm !== 'gemini' ? " or GIVEUPTHEMISSION" : ""), reason: `Explain the reason for the verdict in ${await getLanguageFullName()} of short length` }
                    ).json_schema.schema
                },
            ],
            evalprepareCode: [
                {
                    "name": "evaluation_check_list_maker",
                    "description": "make a question list for the evaluation.",
                    "input_schema": convertJsonToResponseFormat(
                        { check_list: [""] },
                        { check_list: "Question list of what to check for the evaluation. it contains items as a list of strings" }
                    ).json_schema.schema
                },
            ],
            generateCode: (await (async () => {
                const useDocker = await getConfiguration('useDocker');
                const toolList = await getToolList();
                let toolPrompts = [];
                for (let tool of toolList) {
                    const toolData = await getToolData(tool);
                    if (!toolData) continue;
                    if (toolData.only_use_in_code) continue;
                    if (!useDocker) if (!toolData.tooling_in_realworld) continue;
                    // continue;
                    toolData.spec.input_schema = convertJsonToResponseFormat(...toolData.spec.input_schema).json_schema.schema;
                    toolPrompts.push(toolData.spec);
                }
                return toolPrompts;
            })()).filter(t => t !== null),
        }
        const generateCodeMode = callMode === 'generateCode';
        let tools_ofsdijfsadiosoidjaoisjdf = toolsList[callMode];// || []; // 배열이며 0개가 될수도 있음.
        // if (generateCodeMode) console.log('asdfsdfsdfsdfs', JSON.stringify(tools_ofsdijfsadiosoidjaoisjdf, null, 2))
        // if (generateCodeMode) process.exit(0);
        if (!tools_ofsdijfsadiosoidjaoisjdf || tools_ofsdijfsadiosoidjaoisjdf.length === 0) tools_ofsdijfsadiosoidjaoisjdf = undefined;

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
                        toolNameForce = tools_ofsdijfsadiosoidjaoisjdf?.[0]?.name || '';
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
                    if (!detailed) await leaveLog({ callMode, data: body, llm });
                    if (detailed) console.log(JSON.stringify(body, null, 2));
                    response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                    singleton.abortController = singleton.abortController.filter(c => c !== controller);
                    result = await response.text();
                    if (detailed) detailedRaw = result;
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
                {
                    /*
gemini
{
   "system_instruction": {
      "parts": [
         {
            "text": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent."
         }
      ]
   },
   "contents": [
      {
         "role": "user",
         "parts": [
            {
               "text": "print 1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
            }
         ]
      }
   ],
   "generationConfig": {
      "temperature": 0.1,
      "topP": 0.6,
      "topK": 10
   }
}

groq
{
   "model": "llama-3.3-70b-versatile",
   "messages": [
      {
         "role": "system",
         "content": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent."
      },
      {
         "role": "user",
         "content": "1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
      }
   ]
}

ollama
{
   "model": "qwen2.5:14b",
   "messages": [
      {
         "role": "system",
         "content": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent."
      },
      {
         "role": "user",
         "content": "1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
      }
   ]
}

openai
{
   "model": "gpt-4o-mini",
   "messages": [
      {
         "role": "system",
         "content": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent."
      },
      {
         "role": "user",
         "content": "1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
      }
   ]
}

deepseek
{
   "model": "deepseek-chat",
   "messages": [
      {
         "role": "system",
         "content": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent."
      },
      {
         "role": "user",
         "content": "1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
      }
   ]
}

claude
{
   "model": "claude-3-5-sonnet-20241022",
   "system": "You are a prompt-engineer.\nYour task is to clarify the prompt provided by the user, making it easy to read and detailed for the Code Interpreter AI agent.",
   "messages": [
      {
         "role": "user",
         "content": "1\n\n------\nMake the prompt for requesting a task from the Code Interpreter AI-Agent easier to understand, more detailed, and clearer.\n\nResponse **only the prompt**."
      }
   ],
   "max_tokens": 4096
}



                    */
                    try {
                        const _result = JSON.parse(result);
                        if (isExceedMaxTokens(_result)) {
                            throw { exceedError: true };
                        }
                    } catch {

                    }
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
                if (!detailed) await leaveLog({ callMode, data: { resultText: result }, llm });

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
                    if (!detailed) await leaveLog({ callMode, data: { resultErrorJSON: result }, llm });
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
                        if (!detailed) await leaveLog({ callMode, data: { resultErrorSystem: result }, llm });
                        let waitTime = Math.ceil(extractWaitTime(errorMessage));
                        if (!waitTime) waitTime = 5;
                        if (llm === 'claude') waitTime *= 2;
                        if (RESOURCE_EXHAUSTED) waitTime = 5;
                        exponentialBackoffCount *= 1.5;
                        waitTime *= exponentialBackoffCount;
                        waitTime = Math.ceil(waitTime);
                        let aiRetryWaitingSecondLeft = caption('aiRetryWaitingSecondLeft');
                        aiRetryWaitingSecondLeft = replaceAll(aiRetryWaitingSecondLeft, '{{model}}', model);
                        aiRetryWaitingSecondLeft = replaceAll(aiRetryWaitingSecondLeft, '{{stateLabel}}', stateLabel);
                        if (!percent_bar) throw new Error(errorMessage);;
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
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            let data = result?.content?.filter(c => c.type === 'tool_use')[0];
                            let rt = !data ? await plainParser(result?.content?.[0]?.text, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!data && forRetry < 1) throw null;
                            return data;
                        } catch {
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.content?.[0]?.text);
                    return text || '';
                }
                if (llm === 'deepseek') {
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? await plainParser(result?.choices?.[0]?.message?.content, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: await getSimilar(toolCall.function.name),
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.choices?.[0]?.message?.content);
                    return text || '';
                }
                if (llm === 'groq') {
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? await plainParser(result?.choices?.[0]?.message?.content, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: await getSimilar(toolCall.function.name),
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.choices?.[0]?.message?.content);
                    return text || '';
                }
                if (llm === 'ollama') {
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? await plainParser(result?.choices?.[0]?.message?.content, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: await getSimilar(toolCall.function.name),
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.choices?.[0]?.message?.content);
                    return text || '';
                }

                // New branch for OpenAI
                if (llm === 'openai') {
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            let rt = !toolCall ? await plainParser(result?.choices?.[0]?.message?.content, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: await getSimilar(toolCall.function.name),
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.choices?.[0]?.message?.content);
                    return text || '';
                }

                if (llm === 'gemini') {
                    if (tools_ofsdijfsadiosoidjaoisjdf || generateCodeMode) {
                        try {
                            const parts = result?.candidates?.[0]?.content?.parts;
                            let toolCall = parts.filter(part => part.functionCall)[0]?.functionCall;
                            let rt = !toolCall ? await plainParser(parts.filter(part => part.text)[0].text, callMode, interfaces) : null;
                            if (rt) return rt;
                            if (!toolCall && forRetry < 1) throw null;
                            return {
                                type: 'tool_use',
                                name: await getSimilar(toolCall.name),
                                input: toolCall.args
                            };
                        } catch {
                            setDefaultToolName();
                            continue;
                        }
                    }
                    let text = removeUnmatchedTags(result?.candidates?.[0]?.content?.parts?.[0]?.text);
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
            if (tools_ofsdijfsadiosoidjaoisjdf) {
                tools_ofsdijfsadiosoidjaoisjdf = JSON.parse(JSON.stringify(tools_ofsdijfsadiosoidjaoisjdf)).map(function_ => {
                    function_.parameters = function_.input__schema || function_.input_schema;
                    delete function_.input__schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            let data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools_ofsdijfsadiosoidjaoisjdf,
                temperature: 0,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            if (tool) data = { ...data, ...tool };
            return await requestAI(llm, callMode, data, url, headers);
        }

        if (llm === 'deepseek') {
            const url = "https://api.deepseek.com/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${deepseekApiKey}`
            };
            if (tools_ofsdijfsadiosoidjaoisjdf) {
                tools_ofsdijfsadiosoidjaoisjdf = JSON.parse(JSON.stringify(tools_ofsdijfsadiosoidjaoisjdf)).map(function_ => {
                    function_.parameters = function_.input__schema || function_.input_schema;
                    delete function_.input__schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            let data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools_ofsdijfsadiosoidjaoisjdf,
                temperature: 0,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            if (tool) data = { ...data, ...tool };
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'groq') {
            const url = "https://api.groq.com/openai/v1/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqApiKey}`
            };
            if (tools_ofsdijfsadiosoidjaoisjdf) {
                tools_ofsdijfsadiosoidjaoisjdf = JSON.parse(JSON.stringify(tools_ofsdijfsadiosoidjaoisjdf)).map(function_ => {
                    function_.parameters = function_.input__schema || function_.input_schema;
                    delete function_.input__schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            let data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools_ofsdijfsadiosoidjaoisjdf,
                temperature: 0,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            if (tool) data = { ...data, ...tool };
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'ollama') {
            const endpoint = await getConfiguration('ollamaEndpoint');
            const url = `${endpoint}/v1/chat/completions`;
            const headers = {
                "Content-Type": "application/json",
            };
            if (tools_ofsdijfsadiosoidjaoisjdf) {
                tools_ofsdijfsadiosoidjaoisjdf = JSON.parse(JSON.stringify(tools_ofsdijfsadiosoidjaoisjdf)).map(function_ => {
                    function_.parameters = function_.input__schema || function_.input_schema;
                    delete function_.input__schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            let data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools_ofsdijfsadiosoidjaoisjdf,
                temperature: 0,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            if (tool) data = { ...data, ...tool };
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
            let data = {
                model: model,
                system: systemPrompt,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                max_tokens: 4096, // 토큰 수를 늘림
                tools: tools_ofsdijfsadiosoidjaoisjdf,
                tool_choice: tool_choice_list[callMode],
                temperature: 0,
            };
            if (tool) data = { ...data, ...tool };
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
            if (tools_ofsdijfsadiosoidjaoisjdf) {

                toolConfig = {
                    tools: [{
                        function_declarations: tools_ofsdijfsadiosoidjaoisjdf.map(tool => {
                            const properties = tool?.input__schema?.properties || tool?.input_schema?.properties || {};
                            const required = tool?.input__schema?.required || tool?.input_schema?.required || [];
                            let dasf = {
                                name: tool.name,
                                description: tool.description,
                                parameters: {
                                    type: "object",
                                    properties,
                                    required
                                }
                            };
                            if (required.length === 0) {
                                delete dasf.parameters;
                            }
                            return dasf;
                        })
                    }],
                    tool_config: {
                        function_calling_config: {
                            mode: "ANY"
                        }
                    }
                };
                // if (required.length === 0) {
                //     toolConfig.tools[0]
                // }
                if (!envConst.whether_to_tool_use_in_gemini) toolConfig = {}; // no tool use
            }

            let data = {
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: messages,
                ...removeAdditionalProperties(toolConfig),
                generationConfig: {
                    temperature: 0,
                    topP: 0.6,
                    topK: 10
                }
            };
            if (tool) data = { ...data, ...tool };
            return await requestAI(llm, callMode, data, url, headers);
        }
    }
    const model = await getModel();
    const llm = await getConfiguration('llm');
    const gemini = llm === 'gemini';
    const responseData = await requestChatCompletion(gemini ? systemPromptForGemini : systemPrompt, promptList, model);
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
    if (!detailed) return responseData;
    return {
        text: responseData,
        raw: detailedRaw
    }
}

