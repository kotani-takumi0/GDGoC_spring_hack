import os
import json
import logging
from typing import List, Optional, Literal, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 型定義のインポート
from .models.schemas import (
    PersonalizeRequest, PersonalizeResponse,
    GenerateCodeRequest, GenerateCodeResponse,
    MappingRequest, MappingResponse,
    EvaluateRequest, EvaluateResponse,
    AskRequest, AskResponse
)
# AIサービスのインポート
from .services.llm import call_llm

# =============================================================================
# 初期化
# =============================================================================

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Riasapo API (Python Backend)")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# データローダー
# =============================================================================

SCENARIOS_DIR = "data/scenarios"

def get_scenario(scenario_id: str) -> Dict[str, Any]:
    file_path = f"{SCENARIOS_DIR}/{scenario_id}.json"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

# =============================================================================
# ヘルパー関数
# =============================================================================

def find_line_range(full_code: str, snippet: str) -> Dict[str, int]:
    lines = full_code.split('\n')
    snippet_lines = snippet.split('\n')
    if not snippet_lines:
        return {"startLine": 0, "endLine": 0}
    
    snippet_first_line = snippet_lines[0].strip()
    if not snippet_first_line:
        return {"startLine": 0, "endLine": 0}

    for i, line in enumerate(lines):
        if snippet_first_line in line.strip():
            return {"startLine": i + 1, "endLine": i + len(snippet_lines)}
            
    return {"startLine": 0, "endLine": 0}

# =============================================================================
# API エンドポイント
# =============================================================================

@app.post("/api/personalize", response_model=PersonalizeResponse)
async def personalize(req: PersonalizeRequest):
    scenario = get_scenario(req.scenarioId)
    nodes = scenario.get("nodes", [])
    level_label = {'complete-beginner': '初心者', 'python-experienced': 'Python経験者', 'other-language-experienced': '他言語経験者'}[req.experienceLevel]

    prompt = f"プログラミング学習支援AIとして、以下の概念ノードの説明文を「{level_label}」に合わせて書き直してください。\n\n{json.dumps(nodes, ensure_ascii=False)}"
    schema = {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "title": {"type": "string"}, "subtitle": {"type": "string"}}, "required": ["id", "title", "subtitle"]}}
    
    result = await call_llm(prompt, schema, use_local_llm=req.useLocalLLM)
    return {"nodes": result}

@app.post("/api/generate-code", response_model=GenerateCodeResponse)
async def generate_code(req: GenerateCodeRequest):
    scenario = get_scenario(req.scenarioId)
    level_label = {'complete-beginner': '初心者', 'python-experienced': 'Python経験者', 'other-language-experienced': '他言語経験者'}[req.experienceLevel]
    
    prompt = f"シナリオ「{scenario.get('title')}」に基づき、TypeScriptのサンプルコードを生成してください。レベル: {level_label}。index.htmlを含め、グローバルスコープで動作するようにしてください。"
    schema = {"type": "object", "properties": {"files": {"type": "array", "items": {"type": "object", "properties": {"filename": {"type": "string"}, "code": {"type": "string"}, "description": {"type": "string"}}, "required": ["filename", "code", "description"]}}, "language": {"type": "string"}, "explanation": {"type": "string"}}, "required": ["files", "language", "explanation"]}

    result = await call_llm(prompt, schema, use_local_llm=req.useLocalLLM)
    return result

@app.post("/api/mapping", response_model=MappingResponse)
async def mapping(req: MappingRequest):
    nodes_data = [{"id": n.id, "title": n.title} for n in req.nodes]
    prompt = f"以下のコードと概念の対応関係を分析してください。\n\nNodes: {json.dumps(nodes_data, ensure_ascii=False)}\nCode: {req.code}"
    schema = {"type": "array", "items": {"type": "object", "properties": {"nodeId": {"type": "string"}, "codeSnippet": {"type": "string"}, "explanation": {"type": "string"}}, "required": ["nodeId", "codeSnippet", "explanation"]}}

    raw_mappings = await call_llm(prompt, schema, use_local_llm=req.useLocalLLM)
    enriched = [{**m, **find_line_range(req.code, m["codeSnippet"])} for m in raw_mappings]
    return {"mappings": enriched}

@app.post("/api/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest):
    prompt = f"概念「{req.nodeTitle}」についてのユーザーの回答「{req.userAnswer}」を、コード「{req.codeSnippet}」に照らして評価してください。"
    schema = {"type": "object", "properties": {"score": {"type": "number"}, "feedback": {"type": "string"}, "status": {"type": "string", "enum": ["green", "yellow", "red"]}}, "required": ["score", "feedback", "status"]}

    result = await call_llm(prompt, schema, use_local_llm=req.useLocalLLM)
    return {"nodeId": req.nodeId, "status": result["status"], "feedback": result["feedback"]}

@app.post("/api/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    prompt = f"学習者から「{req.scenarioTitle}」の「{req.nodeTitle} ({req.nodeSubtitle})」について質問がありました。レベル「{req.experienceLevel}」に合わせて答えてください。\n質問: {req.question}"
    schema = {"type": "object", "properties": {"answer": {"type": "string"}}, "required": ["answer"]}

    result = await call_llm(prompt, schema, use_local_llm=req.useLocalLLM)
    return {"answer": result["answer"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
