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
          if (!data.value) {
            return;
          }
          // Send the user's question to the Extension Logic
          vscode.commands.executeCommand("ai-tutor.askBackend", data.value);
          break;
        }
      }
    });
  }

  public updateContent(htmlContent: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "add-response",
        value: htmlContent,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // 1. Get the URI for your logo (Assumes you have a 'media/logo.png' file)
    // If you don't have a logo yet, this line is harmless, but the image won't show.
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "logo.png")
    );

    // 2. Define the Content Security Policy (CSP)
    // This allows:
    // - Images from local extension files (vscode-resource:) and https
    // - Styles from local extension and inline styles
    // - Scripts from inline sources (for this simple example)
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src ${webview.cspSource} 'unsafe-inline';
      img-src ${webview.cspSource} https:;
    `;

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Python Tutor</title>
        <style>
          body { 
            font-family: var(--vscode-font-family); 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 10px; 
          }
          .header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
          }
          .header img {
            width: 30px; 
            height: 30px;
          }
          .chat-box { 
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
            margin-bottom: 15px;
          }
          .user-msg { 
            align-self: flex-end; 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            padding: 8px 12px; 
            border-radius: 5px; 
            max-width: 80%;
          }
          .ai-msg { 
            align-self: flex-start; 
            background: var(--vscode-editor-inactiveSelectionBackground); 
            padding: 8px 12px; 
            border-radius: 5px; 
            border: 1px solid var(--vscode-widget-border); 
            max-width: 90%;
          }
          input { 
            width: 100%; 
            padding: 8px; 
            box-sizing: border-box; 
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          input:focus {
            outline: 1px solid var(--vscode-focusBorder);
          }
        </style>
      </head>
      <body>
        
        <div class="header">
            <img src="${logoUri}" alt="Logo" />
            <h3>AI Python Tutor</h3>
        </div>

        <div class="chat-box" id="chat-container"></div>
        <input type="text" id="question-input" placeholder="Ask a follow-up..." />

        <script>
          const vscode = acquireVsCodeApi();
          const chatContainer = document.getElementById('chat-container');
          const input = document.getElementById('question-input');

          // Handle Enter key
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const text = input.value;
              if(!text) return;
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
            div.innerHTML = text; 
            chatContainer.appendChild(div);
            // Auto-scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
          }
        </script>
      </body>
      </html>`;
  }
}