import * as vscode from 'vscode';
import { showPoolsSelection, showSubscriptionsSelection, showSynapseWorkspaceSelection } from './ConfigManager';

const registerCommand = (context: vscode.ExtensionContext, name: string, callback: () => Promise<any>) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(name, async () => { await callback(); })
	);
};

export function activate(context: vscode.ExtensionContext) {
	console.log('Starting extension synapse-spark!');

	// let disposable = vscode.commands.registerCommand('synapse-spark.helloWorld', () => {
	// 	vscode.window.showInformationMessage('Hello World from synapse-spark!');
	// });

	registerCommand(context, "synapse-spark.configureAzureSubscription", showSubscriptionsSelection);
	registerCommand(context, "synapse-spark.configureSynapseWorkspace", showSynapseWorkspaceSelection);
	registerCommand(context, "synapse-spark.selectPool", showPoolsSelection);
}

// This method is called when your extension is deactivated
export function deactivate() { }
