# aiexeauto-gui

**aiexeauto-gui** is an autonomous AI agent that thinks and acts on its own. This innovative application understands natural language input and performs computer tasks in the optimal way, automatically handling even complex tasks.

## Watch Our Demo
Watch our demo video on YouTube to get a quick overview of what aiexe can do for you! Click [here](https://www.youtube.com/watch?v=WObRj5-PqmM) to watch the video.  
[![Video Label](http://img.youtube.com/vi/WObRj5-PqmM/0.jpg)](https://youtu.be/WObRj5-PqmM)  

## Key Features

- **Safe Execution**: Operates securely based on Docker.
- **Local LLM Support**: Uses locally running LLMs to reduce costs and ensure data security.
- **Natural Language Input**: Executes tasks with simple commands like "Organize the files" or "Edit the video."
- **Automation Features**: Automates various repetitive tasks such as file management, image editing, and document processing.
- **Cross-Platform Support**: Supports both Windows and macOS.
- **Real-Time Progress Display**: Check task progress through a clean interface.

## System Requirements

- **Operating System**: Windows, macOS

## Installation Guide

### 1. Install NodeJS and Python

1. Download and install Node.js from [nodejs.org](https://nodejs.org).

2. Download and install Python from [python.org](https://www.python.org/).

### 2. Install AIEXEAUTO-GUI

For general users, AIEXEAUTO-GUI can be installed easily by following the steps below.

#### Install AIEXEAUTO-GUI on Windows
1. **Run PowerShell as Administrator and execute the following command:**
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; if (Get-Command npm -ErrorAction SilentlyContinue) { $timestamp = Get-Date -Format "yyyyMMddHHmmss"; $folderName = "_aiexeauto-gui_project_$timestamp"; $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), $folderName); New-Item -ItemType Directory -Path $desktopPath -Force; if (Test-Path $desktopPath) { Set-Location -Path $desktopPath; Invoke-WebRequest -Uri "https://github.com/kstost/aiexeauto-gui/archive/refs/heads/main.zip" -OutFile "__aiexeauto-gui_project__.zip" -ErrorAction Stop; if (Test-Path "__aiexeauto-gui_project__.zip") { Expand-Archive -Path "__aiexeauto-gui_project__.zip" -DestinationPath "."; Set-Location -Path "aiexeauto-gui-main"; npm i; if ($?) { npm run build; if ($?) { ii "dist"; ii "dist\\aiexeauto Setup*.exe" } } } } } else { Write-Output "npm is not installed. Please download and install it from https://nodejs.org." }
   ```

#### Install AIEXEAUTO-GUI on macOS
1. **Run Terminal and execute the following command:**
   ```bash
   sudo chown -R 501:20 ~/.npm 2>/dev/null; command -v npm >/dev/null 2>&1 && { timestamp=$(date +%Y%m%d%H%M%S) && cd ~/Downloads && mkdir "_aiexeauto-gui_project_$timestamp" && cd "_aiexeauto-gui_project_$timestamp" && git clone https://github.com/kstost/aiexeauto-gui && cd aiexeauto-gui && npm i && npm run build && open dist/aiexeauto-*.dmg; } || { echo "npm is not installed. Please download and install it from https://nodejs.org."; }
   ```

### 3. Install Docker (Optional)

Docker is optional. Using Docker allows you to perform tasks in a safer and isolated environment. If you want to use Docker, please follow these steps.

⚠️ **Important Warning for Non-Docker Users**: 
When running AIEXEAUTO-GUI without Docker, the application will execute tasks directly on your system. This means:
- All operations will affect your actual system files and settings
- There is no isolation between the application and your system
- We strongly recommend against using automatic code execution mode without Docker
- Always review generated code carefully before execution
- Consider backing up important data before running any tasks

1. **Install Docker**
   - Download and install the latest version of [Docker Desktop](https://www.docker.com/).

2. **Build the Docker Image**

   **For macOS:**
   ```bash
   git clone https://github.com/kstost/aiexeauto-gui.git && cd aiexeauto-gui/my-docker-app && docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

   **For Windows:**
   1) Open "PowerShell" as Administrator from the Start menu.  
   2) Execute the following commands sequentially:
   ```powershell
   # Change execution policy
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

   # Create directory
   New-Item -ItemType Directory -Path "my-docker-app" -Force

   # Navigate to the directory
   cd my-docker-app

   # Download Dockerfile
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kstost/aiexeauto-gui/refs/heads/main/my-docker-app/Dockerfile" -OutFile "Dockerfile"

   # Build Docker image
   docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

### 4. Install Ollama (Optional)

Ollama is a locally running LLM. If you wish to use Ollama, follow the steps below for installation.

1. **Install Ollama**
   - Download and install the latest version of [Ollama](https://ollama.com/).

2. **Download the Ollama Model**
   ```bash
   ollama run qwen2.5
   ```

Model exploration is available at [Ollama Search](https://ollama.com/search?c=tools).
Since AIEXEAUTO-GUI uses tool-based models, please select models under the "Tools" category.

## Simple Usage Guide

Once setup is complete, select the folder containing the files you want to process and enter the desired task description in natural language. The AI will automatically perform the task.

During the process, the AI generates and executes necessary code through multiple steps. Users can review the generated code before execution.

When all tasks are completed, the folder containing the results will automatically open. Additionally, the opened folder will be set as the default folder for the next task, allowing users to continue without reselecting folders.

However, **the context of the previous task is not shared with the next task.**

## Precautions and Warnings

- **Data Backup**: Always back up important data before executing tasks.
- **Security**: Be cautious about security when allowing the application to perform real-world tasks.
- **API Costs**: Tasks may incur API fees for services like Claude, DeepSeek, OpenAI, Groq, and Gemini.

## Troubleshooting

- **Common Errors**: Check for API keys, paths, and permission issues.
- **Support Request**: If additional support is needed, visit [COKAC website](https://cokac.com) or the "코드깎는노인" community.

## License

This software is distributed under the MIT License. For details, refer to the [LICENSE](LICENSE) file.

## Contributions

- Bug reports, feature requests, and pull requests are welcome.
- Please include test code when contributing.

## Disclaimer

This software is in the prototype stage. Users are fully responsible for its use, and caution is advised when using it with important data or systems.

