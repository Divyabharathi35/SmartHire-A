// ============================================================
// AIConfig.jsx — AI Provider & Gemini Model Configuration
// ============================================================
import { useState, useEffect } from 'react';
import {
  Bot,
  Key,
  Sliders,
  CheckCircle,
  Save,
  AlertCircle,
  RefreshCw,
  Cpu,
  Layers,
} from 'lucide-react';

import { apiFetch } from '../../api/apiClient';

export default function AIConfig() {
  const [provider, setProvider] = useState('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('gemini-3.6-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [enableGeneration, setEnableGeneration] = useState(true);

  const [promptTemplate, setPromptTemplate] = useState(
    'You are an expert technical interviewer and talent assessor. Generate structured JSON questions tailored by Role, Domain, Skills, and Difficulty.'
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAIConfig();
  }, []);

  // ============================================================
  // LOAD AI CONFIGURATION
  // ============================================================
  const fetchAIConfig = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/admin/ai-config', {
        method: 'GET',
      });

      if (!res.ok) {
        throw new Error(`Failed to load AI configuration (${res.status})`);
      }

      const data = await res.json();

      // Gemini is the only supported provider
      setProvider('gemini');

      if (data.default_model) {
        setDefaultModel(data.default_model);
      }

      if (data.temperature !== undefined && data.temperature !== null) {
        setTemperature(Number(data.temperature));
      }

      if (data.max_tokens !== undefined && data.max_tokens !== null) {
        setMaxTokens(Number(data.max_tokens));
      }

      if (data.enable_ai_generation !== undefined) {
        setEnableGeneration(Boolean(data.enable_ai_generation));
      }

      if (data.default_prompt_template) {
        setPromptTemplate(data.default_prompt_template);
      }

      /*
       * Do not expose or populate the real Gemini API key from the backend.
       * If backend returns only a masked/placeholder value, it can be shown
       * as a placeholder but should not be treated as a usable secret.
       */
      if (
        data.gemini_api_key &&
        data.gemini_api_key !== '********' &&
        data.gemini_api_key !== '***'
      ) {
        setGeminiKey(data.gemini_api_key);
      }
    } catch (err) {
      console.error('[AIConfig] Failed to load configuration:', err);

      setErrorMsg(
        err?.message || 'Unable to load AI configuration.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SAVE AI CONFIGURATION
  // ============================================================
  const handleSaveConfig = async (e) => {
    e.preventDefault();

    setSaving(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const payload = {
        // Gemini only
        ai_provider: 'gemini',

        // Send Gemini key only when user entered a new value.
        ...(geminiKey.trim()
          ? { gemini_api_key: geminiKey.trim() }
          : {}),

        default_model: defaultModel || 'gemini-3.6-flash',
        temperature: parseFloat(temperature),
        max_tokens: parseInt(maxTokens, 10),
        enable_ai_generation: enableGeneration,
        default_prompt_template: promptTemplate,
      };

      const res = await apiFetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = 'Failed to save AI configuration';

        try {
          const errorData = await res.json();

          message =
            errorData?.detail ||
            errorData?.message ||
            message;
        } catch {
          // Keep default error message
        }

        throw new Error(message);
      }

      setStatusMsg(
        'AI Configuration saved and activated successfully!'
      );

      // Do not keep API secret in the input after saving.
      setGeminiKey('');

      setTimeout(() => {
        setStatusMsg('');
      }, 3000);
    } catch (err) {
      console.error('[AIConfig] Failed to save configuration:', err);

      setErrorMsg(
        err?.message || 'Error saving AI configuration.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div
        className="animate-fade-in-up"
        style={{
          padding: '24px',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div
          className="card"
          style={{
            padding: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            textAlign: 'center',
          }}
        >
          <RefreshCw
            size={24}
            style={{
              animation: 'spin 1s linear infinite',
              marginBottom: 12,
            }}
          />

          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Loading AI configuration...
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div
      className="animate-fade-in-up"
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Bot
            size={26}
            color="var(--accent-primary)"
          />

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.6rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            AI Configuration &amp; Gemini Key Settings
          </h1>
        </div>

        <p
          style={{
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Manage Gemini AI configuration, model selection,
          temperature parameters, and system prompts.
        </p>
      </div>

      {/* Success */}
      {statusMsg && (
        <div
          style={{
            background: 'hsla(142,70%,55%,0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 20,
            color: 'var(--accent-green)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          {statusMsg}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            background: 'hsla(350,90%,65%,0.1)',
            border: '1px solid var(--accent-rose)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 20,
            color: 'var(--accent-rose)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSaveConfig}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* ======================================================
            ENABLE / DISABLE AI
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div>
            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              Enable AI Question Generation &amp; Evaluation
            </h4>

            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              Master switch to turn Gemini AI generation and
              evaluation services on or off globally.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setEnableGeneration(!enableGeneration)
            }
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: enableGeneration
                ? 'hsla(142,70%,55%,0.15)'
                : 'hsla(350,90%,65%,0.15)',
              color: enableGeneration
                ? 'var(--accent-green)'
                : 'var(--accent-rose)',
              border: enableGeneration
                ? '1px solid var(--accent-green)'
                : '1px solid var(--accent-rose)',
              cursor: 'pointer',
            }}
          >
            {enableGeneration
              ? '● Enabled'
              : '○ Disabled'}
          </button>
        </div>

        {/* ======================================================
            GEMINI PROVIDER
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Key
              size={20}
              color="var(--accent-primary)"
            />

            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                margin: 0,
              }}
            >
              Gemini AI Provider &amp; API Key
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {/* Provider */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Active AI Provider
              </label>

              <select
                className="input"
                value="gemini"
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-input)',
                  opacity: 0.85,
                }}
              >
                <option value="gemini">
                  Google Gemini API
                </option>
              </select>

              <div
                style={{
                  marginTop: 7,
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
              >
                Gemini is the only active LLM provider.
              </div>
            </div>

            {/* Gemini API Key */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Google Gemini API Key
              </label>

              <input
                type="password"
                className="input"
                placeholder="Enter Gemini API key"
                value={geminiKey}
                onChange={(e) =>
                  setGeminiKey(e.target.value)
                }
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-input)',
                }}
              />

              <div
                style={{
                  marginTop: 7,
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
              >
                The API key is stored and used by the backend.
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================
            MODEL PARAMETERS
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Sliders
              size={20}
              color="var(--accent-teal)"
            />

            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                margin: 0,
              }}
            >
              Gemini Model &amp; Parameters
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
            }}
          >
            {/* Model */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Default Model
              </label>

              <select
                className="input"
                value={defaultModel}
                onChange={(e) =>
                  setDefaultModel(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              >
                <option value="gemini-3.6-flash">
                  Gemini 3.6 Flash
                </option>
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Temperature ({Number(temperature).toFixed(2)})
              </label>

              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) =>
                  setTemperature(
                    parseFloat(e.target.value)
                  )
                }
                style={{
                  width: '100%',
                  marginTop: 8,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 5,
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>More deterministic</span>
                <span>More creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Max Tokens
              </label>

              <input
                type="number"
                className="input"
                min="256"
                max="8192"
                step="1"
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================
            SYSTEM PROMPT
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Layers
              size={20}
              color="var(--accent-primary)"
            />

            <label
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Default System Prompt Template
            </label>
          </div>

          <textarea
            rows={4}
            className="input"
            value={promptTemplate}
            onChange={(e) =>
              setPromptTemplate(e.target.value)
            }
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--bg-input)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* ======================================================
            SAVE
        ======================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '12px 26px',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {saving ? (
              <RefreshCw
                size={16}
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              />
            ) : (
              <Save size={16} />
            )}

            <span>
              {saving
                ? 'Saving Config...'
                : 'Save AI Configuration'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}