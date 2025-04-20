// import chalk from 'chalk';
// import { oraSucceed, oraFail, oraStop, oraStart, oraBackupAndStopCurrent, print, strout } from './oraManager.js'
import { app } from 'electron';
import { getSystemLangCode } from './system.js'
// getSystemLangCode()

const singleton = {
    // installedPackages: {},
    lang: getSystemLangCode(),
    abortQueue: {},
    interfaces: null,
    async debug(data, scopename) {
        const optionscopename = singleton?.options?.debug;
        if (!scopename || !optionscopename) return;
        if (optionscopename !== scopename) return;
        // await strout(chalk.red(scopename), (data));
    }
};
export default singleton;
