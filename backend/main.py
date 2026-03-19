import os
import json
import requests
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Gemini API setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY or GEMINI_API_KEY == "your_api_key_here":
    print("WARNING: GEMINI_API_KEY not set in .env")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    
GEMINI_MODEL = "gemini-2.5-flash-lite"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:4b"

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class AnalyzeRequest(BaseModel):
    prompt: str
    experience_level: str  # "beginner" or "experienced"
    use_local_llm: bool = False

class DecomposeRequest(BaseModel):
    prompt: str
    resolution: str
    language: str
    approach: str
    experience_level: str
    use_local_llm: bool = False

class ImplementRequest(BaseModel):
    task: str
    context: str
    language: str
    experience_level: str
    use_local_llm: bool = False

class EvaluateRequest(BaseModel):
    technology: str
    answer: str
    experience_level: str
    use_local_llm: bool = False

# --- LLM Helper ---
def call_llm(prompt: str, use_local_llm: bool, is_json: bool = False) -> str:
    if use_local_llm:
        try:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            }
            if is_json:
                payload["format"] = "json"
            
            response = requests.post(OLLAMA_URL, json=payload, timeout=60)
            response.raise_for_status()
            return response.json().get("response", "")
        except Exception as e:
            print(f"Ollama Error: {e}")
            raise HTTPException(status_code=503, detail=f"Local LLM (Ollama) is not available: {str(e)}")
    else:
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini Error: {e}")
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")

def parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Attempt to find JSON in the string if it's not pure
        import re
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise

# --- Endpoints ---

@app.post("/analyze")
async def analyze_prompt(req: AnalyzeRequest):
    """2. プロンプトを分析し、解像度・言語・技術的アプローチを提案する"""
    prompt = (
        f"あなたは優秀なシニアエンジニアです。以下のプロンプトを分析し、JSON形式で回答してください。\n"
        f"ユーザーの経験レベル: {req.experience_level}\n\n"
        f"1. resolution: ユーザーの目的の解像度を「低・中・高」の3段階で判定してください。\n"
        f"2. language: 最適なプログラミング言語（文字列のみ）\n"
        f"3. approach: 実装すべき主要機能と技術的アプローチの簡潔な説明（文字列のみ）\n\n"
        f"プロンプト: {req.prompt}\n\n"
        f"重要：回答は純粋なJSONで返し、各値は必ず「文字列」にしてください。コードブロックは含めないでください。"
    )
    
    try:
        text = call_llm(prompt, req.use_local_llm, is_json=True)
        data = parse_json_response(text)
        
        def ensure_string(val):
            if isinstance(val, (dict, list)):
                return json.dumps(val, ensure_ascii=False)
            return str(val) if val is not None else ""

        return {
            "resolution": ensure_string(data.get("resolution", "中")),
            "language": ensure_string(data.get("language", "Python")),
            "approach": ensure_string(data.get("approach", "標準的な構成"))
        }
    except Exception as e:
        print(f"ERROR in /analyze: {str(e)}")
        return {
            "resolution": "中",
            "language": "Python",
            "approach": "分析中にエラーが発生しました。手動で入力も可能です。"
        }

@app.post("/decompose")
async def decompose_tasks(req: DecomposeRequest):
    """3. 解像度・言語に応じたタスクの分解。初学者や低解像度の場合はより細かく分解する。"""
    level_instruction = ""
    if req.experience_level == "beginner":
        level_instruction = "ユーザーは完全な初学者です。専門用語を避け、一歩ずつ進めるようにしてください。"
    else:
        level_instruction = "ユーザーは経験者です。効率的な実装ステップを提案してください。"

    resolution_instruction = ""
    if req.resolution == "低":
        resolution_instruction = (
            "目的の解像度が低いため、以下のフェーズを含めて非常に細かく（10〜15個程度）分解してください：\n"
            "1. コンセプト設計（何を作るか、誰が使うか）\n"
            "2. 技術選定の理由と概要\n"
            "3. 開発環境のセットアップ（OSごとの注意点など）\n"
            "4. 基礎文法の学習（このアプリに必要な最小限）\n"
            "5. 小さな機能ごとの実装ステップ\n"
            "6. デバッグとテストのやり方"
        )
    else:
        resolution_instruction = "実装に必要なタスクを論理的な粒度で7〜10個程度に分解してください。"

    prompt = (
        f"以下の条件で、実装すべきタスクをリスト形式（JSON）で詳細に分解してください。\n"
        f"条件:\n"
        f"- プロンプト: {req.prompt}\n"
        f"- 解像度: {req.resolution}\n"
        f"- 経験レベル: {req.experience_level}\n"
        f"- 使用言語: {req.language}\n"
        f"- 技術的アプローチ: {req.approach}\n\n"
        f"{level_instruction}\n"
        f"{resolution_instruction}\n\n"
        f"回答は ['タスク1', 'タスク2', ...] という純粋なJSONリストのみで返してください。"
    )

    try:
        text = call_llm(prompt, req.use_local_llm, is_json=True)
        tasks = parse_json_response(text)
        if not isinstance(tasks, list):
            if isinstance(tasks, dict) and "tasks" in tasks:
                tasks = tasks["tasks"]
            else:
                tasks = ["環境構築", "基本設計", "メイン機能の実装"]
        
        return {"tasks": [{"name": str(t), "status": "pending"} for t in tasks]}
    except Exception as e:
        print(f"ERROR in /decompose: {str(e)}")
        default_tasks = ["環境構築", "基本設計", "メイン機能の実装", "UIの調整", "テストと修正"]
        return {"tasks": [{"name": t, "status": "pending"} for t in default_tasks]}

@app.post("/implement")
async def implement_task(req: ImplementRequest):
    """6. コーディングと解説を構造化して提供する"""
    explanation_style = (
        "初学者向けに、一行ずつの意味を丁寧に説明し、難しい概念は例え話を使ってください。"
        if req.experience_level == "beginner" else
        "経験者向けに、アーキテクチャやパフォーマンス、ベストプラクティスに焦点を当てて簡潔に説明してください。"
    )

    prompt = (
        f"言語「{req.language}」を用いて、タスク「{req.task}」を実装するためのコードと解説を行ってください。\n"
        f"全体の文脈: {req.context}\n"
        f"ユーザーの経験レベル: {req.experience_level}\n\n"
        f"【指示】\n"
        f"- {explanation_style}\n"
        f"- 回答は以下のJSON形式で返してください（純粋なJSON）:\n"
        f"{{\n"
        f"  \"code\": \"ここに実装コードを文字列として\",\n"
        f"  \"explanation\": \"ここに詳細な解説（マークダウン形式可）\"\n"
        f"}}\n"
    )
    
    try:
        text = call_llm(prompt, req.use_local_llm, is_json=True)
        try:
            data = parse_json_response(text)
            return data
        except:
            return {
                "code": text,
                "explanation": "技術解説の抽出に失敗しましたが、上記にコードと解説が含まれています。"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate")
async def evaluate_understanding(req: EvaluateRequest):
    """8. 理解度評価（⭕️, △, ❌）"""
    prompt = (
        f"技術「{req.technology}」に対して、ユーザーから以下の理解度の説明がありました。\n"
        f"回答: {req.answer}\n\n"
        f"内容を評価し、もっとも適切な評価を「⭕️」「△」「❌」のいずれか一文字で選んでください。\n"
        f"また、その評価の理由を1文で添えてください。\n"
        f"形式: ⭕️ [理由]"
    )
    
    try:
        text = call_llm(prompt, req.use_local_llm)
        return {"evaluation": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save")
async def save_project(project: dict):
    """9. プロジェクト保存"""
    project_id = project.get("id", "project_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
    file_path = f"backend/data/{project_id}.json"
    
    os.makedirs("backend/data", exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(project, f, ensure_ascii=False, indent=2)
    
    return {"message": f"Project saved to {file_path}", "id": project_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
