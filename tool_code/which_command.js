async function which_command(input) {
    const { command } = input;
    const { spawnSync } = require('child_process');
    const result = spawnSync('which', [command], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });
    const output = result.stderr.toString() + result.stdout.toString();
    const outputExists = output.trim().length > 0;
    const backtick = "`";
    const notFound = '(❌ ' + command + ' Command is not available)';
    if (result.status === 0) console.log(outputExists ? backtick + command + backtick + ' Command is available.' + String.fromCharCode(10) + 'Path: ' + output + String.fromCharCode(10).repeat(2) + 'You can use this with subprocess in python' : notFound);
    if (result.status !== 0) console.error(notFound);
    /*
    One line explanation of the return data:
    Boolean value indicating whether the command is available.
    */
    return outputExists;
}