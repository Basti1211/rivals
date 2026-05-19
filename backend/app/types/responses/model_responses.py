from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional

from app.types.responses.model_requests import (
    InteractionHierarchyNode,
    InteractionLogRow,
    SubmissionList,
    TaskList,
)


class SourceFileRow(BaseModel):
    """
    Response model for a source file row.
    """

    id: int = Field(
        description="Generated source file id",
    )

    filename: str = Field(
        description="Uploaded source filename",
    )


class LoadDataResponse(BaseModel):
    """
    Response model for data loading operations.
    """

    model_config = ConfigDict(validate_assignment=True)

    loadedTasks: int = Field(
        default=0,
        description="Number of task rows newly added by this load operation",
    )
    loadedUsers: int = Field(
        default=0,
        description="Number of user rows newly added by this load operation",
    )
    loadedLogs: int = Field(
        default=0,
        description="Number of interaction log rows newly added by this load operation",
    )
    loadedAnswers: int = Field(
        default=0,
        description="Number of answer rows newly added by this load operation",
    )
    totalTasks: int = Field(
        default=0,
        description="Total number of task rows currently available",
    )
    totalUsers: int = Field(
        default=0,
        description="Total number of user rows currently available",
    )
    totalLogs: int = Field(
        default=0,
        description="Total number of interaction log rows currently available",
    )
    totalAnswers: int = Field(
        default=0,
        description="Total number of answer rows currently available",
    )
    sourceFiles: List[SourceFileRow] = Field(
        default_factory=list,
        description="List of uploaded source files in insertion order",
    )
    errorMessage: Optional[str] = Field(
        default=None,
        description="Error message if loading failed; null if loading succeeded",
    )


class UserRow(BaseModel):
    """
    Response model for a single user row.
    """

    user: str = Field(
        description="User name",
    )

    system: str = Field(
        description="Name of the logging system associated with the user",
    )

    hierarchy: List[InteractionHierarchyNode] = Field(
        description="Action hierarchy for the user's logging system",
    )

    from_file: Optional[int] = Field(
        default=None,
        description="SourceFiles id of the uploaded file that produced this row",
    )


class UserList(BaseModel):
    """
    Response model containing multiple user entries.
    """

    users: List[UserRow] = Field(
        description="List of user entries",
    )


class FetchInteractionLogRow(InteractionLogRow):
    """
    Response model for a fetched user interaction log entry.
    """

    abstract_type: str = Field(
        description="Nearest selected hierarchy ancestor for this interaction action",
    )

    task_is_active: bool = Field(
        description="Whether the task was active when this interaction occurred",
    )

    cancelled: bool = Field(
        description="Whether this interaction belongs to a cancelled hierarchy subtree",
    )


class InteractionTaskUser(BaseModel):
    """
    Response model for interaction logs grouped by a user-task pair.
    """

    user: str = Field(
        description="User name",
    )

    task: str = Field(
        description="Task identifier or name",
    )

    interactions: List[FetchInteractionLogRow] = Field(
        description="Interaction log entries for this user-task pair",
    )


class FetchInteractionDataResponse(BaseModel):
    """
    Response model for fetching some interaction data.
    """

    tasks: TaskList = Field(
        description="List of task entries",
    )

    submissions: SubmissionList = Field(
        description="List of submitted answers",
    )

    interactions: List[InteractionTaskUser] = Field(
        description="List of interaction log entries grouped by user-task pair",
    )

    users: UserList = Field(
        description="List of users and their interaction hierarchies",
    )

class FetchUsersAndTasks(BaseModel):
    tasks: TaskList = Field(
        description="List of task entries",
    )
    users: UserList = Field(
        description="List of users and their interaction hierarchies",
    )
