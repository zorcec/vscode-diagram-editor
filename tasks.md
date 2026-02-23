[] groups can be collapsed and expanded by clicking on the group header. This allows you to focus on specific sections of your task list while keeping the overall structure organized.

[] when i open svg with another editor, it looks cut off. Example "test-metadata.diagram.svg"

[] in the editor add "view metadata" button where I can have a look into the full data that will be passed to the agent via tool. Has to be nicely formatted and human readable. MAybe virtual .json editor with formted json view, or something even more use friendly.

[] generate architecture.diagramm.svg, high overview of the project. And manually make sure all works as expected, can be displayed and edited with the tools. If any problems are found, fix them and cover with tests.

[] .diagramm.svg should be the only supported format, and every diagram we generate, save should be in this format and viewable as svg when opened with other editors. This way we can be sure that the metadata is always there and can be used by other tools if needed. We can also leverage svg features to embed metadata in a way that is not visible in the visual representation but can be extracted by tools.

[] update Coder.md instructions to reflect the new file format and how to use the editor. Make it clear the DiagramFlow tools should be used to interact with it. Reading or editing.

[] improve whole project code and tests, simplify where possible, and make sure everything is well covered with tests. This includes unit tests for the editor functionality, integration tests for the file saving and loading, and end-to-end tests to ensure the overall workflow works as expected. Code has to be clean, well-structured, and maintainable, following best practices for TypeScript and VS Code extension development, and the guidelines and checklists inside the Coder.md