from pydantic import BaseModel, Field

from typing import Any, Dict, List, Optional


class TaskRow(BaseModel):
    """
    Response model for data loading operations.
    """
    task_id: str = Field(
        description="Unique UUID identifying the task",
    )

    name: str = Field(
        description="Human-readable task name, for example 'vbs26-kis-t4' or 'vbs26-qa1'",
    )

    dataset: str = Field(
        description="Dataset associated with the task, for example 'V3C'",
    )

    task_group: str = Field(
        alias="taskGroup",
        description="Task group or benchmark category, for example 'AVS'",
    )

    finished_after_correct_answer: bool = Field(
        description="Defines whether a task is finished after an correct answer of a user",
    )

    hint_video: Optional[str] = Field(
        default=None,
        description="Optional video ID used as a hint for the task; null if no hint video is provided",
    )

    hint_video_path: Optional[str] = Field(
        default=None,
        description="Optional path or URL for the hint video; null if not provided",
    )

    hint_video_start_time: Optional[int] = Field(
        default=None,
        description="Optional start time of the hint video segment, usually in milliseconds; null if not provided",
    )

    hint_video_end_time: Optional[int] = Field(
        default=None,
        description="Optional end time of the hint video segment, usually in milliseconds; null if not provided",
    )

    hint_text: Optional[str] = Field(
        default=None,
        description="Textual task description, question, or search hint shown to the user; null if not provided",
    )

    target_text: Optional[str] = Field(
        default=None,
        description="Optional target text answer or description; null if not provided",
    )

    target_video: Optional[str] = Field(
        default=None,
        description="Optional target video ID; null if not provided",
    )

    target_video_path: Optional[str] = Field(
        default=None,
        description="Optional path or URL for the target video; null if not provided",
    )

    target_video_start_time: Optional[int] = Field(
        default=None,
        description="Optional start time of the target video segment, usually in milliseconds; null if not provided",
    )

    target_video_end_time: Optional[int] = Field(
        default=None,
        description="Optional end time of the target video segment, usually in milliseconds; null if not provided",
    )

    started: Optional[int] = Field(
        default=None,
        description="Optional Unix timestamp in milliseconds indicating when the task started",
    )

    ended: Optional[int] = Field(
        default=None,
        description="Optional Unix timestamp in milliseconds indicating when the task ended",
    )

    from_file: Optional[int] = Field(
        default=None,
        description="SourceFiles id of the uploaded file that produced this row",
    )


class TaskList(BaseModel):
    """
    Response model containing multiple VBS task entries.
    """

    tasks: List[TaskRow] = Field(
        description="List of task entries",
    )


class SubmissionRow(BaseModel):
    """
    Request model for a single submitted answer.
    """

    task_id: str = Field(
        description="Unique UUID identifying the task this submission belongs to",
    )

    user: str = Field(
        description="User name that submitted the answer",
    )

    timestamp: int = Field(
        description="Unix timestamp in milliseconds when the answer was submitted",
    )

    status: int = Field(
        ge=-1,
        le=1,
        description="Submission status: -1 for wrong, 0 for not decided, 1 for correct",
    )

    answer_text: Optional[str] = Field(
        default=None,
        description="Optional submitted text answer; null if not provided",
    )

    answer_video: Optional[str] = Field(
        default=None,
        description="Optional submitted video ID; null if not provided",
    )

    answer_video_start_time: Optional[int] = Field(
        default=None,
        description="Optional start time of the submitted video segment, usually in milliseconds; null if not provided",
    )

    answer_video_end_time: Optional[int] = Field(
        default=None,
        description="Optional end time of the submitted video segment, usually in milliseconds; null if not provided",
    )

    from_file: Optional[int] = Field(
        default=None,
        description="SourceFiles id of the uploaded file that produced this row",
    )


class SubmissionList(BaseModel):
    """
    Request model containing multiple submitted answers.
    """

    submissions: List[SubmissionRow] = Field(
        description="List of submitted answers",
    )


class InteractionHierarchyNode(BaseModel):
    """
    Request model for a node in an interaction action hierarchy.
    """

    name: str = Field(
        alias="Name",
        description="Human-readable hierarchy node name",
    )

    visualize: bool = Field(
        alias="Visualize",
        description="Whether this hierarchy node should be visualized",
    )

    cancelled: bool = Field(
        default=False,
        alias="Cancelled",
        description="Whether this hierarchy node should be cancelled",
    )

    children: List["InteractionHierarchyNode"] = Field(
        default_factory=list,
        alias="Children",
        description="Child hierarchy nodes",
    )


class InteractionLogRow(BaseModel):
    """
    Request model for a single user interaction log entry.
    """

    timestamp: float = Field(
        description="Unix timestamp in milliseconds for the interaction",
    )

    action: str = Field(
        description="Interaction action type",
    )

    frame_rank: Optional[float] = Field(
        default=None,
        alias="frameRank",
        description="Optional frame rank associated with the interaction",
    )

    video_rank: Optional[float] = Field(
        default=None,
        alias="videoRank",
        description="Optional video rank associated with the interaction",
    )

    metadata: Optional[Any] = Field(
        default=None,
        description="Optional interaction metadata payload",
    )

    from_file: Optional[int] = Field(
        default=None,
        description="SourceFiles id of the uploaded file that produced this row",
    )


class InteractionLogSystem(BaseModel):
    """
    Request model for one logging system export.
    """

    name: str = Field(
        alias="Name",
        description="Name of the logging system",
    )

    hierarchy: List[InteractionHierarchyNode] = Field(
        alias="Hierarchy",
        description="Action hierarchy for the logging system",
    )

    logs: Dict[str, List[InteractionLogRow]] = Field(
        alias="Logs",
        description="Mapping of user names to their interaction log entries",
    )


class InteractionLogList(BaseModel):
    """
    Request model containing multiple logging system exports.
    """

    interaction_logs: List[InteractionLogSystem] = Field(
        description="List of interaction logging system exports",
    )


class InteractionRequestRow(BaseModel):
    """
    Request model for a single user-task-hierarchy interaction request triplet.
    """

    user: str = Field(
        description="User name",
    )

    task: str = Field(
        description="Task identifier or name",
    )

    hierarchy: List[InteractionHierarchyNode] = Field(
        description="Selected interaction action hierarchy for this user-task request",
    )


class InteractionRequest(BaseModel):
    """
    Request model containing multiple user-task-hierarchy triplets.
    """

    interactions: List[InteractionRequestRow] = Field(
        description="List of user-task-hierarchy triplets",
    )
