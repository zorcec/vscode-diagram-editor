[] analyze the code, module by module and think and challange if there are any bugs or potential problems. After that replicate with test (TDD) and fix them.
[] diagram sorting doesnt do anything, it is broken.
[] changing the sorting mode can't be done via small dropdown, but only with the bigger button that should be removed, the dropdown should be the only way to change sorting mode
[] when nodes are moved around, the gruping element is weirdly adjusted, resized in wrong direction, etc...
[] e2e tests should be run in "headless" mode or fake desktop environment
[] do extended online research which information can be added into the diagramm for the LLM to understand the project better. Add the ideas into ideas.md
[] ideas in ideas.md that are implemented,  finished or skipped should be removed.
[] the tool that reads the diagram has to accept a file path as an argument, required so the LLM agent always specifies which file to read
[] add linting with a community popular configuration, like eslint-config-airbnb, to the project and fix all linting errors, and add linting problems fixing into the agnent.md as requirement