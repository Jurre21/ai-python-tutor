import os
import httpx  # Modern, async-capable HTTP client
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware

# --- Configuration ---------------------------------------------------

# Get these from your AnythingLLM instance (Settings > API Keys)
ANYTHINGLLM_HOST = "http://localhost:3001"
# Make sure to replace this with your actual key
ANYTHINGLLM_API_KEY = "V7ZRM7Z-QEA4WZF-HVEQYTM-DGEW8W5" 

# --- Pydantic Models (Defines API input structure) -------------------

class AnalyzeRequest(BaseModel):
    code: str
    error_output: str | None = None
    session_id: str | None = None

class QuizRequest(BaseModel):
    code_or_topic: str
    session_id: str | None = None

class FollowupRequest(BaseModel):
    question: str
    session_id: str | None = None 

class DocsRequest(BaseModel):
    library_name: str
    session_id: str | None = None

class AnythingLLMResponse(BaseModel):
    """A simplified model for the part of AnythingLLM's response we care about."""
    textResponse: str
    sources: List = () # <-- FIX 1: Added default value

# --- FastAPI App Initialization --------------------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (ok for local dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- Core API Logic (The "Translator") -------------------------------

async def query_anythingllm(workspace_slug: str, prompt: str, mode: str, session_id: str | None = None) -> AnythingLLMResponse:
    """
    A helper function to send a query to a specific AnythingLLM workspace.
    
    :param workspace_slug: The name of the workspace (e.g., "python-tutor")
    :param prompt: The fully-formed prompt for the LLM
    :param mode: "chat" (generative) or "query" (strict RAG)
    :param session_id: The ID to maintain chat history
    """
    api_url = f"{ANYTHINGLLM_HOST}/api/v1/workspace/{workspace_slug}/chat"
    headers = {
        "Authorization": f"Bearer {ANYTHINGLLM_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "message": prompt,
        "mode": mode
    }
    
    if session_id:
        payload["sessionId"] = session_id

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(api_url, headers=headers, json=payload)
            response.raise_for_status()
            
            data = response.json()

            # --- FIX 2: Correctly parse the JSON response ---
            # Check for the two common response structures
            if 'result' in data and 'textResponse' in data['result']:
                # Standard chat response
                return AnythingLLMResponse(
                    textResponse=data['result'], # <-- CORRECTED
                    sources=data.get('sources',)
                )
            elif 'textResponse' in data:
                # Simpler response structure
                return AnythingLLMResponse(
                    textResponse=data,          # <-- CORRECTED
                    sources=data.get('sources',)
                )
            else:
                 raise HTTPException(status_code=500, detail=f"Unexpected API response format: {data}")
            # --- End of FIX 2 ---

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# --- API Endpoints (Your Prototype's "Functions") --------------------

@app.post("/analyze")
async def analyze_code(request: AnalyzeRequest):
    """
    Explains code, finds improvements, and debugs errors.
    """
    if request.error_output:
        # --- DEBUGGING PROMPT (Grounded in the actual error) ---
        prompt = f"""
        You are a Socratic Python tutor. A student's code failed.
        
        Here is the code:
        ```python
        {request.code}
        ```
        
        It produced this exact error traceback:
        ```
        {request.error_output}
        ```
        
        Analyze the code and the error. In a structured response, provide:
        1.  **Explanation:** A line-by-line explanation of the code's logic.
        2.  **Error Analysis:** A clear, beginner-friendly explanation of what the error means and why it happened.
        3.  **Suggestion:** A Socratic hint (a question, not the answer) to guide the student to fix the bug.
        """
    else:
        # --- STANDARD ANALYSIS PROMPT ---
        prompt = f"""
        You are a Socratic Python tutor. A student wants to understand a piece of code.
        
        Here is the code:
        ```python
        {request.code}
        ```
        
        In a structured response, provide:
        1.  **Explanation:** A line-by-line explanation of what the code does.
        2.  **Mistakes/Improvements:** Identify any potential bugs, style issues, or conceptual errors.
        3.  **Suggestions:** Offer 1-2 concrete suggestions for improvement (e.g., readability, efficiency).
        4.  **Difficulty Rating:** Rate the code's complexity (Beginner, Intermediate, Advanced).
        """
    
    response = await query_anythingllm("python-tutor", prompt, "chat", request.session_id)
    return {"analysis": response.textResponse}


@app.post("/quiz")
async def generate_quiz(request: QuizRequest):
    """
    Generates a short quiz based on the code or topic.
    """
    prompt = f"""
    You are a Python tutor. Based on the following code snippet or topic, generate a 
    3-question multiple-choice quiz to test a student's understanding.
    
    Provide the questions, options, and the correct answer for each.
    
    Topic/Code:
    {request.code_or_topic}
    """
    
    response = await query_anythingllm("python-tutor", prompt, "chat", request.session_id)
    return {"quiz": response.textResponse}


@app.post("/followup")
async def handle_followup(request: FollowupRequest):
    """
    Handles a follow-up conceptual question.
    """
    prompt = f"""
    You are a Socratic Python tutor. A student has a follow-up question. 
    Answer it clearly and concisely, then ask a related question to check their understanding.
    
    Student's Question:
    {request.question}
    """
    
    response = await query_anythingllm("python-tutor", prompt, "chat", request.session_id)
    return {"answer": response.textResponse}


@app.post("/docs")
async def get_docs(request: DocsRequest):
    """
    Gets a summary of a library from the ingested Python documentation.
    """
    prompt = f"""
    Using only the provided documentation, what is the library '{request.library_name}' 
    and what is its main purpose?
    """
    
    # Use "query" mode to force RAG and prevent hallucination
    response = await query_anythingllm("python-docs", prompt, "query", request.session_id)
    
    return {"summary": response.textResponse, "sources": response.sources}
