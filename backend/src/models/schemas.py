from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel

# ユーザーの経験レベルの定義
ExperienceLevel = Literal['complete-beginner', 'python-experienced', 'other-language-experienced']

# 概念ノードの基本データ構造
class ConceptNodeData(BaseModel):
    id: str
    title: str
    subtitle: str
    status: Optional[str] = "default"

# パーソナライズ (Step 2)
class PersonalizeRequest(BaseModel):
    scenarioId: str
    experienceLevel: ExperienceLevel
    useLocalLLM: bool = False

class PersonalizedNode(BaseModel):
    id: str
    title: str
    subtitle: str

class PersonalizeResponse(BaseModel):
    nodes: List[PersonalizedNode]

# コード生成 (Step 3)
class GenerateCodeRequest(BaseModel):
    scenarioId: str
    experienceLevel: ExperienceLevel
    useLocalLLM: bool = False

class GeneratedFile(BaseModel):
    filename: str
    code: str
    description: str

class GenerateCodeResponse(BaseModel):
    files: List[GeneratedFile]
    language: str
    explanation: str

# 概念-コードマッピング (Step 4)
class NodeBrief(BaseModel):
    id: str
    title: str

class MappingRequest(BaseModel):
    scenarioId: str
    code: str
    nodes: List[NodeBrief]
    useLocalLLM: bool = False

class ConceptCodeMapping(BaseModel):
    nodeId: str
    codeSnippet: str
    explanation: str
    start_line: Optional[int] = 0
    end_line: Optional[int] = 0

class MappingResponse(BaseModel):
    mappings: List[ConceptCodeMapping]

# 理解度評価 (Step 5)
class EvaluateRequest(BaseModel):
    nodeId: str
    nodeTitle: str
    codeSnippet: str
    userAnswer: str
    experienceLevel: ExperienceLevel
    useLocalLLM: bool = False

class EvaluateResponse(BaseModel):
    nodeId: str
    status: Literal['green', 'yellow', 'red']
    feedback: str

# AIへの質問 (QA)
class AskRequest(BaseModel):
    nodeId: str
    nodeTitle: str
    nodeSubtitle: str
    question: str
    scenarioTitle: str
    experienceLevel: ExperienceLevel
    useLocalLLM: bool = False

class AskResponse(BaseModel):
    answer: str
