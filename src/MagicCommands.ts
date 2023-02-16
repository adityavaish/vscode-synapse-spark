import { cwd } from "process";
import fs = require('fs');
import { SynapseNotebookSerializer } from "./NotebookSerializer";

export const executeMagicCommand = (command: string) => {
    if (command.startsWith("%run ")) {
        const notebookName = command.replace("%run ", "");

        fs.readFile(`${notebookName}.json`, (_err, data: Buffer) => {
            const notebookSerializer = new SynapseNotebookSerializer();
            const notebookData = notebookSerializer.deserializeNotebook(data, undefined);

            notebookData.cells.forEach(_cell => {
            });
        });
    }
};