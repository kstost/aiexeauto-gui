async function pip_install_package(input) {
    let {
        package_name,
        isWindows,
        useDocker,
        npmPath,
        virtualPythonPath,
        nodePath
    } = input;
    const { exec } = require('child_process');
    let result = await new Promise((resolve, reject) => {
        let command;
        if (useDocker) {
            command = `pip install ${package_name}`;
        } else {
            command = isWindows ?
                `"${virtualPythonPath}" -m pip install ${package_name}` :
                `"${virtualPythonPath}" -m pip install ${package_name}`;
        }

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`⚠️ Python package installation failed: ${package_name}`);
                return resolve(false);
            }
            console.log(`✅ Python package installation completed: ${package_name}`);
            return resolve(true);
        });
    });
    return result;
}
