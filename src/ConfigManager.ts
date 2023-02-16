import * as vscode from 'vscode';

import { BigDataPoolResourceInfo, SynapseManagementClient } from "@azure/arm-synapse";
import { getCredentials } from "./SynapseUtils";
import { StorageManagementClient } from '@azure/arm-storage';
import { DataLakeServiceClient } from '@azure/storage-file-datalake';
import { SubscriptionClient } from '@azure/arm-subscriptions';

export const EXT_CONFIG_ID = "synapse-spark-extension";

export const showPoolsSelection = async (): Promise<string> => {
    const subscriptionId = getConfig("subscriptionId") || await showSubscriptionsSelection();
    let workspaceName = getConfig("workspaceName");
    let resourceGroupName = getConfig("resourceGroupName");

    if (!workspaceName || !resourceGroupName) {
        [workspaceName, resourceGroupName] = await showSynapseWorkspaceSelection();
    }
    
    const client = new SynapseManagementClient(getCredentials(), subscriptionId);
      let pools = [];
      for await (let page of client.bigDataPools
        .listByWorkspace(resourceGroupName, workspaceName)
        .byPage({ maxPageSize: 10 })) {
        for (const pool of page) {
          pools.push(pool);
        }
      }

    const items: vscode.QuickPickItem[] = [];
    for (let index = 0; index < pools.length; index++) {
        const item = pools[index];
        items.push({
            label: item.name!,
            description: item.id,
        });
    }

    return vscode.window
        .showQuickPick(items, { title: "Select Synapse Spark Pool" })
        .then(async (selection) => {
            // the user canceled the selection
            if (!selection) {
                return "";
            }

            await updateConfig("cluster", selection.label);

            return selection.label;
        });
};

export const showSubscriptionsSelection = async (): Promise<string> => {
    const subClient = new SubscriptionClient(getCredentials());
    const subscriptions = [];

    for await (const item of subClient.subscriptions.list()) {
        subscriptions.push(item);
    }

    const items: vscode.QuickPickItem[] = [];

    for (let index = 0; index < subscriptions.length; index++) {
        const item = subscriptions[index];
        items.push({
            label: item.displayName!,
            description: item.subscriptionId,
        });
    }

    return vscode.window
        .showQuickPick(items, { title: "Select Azure Subscription" })
        .then(async (selection) => {
            // the user canceled the selection
            if (!selection) {
                return "";
            }

            await updateConfig("subscriptionId", selection.description!);
            return !!selection.description ? selection.description : "";
        });
};

export const showSynapseWorkspaceSelection = async (): Promise<[string, string]> => {
    const subscriptionId = getConfig("subscriptionId") || await showSubscriptionsSelection();
    const synapseClient = new SynapseManagementClient(getCredentials(), subscriptionId);
    const workspaces = [];

    for await (const item of synapseClient.workspaces.list()) {
        workspaces.push(item);
    }

    const items: vscode.QuickPickItem[] = [];

    for (let index = 0; index < workspaces.length; index++) {
        const item = workspaces[index];
        const substring = item.id?.slice(item.id?.indexOf("resourceGroups/") + 15);
        const resourceGroup = substring?.slice(0, substring.indexOf("/"));

        items.push({
            label: item.name!,
            description: resourceGroup,
        });
    }

    return vscode.window
        .showQuickPick(items, { title: "Select Synapse Workspace" })
        .then(async (selection) => {
            // the user canceled the selection
            if (!selection || !selection.label || !selection.description) {
                return ["", ""];
            }

            await updateConfig("workspaceName", selection.label);
            await updateConfig("resourceGroupName", selection.description);
            return [selection.label, selection.description];
        });
};

export const showAdlsAccountSelection = async (subscriptionId: string): Promise<string> => {
    const stgClient = new StorageManagementClient(getCredentials(), subscriptionId);
    const accounts = [];

    for await (const item of stgClient.storageAccounts.list()) {
        accounts.push(item);
    }

    const items: vscode.QuickPickItem[] = [];

    for (let index = 0; index < accounts.length; index++) {
        const item = accounts[index];
        items.push({
            label: item.name!,
            description: `${item.location}, ${item.kind}`,
        });
    }

    return vscode.window
        .showQuickPick(items, { title: "Select ADLS Account" })
        .then(async (selection) => {
            // the user canceled the selection
            if (!selection) {
                return "";
            }

            await updateConfig("adlsTempAccount", selection.label);
            return !!selection.label ? selection.label : "";
        });
};

export const showAdlsContainerSelection = async (account: string): Promise<string> => {
    const datalakeServiceClient = new DataLakeServiceClient(
        `https://${account}.dfs.core.windows.net`,
        getCredentials()
    );

    const fileSystems = new Array();
    for await (const fileSystem of datalakeServiceClient.listFileSystems()) {
        fileSystems.push(fileSystem);
    }

    const items: vscode.QuickPickItem[] = [];

    for (let index = 0; index < fileSystems.length; index++) {
        const item = fileSystems[index];
        items.push({
            label: item.name!,
            description: item.versionId,
        });
    }

    return vscode.window
        .showQuickPick(items, { title: "Select ADLS Container" })
        .then(async (selection) => {
            // the user canceled the selection
            if (!selection) {
                return "";
            }

            await updateConfig("adlsTempContainer", selection.label);
            return !!selection.label ? selection.label : "";
        });
};

export const showAdlsPathInput = async (container: string): Promise<string | undefined> => {
    return await vscode.window.showInputBox({
        title: "Enter ADLS Path",
        value: "",
        valueSelection: [2, 4],
        placeHolder: `Path to temp location inside ${container} container, e.g. path/to/temp/location`,
        validateInput: async (text) => {
            let result: string = "";

            if (!!text) {
                result = text.endsWith("/") ? text : text + "/";
            }

            await updateConfig("adlsTempPath", result);

            return "";
        },
    });
};

export const getConfig = (property: string): string | undefined => {
    const config = vscode.workspace.getConfiguration(EXT_CONFIG_ID);
    const val = config.get(property, undefined);
    if (val === '') {
        return undefined;
    }
    else {
        return val;
    }
};

export const updateConfig = async (property: string, value: string) => {
    const config = vscode.workspace.getConfiguration(EXT_CONFIG_ID);
    await config.update(
        property,
        value,
        vscode.ConfigurationTarget.Workspace
    );
};