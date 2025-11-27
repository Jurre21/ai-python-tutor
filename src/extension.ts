import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SidebarProvider } from './SidebarProvider';

// Configuration: Your FastAPI Backend URL
const BACKEND_URL = 'http://127.0.0.1:8000';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations! "ai-python-tutor" is now active!');

    // 1. Register the Sidebar View
    const sidebarProvider = new SidebarProvider(context.extensionUri);

    try {
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('ai-tutor.chatView', sidebarProvider)
        );
        console.log('Sidebar Provider registered successfully!');
    } catch (err) {
        console.error('Failed to register Sidebar Provider', err);
    }

    // Helper: Send Data to Backend
    const sendToBackend = async (endpoint: string, payload: any) => {
        try {
            // Show loading state
            sidebarProvider.updateContent('<i>Thinking...</i>');

            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server Error: ${response.statusText}`);
            }

            const data: any = await response.json();
            const resultText = data.analysis || data.quiz || data.answer || data.summary || '';
            sidebarProvider.updateContent(resultText.replace(/\n/g, '<br>'));
        } catch (error) {
            vscode.window.showErrorMessage('Failed to connect to AI Tutor Backend.');
            sidebarProvider.updateContent(`<b>Error:</b> Could not connect to backend at ${BACKEND_URL}`);
        }
    };

    // --- COMMAND 1: Explain Selection ---
    context.subscriptions.push(
vscode.commands.registerCommand('ai-tutor.explainSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const selection = editor.selection;
            // FIX 3: Get the actual text, don't send the Selection object
            const text = editor.document.getText(selection); 

            if (!text) {
                vscode.window.showInformationMessage('Please select some code first.');
                return;
            }

            vscode.commands.executeCommand('ai-tutor.chatView.focus');
            sendToBackend('/analyze', { code: text }); // Send 'text', not 'selection'
        })
    );

    // --- COMMAND 2: Generate Quiz ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.generateQuiz', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.document.getText(editor.selection);

            // FIX: Stop if nothing is selected
            if (!selection) {
                vscode.window.showInformationMessage('Please select some code to quiz first.');
                return;
            }

            vscode.commands.executeCommand('ai-tutor.chatView.focus');
            // Fix: Send only the selection
            sendToBackend('/quiz', { code_or_topic: selection });
        })
    );

    // --- COMMAND 3: Run & Debug ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.runAndDebug', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            // 1. Get Selected Text
            const selection = editor.document.getText(editor.selection);
        
            // 2. Guard Clause: Stop if empty
            if (!selection) {
                vscode.window.showInformationMessage('Please select the code you want to run.');
                return;
            }

            // 3. Write selection to a temporary file
            // We do this because Python cannot easily run multi-line strings from the command line
            const tempFilePath = path.join(os.tmpdir(), 'temp_run.py');
            fs.writeFileSync(tempFilePath, selection);

            vscode.window.showInformationMessage(`Running selection...`);

            const pythonPath = vscode.workspace.getConfiguration('python').get('defaultInterpreterPath') || 'python';

            // 4. Execute the TEMPORARY file, not the original document
            cp.exec(`"${pythonPath}" "${tempFilePath}"`, (err, stdout, stderr) => {
                vscode.commands.executeCommand('ai-tutor.chatView.focus');

                if (err !== null || stderr !== '') {
                    const errorMsg = stderr || (err !== null ? err.message : 'Unknown Error');
                    vscode.window.showErrorMessage('Code failed! Asking AI Tutor...');
                
                    // 5. Send ONLY the selection to the backend for analysis
                    sendToBackend('/analyze', {
                        code: selection, // <-- Send selection, NOT editor.document.getText()
                        error_output: errorMsg
                    });
                } else {
                    sidebarProvider.updateContent(`<b>Execution Success:</b><br><pre>${stdout}</pre>`);
                }
            });
        })
    );

    // --- COMMAND 4: Handle Chat Questions ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.askBackend', (question: string) => {
            if (question !== null && question !== '') {
                sendToBackend('/followup', { question: question });
            }
        })

        
    );

    // --- COMMAND 5: Test Backend Connection ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.testBackend', async () => {
            const sidebarProvider = new SidebarProvider(context.extensionUri);
            try {
                sidebarProvider.updateContent("<i>Testing backend...</i>");

                const response = await fetch(`${BACKEND_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code: 'print("Hello World")',
                    workspace: "ai-tutor"})
            });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                sidebarProvider.updateContent(`<b>Backend reachable!</b><br>Response: ${JSON.stringify(data)}`);
                vscode.window.showInformationMessage("Backend connection successful!");
            } catch (err: any) {
                console.error(err);
                sidebarProvider.updateContent(`<b>Backend connection failed:</b><br>${err.message}`);
                vscode.window.showErrorMessage(`Backend connection failed: ${err.message}`);
            }

        // Show the sidebar
            vscode.commands.executeCommand('ai-tutor.chatView.focus');
        })
    );

}

export function deactivate() {}
