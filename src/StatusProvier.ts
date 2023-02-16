import * as vscode from 'vscode';
import { SynapseNotebookController } from './NotebookController';

export class NotebookStatusProvicer implements vscode.NotebookCellStatusBarItemProvider {
    private notebookController: SynapseNotebookController;

    constructor(notebookController: SynapseNotebookController) {
        this.notebookController = notebookController;
    }

    onDidChangeCellStatusBarItems?: vscode.Event<void> | undefined;

    provideCellStatusBarItems(_cell: vscode.NotebookCell, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.NotebookCellStatusBarItem | vscode.NotebookCellStatusBarItem[]> {
        return new vscode.NotebookCellStatusBarItem("test", vscode.NotebookCellStatusBarAlignment.Left);
    }
}