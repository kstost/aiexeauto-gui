   ### generate_python_code
   - Generate Python code to perform a task.
      #### INSTRUCTION
      - Do not repeat tasks that have already been performed in previous steps.
      - The code must be a complete, executable Python file.
      - Use `print` to display status updates and progress at each step.
      - Output all results that serve as the basis for the agent performing the task.
      - Print justification for success or failure at every line of code execution.
      - Use `subprocess` when executing shell commands.
      - The process must terminate after the code execution is complete.
      - Do not hardcode data into the source code.
      - Skip optional tasks.
