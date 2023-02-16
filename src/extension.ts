import * as vscode from 'vscode';
import { EXT_CONFIG_ID, showPoolsSelection, showSubscriptionsSelection, showSynapseWorkspaceSelection } from './ConfigManager';
import { SynapseNotebookController } from './SynapseNotebookController';
import { SynapseNotebookSerializer } from './SynapseNotebookSerializer';

const registerCommand = (context: vscode.ExtensionContext, name: string, callback: () => Promise<any>) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(`${EXT_CONFIG_ID}.${name}`, async () => { await callback(); })
	);
};

export function activate(context: vscode.ExtensionContext) {
	console.log('Starting extension synapse-spark-extension!');

	registerCommand(context, "configureAzureSubscription", showSubscriptionsSelection);
	registerCommand(context, "configureSynapseWorkspace", showSynapseWorkspaceSelection);
	registerCommand(context, "selectPool", showPoolsSelection);

	const synapseNotebookSerializer = vscode.workspace.registerNotebookSerializer(EXT_CONFIG_ID, new SynapseNotebookSerializer());
	context.subscriptions.push(synapseNotebookSerializer);

	const synapseNotebookController = new SynapseNotebookController(EXT_CONFIG_ID);
	context.subscriptions.push(synapseNotebookController);
}

// This method is called when your extension is deactivated
export function deactivate() { }
