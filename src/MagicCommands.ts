import * as vscode from 'vscode';

import fs = require('fs');
import { SynapseNotebookSerializer } from "./NotebookSerializer";
import { NotebookCellExecution } from "vscode";
import { submitCodeCell } from "./NotebookExecutor";
import { SparkStatementOutput } from "@azure/synapse-spark";
import { SynapseNotebookController } from './NotebookController';

export const executeMagicCommand = async (command: string, notebookController: SynapseNotebookController): Promise<SparkStatementOutput | undefined> => {
    if (command.startsWith("%run ")) {
        const notebookName = command.replace("%run ", "") + ".json";
        const notebookPaths = (await vscode.workspace.findFiles(notebookName)).at(0)?.fsPath || "";

        try {
            const buffer = fs.readFileSync(notebookPaths);
            const notebookSerializer = new SynapseNotebookSerializer();
            const notebookData = notebookSerializer.deserializeNotebook(buffer, undefined);

            let sparkStatementOutput: SparkStatementOutput | undefined;

            for (let cell of notebookData.cells) {
                sparkStatementOutput = await submitCodeCell(cell.value, notebookController);
                notebookController.updateCellOutput(sparkStatementOutput?.data);
            }

            return sparkStatementOutput;
        }
        catch (ex: any) {
            throw new Error(ex);
        }
    }

    return undefined;
};