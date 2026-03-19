import { useState, useEffect } from 'react';

const SCREENS = {
  INPUT: 'input',
  ANALYSIS: 'analysis',
  TASKS: 'tasks',
  DETAIL: 'detail'
};

function App() {
  const [screen, setScreen] = useState(SCREENS.INPUT);
  const [prompt, setPrompt] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('beginner');
  const [useLocalLLM, setUseLocalLLM] = useState(false);
  
  const [resolution, setResolution] = useState('中');
  const [language, setLanguage] = useState('');
  const [approach, setApproach] = useState('');
  
  const [tasks, setTasks] = useState([]);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(-1);
  const [message, setMessage] = useState('');

  const API_BASE = 'http://localhost:8000';

  const ensureString = (val) => {
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }
    return String(val || '');
  };

  // 1-2. 分析開始
  const handleAnalyze = async () => {
    setMessage('AIが目的と経験レベルを分析中...');
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, experience_level: experienceLevel, use_local_llm: useLocalLLM })
      });
      const data = await res.json();
      
      setResolution(ensureString(data.resolution || '中'));
      setLanguage(ensureString(data.language || ''));
      setApproach(ensureString(data.approach || ''));
      
      setMessage('分析完了。提案を確認してください。');
      setScreen(SCREENS.ANALYSIS);
    } catch (e) {
      console.error(e);
      setMessage('エラー: ' + e.message);
    }
  };

  // 3. タスク分解
  const handleDecompose = async () => {
    setMessage('タスクを詳細に分解中...');
    try {
      const res = await fetch(`${API_BASE}/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          resolution, 
          language, 
          approach, 
          experience_level: experienceLevel,
          use_local_llm: useLocalLLM
        })
      });
      const data = await res.json();
      
      if (data && data.tasks) {
        setTasks(data.tasks.map(t => ({
          ...t,
          code: '',
          explanation: '',
          understanding: '',
          evaluation: '',
          status: 'pending'
        })));
        setMessage('タスクリストを作成しました。');
        setScreen(SCREENS.TASKS);
      } else {
        setMessage('タスクの生成に失敗しました。');
      }
    } catch (e) {
      console.error(e);
      setMessage('エラー: ' + e.message);
    }
  };

  // 6. 指定タスクの実装
  const handleImplement = async (index) => {
    const task = tasks[index];
    if (!task) return;

    if (task.code) {
      setSelectedTaskIndex(index);
      setScreen(SCREENS.DETAIL);
      return;
    }

    setMessage(`${task.name} の実装と解説を生成中...`);
    
    try {
      const res = await fetch(`${API_BASE}/implement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task: task.name, 
          context: prompt, 
          language,
          experience_level: experienceLevel,
          use_local_llm: useLocalLLM
        })
      });
      const data = await res.json();
      
      setTasks(prev => prev.map((t, i) => 
        i === index ? { 
          ...t, 
          code: ensureString(data.code || ''), 
          explanation: ensureString(data.explanation || '解説が生成されませんでした。'), 
          status: 'completed' 
        } : t
      ));
      
      setSelectedTaskIndex(index);
      setScreen(SCREENS.DETAIL);
      setMessage('実装完了。');
    } catch (e) {
      console.error(e);
      setMessage('エラー: ' + e.message);
    }
  };

  // 8. 理解度評価
  const handleEvaluate = async (index) => {
    const task = tasks[index];
    if (!task || !task.understanding) {
      setMessage('理解度の説明を入力してください。');
      return;
    }
    
    setMessage('理解度を評価中...');
    try {
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          technology: `${language} (${task.name})`, 
          answer: task.understanding,
          experience_level: experienceLevel,
          use_local_llm: useLocalLLM
        })
      });
      const data = await res.json();
      
      setTasks(prev => prev.map((t, i) => 
        i === index ? { ...t, evaluation: ensureString(data.evaluation) } : t
      ));
      setMessage('評価完了');
    } catch (e) {
      console.error(e);
      setMessage('エラー: ' + e.message);
    }
  };

  const updateTask = (index, field, value) => {
    setTasks(prev => prev.map((t, i) => 
      i === index ? { ...t, [field]: value } : t
    ));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_prompt: prompt,
          experience_level: experienceLevel,
          resolution,
          language,
          approach,
          tasks
        })
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (e) {
      setMessage('エラー: ' + e.message);
    }
  };

  const selectedTask = selectedTaskIndex >= 0 ? tasks[selectedTaskIndex] : null;

  // --- Render Components ---

  const Header = () => (
    <header style={{ borderBottom: '2px solid #2196F3', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px' }}>
      <h1 style={{ margin: 0, color: '#2196F3', cursor: 'pointer' }} onClick={() => setScreen(SCREENS.INPUT)}>
        リアサポ v2.5 <span style={{ fontSize: '0.5em', verticalAlign: 'middle', background: '#e3f2fd', padding: '4px 8px', borderRadius: '4px' }}>AI-Driven Learning</span>
      </h1>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.8em', color: '#666' }}>現在の進捗</div>
        <div style={{ fontWeight: 'bold' }}>{tasks.filter(t => t.status === 'completed').length} / {tasks.length} タスク完了</div>
      </div>
    </header>
  );

  const MessageBar = () => (
    <div style={{ 
      position: 'fixed', bottom: 20, right: 20, maxWidth: '400px',
      background: '#333', color: 'white', padding: '12px 20px', borderRadius: '8px', 
      fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 1000,
      display: message ? 'block' : 'none'
    }}>
      {message}
      <button onClick={() => setMessage('')} style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>×</button>
    </div>
  );

  return (
    <div style={{ padding: '20px', fontFamily: '"Helvetica Neue", Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333', minHeight: '100vh' }}>
      <Header />
      
      {/* 画面1: 入力 */}
      {screen === SCREENS.INPUT && (
        <section style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '30px', textAlign: 'center' }}>どのようなアプリを作りたいですか？</h2>
          
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>あなたのプロンプト:</label>
            <textarea 
              rows="6" style={{ width: '100%', padding: '20px', fontSize: '18px', borderRadius: '12px', border: '2px solid #eee', boxSizing: 'border-box', marginBottom: '15px', transition: 'border-color 0.3s' }}
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)} 
              placeholder="例: 「PythonでAIチャットボットを作りたい」「Reactで綺麗なTodoアプリを作りたい」など"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '15px' }}>経験レベル:</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '10px 15px', background: experienceLevel === 'beginner' ? '#e3f2fd' : 'white', borderRadius: '8px', border: `1px solid ${experienceLevel === 'beginner' ? '#2196F3' : '#ddd'}` }}>
                  <input type="radio" name="level" value="beginner" checked={experienceLevel === 'beginner'} onChange={() => setExperienceLevel('beginner')} style={{ marginRight: '10px' }} /> 初学者
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '10px 15px', background: experienceLevel === 'experienced' ? '#e3f2fd' : 'white', borderRadius: '8px', border: `1px solid ${experienceLevel === 'experienced' ? '#2196F3' : '#ddd'}` }}>
                  <input type="radio" name="level" value="experienced" checked={experienceLevel === 'experienced'} onChange={() => setExperienceLevel('experienced')} style={{ marginRight: '10px' }} /> 経験者
                </label>
              </div>
            </div>
            
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '15px' }}>LLM設定:</label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '10px 15px', background: useLocalLLM ? '#fff3e0' : 'white', borderRadius: '8px', border: `1px solid ${useLocalLLM ? '#ff9800' : '#ddd'}` }}>
                <input type="checkbox" checked={useLocalLLM} onChange={(e) => setUseLocalLLM(e.target.checked)} style={{ marginRight: '10px', width: '20px', height: '20px' }} /> 
                <span>ローカルLLMを使用 (Ollama/Gemma3)</span>
              </label>
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <button 
              onClick={handleAnalyze} 
              disabled={!prompt}
              style={{ 
                padding: '18px 60px', background: '#2196F3', color: 'white', border: 'none', 
                borderRadius: '40px', cursor: prompt ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '20px',
                boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)', transition: 'transform 0.2s, background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              学習プランを作成する
            </button>
          </div>
        </section>
      )}

      {/* 画面2: 分析結果 */}
      {screen === SCREENS.ANALYSIS && (
        <section style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: 0 }}>AIによる提案プラン</h2>
            <button onClick={() => setScreen(SCREENS.INPUT)} style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontWeight: 'bold' }}>← 入力に戻る</button>
          </div>

          <div style={{ background: '#e3f2fd', padding: '15px 25px', borderRadius: '12px', marginBottom: '30px', display: 'inline-block' }}>
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>推定される目的の解像度:</span> {resolution}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', marginBottom: '40px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: '#555' }}>推奨プログラミング言語:</label>
              <input 
                type="text" 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)} 
                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #eee', fontSize: '18px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: '#555' }}>主要機能と技術的アプローチ:</label>
              <textarea 
                rows="5" 
                value={approach} 
                onChange={(e) => setApproach(e.target.value)} 
                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #eee', fontSize: '16px', lineHeight: '1.6' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', borderTop: '2px solid #eee', paddingTop: '40px' }}>
            <button 
              onClick={handleAnalyze} 
              style={{ padding: '15px 30px', borderRadius: '30px', border: '2px solid #2196F3', background: 'white', color: '#2196F3', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🔄 別の提案をリクエスト
            </button>
            <button 
              onClick={handleDecompose} 
              style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '15px 50px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)' }}
            >
              このプランでタスク分解へ →
            </button>
          </div>
        </section>
      )}

      {/* 画面3: タスク一覧 */}
      {screen === SCREENS.TASKS && (
        <section style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: 0 }}>学習ステップ</h2>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={handleDecompose} style={{ background: '#f1f3f4', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>🔄 再構成</button>
              <button onClick={handleSave} style={{ background: '#333', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}>💾 保存</button>
            </div>
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '20px', width: '80px', textAlign: 'center' }}>完了</th>
                  <th style={{ padding: '20px' }}>タスク内容</th>
                  <th style={{ padding: '20px', width: '100px', textAlign: 'center' }}>理解度</th>
                  <th style={{ padding: '20px', width: '150px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #eee', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#fcfcfc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ textAlign: 'center', padding: '20px' }}>
                      <input 
                        type="checkbox" 
                        checked={task.status === 'completed'} 
                        onChange={(e) => updateTask(idx, 'status', e.target.checked ? 'completed' : 'pending')}
                        style={{ width: '22px', height: '22px', cursor: 'pointer' }} 
                      />
                    </td>
                    <td style={{ padding: '20px' }}>
                      <div style={{ fontWeight: task.status === 'completed' ? 'bold' : 'normal', color: task.status === 'completed' ? '#4CAF50' : '#333' }}>
                        {task.name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '20px', fontSize: '24px' }}>
                      {task.evaluation ? task.evaluation.split(' ')[0] : '-'}
                    </td>
                    <td style={{ textAlign: 'center', padding: '20px' }}>
                      <button 
                        onClick={() => handleImplement(idx)}
                        style={{ 
                          padding: '10px 20px', borderRadius: '20px', border: 'none', 
                          background: task.code ? '#2196F3' : '#e3f2fd', 
                          color: task.code ? 'white' : '#2196F3', 
                          cursor: 'pointer', fontWeight: 'bold'
                        }}
                      >
                        {task.code ? '詳細を見る' : '学習開始'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 画面4: 詳細 (コード/解説/評価) */}
      {screen === SCREENS.DETAIL && selectedTask && (
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>
          {/* 左: コードエディタ */}
          <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={() => setScreen(SCREENS.TASKS)} style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontWeight: 'bold' }}>← タスク一覧に戻る</button>
              <h3 style={{ margin: 0 }}>{selectedTask.name}</h3>
            </div>
            
            <textarea
              style={{ 
                width: '100%', height: '600px', 
                fontFamily: '"Fira Code", monospace', fontSize: '15px',
                padding: '25px', background: '#1e1e1e', color: '#d4d4d4',
                borderRadius: '12px', border: 'none', resize: 'vertical',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
                lineHeight: '1.6'
              }}
              value={selectedTask.code}
              onChange={(e) => updateTask(selectedTaskIndex, 'code', e.target.value)}
              placeholder="// ここにコードが表示されます。自由に編集して実験してみましょう。"
            />
          </div>

          {/* 右: 解説 & 評価 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ background: '#e3f2fd', padding: '30px', borderRadius: '16px', borderLeft: '8px solid #2196F3' }}>
              <h4 style={{ marginTop: 0, color: '#1976d2', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '24px', marginRight: '10px' }}>💡</span> AIの技術解説
              </h4>
              <div style={{ fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {selectedTask.explanation}
              </div>
            </div>

            <div style={{ background: '#fff9c4', padding: '30px', borderRadius: '16px', border: '1px solid #fbc02d' }}>
              <h4 style={{ marginTop: 0, marginBottom: '15px' }}>✍️ 理解度セルフチェック</h4>
              <p style={{ fontSize: '14px', marginBottom: '20px', color: '#6d4c41' }}>
                このコードが何をしているか、自分の言葉で説明してみましょう。
              </p>
              <textarea 
                rows="6" style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #fbc02d', fontSize: '15px', boxSizing: 'border-box', marginBottom: '20px' }}
                value={selectedTask.understanding} 
                onChange={(e) => updateTask(selectedTaskIndex, 'understanding', e.target.value)}
                placeholder="例: この関数はAPIからデータを取得し、JSONとして返しています..."
              />
              <button 
                onClick={() => handleEvaluate(selectedTaskIndex)} 
                disabled={!selectedTask.understanding}
                style={{ 
                  width: '100%', padding: '15px', 
                  background: '#fbc02d', border: 'none', borderRadius: '30px', 
                  fontWeight: 'bold', fontSize: '18px', cursor: selectedTask.understanding ? 'pointer' : 'not-allowed',
                  boxShadow: '0 4px 10px rgba(251, 192, 45, 0.3)'
                }}
              >
                AIに評価してもらう
              </button>
              
              {selectedTask.evaluation && (
                <div style={{ marginTop: '25px', padding: '20px', background: 'white', borderRadius: '12px', border: '2px solid #fbc02d' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>AIの評価:</div>
                  <div style={{ fontSize: '16px', lineHeight: '1.5' }}>{selectedTask.evaluation}</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <MessageBar />
    </div>
  );
}

export default App;
