import * as vscode from 'vscode';
import { CompileResult, ExecuteResult } from "../request/CompileResult";
import path from 'node:path';

interface ShowWebviewParams {
    context: vscode.ExtensionContext;
    editor: vscode.TextEditor;
    result: { compileResult: CompileResult, executeResult?: ExecuteResult }
};

export async function ShowWebview(params: ShowWebviewParams) {
    const { context, editor, result } = params;

    const panel = vscode.window.createWebviewPanel(
        'compiler-explorer-webview',
        'Compiler Explorer',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getWebviewHtml(context.extensionPath, panel);

    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'ready': {
                panel.webview.postMessage({ command: 'setResults', results: result });
            } return;
            case 'gotoLine': {
                const lineNo = message.lineNo as number;
                if (lineNo < 0 || lineNo === editor.selection.active.line || lineNo >= editor.document.lineCount) {
                    break;
                }

                editor.selection = new vscode.Selection(lineNo, 0, lineNo, 0);
                editor.revealRange(
                    new vscode.Range(lineNo, 0, lineNo, 0),
                    vscode.TextEditorRevealType.InCenter
                );
            } return;
        }
    });

    const disposable = vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor === editor) {
            const lineNo = editor.selection.active.line;
            panel.webview.postMessage({ command: 'gotoLine', lineNo });
        }
    });

    context.subscriptions.push(disposable);
};

export async function ClearWebview() {

}

function getWebviewHtml(extensionPath: string, panel: vscode.WebviewPanel): string {
    const getUri = (webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) => {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
    };

    const buildPath = path.join(extensionPath, 'webview-ui', 'build');
    const scriptPath = path.join(buildPath, 'assets', 'index.js');
    const stylePath = path.join(buildPath, 'assets', 'index.css');

    return `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.file(stylePath))}">
            <title>React Webview</title>
        </head>
        <body>
            <div id="root"></div>
            <script src="${panel.webview.asWebviewUri(vscode.Uri.file(scriptPath))}"></script>
        </body>
    </html>`;
}