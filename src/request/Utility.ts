import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import axios from 'axios';

import { logger } from './Logger';

export function SetProxy() {
    const vscodeProxy = vscode.workspace.getConfiguration('http').get<string>('proxy');
    if (vscodeProxy) {
        axios.defaults.proxy = {
            host: new URL(vscodeProxy).hostname,
            port: parseInt(new URL(vscodeProxy).port),
            protocol: new URL(vscodeProxy).protocol,
        };
    }
}

export async function retry<T>(messgae: string, fn: () => Promise<T>, maxTries: number = 3): Promise<T> {
    let tries = 0;
    while (true) {
        try {
            return await fn();
        } catch (error: unknown) {
            if (tries !== maxTries) {
                logger.info(`Request failed, retrying for the ${tries + 1} time.`);
                tries += 1;
                if (axios.isAxiosError(error)) {
                    SetProxy();
                }
            } else {
                logger.error(`Request failed for ${messgae}, after ${tries} tries, error: ${error}`);
                throw error;
            }
        }
    }
}

export function GetEditor(path: string): vscode.TextEditor {
    if (path === 'active') {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor;
        }
        throw Error("No active editor found");
    } else {
        const uri = vscode.Uri.file(path);
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.path === uri.path) {
                return editor;
            }
        }
        throw Error("File not found: " + path);
    }
}

export async function ReadSource(path: string): Promise<string> {
    if (path === "active") {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.getText();
        }
        throw Error("No active editor found");
    }

    const uri = vscode.Uri.file(path);
    return await vscode.workspace.openTextDocument(uri).then(doc => doc.getText(), () => {
        const openDocuments = vscode.workspace.textDocuments;
        for (const doc of openDocuments) {
            if (doc.fileName === path) {
                return doc.getText();
            }
        }
        throw Error(`File not found: ${path}`);
    });
}

export async function ReadCMakeSource(src: string) {
    let cmakeSource = "";
    let files: { filename: string, contents: string }[] = [];

    const cmake = path.join(src, "CMakeLists.txt");
    if (fs.existsSync(cmake)) {
        cmakeSource = await ReadSource(cmake);
        for (const name of fs.readdirSync(src, { recursive: true })) {
            const filename = name as string;
            const fullname = path.join(src, filename);
            const stats = fs.statSync(fullname);
            if (stats.isFile()) {
                // TODO: Filters files according to the setting.json
                if (filename !== "CMakeLists.txt") {
                    files.push({ filename: filename, contents: fs.readFileSync(fullname, 'utf8') });
                }
            }
        };
        return { cmakeSource, files };
    }
    else {
        throw Error("CMakeLists.txt not found");
    }
}

export async function WriteFile(contents: string) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspacePath) {
        throw Error("No workspace folder found");
    }

    const dir = path.join(workspacePath, ".compiler-explorer");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    let index = 1;
    while (fs.existsSync(path.join(dir, `source${index}.cpp`))) {
        index += 1;
    }

    const filename = path.join(dir, `source${index}.cpp`);
    fs.writeFileSync(filename, contents, 'utf8');

    vscode.workspace.openTextDocument(filename).then(doc => vscode.window.showTextDocument(doc));

    return filename;
}

export async function WriteFiles(files: { filename: string, content: string }[]) {

    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspacePath) {
        throw Error("No workspace folder found");
    }

    const dir = path.join(workspacePath, ".compiler-explorer");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    let index = 1;
    while (fs.existsSync(path.join(dir, `cmake${index}`))) {
        index += 1;
    }

    const src = path.join(dir, `cmake${index}`);
    fs.mkdirSync(src);

    for (const file of files) {
        const fullname = path.join(src, file.filename);
        if (!fs.existsSync(path.dirname(fullname))) {
            fs.mkdirSync(path.dirname(fullname), { recursive: true });
        }
        fs.writeFileSync(fullname, file.content, 'utf8');
    }

    vscode.workspace.openTextDocument(path.join(src, "CMakeLists.txt")).then(doc => vscode.window.showTextDocument(doc));

    return src;
}