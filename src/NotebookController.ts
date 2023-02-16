import * as vscode from 'vscode';

import { SparkStatementOutput } from '@azure/synapse-spark';
import { submitCodeCell } from './NotebookExecutor';

export class SynapseNotebookController {
    readonly label = 'Synapse kernel';
    readonly supportedLanguages = ['python', 'scala', 'spark'];

    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;

    constructor(notebookType: string) {
        this._controller = vscode.notebooks.createNotebookController(
            `${notebookType}-controller-id`,
            notebookType,
            this.label
        );

        this._controller.supportedLanguages = this.supportedLanguages;
        this._controller.supportsExecutionOrder = true;
        this._controller.executeHandler = this.execute.bind(this);
    }

    private async execute(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): Promise<void> {
        for (let cell of cells) {
            await this.doExecution(cell);
        }
    }

    private async doExecution(cell: vscode.NotebookCell): Promise<void> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now());

        try {
            const sparkStatementOutput = await submitCodeCell(cell.document.getText(), execution);

            if (sparkStatementOutput && sparkStatementOutput.status !== 'error') {
                const outputs: vscode.NotebookCellOutputItem[] = [];
                for (let key in sparkStatementOutput.data) {
                    outputs.push(vscode.NotebookCellOutputItem.text(<string>sparkStatementOutput.data[key], key));
                }

                execution.replaceOutput(new vscode.NotebookCellOutput(outputs));
                execution.end(true, Date.now());
            }
            else if (sparkStatementOutput) {
                throw new Error(sparkStatementOutput.errorValue);
            }
            else {
                throw new Error("Statement output is undefined");
            }
        }
        catch (ex: any) {
            execution.replaceOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr(ex.toString())]));
            execution.end(false, Date.now());
        }
    }

    dispose(): void { }
}