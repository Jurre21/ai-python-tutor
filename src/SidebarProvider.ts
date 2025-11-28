import * as vscode from "vscode";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    try {
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
            vscode.commands.executeCommand("ai-tutor.askBackend", data.value);
            break;
          }
          // --- ADD THESE CASES ---
          case "onExplain": {
            vscode.commands.executeCommand("ai-tutor.explainSelection");
            break;
          }
          case "onQuiz": {
            vscode.commands.executeCommand("ai-tutor.generateQuiz");
            break;
          }
          case "onRun": {
            vscode.commands.executeCommand("ai-tutor.runAndDebug");
            break;
          }
        }
      });
      
    } catch (err) {
      console.error('SidebarProvider.resolveWebviewView error', err);
    }
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
      vscode.Uri.joinPath(this._extensionUri, "media", "logo.svg")
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
          .msg-wrapper {
            display: flex;
            flex-direction: column;
            margin-bottom: 10px; /* Space between different messages */
          }

          .sender-label {
            font-size: 0.75rem;
            font-style: italic;
            margin-bottom: 4px;
            opacity: 0.7;
            font-family: var(--vscode-font-family);
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
      
        <div class="button-row">
          <button onclick="vscode.postMessage({ type: 'onExplain' })">🧠 Explain</button>
          <button onclick="vscode.postMessage({ type: 'onQuiz' })">📝 Quiz</button>
          <button onclick="vscode.postMessage({ type: 'onRun' })">▶️ Run</button>
        </div>

        <div class="chat-box" id="chat-container"></div>
        <input type="text" id="question-input" placeholder="Ask a question..." />

        <style>
            /* Add this simple styling for the buttons */
            .button-row {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 10px;
            cursor: pointer;
            width: 100%; /* Make them equal width */
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
        </style>

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
    
            // 1. Always try to remove an existing "Thinking..." bubble first
            const existingThinking = document.getElementById('thinking-bubble');
            if (existingThinking) {
              existingThinking.remove();
            }

            // 2. If the new message IS "Thinking...", add it with the ID
            if (message.value.includes('Thinking...')) {
              addMessage(message.value, 'ai-msg', 'thinking-bubble');
            } 
            // 3. Otherwise, it's a real answer, just add it normally
            else {
              addMessage(message.value, 'ai-msg');5
            }
          }
        });

          function addMessage(text, className, id = null) {
            const wrapper = document.createElement('div');
            wrapper.className = 'msg-wrapper';
            if (id) {
              wrapper.id = id;
            }
            const label = document.createElement('span');
            label.className = 'sender-label';

            if (className === 'user-msg') {
              wrapper.style.alignItems = 'flex-end'; // Align everything to the right
              label.innerText = 'You';
            } else {
              wrapper.style.alignItems = 'flex-start'; // Align everything to the left
              label.innerText = 'AI Python Tutor';
            }
            const messageDiv = document.createElement('div');
            messageDiv.className = className;
            messageDiv.innerHTML = text;
            wrapper.appendChild(label);
            wrapper.appendChild(messageDiv);
            chatContainer.appendChild(wrapper);
            window.scrollTo(0, document.body.scrollHeight);
          }
        </script>
      </body>
      </html>`;
  }
}