import * as vscode from 'vscode';
import { SynapseNotebookController } from './NotebookController';

export class NotebookStatusProvicer implements vscode.NotebookCellStatusBarItemProvider {
    private notebookController: SynapseNotebookController;

    onDidChangeCellStatusBarItems?: vscode.Event<void> | undefined;
    
    statusMessage: string;
    statusCell: vscode.NotebookCell | undefined;

    constructor(notebookController: SynapseNotebookController) {
        this.notebookController = notebookController;
        this.statusMessage = "";
    }

    updateStatus = (message: string, cell: vscode.NotebookCell)=>{
        if (cell) {
            this.statusMessage = message;
            this.statusCell = cell;
        }
    };

    provideCellStatusBarItems(_cell: vscode.NotebookCell, _token: vscode.CancellationToken)
        : vscode.ProviderResult<vscode.NotebookCellStatusBarItem | vscode.NotebookCellStatusBarItem[]> {

        if (this.statusCell === _cell && this.statusMessage) {
            return new vscode.NotebookCellStatusBarItem(this.statusMessage, vscode.NotebookCellStatusBarAlignment.Left);
        }

        return undefined;
    }
}