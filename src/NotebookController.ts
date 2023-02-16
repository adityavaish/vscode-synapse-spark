import * as vscode from 'vscode';

import { submitCodeCell } from './NotebookExecutor';
import { NotebookStatusProvicer } from './StatusProvier';

export class SynapseNotebookController {
    readonly label = 'Synapse kernel';
    readonly supportedLanguages = ['python', 'scala', 'spark'];

    private readonly controller: vscode.NotebookController;
    private _executionOrder = 0;
    
    execution: vscode.NotebookCellExecution | undefined = undefined;

    constructor(notebookType: string) {
        this.controller = vscode.notebooks.createNotebookController(
            `${notebookType}-controller-id`,
            notebookType,
            this.label
        );

        vscode.notebooks.registerNotebookCellStatusBarItemProvider(notebookType, new NotebookStatusProvicer(this));

        this.controller.supportedLanguages = this.supportedLanguages;
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = this.execute;
        this.controller.interruptHandler = this.interruptHandler;
    }

    private interruptHandler = (_notebook: vscode.NotebookDocument) => {
        console.log("interruptHandler");

        this.execution?.replaceOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr("user cancelled")]));
        this.execution?.end(false, Date.now());
        this.execution = undefined;
    };

    private execute = async (
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): Promise<void> => {
        for (let cell of cells) {
            await this.doExecution(cell);
        }
    };

    private async doExecution(cell: vscode.NotebookCell): Promise<void> {
        if (this.execution) {
            const cellExecution = this.controller.createNotebookCellExecution(cell);
            cellExecution?.replaceOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr("another cell already running")]));
            cellExecution?.end(false, Date.now());
            return;
        }

        this.execution = this.controller.createNotebookCellExecution(cell);
        this.execution.executionOrder = ++this._executionOrder;
        this.execution.start(Date.now());

        try {
            const sparkStatementOutput = await submitCodeCell(cell.document.getText(), this);

            if (sparkStatementOutput && sparkStatementOutput.status !== 'error') {
                // const outputs: vscode.NotebookCellOutputItem[] = [];
                // for (let key in sparkStatementOutput.data) {
                //     outputs.push(vscode.NotebookCellOutputItem.text(<string>sparkStatementOutput.data[key], key));
                // }

                // this.execution?.replaceOutput(new vscode.NotebookCellOutput(outputs));
                this.updateCellOutput(undefined, sparkStatementOutput.data);

                this.execution?.end(true, Date.now());
            }
            else if (sparkStatementOutput) {
                throw new Error(sparkStatementOutput.errorValue);
            }
            else {
                throw new Error("Statement output is undefined");
            }
        }
        catch (ex: any) {
            this.updateCellOutput(ex || "unknown error");
            // this.execution.replaceOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr(ex || "unknown error")]));
            this.execution.end(false, Date.now());
            this.execution = undefined;
        }

        this.execution = undefined;
    }

    updateCellOutput = (message?: string, data?: Record<string, unknown>, cellExecution?: vscode.NotebookCellExecution) => {
        const execution = cellExecution || this.execution;

        if (!execution) {
            return;
        }

        const messages: vscode.NotebookCellOutputItem[] = [];
        
        message && messages.push(vscode.NotebookCellOutputItem.stdout(message));
        execution.replaceOutput(new vscode.NotebookCellOutput(messages));

        for (let key in data) {
            this.appendCellOutput(execution, <string>data[key], key);
        }
    };

    appendCellOutput = (cellExecution: vscode.NotebookCellExecution, message: string, mime?: string) => {
        if (!cellExecution) {
            return;
        }
        cellExecution.appendOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(message, mime)]));
    };

    // updateStatus = (cellExecution: vscode.NotebookCellExecution, message: string) => {
    //     if (!cellExecution) {
    //         return;
    //     }
    //     cellExecution.appendOutput(new vscode.NotebookCellOutput([new vscode.NotebookCellStatusBarItem(message)]));
    // };

    dispose(): void { }
}