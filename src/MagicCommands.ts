import * as vscode from 'vscode';

import fs = require('fs');
import { SynapseNotebookSerializer } from "./NotebookSerializer";
import { NotebookCellExecution } from "vscode";
import { submitCodeCell } from "./NotebookExecutor";
import { SparkStatementOutput } from "@azure/synapse-spark";

export const executeMagicCommand = async (command: string, execution: NotebookCellExecution): Promise<SparkStatementOutput | undefined> => {
    if (command.startsWith("%run ")) {
        const notebookName = command.replace("%run ", "") + ".json";
        const notebookPaths = (await vscode.workspace.findFiles(notebookName)).at(0)?.fsPath || "";

        try {
            const buffer = fs.readFileSync(notebookPaths);
            const notebookSerializer = new SynapseNotebookSerializer();
            const notebookData = notebookSerializer.deserializeNotebook(buffer, undefined);

            let sparkStatementOutput: SparkStatementOutput | undefined;

            for (let cell of notebookData.cells) {
                sparkStatementOutput = await submitCodeCell(cell.value, execution);

                const outputs: vscode.NotebookCellOutputItem[] = [];
                for (let key in sparkStatementOutput?.data) {
                    outputs.push(vscode.NotebookCellOutputItem.text(<string>sparkStatementOutput?.data[key], key));
                }

                execution.appendOutput(new vscode.NotebookCellOutput(outputs));
            }

            return sparkStatementOutput;
        }
        catch (ex: any) {
            throw new Error(ex);
        }
    }

    return undefined;
};