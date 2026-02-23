[] groups can be collapsed and expanded by clicking on the group header. This allows you to focus on specific sections of your task list while keeping the overall structure organized.

[] when i open svg with another editor, it looks cut off. Example "test-metadata.diagram.svg"

[] in the editor add "view metadata" button where I can have a look into the full data that will be passed to the agent via tool. Has to be nicely formatted and human readable. MAybe virtual .json editor with formted json view, or something even more use friendly.

[] generate architecture.diagramm.svg, high overview of the project. And manually make sure all works as expected, can be displayed and edited with the tools. If any problems are found, fix them and cover with tests. (the active extension is up to date in hte beginning of the project, any change after it wont be deployed)

[] .diagramm.svg should be the only supported format, and every diagram we generate, save should be in this format and viewable as svg when opened with other editors. This way we can be sure that the metadata is always there and can be used by other tools if needed. We can also leverage svg features to embed metadata in a way that is not visible in the visual representation but can be extracted by tools.

[] update Coder.md instructions to reflect the new file format and how to use the editor. Make it clear the DiagramFlow tools should be used to interact with it. Reading or editing.

[] improve whole project code and tests, simplify where possible, and make sure everything is well covered with tests. This includes unit tests for the editor functionality, integration tests for the file saving and loading, and end-to-end tests to ensure the overall workflow works as expected. Code has to be clean, well-structured, and maintainable, following best practices for TypeScript and VS Code extension development, and the guidelines and checklists inside the Coder.md

[] take some time and polish it up, make sure the UI is nice and user friendly, and the overall experience of using the tools is smooth and enjoyable. This includes things like improving the styling, adding animations or transitions where appropriate, and making sure the interactions are intuitive and responsive. The goal is to create a tool that not only works well but also provides a great user experience. Do not add new features but make sure that the existing features are polished and well implemented.

## Tasks tools

[] add new file format; .tasks.md - this file will be used to store the tasks in a structured format. Readable as a standard .md file, but also parseable by the tools to extract the tasks and their status. Providing tools to edit tasks and store related metadata, linked md files and external urls. This way we can have a clear overview of the tasks, their status, and any related information in one place. We can also leverage the markdown format to make it easy to read and edit the tasks manually if needed. Before you start the implementation, do some research on best practices for task management and how to structure the tasks in a way that is easy to read and use. You can also look into existing task management tools and see how they structure their data and what features they offer. Based on that research, design a structure for the .tasks.md file that meets our needs and allows for easy tracking of progress and related information.
- Combination Approach (YAML Front Matter + Markdown List + html comments)
- example:
```markdown
---
lastUpdated: "2025-02-22"
resources:
  - "architecture.diagram.svg"
---

# Task List

Please read the specified resources before working on the tasks. Use that tasks tools to modify the tasks, mark them as complete, and add any relevant notes or links. The tasks are structured in a way that allows for easy tracking of progress and related information.

## Product name

<!-- {"id": "sub-1", "status": "done", "completedAt": "2025-02-22"} -->
- [x] Extract JWT logic into separate service

<!-- {"id": "sub-2", "status": "in-progress"} -->
- [ ] Write unit tests for token refresh
---

[] Make a very use friendly UI for the tasks.md file, where I can easily see the tasks, their status, and any related information. I should be able to mark tasks as complete, add new tasks, and edit existing tasks. The UI should also allow me to easily access any related resources or links that are mentioned in the tasks.md file. This way we can have a clear overview of the tasks and their status without having to manually read through the markdown file. (do online research for best practices and examples of task management UIs, and implement a simple but effective design that meets our needs)