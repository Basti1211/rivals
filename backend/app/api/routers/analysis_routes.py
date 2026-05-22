from fastapi import APIRouter, HTTPException

from app.analysis.helpers import build_sessions_and_labels
from app.analysis.modules import (
    SequencePreprocessor,
    FeatureExtractor,
    SimpleClassifier,
    MotifAnalyzer,
    EfficiencyAnalyzer,
)
from app.types.responses.analysis_responses import (
    AnalysisRequest,
    ClassifierResponse,
    MotifResponse,
    EfficiencyResponse,
)

analysis_router = APIRouter(prefix="/data", tags=["analysis"])


@analysis_router.post(
    "/analysis/classifier",
    response_model=ClassifierResponse,
    summary="Train Random Forest classifier and return SHAP explanations",
    description="Preprocesses interaction sessions, trains a Random Forest classifier on action proportions and 2-grams, and computes SHAP values for model interpretability.",
)
def classifier_endpoint(request: AnalysisRequest) -> ClassifierResponse:
    actions = request.actions_to_aggregate
    use_2grams = request.use_2grams

    sessions, labels, _ = build_sessions_and_labels(request)
    processed = SequencePreprocessor.apply_intensity_binning(sessions, actions)

    vocab = sorted(list({a for seq in processed for a in seq}))
    fe = FeatureExtractor(vocab)

    prop_df, prop_names = fe.extract_proportions(processed)
    if use_2grams:
        gram_df, gram_names = fe.extract_2grams(processed)
        X = prop_df.join(gram_df)
        feature_map = {**prop_names, **gram_names}
    else:
        X = prop_df
        feature_map = prop_names

    result = SimpleClassifier.compute_metrics_and_shap(X.fillna(0), labels, feature_map)
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return ClassifierResponse(**result)


@analysis_router.post(
    "/analysis/motif",
    response_model=MotifResponse,
    summary="Identify discriminative behavioral motifs",
    description="Analyzes which action patterns most differentiate successful from failed sessions using feature proportions and transitions.",
)
def motif_endpoint(request: AnalysisRequest) -> MotifResponse:
    actions = request.actions_to_aggregate

    sessions, labels, _ = build_sessions_and_labels(request)
    processed = SequencePreprocessor.apply_intensity_binning(sessions, actions)

    vocab = sorted(list({a for seq in processed for a in seq}))
    fe = FeatureExtractor(vocab)

    prop_df, prop_names = fe.extract_proportions(processed)
    gram_df, gram_names = fe.extract_2grams(processed)
    X = prop_df.join(gram_df)
    feature_map = {**prop_names, **gram_names}

    motifs = MotifAnalyzer.analyze_differences(X.fillna(0), labels, feature_map, top_k=10)
    return MotifResponse(motifs=motifs)


@analysis_router.post(
    "/analysis/efficiency",
    response_model=EfficiencyResponse,
    summary="Compute iteration and persistence metrics",
    description="Calculates efficiency metrics (iteration intensity and persistence depth) for each session based on restart and refine action counts.",
)
def efficiency_endpoint(request: AnalysisRequest) -> EfficiencyResponse:
    actions = request.actions_to_aggregate
    restart_actions = request.restart_actions
    refine_actions = request.refine_actions

    sessions, labels, _ = build_sessions_and_labels(request)
    processed = SequencePreprocessor.apply_intensity_binning(sessions, actions)

    metrics = EfficiencyAnalyzer.analyze(processed, labels, restart_actions, refine_actions)
    return EfficiencyResponse(metrics=metrics)
