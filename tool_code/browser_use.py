from langchain_openai import ChatOpenAI
from browser_use import Agent
from browser_use import BrowserConfig
from browser_use import Browser
import asyncio
import os
from dotenv import load_dotenv
import subprocess

async def _browser_use(input):
    if aiexe_configuration["useDocker"]:
        virtual_playwright = "playwright"
    try:
        result = subprocess.run([virtual_playwright, "install", "--help"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            subprocess.run([virtual_playwright, "install"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        pass

    headless = False
    if aiexe_configuration["useDocker"]:
        headless = True
    if "headless" in environment_variables and environment_variables["headless"]:
        headless = True

    config = BrowserConfig(
        headless=headless,
        disable_security=environment_variables["disable_security"],
    )
    browser = Browser(config=config)

    os.environ["OPENAI_API_KEY"] = aiexe_configuration["openaiApiKey"]
    os.environ["ANONYMIZED_TELEMETRY"] = json.dumps(environment_variables["ANONYMIZED_TELEMETRY"])
    os.environ["model"] = aiexe_configuration["openaiModel"]

    # Load environment variables from .env file (if any)
    load_dotenv()

    # Define the main async function
    agent = Agent(
        task=input["task"],  # "What's the weather like today?" in Korean
        llm=ChatOpenAI(model=os.environ["model"]),
        browser=browser,
    )
    history = await agent.run()
    result = history.final_result()
    print('-')
    print(':[FINAL RESULT]:')
    print(result)

# Run the async function
def browser_use(input):
    asyncio.run(_browser_use(input))
