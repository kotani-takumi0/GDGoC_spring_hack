import os
import json
import logging
import requests
import time
import google.generativeai as genai
from typing import Any

# =============================================================================
# 初期化
# =============================================================================

logger = logging.getLogger(__name__)

# デフォルト設定 (環境変数)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Gemini 設定
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-1.5-flash")
else:
    gemini_model = None
    logger.warning("GEMINI_API_KEY is not set. Gemini calls will fail.")

# =============================================================================
# LLM 呼び出し関数
# =============================================================================

async def call_llm(prompt: str, response_schema: Any, use_local_llm: bool = False) -> Any:
    """
    引数に応じて Gemini または Ollama (Gemma 3) を呼び出す統一インターフェース。
    """
    start_time = time.time()
    model_name = "Gemma 3 (Local)" if use_local_llm else "Gemini 1.5 Flash (Cloud)"
    
    logger.info(f"--- LLM Call Started: {model_name} ---")
    
    if not use_local_llm:
        if not gemini_model:
            raise Exception("Gemini API key is not configured.")
        try:
            response = gemini_model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema
                )
            )
            elapsed = time.time() - start_time
            logger.info(f"--- LLM Call Finished (Success): {elapsed:.2f}s ---")
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            raise Exception(f"Gemini API Error: {str(e)}")

    else:
        # --- Ollama / Gemma 3 呼び出し ---
        schema_info = json.dumps(response_schema, ensure_ascii=False)
        ollama_prompt = f"{prompt}\n\nReturn the response in ONLY valid JSON format that matches this schema: {schema_info}"
        
        # モデル名を確認してください。Ollamaでの正確な名前を指定する必要があります。
        # 例: "gemma3", "gemma3:4b", "gemma3:12b" など
        payload = {
            "model": "gemma3:4b", 
            "prompt": ollama_prompt,
            "stream": False,
            "format": "json"
        }
        
        try:
            logger.info(f"Requesting Ollama: {OLLAMA_BASE_URL}/api/generate with model 'gemma3'")
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate", 
                json=payload,
                timeout=180
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", response.text)
                except:
                    pass
                logger.error(f"Ollama Error ({response.status_code}): {error_detail}")
                raise Exception(f"Ollama Error: {error_detail}")

            elapsed = time.time() - start_time
            logger.info(f"--- LLM Call Finished (Success): {elapsed:.2f}s ---")
            
            result_data = response.json()
            response_text = result_data.get("response", "{}")
            return json.loads(response_text)
            
        except requests.exceptions.Timeout:
            logger.error("Ollama request timed out after 180s.")
            raise Exception("Local LLM timeout.")
        except Exception as e:
            logger.error(f"Local LLM Exception: {str(e)}")
            raise e
