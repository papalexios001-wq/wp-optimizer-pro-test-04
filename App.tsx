// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO v27.0 — ENTERPRISE SOTA EDITION
// ═══════════════════════════════════════════════════════════════════════════════
// 
// COMPLETE FEATURE SET:
// ✅ ENTERPRISE PROGRESS TRACKING — Real-time phase indicators with ETA
// ✅ STAGED PIPELINE INTEGRATION — Uses chunked generation
// ✅ YOUTUBE INTEGRATION — Auto-discovers and embeds relevant videos
// ✅ REFERENCES INTEGRATION — Authoritative source citations
// ✅ IMMER FREEZE FIX — Deep clone contracts before state updates
// ✅ ZERO H1 DUPLICATION — WordPress provides H1, content NEVER includes H1
// ✅ CANCELLATION SYSTEM — Cancel long-running jobs gracefully
// ✅ BULK OPTIMIZATION — Parallel processing with concurrency control
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from './store';
import { 
    SitemapPage, 
    ContentContract, 
    GodModePhase, 
    InternalLinkTarget,
    GeoTargetConfig, 
    APP_VERSION, 
    NeuronTerm, 
    OptimizationMode,
    StageProgress,
    BulkJob,
    BulkProcessingState,
    PostPreservationData
} from './types';
import { 
    extractSlugFromUrl, 
    sanitizeTitle, 
    calculateOpportunityScore, 
    calculateSeoMetrics, 
    sanitizeSlug, 
    runQASwarm, 
    injectInternalLinks,
    analyzeExistingContent, 
    formatDuration, 
    removeAllH1Tags, 
    validateNoH1,
    countWords,
    cn,
    formatNumber,
    createDefaultSeoMetrics
} from './utils';
import { 
    titanFetch, 
    wpResolvePostIdEnhanced, 
    wpUpdatePost, 
    wpCreatePost, 
    wpGetPost, 
    wpTestConnection, 
    performEntityGapAnalysis,
    discoverAndValidateReferences, 
    wpUpdatePostMeta,
    wpGetPostWithImages, 
    discoverInternalLinkTargets
} from './fetch-service';
import { 
    orchestrator, 
    VALID_GEMINI_MODELS, 
    OPENROUTER_MODELS
} from './lib/ai-orchestrator';
import { getNeuronWriterAnalysis, listNeuronProjects } from './neuronwriter';

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 VERSION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const APP_VERSION_FULL = '27.0.0';
const MAX_SYNTHESIS_CYCLES = 3;
const QA_PASS_THRESHOLD = 65;
const MIN_WORD_COUNT = 3000;
const TARGET_WORD_COUNT = 4000;
const TITLE_MIN_LENGTH = 45;
const TITLE_MAX_LENGTH = 65;
const META_MIN_LENGTH = 145;
const META_MAX_LENGTH = 160;
const JOB_TIMEOUT_MS = 10 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 DEEP CLONE UTILITY — PREVENTS IMMER FREEZE ISSUES
// ═══════════════════════════════════════════════════════════════════════════════

function deepClone<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    return JSON.parse(JSON.stringify(obj));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ENTERPRISE PROGRESS TRACKER — PHASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressPhaseConfig {
    label: string;
    icon: string;
    color: string;
    step: number;
    description: string;
}

const PHASE_CONFIG: Record<string, ProgressPhaseConfig> = {
    'idle': { label: 'Ready', icon: '⏸️', color: '#64748b', step: 0, description: 'Waiting to start' },
    'initializing': { label: 'Initializing', icon: '🚀', color: '#6366f1', step: 1, description: 'Setting up optimization pipeline...' },
    'resolving_post': { label: 'Finding Post', icon: '🔍', color: '#8b5cf6', step: 2, description: 'Resolving WordPress post ID...' },
    'analyzing_existing': { label: 'Analyzing', icon: '📊', color: '#a855f7', step: 3, description: 'Analyzing existing content...' },
    'entity_gap_analysis': { label: 'Entity Analysis', icon: '🧠', color: '#d946ef', step: 4, description: 'Discovering content gaps & entities...' },
    'neuron_analysis': { label: 'NLP Analysis', icon: '🧬', color: '#ec4899', step: 5, description: 'Running NeuronWriter NLP analysis...' },
    'reference_discovery': { label: 'References', icon: '📚', color: '#f43f5e', step: 6, description: 'Finding authoritative sources...' },
    'outline_generation': { label: 'Outline', icon: '📋', color: '#f97316', step: 7, description: 'Generating content structure...' },
    'section_drafts': { label: 'Writing', icon: '✍️', color: '#eab308', step: 8, description: 'Generating content sections...' },
    'youtube_integration': { label: 'Video', icon: '🎬', color: '#84cc16', step: 9, description: 'Finding relevant YouTube video...' },
    'merge_content': { label: 'Merging', icon: '🔀', color: '#22c55e', step: 10, description: 'Assembling final content...' },
    'internal_linking': { label: 'Links', icon: '🔗', color: '#14b8a6', step: 11, description: 'Injecting contextual links...' },
    'qa_validation': { label: 'QA Check', icon: '✅', color: '#06b6d4', step: 12, description: 'Running quality validation...' },
    'final_polish': { label: 'Polishing', icon: '✨', color: '#0ea5e9', step: 13, description: 'Final optimizations...' },
    'publishing': { label: 'Publishing', icon: '📤', color: '#3b82f6', step: 14, description: 'Pushing to WordPress...' },
    'completed': { label: 'Complete!', icon: '🎉', color: '#10b981', step: 15, description: 'Optimization successful!' },
    'failed': { label: 'Failed', icon: '❌', color: '#ef4444', step: 0, description: 'Optimization failed' },
};

const TOTAL_STEPS = 15;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ENTERPRISE PROGRESS TRACKER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface OptimizationProgressProps {
    isRunning: boolean;
    phase: string;
    progress: number;
    startTime: number | null;
    currentUrl: string;
    sectionsCompleted?: number;
    totalSections?: number;
    wordCount?: number;
    onCancel?: () => void;
}

const OptimizationProgress: React.FC<OptimizationProgressProps> = ({
    isRunning,
    phase,
    progress,
    startTime,
    currentUrl,
    sectionsCompleted,
    totalSections,
    wordCount,
    onCancel
}) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    
    useEffect(() => {
        if (!isRunning || !startTime) {
            setElapsedTime(0);
            return;
        }
        
        const interval = setInterval(() => {
            setElapsedTime(Date.now() - startTime);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [isRunning, startTime]);
    
    const phaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG['idle'];
    const currentStep = phaseConfig.step;
    const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);
    
    const formatTime = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const estimateRemainingTime = (): string => {
        if (currentStep === 0 || elapsedTime === 0) return '--:--';
        const avgTimePerStep = elapsedTime / currentStep;
        const remainingSteps = TOTAL_STEPS - currentStep;
        const estimatedRemaining = avgTimePerStep * remainingSteps;
        return formatTime(estimatedRemaining);
    };
    
    if (!isRunning && phase === 'idle') return null;
    
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '20px',
            padding: '24px',
            marginBottom: '24px',
            animation: isRunning ? 'pulse-border 2s ease-in-out infinite' : 'none'
        }}>
            <style>{`
                @keyframes pulse-border {
                    0%, 100% { border-color: rgba(99,102,241,0.2); }
                    50% { border-color: rgba(99,102,241,0.5); }
                }
                @keyframes progress-shine {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes bounce-icon {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            `}</style>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '52px',
                        height: '52px',
                        background: `linear-gradient(135deg, ${phaseConfig.color} 0%, ${phaseConfig.color}dd 100%)`,
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        animation: isRunning ? 'bounce-icon 1s ease-in-out infinite' : 'none',
                        boxShadow: `0 8px 24px ${phaseConfig.color}40`
                    }}>
                        {phaseConfig.icon}
                    </div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: phaseConfig.color, marginBottom: '2px' }}>
                            {phaseConfig.label}
                        </div>
                        <div style={{ fontSize: '13px', opacity: 0.7 }}>
                            {phaseConfig.description}
                        </div>
                    </div>
                </div>
                
                {/* Time Display */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'monospace' }}>
                        {formatTime(elapsedTime)}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.5, textTransform: 'uppercase' }}>
                        ETA: {estimateRemainingTime()}
                    </div>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '10px',
                height: '14px',
                overflow: 'hidden',
                marginBottom: '16px',
                position: 'relative'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, ${phaseConfig.color}, ${phaseConfig.color}dd, ${phaseConfig.color})`,
                    backgroundSize: '200% 100%',
                    animation: isRunning ? 'progress-shine 2s linear infinite' : 'none',
                    borderRadius: '10px',
                    transition: 'width 0.5s ease-out',
                    boxShadow: `0 0 20px ${phaseConfig.color}60`
                }} />
                <div style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                    {progressPercent}%
                </div>
            </div>
            
            {/* Step Indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '3px' }}>
                {Object.entries(PHASE_CONFIG)
                    .filter(([key]) => !['idle', 'failed'].includes(key))
                    .map(([key, config]) => {
                        const isComplete = currentStep > config.step;
                        const isCurrent = phase === key;
                        
                        return (
                            <div
                                key={key}
                                title={config.label}
                                style={{
                                    flex: 1,
                                    height: '6px',
                                    borderRadius: '3px',
                                    background: isComplete 
                                        ? config.color 
                                        : isCurrent 
                                            ? `linear-gradient(90deg, ${config.color}, transparent)`
                                            : 'rgba(255,255,255,0.1)',
                                    transition: 'all 0.3s ease',
                                    cursor: 'help'
                                }}
                            />
                        );
                    })}
            </div>
            
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{
                    flex: '1 1 100px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    minWidth: '100px'
                }}>
                    <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>Step</div>
                    <div style={{ fontSize: '18px', fontWeight: '700' }}>{currentStep} / {TOTAL_STEPS}</div>
                </div>
                
                {sectionsCompleted !== undefined && totalSections !== undefined && totalSections > 0 && (
                    <div style={{
                        flex: '1 1 100px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        minWidth: '100px'
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>Sections</div>
                        <div style={{ fontSize: '18px', fontWeight: '700' }}>{sectionsCompleted} / {totalSections}</div>
                    </div>
                )}
                
                {wordCount !== undefined && wordCount > 0 && (
                    <div style={{
                        flex: '1 1 100px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        minWidth: '100px'
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>Words</div>
                        <div style={{ fontSize: '18px', fontWeight: '700' }}>{wordCount.toLocaleString()}</div>
                    </div>
                )}
                
                {onCancel && isRunning && (
                    <button
                        onClick={onCancel}
                        style={{
                            flex: '0 0 auto',
                            background: 'rgba(239,68,68,0.2)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px',
                            padding: '12px 20px',
                            color: '#f87171',
                            fontSize: '12px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ⛔ Cancel
                    </button>
                )}
            </div>
            
            {/* Current URL */}
            {currentUrl && (
                <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    opacity: 0.6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    📄 {currentUrl}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface CardProps {
    children: React.ReactNode;
    padding?: 'sm' | 'md' | 'lg';
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, padding = 'md', className }) => {
    const paddingClasses = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
    return (
        <div className={cn(
            'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl',
            padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-8' : 'p-6',
            className
        )} style={{ padding: padding === 'sm' ? '16px' : padding === 'lg' ? '32px' : '24px' }}>
            {children}
        </div>
    );
};

interface ToggleProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    description?: string;
    icon?: string;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, description, icon }) => (
    <div 
        onClick={() => onChange(!checked)}
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px',
            borderRadius: '12px',
            border: checked ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
            background: checked ? 'rgba(59,130,246,0.05)' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
            <div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{label}</div>
                {description && <div style={{ fontSize: '11px', opacity: 0.5 }}>{description}</div>}
            </div>
        </div>
        <div style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: checked ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            position: 'relative',
            transition: 'all 0.2s'
        }}>
            <div style={{
                position: 'absolute',
                top: '2px',
                left: checked ? '22px' : '2px',
                width: '20px',
                height: '20px',
                borderRadius: '10px',
                background: 'white',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
        </div>
    </div>
);

interface AdvancedInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'password' | 'url';
    placeholder?: string;
    icon?: string;
    helpText?: string;
    required?: boolean;
}

const AdvancedInput: React.FC<AdvancedInputProps> = ({
    label, value, onChange, type = 'text', placeholder, icon, helpText, required
}) => {
    const [showPassword, setShowPassword] = useState(false);
    
    return (
        <div style={{ marginBottom: '16px' }}>
            <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: 0.5,
                marginBottom: '8px'
            }}>
                {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <div style={{ position: 'relative' }}>
                {icon && (
                    <span style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.4
                    }}>{icon}</span>
                )}
                <input
                    type={type === 'password' && showPassword ? 'text' : type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        width: '100%',
                        padding: icon ? '12px 14px 12px 42px' : '12px 14px',
                        paddingRight: type === 'password' ? '42px' : '14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: 'inherit',
                        outline: 'none',
                        transition: 'all 0.2s'
                    }}
                />
                {type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.4
                        }}
                    >
                        {showPassword ? '🙈' : '👁️'}
                    </button>
                )}
            </div>
            {helpText && <p style={{ fontSize: '11px', opacity: 0.4, marginTop: '6px' }}>{helpText}</p>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ MODEL SELECTOR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const OPENROUTER_PRESET_MODELS = [
    'google/gemini-2.5-flash-preview',
    'google/gemini-2.5-pro-preview',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat',
];

const GROQ_PRESET_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const App: React.FC = () => {
    const store = useAppStore();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LOCAL STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    const [sitemapUrl, setSitemapUrl] = useState('');
    const [manualUrl, setManualUrl] = useState('');
    const [targetKeywordOverride, setTargetKeywordOverride] = useState('');
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [wpTestStatus, setWpTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    
    const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('surgical');
    const [preserveImages, setPreserveImages] = useState(true);
    const [preserveFeaturedImage, setPreserveFeaturedImage] = useState(true);
    const [preserveCategories, setPreserveCategories] = useState(true);
    const [preserveTags, setPreserveTags] = useState(true);
    
    const [geoConfig, setGeoConfig] = useState<GeoTargetConfig>({
        enabled: false,
        country: 'US',
        region: '',
        city: '',
        language: 'en'
    });

    // Progress tracking state
    const [optimizationProgress, setOptimizationProgress] = useState({
        isRunning: false,
        phase: 'idle',
        progress: 0,
        startTime: null as number | null,
        currentUrl: '',
        sectionsCompleted: 0,
        totalSections: 0,
        wordCount: 0
    });

    // Bulk optimization state
    const [bulkUrls, setBulkUrls] = useState('');
    const [showBulkMode, setShowBulkMode] = useState(false);
    const [bulkConcurrency, setBulkConcurrency] = useState(3);
    const [bulkState, setBulkState] = useState<BulkProcessingState>({
        isRunning: false,
        jobs: [],
        concurrency: 3,
        completed: 0,
        failed: 0,
        totalTime: 0,
        avgScore: 0,
        totalWords: 0
    });
    const bulkAbortRef = useRef(false);
    
    // Cancellation
    const cancellationTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
    
    const cancelCurrentJob = useCallback((reason: string = 'User cancelled') => {
        cancellationTokenRef.current = { cancelled: true };
        store.addGodLog(`⛔ CANCELLATION REQUESTED: ${reason}`);
        store.addToast('Cancellation requested', 'warning');
        setOptimizationProgress(prev => ({ ...prev, isRunning: false, phase: 'failed' }));
    }, [store]);
    
    const resetCancellationToken = useCallback(() => {
        cancellationTokenRef.current = { cancelled: false };
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    const getSiteContext = useCallback(() => ({
        orgName: store.wpConfig.orgName || 'Expert Website',
        url: store.wpConfig.url || 'https://example.com',
        authorName: store.wpConfig.authorName || 'Editorial Team',
        logoUrl: store.wpConfig.logoUrl,
        authorPageUrl: store.wpConfig.authorPageUrl,
    }), [store.wpConfig]);

    const getAuth = useCallback(() => ({
        u: store.wpConfig.username,
        p: store.wpConfig.password || ''
    }), [store.wpConfig.username, store.wpConfig.password]);

    const hasRequiredKeys = useCallback(() => {
        return !!(store.apiKeys.google || store.apiKeys.openrouter || 
                  store.apiKeys.openai || store.apiKeys.anthropic || store.apiKeys.groq);
    }, [store.apiKeys]);

    const hasNeuronConfig = useCallback(() => {
        return !!(store.neuronEnabled && store.apiKeys.neuronwriter && store.apiKeys.neuronProject);
    }, [store.neuronEnabled, store.apiKeys.neuronwriter, store.apiKeys.neuronProject]);

    const getActualModel = useCallback(() => {
        switch (store.selectedProvider) {
            case 'openrouter':
                return store.apiKeys.openrouterModel || 'google/gemini-2.5-flash-preview';
            case 'groq':
                return store.apiKeys.groqModel || 'llama-3.3-70b-versatile';
            case 'openai':
                return 'gpt-4o';
            case 'anthropic':
                return 'claude-sonnet-4';
            default:
                return store.selectedModel;
        }
    }, [store.selectedProvider, store.apiKeys.openrouterModel, store.apiKeys.groqModel, store.selectedModel]);

    // ═══════════════════════════════════════════════════════════════════════════
    // WORDPRESS CONNECTION TEST
    // ═══════════════════════════════════════════════════════════════════════════

    const handleTestWpConnection = useCallback(async () => {
        if (!store.wpConfig.url || !store.wpConfig.username || !store.wpConfig.password) {
            store.addToast('Fill all WordPress fields first', 'warning');
            return;
        }
        
        setWpTestStatus('testing');
        
        try {
            const result = await wpTestConnection(store.wpConfig.url, getAuth());
            setWpTestStatus(result.success ? 'success' : 'failed');
            store.addToast(result.success ? `✅ Connected!` : result.message, result.success ? 'success' : 'error');
        } catch (e: any) {
            setWpTestStatus('failed');
            store.addToast(`Connection failed: ${e.message}`, 'error');
        }
    }, [store, getAuth]);

    // ═══════════════════════════════════════════════════════════════════════════
    // SITEMAP CRAWLER
    // ═══════════════════════════════════════════════════════════════════════════

    const handleCrawlSitemap = useCallback(async () => {
        if (!sitemapUrl) {
            store.addToast('Enter a sitemap URL', 'warning');
            return;
        }
        
        store.setProcessing(true, 'Crawling sitemap...');
        store.addGodLog(`🕷️ ULTRA-FAST SITEMAP CRAWLER v${APP_VERSION_FULL}`);
        store.addGodLog(`🕷️ URL: ${sitemapUrl}`);
        
        const startTime = Date.now();
        
        try {
            let text = '';
            let fetchSucceeded = false;
            
            try {
                const directRes = await fetch(sitemapUrl, { method: 'GET', headers: { 'Accept': 'application/xml, text/xml, */*' } });
                if (directRes.ok) { text = await directRes.text(); fetchSucceeded = true; store.addGodLog(`   ✅ Direct fetch succeeded`); }
            } catch {}
            
            if (!fetchSucceeded) {
                try {
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sitemapUrl)}`;
                    const proxyRes = await fetch(proxyUrl);
                    if (proxyRes.ok) { text = await proxyRes.text(); fetchSucceeded = true; store.addGodLog(`   ✅ CORS proxy succeeded`); }
                } catch {}
            }
            
            if (!fetchSucceeded || !text) throw new Error('All fetch strategies failed');
            
            const xml = new DOMParser().parseFromString(text, 'application/xml');
            let allUrls: string[] = Array.from(xml.querySelectorAll('url loc, loc')).map(el => el.textContent || '').filter(Boolean);
            
            const uniqueUrls = [...new Set(allUrls)].filter(url => {
                if (!url || !url.startsWith('http')) return false;
                const lower = url.toLowerCase();
                const exclude = ['?', '.xml', '/wp-admin', '/wp-content', '/wp-json', '/feed/', '.pdf', '.jpg', '.png'];
                return !exclude.some(p => lower.includes(p));
            }).slice(0, 300);
            
            store.addGodLog(`🔍 Found ${uniqueUrls.length} valid URLs`);
            
            const discovered: SitemapPage[] = uniqueUrls.map(url => {
                const slug = sanitizeSlug(extractSlugFromUrl(url));
                let title = '';
                try {
                    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
                    if (pathParts.length > 0) {
                        title = pathParts[pathParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                } catch {}
                
                return {
                    id: url, title: title || 'Page', slug, lastMod: null, wordCount: null, crawledContent: null,
                    healthScore: null, status: 'idle' as const, opportunity: calculateOpportunityScore(title, null), improvementHistory: []
                };
            });

            store.addPages(discovered);
            
            const elapsed = Date.now() - startTime;
            store.addGodLog(`🎉 CRAWL COMPLETE: ${discovered.length} pages in ${formatDuration(elapsed)}`);
            store.addToast(`Discovered ${discovered.length} pages`, 'success');
            setSitemapUrl('');
        } catch (e: any) {
            store.addGodLog(`❌ Crawl failed: ${e.message}`);
            store.addToast(`Crawl failed: ${e.message}`, 'error');
        } finally {
            store.setProcessing(false);
        }
    }, [sitemapUrl, store]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥🔥🔥 GOD MODE ENGINE — WITH PROGRESS TRACKING
    // ═══════════════════════════════════════════════════════════════════════════

    const executeGodMode = useCallback(async (
        targetOverride?: string, 
        silentMode = false
    ): Promise<{ success: boolean; score: number; wordCount: number; error?: string }> => {
        const startTime = Date.now();
        let targetId = targetOverride;
        
        resetCancellationToken();
        
        // Initialize progress
        setOptimizationProgress({
            isRunning: true,
            phase: 'initializing',
            progress: 0,
            startTime,
            currentUrl: targetId || manualUrl || '',
            sectionsCompleted: 0,
            totalSections: 0,
            wordCount: 0
        });
        
        const updateProgress = (phase: string, extras?: { sectionsCompleted?: number; totalSections?: number; wordCount?: number }) => {
            setOptimizationProgress(prev => ({ ...prev, phase, ...(extras || {}) }));
        };
        
        const log = (msg: string) => { 
            if (targetId) store.addJobLog(targetId, msg);
            if (!silentMode) store.addGodLog(msg); 
        };

        const failWith = (error: string): { success: false; score: 0; wordCount: 0; error: string } => {
            log(`❌ ${error}`);
            setOptimizationProgress(prev => ({ ...prev, isRunning: false, phase: 'failed' }));
            return { success: false, score: 0, wordCount: 0, error };
        };
        
        // Handle manual URL
        if (!targetId && manualUrl && manualUrl.startsWith('http')) {
            const slug = sanitizeSlug(extractSlugFromUrl(manualUrl));
            const existing = store.pages.find(p => p.id === manualUrl);
            
            if (!existing) {
                let title = '';
                try {
                    const pathParts = new URL(manualUrl).pathname.split('/').filter(Boolean);
                    if (pathParts.length > 0) title = pathParts[pathParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } catch {}
                
                const newPage: SitemapPage = { 
                    id: manualUrl, title: title || 'New Page', slug, lastMod: new Date().toISOString(), 
                    wordCount: null, crawledContent: null, healthScore: null, status: 'idle', 
                    opportunity: calculateOpportunityScore(title, null), improvementHistory: []
                };
                store.addPages([newPage]);
            }
            targetId = manualUrl;
            if (!silentMode) setManualUrl('');
        }
        
        if (!targetId) {
            const candidates = store.pages.filter(p => p.jobState?.status !== 'running').sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0));
            targetId = candidates[0]?.id;
        }

        if (!targetId) return failWith('No pages to optimize');
        if (!hasRequiredKeys()) return failWith('No AI API key configured');
        if (!store.wpConfig.url) return failWith('WordPress URL not configured');
        if (!store.wpConfig.username || !store.wpConfig.password) return failWith('WordPress credentials not configured');

        setOptimizationProgress(prev => ({ ...prev, currentUrl: targetId || '' }));
        
        const getPage = () => useAppStore.getState().pages.find(p => p.id === targetId)!;
        
        if (!getPage()?.jobState) store.initJobState(targetId);
        store.updateJobState(targetId, { status: 'running', phase: 'initializing', error: undefined, attempts: (getPage()?.jobState?.attempts || 0) + 1, startTime });
        store.updatePage(targetId, { status: 'analyzing' });

        const siteContext = getSiteContext();
        const auth = getAuth();
        
        let preservation: PostPreservationData = {
            originalSlug: null, originalLink: null, originalCategories: [], originalTags: [], featuredImageId: null, contentImages: []
        };
        
        try {
            // ═══════════════════════════════════════════════════════════════
            // PHASE 1: RESOLVE WORDPRESS POST
            // ═══════════════════════════════════════════════════════════════
            
            updateProgress('resolving_post');
            store.updateJobState(targetId, { phase: 'resolving_post' });
            log(`📍 PHASE 1: Resolving WordPress post...`);
            
            let originalContent = '';
            let topic = getPage().title;
            let postId: number | null = null;

            postId = await wpResolvePostIdEnhanced(store.wpConfig.url, targetId, auth, log);

            if (!postId) {
                log(`   ⚠️ Could not find existing post — will create new`);
            } else {
                log(`   ✅ Found existing post ID: ${postId}`);
                
                try {
                    const postData = await wpGetPostWithImages(store.wpConfig.url, postId, auth);
                    preservation.originalSlug = postData.originalSlug;
                    preservation.originalLink = postData.post.link || null;
                    preservation.originalCategories = postData.originalCategories;
                    preservation.originalTags = postData.originalTags;
                    
                    if (postData.featuredImage && preserveFeaturedImage) {
                        preservation.featuredImageId = postData.featuredImage.id;
                    }
                    
                    const wpTitle = postData.post.title?.rendered || postData.post.title?.raw || '';
                    if (wpTitle && wpTitle.length > 3) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = wpTitle;
                        topic = tempDiv.textContent || wpTitle;
                        store.updatePage(targetId, { title: topic });
                    }
                    
                    originalContent = postData.post.content?.rendered || '';
                } catch (e: any) {
                    log(`   ⚠️ Could not fetch existing content: ${e.message}`);
                }
            }

            if (targetKeywordOverride && targetKeywordOverride.trim().length > 3) {
                topic = targetKeywordOverride.trim();
                store.updatePage(targetId, { title: topic, targetKeyword: topic });
                if (!silentMode) setTargetKeywordOverride('');
            }

            const actualModel = getActualModel();
            
            log(`🚀 ═══════════════════════════════════════════════════════════`);
            log(`🚀 GOD MODE: "${topic.substring(0, 50)}..."`);
            log(`🚀 Provider: ${store.selectedProvider} | Model: ${actualModel}`);
            log(`🚀 ═══════════════════════════════════════════════════════════`);

            // ═══════════════════════════════════════════════════════════════
            // PHASE 2: ENTITY GAP ANALYSIS
            // ═══════════════════════════════════════════════════════════════
            
            let entityGapData = undefined;

            if (store.apiKeys.serper) {
                updateProgress('entity_gap_analysis');
                store.updateJobState(targetId, { phase: 'entity_gap_analysis' });
                log(`🔬 PHASE 2: Entity Gap Analysis...`);
                
                try {
                    entityGapData = await performEntityGapAnalysis(topic, store.apiKeys.serper, originalContent || undefined, geoConfig.enabled ? { geoCountry: geoConfig.country } : undefined, log);
                    store.updateJobState(targetId, { entityGapData });
                    log(`   ✓ Entities: ${entityGapData.missingEntities?.length || 0} | PAA: ${entityGapData.paaQuestions?.length || 0}`);
                } catch (e: any) {
                    log(`   ⚠️ Entity analysis failed: ${e.message}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // PHASE 3: NEURONWRITER (Optional)
            // ═══════════════════════════════════════════════════════════════
            
            let neuronData = undefined;

            if (hasNeuronConfig()) {
                updateProgress('neuron_analysis');
                store.updateJobState(targetId, { phase: 'neuron_analysis' });
                log(`🧬 PHASE 3: NeuronWriter NLP Analysis...`);
                
                try {
                    neuronData = await getNeuronWriterAnalysis(topic, { enabled: true, apiKey: store.apiKeys.neuronwriter, projectId: store.apiKeys.neuronProject }, {}, log);
                    if (neuronData) {
                        store.updateJobState(targetId, { neuronData });
                        store.setNeuronTerms(neuronData.terms);
                        log(`   → ${neuronData.terms.length} NLP terms`);
                    }
                } catch (e: any) {
                    log(`   ⚠️ NeuronWriter failed: ${e.message}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // PHASE 4: INTERNAL LINKS
            // ═══════════════════════════════════════════════════════════════
            
            updateProgress('internal_linking');
            store.updateJobState(targetId, { phase: 'internal_linking' });
            log(`🔗 PHASE 4: Building internal links...`);
            
            const internalLinks: InternalLinkTarget[] = store.pages
                .filter(p => p.id !== targetId && p.title && p.title.length > 5)
                .slice(0, 50)
                .map(p => ({ url: p.id, title: p.title, slug: p.slug }));
            
            log(`   → ${internalLinks.length} potential link targets`);

            // ═══════════════════════════════════════════════════════════════
            // PHASE 5: CONTENT SYNTHESIS — STAGED PIPELINE
            // ═══════════════════════════════════════════════════════════════

            updateProgress('outline_generation');
            store.updateJobState(targetId, { phase: 'content_synthesis' });
            log(`🎨 PHASE 5: SOTA Content Synthesis (Staged Pipeline)...`);

            const synthesisConfig = {
                prompt: `Create comprehensive content about "${topic}"`,
                topic,
                mode: optimizationMode === 'surgical' ? 'surgical' as const : 'writer' as const,
                siteContext,
                model: actualModel,
                provider: store.selectedProvider,
                apiKeys: store.apiKeys,
                entityGapData,
                neuronData: neuronData || undefined,
                existingAnalysis: originalContent ? analyzeExistingContent(originalContent) : undefined,
                internalLinks,
                targetKeyword: topic,
                validatedReferences: entityGapData?.validatedReferences,
                geoConfig: geoConfig.enabled ? geoConfig : undefined,
                useStagedPipeline: true,
                targetWords: TARGET_WORD_COUNT,
            };

            let bestContract: ContentContract | null = null;
            let bestScore = 0;
            let bestWordCount = 0;

            try {
                const { contract: _rawContract, youtubeVideo, references } = await orchestrator.generateEnhanced(
                    synthesisConfig,
                    log,
                    (progress: StageProgress) => {
                        if (progress.stage === 'outline') {
                            updateProgress('outline_generation');
                        } else if (progress.stage === 'sections') {
                            updateProgress('section_drafts', { 
                                sectionsCompleted: progress.sectionsCompleted || 0, 
                                totalSections: progress.totalSections || 0 
                            });
                        } else if (progress.stage === 'youtube') {
                            updateProgress('youtube_integration');
                        } else if (progress.stage === 'references') {
                            updateProgress('reference_discovery');
                        } else if (progress.stage === 'merge') {
                            updateProgress('merge_content');
                        } else if (progress.stage === 'polish') {
                            updateProgress('final_polish');
                        }
                    }
                );

                // Deep clone to avoid Immer freeze
                let contract: ContentContract = deepClone(_rawContract);

                // Post-processing
                contract.htmlContent = removeAllH1Tags(contract.htmlContent, log);

                // Calculate word count
                const finalWordCount = countWords(contract.htmlContent);
                contract.wordCount = finalWordCount;
                
                updateProgress('qa_validation', { wordCount: finalWordCount });

                log(`   ✅ Content generated: ${finalWordCount.toLocaleString()} words`);

                // Store contract
                store.updateJobState(targetId, { contract: deepClone(contract) });

                // QA Validation
                store.updateJobState(targetId, { phase: 'qa_validation' });
                log(`🔍 QA Validation...`);

                const qaResult = runQASwarm(contract, entityGapData, store.neuronTerms);
                store.updateJobState(targetId, { qaResults: qaResult.results });
                
                log(`   📊 QA Score: ${qaResult.score}/100 | Words: ${finalWordCount.toLocaleString()}`);

                bestContract = deepClone(contract);
                bestScore = qaResult.score;
                bestWordCount = finalWordCount;

            } catch (genErr: any) {
                log(`   ❌ Content generation failed: ${genErr.message}`);
                throw genErr;
            }

            // Final validation
            if (!bestContract || !bestContract.htmlContent || bestContract.htmlContent.length < 2000) {
                throw new Error('Content generation failed: No valid content produced');
            }

            log(`✅ Phase 5 Complete: ${bestWordCount.toLocaleString()} words | Score: ${bestScore}%`);

            // ═══════════════════════════════════════════════════════════════
            // PHASE 6: PUBLISH TO WORDPRESS
            // ═══════════════════════════════════════════════════════════════

            updateProgress('publishing');
            store.updateJobState(targetId, { phase: 'publishing' });
            log(`📤 PHASE 6: Publishing to WordPress...`);

            const publishData: any = {
                title: bestContract.title,
                content: bestContract.htmlContent,
                excerpt: bestContract.excerpt || '',
                status: store.publishMode === 'autopublish' ? 'publish' : 'draft'
            };

            let finalPostId: number;
            let finalPostLink: string;

            if (postId) {
                log(`   → Updating existing post ID: ${postId}`);
                
                if (preserveCategories && preservation.originalCategories.length > 0) {
                    publishData.categories = preservation.originalCategories;
                }
                if (preserveTags && preservation.originalTags.length > 0) {
                    publishData.tags = preservation.originalTags;
                }
                if (preserveFeaturedImage && preservation.featuredImageId) {
                    publishData.featured_media = preservation.featuredImageId;
                }
                
                const result = await wpUpdatePost(store.wpConfig.url, auth, postId, publishData, {
                    preserveFeaturedImage,
                    preserveSlug: true,
                    preserveCategories,
                    preserveTags
                });
                
                finalPostId = result.id;
                finalPostLink = result.link;
                
                log(`   ✅ Updated post ID: ${finalPostId}`);
            } else {
                publishData.slug = bestContract.slug;
                log(`   → Creating NEW post with slug: "${bestContract.slug}"`);
                
                const result = await wpCreatePost(store.wpConfig.url, auth, publishData);
                finalPostId = result.id;
                finalPostLink = result.link;
                log(`   ✅ Created NEW post ID: ${finalPostId}`);
            }

            store.updateJobState(targetId, { postId: finalPostId });

            // Update SEO meta
            try {
                await wpUpdatePostMeta(store.wpConfig.url, auth, finalPostId, {
                    title: bestContract.title,
                    description: bestContract.metaDescription,
                    focusKeyword: topic
                });
                log(`   ✅ SEO meta updated`);
            } catch {}

            // ═══════════════════════════════════════════════════════════════
            // PHASE 7: COMPLETION
            // ═══════════════════════════════════════════════════════════════
            
            updateProgress('completed', { wordCount: bestWordCount });
            store.updateJobState(targetId, { phase: 'completed' });
            
            const metrics = calculateSeoMetrics(bestContract.htmlContent, bestContract.title || topic, bestContract.slug || '');
            const finalQA = runQASwarm(bestContract, entityGapData, store.neuronTerms);
            const finalScore = Math.round((metrics.aeoScore * 0.25) + (finalQA.score * 0.45) + (metrics.contentDepth * 0.15) + (metrics.headingStructure * 0.15));

            const processingTime = Date.now() - startTime;

            store.updateJobState(targetId, { status: 'completed', processingTime });
            
            store.updatePage(targetId, { 
                status: 'analyzed', 
                healthScore: finalScore, 
                wordCount: metrics.wordCount, 
                seoMetrics: metrics,
                improvementHistory: [...(getPage().improvementHistory || []), { timestamp: Date.now(), score: finalScore, action: `v${APP_VERSION}`, wordCount: metrics.wordCount, qaScore: finalQA.score, version: APP_VERSION }],
                wpPostId: finalPostId, 
                lastPublishedAt: Date.now()
            });

            store.updateGlobalStats({
                totalProcessed: (store.globalStats.totalProcessed || 0) + 1,
                totalWordsGenerated: (store.globalStats.totalWordsGenerated || 0) + metrics.wordCount,
                lastRunTime: processingTime,
                totalImproved: (store.globalStats.totalImproved || 0) + (finalScore >= 70 ? 1 : 0)
            });

            log(`🎉 ═══════════════════════════════════════════════════════════`);
            log(`🎉 SUCCESS: Score ${finalScore}% | ${metrics.wordCount.toLocaleString()} words | ${formatDuration(processingTime)}`);
            log(`🎉 ═══════════════════════════════════════════════════════════`);
            
            setOptimizationProgress(prev => ({ ...prev, isRunning: false }));
            
            if (!silentMode) store.addToast(`✅ Optimized! Score: ${finalScore}%`, 'success');
            
            return { success: true, score: finalScore, wordCount: metrics.wordCount };

        } catch (e: any) {
            const processingTime = Date.now() - startTime;
            const errorMessage = e.message || 'Unknown error';
            
            store.updateJobState(targetId!, { status: 'failed', phase: 'failed', error: errorMessage, processingTime });
            store.updatePage(targetId!, { status: 'error' });
            setOptimizationProgress(prev => ({ ...prev, isRunning: false, phase: 'failed' }));
            
            log(`💥 FAILED: ${errorMessage}`);
            
            if (!silentMode) store.addToast(`❌ Failed: ${errorMessage}`, 'error');
            
            return { success: false, score: 0, wordCount: 0, error: errorMessage };
        }

    }, [manualUrl, store, getSiteContext, getAuth, geoConfig, hasRequiredKeys, targetKeywordOverride, getActualModel, optimizationMode, preserveFeaturedImage, preserveCategories, preserveTags, hasNeuronConfig, resetCancellationToken]);

    // ═══════════════════════════════════════════════════════════════════════════
    // BULK OPTIMIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    const parseBulkUrls = useCallback((text: string): string[] => {
        return text.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.startsWith('http')).filter((u, i, arr) => arr.indexOf(u) === i);
    }, []);

    const executeBulkOptimization = useCallback(async () => {
        const urls = parseBulkUrls(bulkUrls);
        if (urls.length === 0) { store.addToast('Enter valid URLs', 'warning'); return; }
        if (!hasRequiredKeys()) { store.addToast('Configure API key', 'error'); return; }

        bulkAbortRef.current = false;
        const startTime = Date.now();

        const jobs: BulkJob[] = urls.map((url, index) => ({ id: `bulk-${Date.now()}-${index}`, url, status: 'queued' as const, progress: 0, attempts: 0 }));

        setBulkState({ isRunning: true, jobs, concurrency: bulkConcurrency, completed: 0, failed: 0, totalTime: 0, avgScore: 0, totalWords: 0 });
        store.addGodLog(`🚀 BULK OPTIMIZATION: ${urls.length} URLs | Concurrency: ${bulkConcurrency}`);

        let completed = 0, failed = 0, totalWords = 0, totalScore = 0;

        const processJob = async (job: BulkJob): Promise<void> => {
            if (bulkAbortRef.current) return;
            const jobStartTime = Date.now();

            setBulkState(prev => ({ ...prev, jobs: prev.jobs.map(j => j.id === job.id ? { ...j, status: 'running' as const, startTime: jobStartTime } : j) }));

            try {
                const result = await Promise.race([
                    executeGodMode(job.url, true),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT_MS))
                ]);
                
                if (result.success && result.score >= 50) {
                    completed++; totalWords += result.wordCount; totalScore += result.score;
                    setBulkState(prev => ({ ...prev, jobs: prev.jobs.map(j => j.id === job.id ? { ...j, status: 'completed' as const, score: result.score, wordCount: result.wordCount, endTime: Date.now() } : j), completed, totalWords, avgScore: Math.round(totalScore / completed) }));
                    store.addGodLog(`   ✅ ${job.url.split('/').pop()}: ${result.score}% | ${result.wordCount} words`);
                } else {
                    throw new Error(result.error || 'Quality check failed');
                }
            } catch (error: any) {
                failed++;
                setBulkState(prev => ({ ...prev, jobs: prev.jobs.map(j => j.id === job.id ? { ...j, status: 'failed' as const, error: error.message, endTime: Date.now() } : j), failed }));
                store.addGodLog(`   ❌ ${job.url.split('/').pop()}: ${error.message}`);
            }
        };

        for (let i = 0; i < jobs.length; i += bulkConcurrency) {
            if (bulkAbortRef.current) break;
            const batch = jobs.slice(i, i + bulkConcurrency);
            await Promise.all(batch.map(job => processJob(job)));
            if (i + bulkConcurrency < jobs.length && !bulkAbortRef.current) await new Promise(r => setTimeout(r, 2000));
        }

        const totalTime = Date.now() - startTime;
        setBulkState(prev => ({ ...prev, isRunning: false, totalTime, avgScore: completed > 0 ? Math.round(totalScore / completed) : 0 }));
        store.addGodLog(`🏁 BULK COMPLETE: ${completed}/${jobs.length} success | ${totalWords.toLocaleString()} words | ${formatDuration(totalTime)}`);
        store.addToast(`Bulk complete: ${completed}/${jobs.length} success`, completed > 0 ? 'success' : 'error');
    }, [bulkUrls, bulkConcurrency, store, hasRequiredKeys, executeGodMode, parseBulkUrls]);

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            
            {/* Header */}
            <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
                <div style={{ maxWidth: '1800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700' }}>⚡</div>
                        <div>
                            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>WP Optimizer Pro</h1>
                            <p style={{ fontSize: '11px', opacity: 0.4, margin: 0 }}>v{APP_VERSION_FULL} Enterprise</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
                        {(['setup', 'strategy', 'review'] as const).map(view => (
                            <button key={view} onClick={() => store.setActiveView(view)} style={{
                                padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase',
                                background: store.activeView === view ? 'white' : 'transparent',
                                color: store.activeView === view ? 'black' : 'rgba(255,255,255,0.4)',
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                            }}>
                                {view === 'setup' && '⚙️ '}{view === 'strategy' && '🚀 '}{view === 'review' && '📊 '}{view}
                            </button>
                        ))}
                    </div>
                </div>
            </header>
            
            {/* Main Content */}
            <main style={{ maxWidth: '1800px', margin: '0 auto', padding: '32px 24px' }}>
                
                {/* Setup View */}
                {store.activeView === 'setup' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                        {/* WordPress Config */}
                        <Card padding="lg">
                            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>🌐</span> WordPress Connection
                            </h3>
                            <AdvancedInput label="Site URL" value={store.wpConfig.url} onChange={v => store.setWpConfig({ url: v })} placeholder="https://yoursite.com" icon="🔗" required />
                            <AdvancedInput label="Username" value={store.wpConfig.username} onChange={v => store.setWpConfig({ username: v })} placeholder="admin" icon="👤" required />
                            <AdvancedInput label="Application Password" value={store.wpConfig.password || ''} onChange={v => store.setWpConfig({ password: v })} type="password" placeholder="xxxx xxxx xxxx xxxx" icon="🔑" helpText="Generate in WordPress → Users → Application Passwords" required />
                            <button onClick={handleTestWpConnection} disabled={wpTestStatus === 'testing'} style={{
                                width: '100%', padding: '14px', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', border: 'none',
                                background: wpTestStatus === 'success' ? 'rgba(16,185,129,0.2)' : wpTestStatus === 'failed' ? 'rgba(239,68,68,0.2)' : '#3b82f6',
                                color: wpTestStatus === 'success' ? '#10b981' : wpTestStatus === 'failed' ? '#ef4444' : 'white'
                            }}>
                                {wpTestStatus === 'testing' ? '🔄 Testing...' : wpTestStatus === 'success' ? '✅ Connected' : wpTestStatus === 'failed' ? '❌ Retry' : '🔌 Test Connection'}
                            </button>
                        </Card>
                        
                        {/* AI Config */}
                        <Card padding="lg">
                            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>🤖</span> AI Provider
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
                                {(['google', 'openrouter', 'openai', 'anthropic', 'groq'] as const).map(provider => (
                                    <button key={provider} onClick={() => store.setSelectedProvider(provider)} style={{
                                        padding: '12px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                                        background: store.selectedProvider === provider ? 'white' : 'rgba(255,255,255,0.03)',
                                        color: store.selectedProvider === provider ? 'black' : 'rgba(255,255,255,0.4)',
                                        border: store.selectedProvider === provider ? 'none' : '1px solid rgba(255,255,255,0.06)',
                                        cursor: 'pointer'
                                    }}>{provider}</button>
                                ))}
                            </div>
                            <AdvancedInput label={`${store.selectedProvider} API Key`} value={store.apiKeys[store.selectedProvider]} onChange={v => store.setApiKey(store.selectedProvider, v)} type="password" placeholder="Enter API key..." icon="🔑" required />
                            <AdvancedInput label="Serper API Key (Optional)" value={store.apiKeys.serper} onChange={v => store.setApiKey('serper', v)} type="password" placeholder="For SERP analysis, YouTube, References..." icon="🔍" helpText="Enables entity analysis, YouTube videos & references" />
                        </Card>
                    </div>
                )}
                
                {/* Strategy View */}
                {store.activeView === 'strategy' && (
                    <div>
                        {/* Progress Tracker */}
                        <OptimizationProgress
                            isRunning={optimizationProgress.isRunning}
                            phase={optimizationProgress.phase}
                            progress={optimizationProgress.progress}
                            startTime={optimizationProgress.startTime}
                            currentUrl={optimizationProgress.currentUrl}
                            sectionsCompleted={optimizationProgress.sectionsCompleted}
                            totalSections={optimizationProgress.totalSections}
                            wordCount={optimizationProgress.wordCount}
                            onCancel={() => cancelCurrentJob('User cancelled')}
                        />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                            {/* Left Column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Sitemap Crawler */}
                                <Card padding="lg">
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>🕷️</span> Sitemap Crawler
                                    </h3>
                                    <AdvancedInput label="Sitemap URL" value={sitemapUrl} onChange={setSitemapUrl} placeholder="https://yoursite.com/sitemap.xml" icon="🗺️" />
                                    <button onClick={handleCrawlSitemap} disabled={store.isProcessing} style={{
                                        width: '100%', padding: '14px', borderRadius: '12px', fontWeight: '600', fontSize: '14px',
                                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', border: 'none', cursor: 'pointer', opacity: store.isProcessing ? 0.5 : 1
                                    }}>
                                        {store.isProcessing ? '🔄 Crawling...' : '🕷️ Crawl Sitemap'}
                                    </button>
                                </Card>
                                
                                {/* Quick Optimize */}
                                <Card padding="lg">
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>⚡</span> Quick Optimize
                                    </h3>
                                    <AdvancedInput label="Page URL" value={manualUrl} onChange={setManualUrl} placeholder="https://yoursite.com/your-page" icon="🔗" />
                                    <AdvancedInput label="Target Keyword (Optional)" value={targetKeywordOverride} onChange={setTargetKeywordOverride} placeholder="Override topic..." icon="🎯" />
                                    
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                        <button onClick={() => store.setPublishMode('draft')} style={{
                                            flex: 1, padding: '12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                                            background: store.publishMode === 'draft' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                                            color: store.publishMode === 'draft' ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                                            border: store.publishMode === 'draft' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                            cursor: 'pointer'
                                        }}>📝 Draft</button>
                                        <button onClick={() => store.setPublishMode('autopublish')} style={{
                                            flex: 1, padding: '12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                                            background: store.publishMode === 'autopublish' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
                                            color: store.publishMode === 'autopublish' ? '#10b981' : 'rgba(255,255,255,0.4)',
                                            border: store.publishMode === 'autopublish' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                            cursor: 'pointer'
                                        }}>🚀 Publish</button>
                                    </div>
                                    
                                    <button onClick={() => executeGodMode()} disabled={optimizationProgress.isRunning || (!manualUrl && store.pages.length === 0)} style={{
                                        width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '14px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', cursor: 'pointer',
                                        opacity: optimizationProgress.isRunning ? 0.5 : 1, boxShadow: '0 8px 24px rgba(16,185,129,0.3)'
                                    }}>
                                        {optimizationProgress.isRunning ? '🔄 Optimizing...' : '⚡ Optimize Now'}
                                    </button>
                                </Card>
                                
                                {/* Options */}
                                <Card padding="md">
                                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Options</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <Toggle label="Preserve Featured Image" checked={preserveFeaturedImage} onChange={setPreserveFeaturedImage} icon="🎨" />
                                        <Toggle label="Preserve Categories" checked={preserveCategories} onChange={setPreserveCategories} icon="📁" />
                                        <Toggle label="Preserve Tags" checked={preserveTags} onChange={setPreserveTags} icon="🏷️" />
                                    </div>
                                </Card>
                            </div>
                            
                            {/* Right Column - Logs & Pages */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Activity Log */}
                                <Card padding="md">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>📊</span> Activity Log
                                            <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: '400' }}>{store.godModeLog.length} entries</span>
                                        </h3>
                                        <button onClick={() => store.clearGodLog()} style={{
                                            padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                                            background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none', cursor: 'pointer'
                                        }}>🗑️</button>
                                    </div>
                                    <div style={{
                                        height: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px',
                                        fontFamily: 'ui-monospace, monospace', fontSize: '12px', lineHeight: '1.6'
                                    }}>
                                        {store.godModeLog.length === 0 ? (
                                            <div style={{ textAlign: 'center', opacity: 0.3, padding: '40px' }}>No activity yet</div>
                                        ) : (
                                            store.godModeLog.slice(-100).map((entry, i) => (
                                                <div key={i} style={{ marginBottom: '4px', opacity: 0.8 }}>{entry}</div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                                
                                {/* Pages Queue */}
                                <Card padding="md">
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>📋</span> Page Queue
                                        <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: 'rgba(255,255,255,0.06)' }}>{store.pages.length}</span>
                                    </h3>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        {store.pages.length === 0 ? (
                                            <div style={{ textAlign: 'center', opacity: 0.3, padding: '40px' }}>
                                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                                                <div>Crawl a sitemap or add URLs manually</div>
                                            </div>
                                        ) : (
                                            store.pages.slice(0, 50).map(page => (
                                                <div key={page.id} onClick={() => { setActivePageId(page.id); store.setActiveView('review'); }} style={{
                                                    padding: '12px 16px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer',
                                                    background: page.jobState?.status === 'running' ? 'rgba(59,130,246,0.1)' : page.jobState?.status === 'completed' ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                                                    border: page.jobState?.status === 'running' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page.title}</div>
                                                            <div style={{ fontSize: '11px', opacity: 0.4, fontFamily: 'monospace' }}>{page.slug}</div>
                                                        </div>
                                                        {page.healthScore !== null && (
                                                            <div style={{
                                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                                                background: page.healthScore >= 80 ? 'rgba(16,185,129,0.2)' : page.healthScore >= 60 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                                                                color: page.healthScore >= 80 ? '#10b981' : page.healthScore >= 60 ? '#eab308' : '#ef4444'
                                                            }}>{page.healthScore}%</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Review View */}
                {store.activeView === 'review' && (
                    <div style={{ textAlign: 'center', padding: '60px', opacity: 0.4 }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                        <div style={{ fontSize: '18px', fontWeight: '600' }}>Select a page from Strategy tab to review</div>
                    </div>
                )}
            </main>
            
            {/* Toast Container */}
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 100 }}>
                {store.toasts.map(toast => (
                    <div key={toast.id} style={{
                        padding: '14px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '500',
                        background: toast.type === 'success' ? 'rgba(16,185,129,0.9)' : toast.type === 'error' ? 'rgba(239,68,68,0.9)' : toast.type === 'warning' ? 'rgba(234,179,8,0.9)' : 'rgba(59,130,246,0.9)',
                        color: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                        {toast.type === 'success' && '✅'}{toast.type === 'error' && '❌'}{toast.type === 'warning' && '⚠️'}{toast.type === 'info' && 'ℹ️'}
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
