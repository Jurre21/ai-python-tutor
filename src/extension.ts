// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { SidebarProvider } from './SidebarProvider';

// Configuration: Your FastAPI Backend URL
const BACKEND_URL = 'http://127.0.0.1:8000';

export function activate(context: vscode.ExtensionContext) {
    
    // 1. Register the Sidebar View
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("ai-tutor.chatView", sidebarProvider)
    );

    // Helper: Send Data to Backend
    const sendToBackend = async (endpoint: string, payload: any) => {
        try {
            // Show loading state
            sidebarProvider.updateContent("<i>Thinking...</i>");

            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
            
            const data = await response.json();
            // Depending on endpoint, get the right field
            const resultText = data.analysis |

| data.quiz |
| data.answer |
| data.summary;
            
            sidebarProvider.updateContent(resultText.replace(/\n/g, "<br>")); // Simple formatting
        } catch (error) {
            vscode.window.showErrorMessage("Failed to connect to AI Tutor Backend.");
            sidebarProvider.updateContent(`<b>Error:</b> Could not connect to backend at ${BACKEND_URL}`);
        }
    };

    // --- COMMAND 1: Explain Selection ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.explainSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showInformationMessage("Please select some code first.");
                return;
            }

            // Show sidebar and send request
            vscode.commands.executeCommand('ai-tutor.chatView.focus');
            sendToBackend('/analyze', { code: selection });
        })
    );

    // --- COMMAND 2: Generate Quiz ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.generateQuiz', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const selection = editor.document.getText(editor.selection);
            vscode.commands.executeCommand('ai-tutor.chatView.focus');
            sendToBackend('/quiz', { code_or_topic: selection |

| "Python Concepts" });
        })
    );

    // --- COMMAND 3: Run & Debug (The "Magic" Feature) ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.runAndDebug', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const filePath = editor.document.fileName;
            vscode.window.showInformationMessage(`Running ${filePath}...`);

            // Execute Python locally
            cp.exec(`python3 "${filePath}"`, (err, stdout, stderr) => {
                vscode.commands.executeCommand('ai-tutor.chatView.focus');
                
                if (err |

| stderr) {
                    // ERROR FOUND: Send code + error to backend for debugging
                    const errorMsg = stderr |

| err?.message |
| "Unknown Error";
                    vscode.window.showErrorMessage("Code failed! Asking AI Tutor...");
                    
                    sendToBackend('/analyze', { 
                        code: editor.document.getText(),
                        error_output: errorMsg 
                    });
                } else {
                    // SUCCESS: Just show output
                    sidebarProvider.updateContent(`<b>Execution Success:</b><br><pre>${stdout}</pre>`);
                    // Optionally send to backend for "success explanation"
                }
            });
        })
    );

    // --- COMMAND 4: Handle Chat Questions ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-tutor.askBackend', (question: string) => {
            sendToBackend('/followup', { question: question });
        })
    );
}

export function deactivate() {}


