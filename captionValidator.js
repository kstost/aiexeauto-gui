import { execSync } from "child_process";
import fs from "fs";
import { i18nCaptions } from "./frontend/i18nCaptions.mjs";

let mode = 0;
if (mode === 1) {
    let list = `
1 clearOutputData
1 codeGenerationCompleted
1 completed
1 error
1 failed
1 loading
1 ollamaAPIKeyPlaceholder
1 openOutputFolder
1 outputFolder
1 processing
1 selectFolder
1 selectInputFolder
1 success

    `.split('\n').map(m => m.trim().split(' ')[1]).filter(m => m);
    console.log(list);
    Object.keys(i18nCaptions).forEach(langcode => {
        for (const key of list) {
            delete i18nCaptions[langcode][key];
        }
    });
    // fs.writeFileSync("./frontend/i18nCaptions.mjs", JSON.stringify(i18nCaptions, null, 2), "utf-8");
    console.log(JSON.stringify(i18nCaptions, null, 2));
}
if (mode === 1) {
    execSync("codemerger . ./tmp.captionValidator.md -i .mergeignore");
    function captionKeyValidation(matches) {
        let lists = [
            Object.keys(i18nCaptions.en),
            Object.keys(i18nCaptions.ko),
            Object.keys(i18nCaptions.ja),
            Object.keys(i18nCaptions.vi),
        ]
        let count = 0;
        for (const list_ of lists) {
            for (const list of lists) {
                count += list_.sort().join(',') === list.sort().join(',') ? 1 : 0;
            }
        }
        for (const match of matches) {
            if (!lists[0].includes(match)) {
                console.log(0, match);
                // return false;
            }
        }
        for (const item of lists[0]) {
            if (!matches.includes(item)) {
                console.log(1, item);
                // return false;
            }
        }
        if (matches.length !== lists[0].length) return false;
        return lists.length * lists.length === count;
    }
    let content = fs.readFileSync("./tmp.captionValidator.md", "utf-8");
    content = content.replace(/`/g, '"').replace(/'/g, '"');
    const matches = [...content.matchAll(/caption\("(.*?)"\)/g)].map(m => m[1]);
    fs.unlinkSync("./tmp.captionValidator.md");
    console.log(captionKeyValidation(matches));
}