   ### generate_nodejs_code_for_puppeteer
   - Generate NodeJS code to perform tasks.
      #### INSTRUCTION
      - Do not repeat tasks already performed in previous steps.
      - The code must be a complete and executable single JavaScript file.
      - Use the `--no-sandbox` option when executing.
      - Use `console.log` to display status and progress at each step.
      - Use `console.table` when outputting tables.
      - Print all results that serve as the basis for the agent performing the task.
      - Print supporting evidence for determining the success of each code execution step.
      - If visualization is required, generate the output as a web page using appropriate visualization libraries with HTML, CSS, and JavaScript.
      - If visualization is required, use JavaScript libraries via CDN links in `<script>` tags without additional installation.
      - If image processing is required, use the `sharp` library from npm.
      - When executing shell commands, use `spawnSync` from the `child_process` module.
      - Ensure that the process terminates after execution.
      - Do not hardcode data in the source code.
      - Omit optional tasks.
