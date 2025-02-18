import singleton from './singleton.mjs';
import { getConfig, setConfig, caption } from './system.mjs';

export async function customRulesUI(customrulesContainer) {
    const { reqAPI } = singleton;
    const customRulesWrapper = document.createElement('div');
    customRulesWrapper.className = 'customRules-container';
    customRulesWrapper.style.padding = '30px';
    customRulesWrapper.style.display = 'flex';
    customRulesWrapper.style.flexDirection = 'column';
    customRulesWrapper.style.gap = '25px';
    customrulesContainer.appendChild(customRulesWrapper);

    // 이 페이지부분의 타이틀은 남겨둬야지
    const title = document.createElement('h2');
    title.textContent = '커스텀 규칙';
    title.style.margin = '0';
    title.style.marginBottom = '0px';
    title.style.fontSize = '22px';
    customRulesWrapper.appendChild(title);
    function createEditorSection({ configKey, title, description }) {
        const section = document.createElement('div');
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '10px';

        const titleElement = document.createElement('h2');
        titleElement.textContent = title;
        titleElement.style.margin = '0';
        titleElement.style.marginBottom = '5px';
        titleElement.style.marginTop = '10px';
        titleElement.style.fontSize = '18px';

        const descriptionElement = document.createElement('p');
        descriptionElement.textContent = description;
        descriptionElement.style.margin = '0';
        descriptionElement.style.marginBottom = '10px';
        descriptionElement.style.color = '#999';
        descriptionElement.style.fontSize = '14px';
        descriptionElement.style.lineHeight = '1.5';

        const editorContainer = document.createElement('div');
        editorContainer.style.flex = '1';

        section.appendChild(titleElement);
        section.appendChild(descriptionElement);
        section.appendChild(editorContainer);

        return { section, editorContainer, configKey };
    }

    async function createCodeMirrorEditor(container, configKey) {
        return new Promise((resolve) => {
            const editor = CodeMirror(container, {
                mode: 'yaml',
                theme: 'monokai',
                lineNumbers: true,
                lineWrapping: true,
                autofocus: false,
                tabSize: 2,
                indentWithTabs: false
            });

            editor.getWrapperElement().style.height = 'calc((50vh) / 1)';
            editor.getWrapperElement().style.fontSize = '16px';

            const cmElement = editor.getWrapperElement();
            cmElement.style.backgroundColor = '#232323';
            cmElement.style.border = '1px solid #3A3A3A';
            cmElement.style.borderRadius = '4px';

            const scrollbar = cmElement.querySelector('.CodeMirror-vscrollbar');
            if (scrollbar) {
                scrollbar.style.width = '10px';
                scrollbar.style.background = '#1a1a1a';
            }

            editor.refresh();

            editor.on('change', async (cm) => {
                await setConfig(configKey, cm.getValue());
            });

            if (editor.getDoc()) {
                resolve(editor);
            }

            editor.on('init', () => {
                resolve(editor);
            });
        });
    }

    async function createEditorSet({ configKey, title, description }) {
        const { section, editorContainer } = createEditorSection({
            configKey,
            title,
            description
        });
        const editor = await createCodeMirrorEditor(editorContainer, configKey);
        customRulesWrapper.appendChild(section);
        return editor;
    }

    const customRulesForCodeGenerator = await createEditorSet({
        configKey: 'customRulesForCodeGenerator',
        title: 'Code Generator Rules',
        description: 'You can customize the rules for the Code Generator.'
    });
    const customRulesForEvaluator = await createEditorSet({
        configKey: 'customRulesForEvaluator',
        title: 'Evaluator Rules',
        description: 'You can customize the rules for the Evaluator.'
    });
    return { customRulesForCodeGenerator, customRulesForEvaluator };
}