# aiexeauto

**aiexeauto** is an autonomous AI agent that thinks and acts on its own. It is an innovative CLI tool that understands natural language commands and automatically performs computer tasks after analyzing how best to do them. Even complex tasks are handled automatically by the AI agent, which analyzes the situation and finds the optimal approach.

## Key Features

- **Control your computer with natural language**: Simply say things like “clean up these files” or “edit the video for me,” and the AI takes care of it automatically.
- **Automate complex tasks**: Whether it’s file management, image editing, or document tasks, the AI does the tedious work for you.
- **Works on both Windows/Mac**: Supports all major operating systems.
- **Real-time progress updates**: Displays a neat interface so you can see exactly what the AI is doing.

## Demo Video

Watch the demo video on YouTube to see **aiexeauto** in action!  
[Click here](https://www.youtube.com/watch?v=GkOZ6fG99RI) to watch.  
[![Video Label](http://img.youtube.com/vi/GkOZ6fG99RI/0.jpg)](https://www.youtube.com/watch?v=GkOZ6fG99RI)

## System Requirements

- **Node.js**
- **Operating System**: 
  - Windows
  - macOS
- **Docker**

## Installation

1. **Install Node.js**
   - Download and install the latest LTS version from [Node.js official website](https://nodejs.org/).

2. **Install Docker**
   - Download and install the latest version from [Docker Desktop](https://www.docker.com/).

3. **Build Docker Image**

   **For macOS**:
   ```bash
   git clone https://github.com/kstost/aiexeauto.git && cd aiexeauto/my-docker-app && docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

   **For Windows**:  
   1) Open the Start menu, type “PowerShell,” and run it as administrator.  
   2) Then run the following commands:

   ```powershell
   # Change execution policy
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

   # Create directory
   New-Item -ItemType Directory -Path "my-docker-app" -Force

   # Move to the working directory
   cd my-docker-app

   # Download Dockerfile
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kstost/aiexeauto/refs/heads/main/my-docker-app/Dockerfile" -OutFile "Dockerfile"

   # Build Docker image
   docker build --platform linux/x86_64 -t my-node-ubuntu .

   # End
   ```

4. **Install aiexeauto**

   **For Windows**:
   1) Open Start menu, search for “PowerShell,” and run it.
   2) Paste the command below and press Enter:
   ```powershell
   npm install -g aiexeauto
   ```

   **For macOS**:
   1) Open Spotlight (⌘ + Space), search for “Terminal,” and run it.
   2) Paste the command below into the Terminal and press Enter:
   ```bash
   sudo npm install -g aiexeauto
   ```
   3) When prompted for the administrator password, enter your Mac login password.

## Basic Configuration

**aiexeauto** supports Anthropic’s Claude AI model, DeepSeek AI model, and also OpenAI’s Chat Completions.

### Obtaining an API Key (Claude)

1. Go to [Claude API Console](https://console.anthropic.com/settings/keys).
2. Create an account and log in.
3. Register a credit card on the [Billing Settings](https://console.anthropic.com/settings/billing) page.
4. Obtain an API key.

### Obtaining an API Key (DeepSeek)

1. Go to [DeepSeek API Console](https://platform.deepseek.com/api_keys).
2. Create an account and log in.
3. Obtain an API key.

### Obtaining an API Key (OpenAI)

1. Go to [OpenAI](https://platform.openai.com/account/api-keys).
2. Create an account and log in.
3. Click “Create new secret key” to obtain an API key.

### Configuration Commands

```bash
# Required configuration
aiexeauto config claudeApiKey "sk-ant-api..."     # Claude API key
aiexeauto config deepseekApiKey "sk-..."          # DeepSeek API key
aiexeauto config openaiApiKey "sk-openai-..."     # OpenAI API key (newly added)

# Claude-AI model settings
aiexeauto config model "claude-3-5-haiku-20241022"  # Faster, cheaper
aiexeauto config model "claude-3-5-sonnet-20241022" # More refined tasks

# DeepSeek-AI model settings
aiexeauto config deepseekModel "deepseek-chat"

# OpenAI model settings
aiexeauto config openaiModel "gpt-4o"               # or "gpt-4o-mini"

# Choose which LLM to use (Claude, DeepSeek, or OpenAI)
aiexeauto config llm "claude"
aiexeauto config llm "deepseek"
aiexeauto config llm "openai"

# Execution environment settings
aiexeauto config maxIterations 0                    # Number of iterations (0 = unlimited)
aiexeauto config overwriteOutputDir false           # Whether to overwrite output directory

# Docker settings (optional)
aiexeauto config useDocker true                     # Use Docker or not
aiexeauto config dockerImage "my-node-ubuntu"       # Docker image name
aiexeauto config dockerWorkDir "/home/ubuntu/work"  # Docker working directory
```

## How to Use

### Basic Command Structure

```bash
aiexeauto "<task_description>" <input_directory> <output_directory>
```

- **task_description**: Describe the task to be performed in natural language (or a path to a text file containing the description).
- **input_directory**: Directory containing the data needed for the task (optional; if omitted, a new folder is created in the current directory).
- **output_directory**: Directory where results will be saved (optional; if omitted, a new folder is created in the same location as the input directory).

### Usage Examples

1. **Enter commands directly**
   ```bash
   # Remove duplicate files
   aiexeauto "Find duplicate files in this folder, keep only one copy and delete the rest." ./data ./output
   
   # Image processing
   aiexeauto "Convert all JPG files to PNG, then reduce their size by half." ./images ./processed
   
   # Data analysis
   aiexeauto "Analyze CSV files, generate a monthly sales report, and produce a chart." ./sales ./report
   ```

2. **Use a text file for the command**
   ```bash
   # Write instructions in task.txt
   aiexeauto "task.txt" ./data ./output
   ```

### Tips for Writing Task Descriptions

- **Be specific**: Clearly describe what you want done.
- **Break down complex tasks**: For lengthy or complicated tasks, outline them step by step.
- **Specify conditions**: If special constraints or requirements exist, mention them explicitly.

## Precautions

1. **Data**
   - Always back up important data before using.
   - Accidental data loss may occur.
2. **Internet and Security**
   - By default, the AIEXEAUTO environment is connected to the internet, which can lead to real-world actions. Use with caution.
3. **Costs - Claude**
   - Using the Claude API incurs usage fees.
   - See [Claude Pricing](https://www.anthropic.com/pricing#anthropic-api)
4. **Costs - DeepSeek**
   - Using the DeepSeek API incurs usage fees.
   - See [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing)
5. **Costs - OpenAI**
   - Using OpenAI’s API incurs usage fees.
   - See [OpenAI Pricing](https://openai.com/pricing)

## Troubleshooting

1. **Common Errors**
   - API key error: Verify that you have set the correct API key.
   - Path error: Check your input/output paths.
   - Permission error: Make sure you have permission to access the necessary directories.
2. **Docker-Related Errors**
   - Check whether Docker Desktop is running.
   - Check the Docker image build status.
   - Check resource allocation settings.
3. **Seeking Help**
   - If you cannot resolve an issue, visit the [COKAC site](https://cokac.com) for assistance.
   - The “coding old man” community can also help you troubleshoot.

## License

This software is released under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Contributing

Bug reports, feature requests, and pull requests are welcome.
- Use the GitHub issue tracker.
- Include test code when contributing.

## Disclaimer

This software is in a prototype stage, and you are responsible for its use. Use caution for critical data or systems.