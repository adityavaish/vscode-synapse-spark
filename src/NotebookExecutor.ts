import * as vscode from 'vscode';

import { KnownLivyStatementStates, KnownLivyStates, SparkClient, SparkSession, SparkSessionOptions, SparkStatement, SparkStatementOptions, SparkStatementOutput } from "@azure/synapse-spark";
import { getConfig } from "./ConfigManager";
import { getCredentials } from "./SynapseUtils";
import { executeMagicCommand } from './MagicCommands';

const getEndpoint = () => {
    return `https://${getConfig("workspaceName")}.dev.azuresynapse.net/livyApi/versions/2019-11-01-preview/sparkPools/${getConfig("cluster")}`;
};

let _sparkClient: SparkClient | undefined = undefined;
export const getSparkClient = (): SparkClient => {
    const workspaceName = getConfig("workspaceName");
    const cluster = getConfig("cluster");

    if (!_sparkClient && workspaceName && cluster) {
        _sparkClient = new SparkClient(getCredentials(), `https://${workspaceName}.dev.azuresynapse.net`, cluster || "");
    }

    if (!_sparkClient) {
        throw new Error("Unable to create spark client");
    }

    return _sparkClient;
};

const sparkSessionOperations: SparkSessionOptions = {
    name: "vscode-spark-extension-session" + Date.now().toString(),
    driverCores: 32,
    executorCores: 32,
    executorCount: 2,
    driverMemory: "224g",
    executorMemory: "224g",
    
};

let _sparkSession: SparkSession | undefined = undefined;
export const getSparkSession = async (): Promise<SparkSession | undefined> => {
    const sparkClient = getSparkClient();

    if (!_sparkSession) {
        const runningSparkSessions = await sparkClient.sparkSessionOperations.getSparkSessions();
        if (runningSparkSessions.sessions) {
            _sparkSession = runningSparkSessions.sessions.find(x => x.state === KnownLivyStates.Idle || x.state === KnownLivyStates.Running);
        }

        if (!_sparkSession) {
            _sparkSession = await getSparkClient()?.sparkSessionOperations.createSparkSession(sparkSessionOperations);
        }
    }
    else {
        _sparkSession = await sparkClient.sparkSessionOperations.getSparkSession(_sparkSession.id);
    }

    return _sparkSession;
};

export const submitCodeCell = async (
    code: string,
    execution: vscode.NotebookCellExecution): Promise<SparkStatementOutput | undefined> => {

    const sparkStatementOptions: SparkStatementOptions = {
        code: code,
        kind: 'spark',
    };
    const sparkClient = getSparkClient();
    const sparkSession = await getSparkSession();
    let sparkStatement: SparkStatement | undefined = undefined;

    if (sparkSession !== undefined) {
        if (code.startsWith("%")) {
            return await executeMagicCommand(code, execution);
        }
        else {
            sparkStatement = await sparkClient.sparkSessionOperations?.createSparkStatement(sparkSession.id, sparkStatementOptions);
            execution.replaceOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stdout(sparkStatement.state || 'unknown')]));
        }
    }

    return new Promise(async (resolve, reject) => {
        if (!sparkClient || !sparkSession || !sparkStatement) {
            reject();
            return;
        }

        const sparkStatementId = sparkStatement.id;

        const checkStatementUpdate = async () => {
            if (execution.token.isCancellationRequested) {
                reject();
            }
            
            const sparkStatementUpdate = await sparkClient.sparkSessionOperations.getSparkStatement(sparkSession.id, sparkStatementId);
            const state = sparkStatementUpdate.state || 'unknown';

            switch (state) {
                case KnownLivyStatementStates.Running:
                case KnownLivyStatementStates.Waiting:
                case KnownLivyStatementStates.Cancelling:
                    setTimeout(() => {
                        checkStatementUpdate();
                    }, .1);
                    break;
                case KnownLivyStatementStates.Available:
                    if (sparkStatementUpdate && sparkStatementUpdate.output) {
                        resolve(sparkStatementUpdate.output);
                    }
                    else {
                        reject();
                    }
                    break;
                case KnownLivyStatementStates.Cancelled:
                case KnownLivyStatementStates.Error:
                    reject();
                    break;
            }
        };

        await checkStatementUpdate();
    });
};