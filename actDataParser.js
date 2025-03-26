import axios from 'axios';
import puppeteer from 'puppeteer';
import { caption, getConfiguration } from './system.js';
// import marked from 'marked';
import TurndownService from 'turndown';
import { getToolsInfoByToolName } from './mcp.js';
import { virtualPlaywright } from './codeExecution.js';
import { getToolCode, getToolData, convertJsonToResponseFormat, sortKeyOfObject } from './system.js';
import { runPythonCode } from './docker.js';
import { loadConfiguration } from './system.js';
import singleton from './singleton.js';
export async function actDataParser({ actData, processTransactions, out_state, containerId }) {
    console.log('actDataParser!!!!!!!!!!!!!!!!!!!!!!', actData);
    let lazyMode = '';
    const actDataCloneBackedUp = JSON.parse(JSON.stringify(actData));
    let toolingFailed = false;
    function shellCommander(shellCommand) {
        return [
            `const { spawnSync, spawn } = require('child_process');`,
            `const fs = require('fs');`,
            `const outputPath = '/code.sh';`,
            `fs.writeFileSync(outputPath, '${Buffer.from(shellCommand, 'utf-8').toString('base64')}');`,
            `const code = fs.readFileSync(outputPath, 'utf-8');`,
            `fs.writeFileSync(outputPath, Buffer.from(code, 'base64').toString('utf-8'));`,
            `fs.chmodSync(outputPath, '755');`,
            //-----------------------------------
            `{`,
            `    const child = spawn(outputPath, { shell: true });`,
            `    child.stdout.setEncoding('utf8');`,
            `    child.stderr.setEncoding('utf8');`,
            `    async function main() {`,
            `        let stdout = '';`,
            `        let stderr = '';`,
            `        child.stdout.on('data', (data) => {`,
            `            process.stdout.write(data);`,
            `            stdout += data;`,
            `        });`,
            `        child.stderr.on('data', (data) => {`,
            `            process.stderr.write(data);`,
            `            stderr += data;`,
            `        });`,
            `        child.on('error', (err) => {`,
            `            process.exit(1)`,
            `        });`,
            `        const result = await new Promise((resolve, reject) => {`,
            `            child.on('close', (code) => {`,
            `                resolve({`,
            `                    code,`,
            `                    stdout,`,
            `                    stderr`,
            `                })`,
            `            });`,
            `        });`,
            `        if (stdout.trim().length === 0 && stderr.trim().length === 0) console.log('(No output result)');`,
            `        process.exit(result.code);`,
            `    }`,
            `    main();`,
            `}`,
        ].join('\n');
    }
    function is_none_data(data) {
        if (data === undefined) return true;
        if (data === '') return true;
        return false;
    }
    async function loadToolCode(actData) {
        let { code, kind } = await getToolCode(actData.name);
        if (!code) return {};
        let data;
        try { data = await getToolData(actData.name); } catch { }
        if (kind === 'js') {
            code = [
                `const environment_variables = ${JSON.stringify(data?.environment_variables || {})}`,
                `const aiexe_configuration = ${JSON.stringify(await loadConfiguration())}`,
                `const virtual_playwright = '${(await virtualPlaywright()).replace(/\\/g, '\\\\')}';`,
                `;(async()=>{try{await (${code})(${JSON.stringify(actData.input)});}catch{}})();`,
            ].join('\n');
        }
        if (kind === 'py') {
            code = [
                `environment_variables = json.loads('${JSON.stringify(data?.environment_variables || {})}')`,
                `aiexe_configuration = json.loads('${JSON.stringify(await loadConfiguration()).replace(/\\/g, '\\\\')}')`,
                `virtual_playwright = '${(await virtualPlaywright()).replace(/\\/g, '\\\\')}'`,
                `${code}`,
                `${actData.name}(${JSON.stringify(actData.input)})`,
            ].join('\n');
        }
        return { code, kind };
    }
    let javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack, pythonCodeBack, mcpInfo;
    try {
        function formatToolCode(actData) {
            let input = actData.input;
            let keys = Object.keys(input);
            let values = Object.values(input);
            let formattedInput = keys.map((key, index) => `${key}="${values[index]}"`).join(',');
            return `.`;
            return `# Call \`${actData.name}\` tool with arguments: ${formattedInput}`;
        }
        let toolCode;
        try { toolCode = await loadToolCode(actData); } catch { }
        if (actData.name === 'generate_nodejs_code') {
            if (is_none_data(actData?.input?.nodejs_code)) throw null;
            javascriptCode = actData.input.nodejs_code;
            requiredPackageNames = actData.input.npm_package_list;
        } else if (actData.name === 'generate_nodejs_code_for_puppeteer') {
            if (is_none_data(actData?.input?.nodejs_code)) throw null;
            javascriptCode = actData.input.nodejs_code;
            requiredPackageNames = actData.input.npm_package_list;
        } else if (actData.name === 'generate_python_code') {
            if (is_none_data(actData?.input?.python_code)) throw null;
            pythonCode = actData.input.python_code;
            requiredPackageNames = actData.input.pip_package_list;
        } else if (actData.name === 'list_directory') {
            if (is_none_data(actData?.input?.directory_path)) throw null;
            if (!actData.input.directory_path) actData.input.directory_path = './';
            actData.input.directory_path = `${actData.input.directory_path}/`;
            while (actData.input.directory_path.includes('//')) actData.input.directory_path = actData.input.directory_path.replace('//', '/');
            if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'apt_install') {
            if (is_none_data(actData?.input?.package_name)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = shellCommander(`apt install -y ${actData.input.package_name}`);
        } else if (actData.name === 'which_command') {
            if (is_none_data(actData?.input?.command)) throw null;
            if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'shell_command_execute') {
            if (is_none_data(actData?.input?.command)) throw null;
            javascriptCode = [
                actData.input.command,
            ].join('\n');
            javascriptCodeBack = shellCommander(actData.input.command);
            // } else if (actData.name === 'retrieve_from_file') {
            //     lazyMode = actData.name;
            //     if (is_none_data(actData?.input?.file_path)) throw null;
            //     if (is_none_data(actData?.input?.question)) throw null;
            //     if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            //     if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'remove_file') {
            if (is_none_data(actData?.input?.file_path)) throw null;
            if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'remove_directory_recursively') {
            if (is_none_data(actData?.input?.directory_path)) throw null;
            if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'rename_file_or_directory') {
            if (is_none_data(actData?.input?.old_path)) throw null;
            if (is_none_data(actData?.input?.new_path)) throw null;
            if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
            if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
        } else if (actData.name === 'show_output_range') {
            lazyMode = actData.name;
            if (is_none_data(actData?.input?.outputDataId)) throw null;
            if (is_none_data(actData?.input?.startLineNumber)) throw null;
            if (is_none_data(actData?.input?.endLineNumber)) throw null;
            actData = JSON.parse(JSON.stringify(actData));
            actData.input.startLineNumber = Number(actData.input.startLineNumber);
            actData.input.endLineNumber = Number(actData.input.endLineNumber);
            const theLine = processTransactions.filter(transaction => {
                const data1 = transaction?.outputDataId?.toUpperCase();
                const data2 = actData?.input?.outputDataId?.toUpperCase();
                if (!data2 || !data1) return false;
                return data1 === data2;
            })[0];
            let data = theLine ? theLine.data.split('\n').slice(actData.input.startLineNumber, actData.input.endLineNumber).join('\n') : '';
            javascriptCode = formatToolCode(actData);
            // console.log('emoji 🔎');
            data = `🔎 Part of the output from the outputDataId: ${actData.input.outputDataId} (Range: ${actData.input.startLineNumber} - ${actData.input.endLineNumber})\n---\n${data}`;
            // console.log(data);
            const base64 = Buffer.from(data).toString('base64');
            javascriptCodeBack = [`console.log('${base64}');`].join('\n');
            // } else if (actData.name === 'retrieve_from_pdf') {
            //     lazyMode = actData.name;
            //     if (is_none_data(actData?.input?.pdf_file_path)) throw null;
            //     if (is_none_data(actData?.input?.question)) throw null;
            //     const p12 = await out_state(caption('retrievingFromPdf')); // `${stateLabel}를 ${model}가 처리중...`
            //     const requiredPackageNames = ['PyMuPDF'];
            //     const pythonCode = [
            //         "import fitz",
            //         `pdf_document = fitz.open('${actData.input.pdf_file_path}')`,
            //         "text = ''",
            //         "for page_num in range(len(pdf_document)):",
            //         "    page = pdf_document[page_num]",
            //         "    text += page.get_text()",
            //         "pdf_document.close()",
            //         "print(text)",
            //     ].join('\n');
            //     const dockerWorkDir = await getConfiguration('dockerWorkDir');
            //     const codeExecutionResult_ = await runPythonCode(containerId, dockerWorkDir, pythonCode, requiredPackageNames);
            //     // const base64 = Buffer.from(codeExecutionResult_.stdout).toString('base64');
            //     let ob = { data: codeExecutionResult_.stdout, question: actData.input.question, pdf_file_path: actData.input.pdf_file_path };
            //     const base64 = Buffer.from(JSON.stringify(ob)).toString('base64');

            //     javascriptCode = formatToolCode(actData);
            //     javascriptCodeBack = [`console.log('${base64}');`,].join('\n');
            //     await p12.dismiss();
        } else if (actData.name === 'retrieve_from_webpage') {
            lazyMode = actData.name;
            console.log('retrieve_from_webpage!!!!!!!!!!!!!!......................!!!!!!!!');
            if (is_none_data(actData?.input?.url)) throw null;
            if (is_none_data(actData?.input?.question)) {
                actData.input.question = 'Summary of the webpage';
            }
            const url = actData.input.url;
            const question = actData.input.question;
            const p12 = await out_state(caption('accessingWebpage') + ' <a href="' + url + '" target="_blank">🔗 ' + url + '</a>'); // `${stateLabel}를 ${model}가 처리중...`
            let result;
            let data;
            let fail = false;
            if (true) {
                if (url.indexOf('google.') !== -1) fail = true;
                if (url.indexOf('youtube.') !== -1) fail = true;
                if (url.indexOf('youtu.be') !== -1) fail = true;
                if (url.indexOf('gmail') !== -1) fail = true;
                if (url.indexOf('facebook') !== -1) fail = true;
                if (url.endsWith('.pdf')) fail = true;
            }

            if (false && !fail && !data && typeof result.data !== 'string') {
                data = JSON.stringify(result.data);
            } else if (!fail && !data) {
                let htmldata = '';
                // const browser = await puppeteer.launch({ headless: 'new' });
                const browser = await puppeteer.launch({
                    headless: 'new',
                    defaultViewport: {
                        width: 1366,
                        height: 768
                    },
                    args: ['--window-size=1366,768']
                });
                try {
                    console.log('puppeteer launch');
                    const page = await browser.newPage();
                    await page.setViewport({ width: 1366, height: 768 });

                    // 실제 사용자 에이전트 설정
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

                    // 쿠키 동의 대화 상자를 자동으로 처리하기 위한 준비
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                    // 스크롤 동작 시뮬레이션
                    for (let i = 0; i < 20; i++) {
                        await page.evaluate((i) => {
                            let to = i % 2 === 0 ? 0 : document.body.scrollHeight;
                            window.scrollTo(0, to)
                        }, i);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    htmldata = await page.evaluate(() => {
                        {
                            const elements = document.querySelectorAll('style, script, link, canvas, video, audio, iframe, svg');
                            elements.forEach(element => {
                                element.remove();
                            });
                        }
                        {
                            const elements = document.querySelectorAll('*');
                            elements.forEach(element => {
                                element.removeAttribute('style');
                                element.removeAttribute('class');
                                element.removeAttribute('id');
                                element.removeAttribute('name');
                            });
                        }
                        return document.documentElement.innerHTML;
                    });
                } catch {
                    fail = true;
                }
                await browser.close();
                console.log('htmldata!!!!!!!!!!!!!!!!!!!!!!', htmldata);
                data = new TurndownService().turndown(htmldata);
                console.log('data!!!!!!!!!!!!!!!!!!!!!!', data);
            }
            let ob = { data, question, url };
            const base64 = Buffer.from(JSON.stringify(ob)).toString('base64');
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = [
                `console.log('${!fail ? base64 : `["${url}"]`}');`,
            ].join('\n');
            await p12.dismiss();
            // console.log('javascriptCodeBack!!!!!!!!!!!!!!!!!!!!!!', javascriptCodeBack);
        } else if (actData.name === 'cdnjs_finder') {
            if (is_none_data(actData?.input?.package_name)) throw null;
            const packageName = actData.input.package_name;
            const result = await axios.get('https://api.cdnjs.com/libraries?search=' + packageName + '&fields=description,version');
            let data = result.data;
            if (typeof data === 'string') data = JSON.parse(data);
            let url_list1 = data.results.filter(packageInfo => packageInfo.latest.includes('.umd.') && packageInfo.latest.endsWith('.js'))
            let sum = [...url_list1];
            let printData = sum.map(a => `${a.name} - ${a.latest}`).join('\n');
            if (sum.length === 0) printData = 'NOT FOUND';
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = [
                `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                `console.log((${JSON.stringify({ printData })}).printData);`,
            ].join('\n');
        } else {
            // other tool

            const mcpToolInfo = await getToolsInfoByToolName(singleton.serverClients, actData.name);
            if (mcpToolInfo) {
                pythonCodeBack = '';
                mcpInfo = {
                    args: actData.input,
                    name: actData.name,
                    code: formatToolCode(actData)
                };
            } else {
                const name = actData.name;
                const input = JSON.parse(JSON.stringify(actData.input));
                const { spec, npm_package_list, pip_package_list } = await getToolData(name);
                const rule = spec.input_schema[0];
                const desc = spec.input_schema[1];
                const structure1 = JSON.stringify(convertJsonToResponseFormat(sortKeyOfObject(rule), desc))
                const structure2 = JSON.stringify(convertJsonToResponseFormat(sortKeyOfObject(input), desc))
                if (structure1 === structure2) {
                    if (toolCode.kind === 'js') { javascriptCodeBack = toolCode.code; javascriptCode = formatToolCode(actData); }
                    if (toolCode.kind === 'py') { pythonCodeBack = toolCode.code; pythonCode = formatToolCode(actData); }
                    if (npm_package_list) requiredPackageNames = npm_package_list;
                    if (pip_package_list) requiredPackageNames = pip_package_list;
                }
            }
        }
        /*
            코드 수행결과 javascriptCode || pythonCode 둘중에 하나는 존재해야해.
            둘다 없다면 LLM이 Tooling 실패했다고 봐야해.
            실패했다면 actData 어떤 모습인지 확인할 수 있도록 actDataCloneBackedUp 준비했어.
        */
        if (!javascriptCode && !pythonCode) toolingFailed = true;
        if (mcpInfo) {
            javascriptCode = '';
            pythonCode = '';
        }
        return { javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack, pythonCodeBack, toolingFailed, actDataCloneBackedUp, lazyMode, mcpInfo };
    } catch {
        return {
            toolingFailed,
            lazyMode
        }
    }

}