from pydantic import BaseModel, Field
from typing import List, Optional, Union


class AnalysisRequest(BaseModel):
    """
    Base request model for all analysis endpoints.
    Must include the interaction request data plus analysis-specific parameters.
    """

    interactions: List[dict] = Field(
        description="List of user-task-hierarchy triplets from InteractionRequest",
    )

    actions_to_aggregate: List[str] = Field(
        default_factory=list,
        description="List of action types to compress during preprocessing",
    )

    use_2grams: bool = Field(
        default=True,
        description="Whether to include 2-gram features",
    )

    restart_actions: List[str] = Field(
        default_factory=list,
        description="Action types that restart a session (for efficiency analysis)",
    )

    refine_actions: List[str] = Field(
        default_factory=list,
        description="Action types that refine within a session (for efficiency analysis)",
    )


class FeatureImportance(BaseModel):
    """
    Model for a single feature's importance in the classifier.
    """

    feature_key: str = Field(
        description="Technical column name",
    )

    feature_name: str = Field(
        description="Human-readable feature name",
    )

    importance: float = Field(
        description="Feature importance weight (0-1)",
    )


class ClassifierResponse(BaseModel):
    """
    Response model for classifier analysis with SHAP values.
    Trains a Random Forest and returns model metrics plus SHAP explanations.
    """

    accuracy: float = Field(
        description="Accuracy score on test set",
    )

    f1: float = Field(
        description="F1 score on test set",
    )

    auc: Optional[float] = Field(
        default=None,
        description="ROC-AUC score on test set",
    )

    importances: List[FeatureImportance] = Field(
        description="List of feature importances from Random Forest",
    )

    shap_values: List[List[float]] = Field(
        description="SHAP values for each sample and feature",
    )

    shap_expected_value: Optional[Union[float, List[float]]] = Field(
        default=None,
        description="SHAP expected value (base value); may be scalar or per-class list",
    )

    feature_keys: List[str] = Field(
        description="Technical column names in order",
    )

    feature_names: dict = Field(
        description="Mapping from technical names to human-readable names",
    )


class MotifDifference(BaseModel):
    """
    Model for a single discriminative motif/feature.
    """

    feature_key: str = Field(
        description="Technical column name",
    )

    feature_name: str = Field(
        description="Human-readable feature name",
    )

    success_mean: Optional[float] = Field(
        default=None,
        description="Mean value in successful sessions",
    )

    failure_mean: Optional[float] = Field(
        default=None,
        description="Mean value in failed sessions",
    )

    difference: Optional[float] = Field(
        default=None,
        description="Difference: success_mean - failure_mean",
    )


class MotifResponse(BaseModel):
    """
    Response model for motif analysis.
    Identifies features that most differentiate successful from failed sessions.
    """

    motifs: List[MotifDifference] = Field(
        description="Top discriminative features sorted by absolute difference",
    )


class EfficiencyMetric(BaseModel):
    """
    Model for a single session's efficiency metrics.
    """

    intensity: float = Field(
        description="Refines / (Restarts + 1)",
    )

    persistence: float = Field(
        description="Total actions / (Restarts + 1)",
    )

    success: bool = Field(
        description="Whether the session was successful",
    )


class EfficiencyResponse(BaseModel):
    """
    Response model for efficiency analysis.
    Computes iteration intensity and persistence metrics per session.
    """

    metrics: List[EfficiencyMetric] = Field(
        description="Efficiency metrics per session",
    )
