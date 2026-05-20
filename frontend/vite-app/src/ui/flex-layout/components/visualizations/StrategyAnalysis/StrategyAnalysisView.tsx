import React, { useMemo, useState } from "react";
import { Button, Checkbox, Switch, Divider, Alert, Spin } from "antd";
import { scaleLinear, scaleBand, max, min, quantile } from "d3";
import { fetchClassifierAnalysis, fetchMotifAnalysis, fetchEfficiencyAnalysis, getErrorMessage } from "../../../../../api-handler/Requests";
import type { 
    FetchInteractionDataResponse, 
    AnalysisRequest, 
    ClassifierResponse, 
    MotifResponse, 
    EfficiencyResponse 
} from "../../../../../types/dataTypes";
import "./strategyAnalysis.css";

type StrategyAnalysisViewProps = {
    data: FetchInteractionDataResponse | null;
    onOpenDataManipulator: () => void;
};

// --- Helper Functions ---

const truncateLabel = (text: string, length = 18) => 
    text.length > length ? text.slice(0, length) + '...' : text;

const computeBoxStats = (data: number[]) => {
    if (!data.length) return null;
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25) ?? 0;
    const med = quantile(sorted, 0.5) ?? 0;
    const q3 = quantile(sorted, 0.75) ?? 0;
    const iqr = q3 - q1;
    const minVal = Math.max(sorted[0], q1 - 1.5 * iqr);
    const maxVal = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
    const outliers = sorted.filter(v => v < minVal || v > maxVal);
    return { q1, med, q3, minVal, maxVal, outliers };
};

// --- D3 Plot Components ---

const ClassifierPlot: React.FC<{ result: ClassifierResponse }> = ({ result }) => {
    const width = 550;
    const height = Math.max(200, result.feature_keys.length * 28);
    const margin = { top: 30, right: 30, bottom: 40, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    
    const shapStats = useMemo(() => {
        if (!result.shap_values || !result.shap_values.length) return [];
        return result.feature_keys.map((key, i) => {
            const meanShap = result.shap_values.reduce((sum, row) => sum + row[i], 0) / result.shap_values.length;
            return { key, name: result.feature_names[key] || key, meanShap };
        }).sort((a, b) => Math.abs(b.meanShap) - Math.abs(a.meanShap)); // Sort by absolute magnitude descending
    }, [result]);

    const maxAbsShap = max(shapStats, d => Math.abs(d.meanShap)) ?? 0.1;
    const xScale = scaleLinear().domain([-maxAbsShap, maxAbsShap]).range([0, innerWidth]).nice();
    const yScale = scaleBand().domain(shapStats.map(d => d.name)).range([0, height]).padding(0.2);

    return (
        <div className="analysis-plot-container">
            <h4>Mean SHAP Values (Accuracy: {(result.accuracy * 100).toFixed(1)}%)</h4>
            <svg viewBox={`0 0 ${width} ${height + margin.top + margin.bottom}`} width="100%" height={height + margin.top + margin.bottom}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {xScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(${xScale(tick)}, 0)`}>
                            <line y2={height} stroke="#e0e0e0" strokeDasharray="3,3" />
                            <text y={height + 15} textAnchor="middle" className="plot-label">{tick}</text>
                        </g>
                    ))}
                    <line x1={xScale(0)} x2={xScale(0)} y1={0} y2={height} stroke="#333" />
                    
                    {shapStats.map((d) => {
                        const val = d.meanShap;
                        const x = val < 0 ? xScale(val) : xScale(0);
                        const w = Math.abs(xScale(val) - xScale(0));
                        const y = yScale(d.name) ?? 0;
                        return (
                            <g key={d.key}>
                                <text x={-10} y={y + yScale.bandwidth() / 2} textAnchor="end" alignmentBaseline="middle" className="plot-label">
                                    {truncateLabel(d.name)}
                                    <title>{d.name}</title>
                                </text>
                                <rect x={x} y={y} width={w} height={yScale.bandwidth()} fill={val > 0 ? "#59a14f" : "#e15759"} />
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

const MotifPlot: React.FC<{ result: MotifResponse }> = ({ result }) => {
    const width = 550;
    const height = Math.max(200, result.motifs.length * 30);
    const margin = { top: 30, right: 30, bottom: 40, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    
    // Sort by absolute magnitude descending to match SHAP style
    const sortedMotifs = useMemo(() => {
        return [...result.motifs].sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0));
    }, [result.motifs]);

    const minDiff = min(sortedMotifs, d => d.difference ?? 0) ?? 0;
    const maxDiff = max(sortedMotifs, d => d.difference ?? 0) ?? 0;
    const absMax = Math.max(Math.abs(minDiff), Math.abs(maxDiff));
    
    const xScale = scaleLinear().domain([-absMax, absMax]).range([0, innerWidth]).nice();
    const yScale = scaleBand().domain(sortedMotifs.map(d => d.feature_name)).range([0, height]).padding(0.2);

    return (
        <div className="analysis-plot-container">
            <h4>Motif Differences (Success vs. Failure)</h4>
            <svg viewBox={`0 0 ${width} ${height + margin.top + margin.bottom}`} width="100%" height={height + margin.top + margin.bottom}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {xScale.ticks(5).map(tick => (
                        <g key={tick} transform={`translate(${xScale(tick)}, 0)`}>
                            <line y2={height} stroke="#e0e0e0" strokeDasharray="3,3" />
                            <text y={height + 15} textAnchor="middle" className="plot-label">{tick}</text>
                        </g>
                    ))}
                    <line x1={xScale(0)} x2={xScale(0)} y1={0} y2={height} stroke="#333" />
                    
                    {sortedMotifs.map((d) => {
                        const val = d.difference ?? 0;
                        const x = val < 0 ? xScale(val) : xScale(0);
                        const w = Math.abs(xScale(val) - xScale(0));
                        const y = yScale(d.feature_name) ?? 0;
                        return (
                            <g key={d.feature_key}>
                                <text x={-10} y={y + yScale.bandwidth() / 2} textAnchor="end" alignmentBaseline="middle" className="plot-label">
                                    {truncateLabel(d.feature_name)}
                                    <title>{d.feature_name}</title>
                                </text>
                                <rect x={x} y={y} width={w} height={yScale.bandwidth()} fill={val > 0 ? "#59a14f" : "#e15759"} />
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

const BoxPlotChart: React.FC<{ title: string, dataFalse: number[], dataTrue: number[], yLabel: string }> = ({ title, dataFalse, dataTrue, yLabel }) => {
    const width = 300;
    const height = 350;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allData = [...dataFalse, ...dataTrue].sort((a, b) => a - b);
    const globalQ1 = quantile(allData, 0.25) ?? 0;
    const globalQ3 = quantile(allData, 0.75) ?? 0;
    const globalIQR = globalQ3 - globalQ1;
    
    // Robust upper bound to prevent extreme outliers from squishing the boxplot
    const robustMax = globalQ3 + 3 * globalIQR;
    const actualMax = max(allData) ?? 1;
    const domainMax = Math.min(actualMax, Math.max(robustMax, quantile(allData, 0.95) ?? 1));

    // Clamp scales extreme outliers to the top edge (y=0)
    const yScale = scaleLinear().domain([0, domainMax]).range([innerHeight, 0]).clamp(true).nice();
    const xScale = scaleBand().domain(["False", "True"]).range([0, innerWidth]).padding(0.4);

    const statsFalse = computeBoxStats(dataFalse);
    const statsTrue = computeBoxStats(dataTrue);

    const renderBox = (stats: ReturnType<typeof computeBoxStats>, successLabel: string, fill: string) => {
        if (!stats) return null;
        const x = xScale(successLabel) ?? 0;
        const bw = xScale.bandwidth();
        const center = x + bw / 2;
        
        return (
            <g key={successLabel}>
                <line x1={center} x2={center} y1={yScale(stats.minVal)} y2={yScale(stats.q1)} stroke="#333" />
                <line x1={center} x2={center} y1={yScale(stats.maxVal)} y2={yScale(stats.q3)} stroke="#333" />
                <line x1={center - bw / 4} x2={center + bw / 4} y1={yScale(stats.minVal)} y2={yScale(stats.minVal)} stroke="#333" />
                <line x1={center - bw / 4} x2={center + bw / 4} y1={yScale(stats.maxVal)} y2={yScale(stats.maxVal)} stroke="#333" />
                
                <rect x={x} y={yScale(stats.q3)} width={bw} height={Math.abs(yScale(stats.q1) - yScale(stats.q3))} fill={fill} stroke="#333" />
                <line x1={x} x2={x + bw} y1={yScale(stats.med)} y2={yScale(stats.med)} stroke="#333" />
                
                {stats.outliers.map((val, i) => (
                    <circle key={i} cx={center} cy={yScale(val)} r={3} fill="none" stroke={val > domainMax ? "#e15759" : "#666"} />
                ))}
            </g>
        );
    };

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
            <text x={width / 2} y={margin.top / 2} textAnchor="middle" style={{ fontSize: '14px', fontWeight: 500 }}>{title}</text>
            <g transform={`translate(${margin.left},${margin.top})`}>
                {yScale.ticks(6).map(tick => (
                    <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
                        <line x2={innerWidth} stroke="#e0e0e0" strokeDasharray="3,3" />
                        <text x={-10} alignmentBaseline="middle" textAnchor="end" className="plot-label">{tick}</text>
                    </g>
                ))}
                <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="#333" />
                <text x={-innerHeight / 2} y={-40} transform="rotate(-90)" textAnchor="middle" className="plot-label">{yLabel}</text>
                
                <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#333" />
                {xScale.domain().map(d => (
                    <text key={d} x={(xScale(d) ?? 0) + xScale.bandwidth() / 2} y={innerHeight + 20} textAnchor="middle" className="plot-label">{d}</text>
                ))}
                <text x={innerWidth / 2} y={innerHeight + 35} textAnchor="middle" className="plot-label">Success</text>

                {renderBox(statsFalse, "False", "#d4d8dd")}
                {renderBox(statsTrue, "True", "#278d9b")}
            </g>
        </svg>
    );
};

const EfficiencyPlot: React.FC<{ result: EfficiencyResponse }> = ({ result }) => {
    const intensityFalse = result.metrics.filter(d => !d.success).map(d => d.intensity);
    const intensityTrue = result.metrics.filter(d => d.success).map(d => d.intensity);
    const persistenceFalse = result.metrics.filter(d => !d.success).map(d => d.persistence);
    const persistenceTrue = result.metrics.filter(d => d.success).map(d => d.persistence);

    return (
        <div className="analysis-plot-container" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <BoxPlotChart title="Iteration Intensity" yLabel="Intensity" dataFalse={intensityFalse} dataTrue={intensityTrue} />
            <BoxPlotChart title="Persistence Depth" yLabel="Persistence" dataFalse={persistenceFalse} dataTrue={persistenceTrue} />
        </div>
    );
};

// --- Main View ---

const extractUniqueActions = (data: FetchInteractionDataResponse | null): string[] => {
    if (!data) return [];
    const actions = new Set<string>();
    data.interactions.forEach(group => {
        group.interactions.forEach(interaction => {
            if (interaction.abstract_type) actions.add(interaction.abstract_type);
        });
    });
    return Array.from(actions).sort();
};

const StrategyAnalysisView: React.FC<StrategyAnalysisViewProps> = ({ data, onOpenDataManipulator }) => {
    const [use2Grams, setUse2Grams] = useState<boolean>(true);
    const [actionsToAggregate, setActionsToAggregate] = useState<string[]>([]);
    const [restartActions, setRestartActions] = useState<string[]>([]);
    const [refineActions, setRefineActions] = useState<string[]>([]);
    
    const [classifierResult, setClassifierResult] = useState<ClassifierResponse | null>(null);
    const [motifResult, setMotifResult] = useState<MotifResponse | null>(null);
    const [efficiencyResult, setEfficiencyResult] = useState<EfficiencyResponse | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableActions = useMemo(() => extractUniqueActions(data), [data]);

    const requestInteractions = useMemo(() => {
        if (!data) return [];
        return data.interactions.map(ig => {
            const userRef = data.users.users.find(u => u.user === ig.user);
            return {
                user: ig.user,
                task: ig.task,
                hierarchy: userRef?.hierarchy || []
            };
        });
    }, [data]);

    const buildRequest = (): AnalysisRequest => ({
        interactions: requestInteractions,
        actions_to_aggregate: actionsToAggregate,
        use_2grams: use2Grams,
        restart_actions: restartActions,
        refine_actions: refineActions
    });

    const executeAnalysis = async (type: 'classifier' | 'motif' | 'efficiency') => {
        setIsLoading(true);
        setError(null);
        try {
            const req = buildRequest();
            if (type === 'classifier') setClassifierResult(await fetchClassifierAnalysis(req));
            if (type === 'motif') setMotifResult(await fetchMotifAnalysis(req));
            if (type === 'efficiency') setEfficiencyResult(await fetchEfficiencyAnalysis(req));
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="strategy-analysis-view">
            <div className="strategy-analysis-header">
                <h1>Strategy Analysis</h1>
                <Button type="primary" onClick={onOpenDataManipulator}>
                    Select Data ({requestInteractions.length} pairs loaded)
                </Button>
            </div>

            {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

            <div className="analysis-configuration">
                <Divider orientation="left">Configuration</Divider>
                
                <div style={{ marginBottom: 16 }}>
                    <strong>Include 2-Grams: </strong>
                    <Switch checked={use2Grams} onChange={setUse2Grams} />
                </div>

                <div className="configuration-lists">
                    <div className="config-column">
                        <h4>Actions to Aggregate</h4>
                        <Checkbox.Group options={availableActions} value={actionsToAggregate} onChange={(val) => setActionsToAggregate(val as string[])} />
                    </div>
                    <div className="config-column">
                        <h4>Restart Actions</h4>
                        <Checkbox.Group options={availableActions} value={restartActions} onChange={(val) => setRestartActions(val as string[])} />
                    </div>
                    <div className="config-column">
                        <h4>Refine Actions</h4>
                        <Checkbox.Group options={availableActions} value={refineActions} onChange={(val) => setRefineActions(val as string[])} />
                    </div>
                </div>

                <Divider orientation="left">Execution</Divider>
                <div className="execution-actions">
                    <Button onClick={() => executeAnalysis('classifier')} disabled={!data || isLoading}>Run Classifier</Button>
                    <Button onClick={() => executeAnalysis('motif')} disabled={!data || isLoading}>Run Motif</Button>
                    <Button onClick={() => executeAnalysis('efficiency')} disabled={!data || isLoading}>Run Efficiency</Button>
                    {isLoading && <Spin style={{ marginLeft: 16 }} />}
                </div>
            </div>

            <Divider orientation="left">Results</Divider>
            <div className="analysis-results-grid">
                {classifierResult && <ClassifierPlot result={classifierResult} />}
                {motifResult && <MotifPlot result={motifResult} />}
                {efficiencyResult && <EfficiencyPlot result={efficiencyResult} />}
            </div>
        </div>
    );
};

export default StrategyAnalysisView;