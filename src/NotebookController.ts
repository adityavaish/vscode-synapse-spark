import * as vscode from 'vscode';

import { submitCodeCell } from './NotebookExecutor';
import { NotebookStatusProvicer } from './NotebookStatusProvider';

export class SynapseNotebookController {
    readonly label = 'Synapse kernel';
    readonly supportedLanguages = ['python', 'scala', 'spark'];

    private readonly controller: vscode.NotebookController;
    private _executionOrder = 0;
    private statusProvider: NotebookStatusProvicer;

    execution: vscode.NotebookCellExecution | undefined = undefined;

    constructor(notebookType: string) {
        this.controller = vscode.notebooks.createNotebookController(
            `${notebookType}-controller-id`,
            notebookType,
            this.label
        );

        this.statusProvider = new NotebookStatusProvicer(this);
        vscode.notebooks.registerNotebookCellStatusBarItemProvider(notebookType, this.statusProvider);

        this.controller.supportedLanguages = this.supportedLanguages;
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = this.execute;
    }

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
            this.controller.createNotebookCellExecution(cell)?.end(false, Date.now());

            return;
        }

        await this.startExecution(cell);

        try {
            const sparkStatementOutput = await submitCodeCell(cell.document.getText(), this);

            if (sparkStatementOutput && sparkStatementOutput.status !== 'error') {
                this.updateCellOutput(sparkStatementOutput.data);
                await this.endExecution(true, "success");
            }
            else if (sparkStatementOutput) {
                throw new Error(sparkStatementOutput.errorValue);
            }
            else {
                throw new Error("Statement output is undefined");
            }
        }
        catch (ex: any) {
            this.appendCellOutput(ex);
            await this.endExecution(false, "error");
            this.execution = undefined;
        }

        this.execution = undefined;
    }

    updateCellOutput = (data?: Record<string, unknown>, cellExecution?: vscode.NotebookCellExecution) => {
        const execution = cellExecution || this.execution;
        if (!execution) { return; }

        for (let key in data) {
            this.appendCellOutput(<string>data[key], key, execution);
        }
    };

    appendCellOutput = (message: string, mime?: string, cellExecution?: vscode.NotebookCellExecution) => {
        const execution = cellExecution || this.execution;
        if (!execution) { return; }

        execution.appendOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(message, mime)]));
    };

    updateCellStatus = (message: string, cellExecution?: vscode.NotebookCellExecution) => {
        const execution = cellExecution || this.execution;
        if (!execution) { return; }

        this.statusProvider.updateStatus(message, execution.cell);
    };

    isCanceled: boolean = false;

    startExecution = async (cell: vscode.NotebookCell) => {
        if (!this.execution) {
            this.isCanceled = false;
            this.execution = this.controller.createNotebookCellExecution(cell);
            this.execution.executionOrder = ++ this._executionOrder;
            this.execution.token.onCancellationRequested(async () => {
                await this.endExecution(false, "", true);
            });

            this.updateCellStatus("starting");
            this.execution.start(Date.now());

            await this.execution.clearOutput();
        }
    };

    endExecution = async (success: boolean, status: string = "", isCanceled: boolean = false) => {
        if (this.execution) {
            this.updateCellStatus(isCanceled ? "canceled" : status);
            this.isCanceled = isCanceled;
            this.execution.end(success, Date.now());
            this.execution = undefined;
        }
    };

    dispose(): void { }
}