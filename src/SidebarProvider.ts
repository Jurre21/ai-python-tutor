import * as vscode from "vscode";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for messages from the HTML UI
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "onAskQuestion": {
          if (!data.value) return;
          // Send the user's question to the Extension Logic (Phase 4)
          vscode.commands.executeCommand("ai-tutor.askBackend", data.value);
          break;
        }
      }
    });
  }

  // A public method to send HTML content TO the sidebar (e.g., answers from AI)
  public updateContent(htmlContent: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "add-response",
        value: htmlContent,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Basic chat UI styles and scripts
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: var(--vscode-font-family); padding: 10px; }
         .chat-box { display: flex; flex-direction: column; gap: 10px; }
         .user-msg { align-self: flex-end; background: #007acc; color: white; padding: 8px; border-radius: 5px; }
         .ai-msg { align-self: flex-start; background: #252526; padding: 8px; border-radius: 5px; border: 1px solid #333; }
          input { width: 100%; padding: 8px; box-sizing: border-box; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h3>🐍 AI Python Tutor</h3>
        <div class="chat-box" id="chat-container"></div>
        <input type="text" id="question-input" placeholder="Ask a follow-up..." />

        <script>
          const vscode = acquireVsCodeApi();
          const chatContainer = document.getElementById('chat-container');
          const input = document.getElementById('question-input');

          // Handle Enter key to send message
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const text = input.value;
              input.value = '';
              addMessage(text, 'user-msg');
              vscode.postMessage({ type: 'onAskQuestion', value: text });
            }
          });

          // Handle messages FROM the extension
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'add-response') {
              addMessage(message.value, 'ai-msg');
            }
          });

          function addMessage(text, className) {
            const div = document.createElement('div');
            div.className = className;
            div.innerHTML = text; // Using innerHTML to render simple formatting
            chatContainer.appendChild(div);
          }
        </script>
      </body>
      </html>`;
  }
}
