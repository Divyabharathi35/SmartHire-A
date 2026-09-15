// ============================================================
//  AIConfig.jsx — AI Provider & Gemini Model Configuration
// ============================================================
import { useState, useEffect } from 'react';
import { Bot, Key, Sliders, CheckCircle, Save, AlertCircle, RefreshCw, Cpu, Layers } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AIConfig() {
  const [provider, setProvider]               = useState('gemini');
  const [geminiKey, setGeminiKey]             = useState('');
  const [openaiKey, setOpenaiKey]             = useState('');
  const [defaultModel, setDefaultModel]       = useState('gemini-3.6-flash');
  const [temperature, setTemperature]         = useState(0.7);
  const [maxTokens, setMaxTokens]             = useState(2048);
  const [enableGeneration, setEnableGeneration] = useState(true);
  const [promptTemplate, setPromptTemplate]   = useState(
    'You are an expert technical interviewer and talent assessor. Generate structured JSON questions tailored by Role, Domain, Skills, and Difficulty.'
  );

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    fetchAIConfig();
  }, []);

  const fetchAIConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-config`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ai_provider) setProvider(data.ai_provider);
        if (data.gemini_api_key) setGeminiKey(data.gemini_api_key);
        if (data.openai_api_key) setOpenaiKey(data.openai_api_key);
        if (data.default_model) setDefaultModel(data.default_model);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.max_tokens !== undefined) setMaxTokens(data.max_tokens);
        if (data.enable_ai_generation !== undefined) setEnableGeneration(data.enable_ai_generation);
        if (data.default_prompt_template) setPromptTemplate(data.default_prompt_template);
      }
    } catch (_err) {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ai_provider: provider,
          gemini_api_key: geminiKey,
          openai_api_key: openaiKey,
          default_model: defaultModel,
          temperature: parseFloat(temperature),
          max_tokens: parseInt(maxTokens, 10),
          enable_ai_generation: enableGeneration,
          default_prompt_template: promptTemplate,
        }),
      });

      if (!res.ok) throw new Error('Failed to save AI configuration');

      setStatusMsg('AI Configuration saved and activated successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Error saving AI config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>
          AI Configuration &amp; Gemini Key Settings
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage LLM provider keys, model selection, temperature parameters, and system prompts.
        </p>
      </div>

      {statusMsg && (
        <div style={{ background: 'hsla(142,70%,55%,0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, color: 'var(--accent-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'hsla(350,90%,65%,0.1)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, color: 'var(--accent-rose)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Enable / Disable AI Generation Toggle */}
        <div className="card" style={{ padding: '20px 24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Enable AI Question Generation &amp; Evaluation
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Master switch to turn AI generation services on or off globally.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnableGeneration(!enableGeneration)}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', fontWeight: 600,
              background: enableGeneration ? 'hsla(142,70%,55%,0.15)' : 'hsla(350,90%,65%,0.15)',
              color: enableGeneration ? 'var(--accent-green)' : 'var(--accent-rose)',
              border: enableGeneration ? '1px solid var(--accent-green)' : '1px solid var(--accent-rose)',
              cursor: 'pointer'
            }}
          >
            {enableGeneration ? '● Enabled' : '○ Disabled'}
          </button>
        </div>

        {/* AI Provider & Keys */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Key size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              AI Provider Selection &amp; API Keys
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Select Active AI Provider
              </label>
              <select
                className="input"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-input)' }}
              >
                <option value="gemini">Google Gemini API (Gemini 3.6 Flash)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Google Gemini API Key
              </label>
              <input
                type="password"
                className="input"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-input)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                OpenAI API Key (Optional)
              </label>
              <input
                type="password"
                className="input"
                placeholder="sk-..."
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-input)' }}
              />
            </div>
          </div>
        </div>

        {/* Model Hyperparameters */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Sliders size={20} color="var(--accent-teal)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              Model Selection &amp; Parameters
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Default Model
              </label>
              <input
                type="text"
                className="input"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Max Tokens
              </label>
              <input
                type="number"
                className="input"
                value={maxTokens}
                onChange={e => setMaxTokens(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)' }}
              />
            </div>
          </div>
        </div>

        {/* System Prompt Template */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Default System Prompt Template
          </label>
          <textarea
            rows={4}
            className="input"
            value={promptTemplate}
            onChange={e => setPromptTemplate(e.target.value)}
            style={{ width: '100%', padding: '14px', background: 'var(--bg-input)', resize: 'vertical' }}
          />
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '12px 26px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving Config...' : 'Save AI Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
