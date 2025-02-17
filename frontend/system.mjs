import singleton from "./singleton.mjs";
import { i18nCaptions } from "./i18nCaptions.mjs";
export async function getConfig(key) {
    const { reqAPI, abortTask } = singleton;
    let task = reqAPI('getconfig', { key: key });
    let taskId = task.taskId;
    if (false) await abortTask(taskId);
    return await task.promise;
}
export async function setConfig(key, value) {
    const { reqAPI, abortTask } = singleton;
    let task = reqAPI('setconfig', { key: key, value: value });
    let taskId = task.taskId;
    if (false) await abortTask(taskId);
    return await task.promise;
}
export function caption(key) {
    const lang = singleton.lang;
    return i18nCaptions[lang]?.[key] || i18nCaptions['ko']?.[key] || '';
}
