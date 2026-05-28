from typing import Any

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

from app.dataManager.loadData.delete_source_file_data import delete_source_file_data
from app.dataManager.loadData.load_demo_data import load_demo_data
from app.dataManager.loadData.load_dres_data import inspect_dres_logs, load_dres_logs
from app.dataManager.loadData.load_real_data import (
    load_answers,
    load_interaction_logs,
    load_tasks,
)
from app.types.responses.model_responses import InspectDresLogsResponse, LoadDataResponse

add_data_router = APIRouter(prefix="/data", tags=["data"])


class LoadDresLogsRequest(BaseModel):
    filename: str | None = Field(
        default=None,
        description="Uploaded DRES source filename",
    )
    data: Any = Field(
        description="Raw DRES JSON export",
    )
    taskGroupDatasets: dict[str, str] = Field(
        description="Mapping from normalized DRES task group names to dataset names",
    )
    datasetRoots: dict[str, str] = Field(
        description="Mapping from dataset names to video root paths or URLs",
    )


@add_data_router.post(
    "/initialize-demo-data",
    response_model=LoadDataResponse,
    summary="Initialize demo data",
    description="Initializes the application with demo data.",
)
def initialize_demo_data() -> LoadDataResponse:
    return load_demo_data()


@add_data_router.post(
    "/load-tasks",
    response_model=LoadDataResponse,
    summary="Load task data",
    description="Loads task data from a JSON payload.",
)
def load_task_data(data: Any = Body(...)) -> LoadDataResponse:
    return load_tasks(data)


@add_data_router.post(
    "/load-answers",
    response_model=LoadDataResponse,
    summary="Load answer data",
    description="Loads answer/submission data from a JSON payload.",
)
def load_answer_data(data: Any = Body(...)) -> LoadDataResponse:
    return load_answers(data)


@add_data_router.post(
    "/load-interaction-logs",
    response_model=LoadDataResponse,
    summary="Load interaction log data",
    description="Loads interaction log data from a JSON payload.",
)
def load_interaction_log_data(data: Any = Body(...)) -> LoadDataResponse:
    return load_interaction_logs(data)


@add_data_router.post(
    "/inspect-dres-logs",
    response_model=InspectDresLogsResponse,
    summary="Inspect raw DRES logs",
    description="Extracts task groups and import metadata from a raw DRES JSON payload.",
)
def inspect_dres_log_data(data: Any = Body(...)) -> InspectDresLogsResponse:
    return inspect_dres_logs(data)


@add_data_router.post(
    "/load-dres-logs",
    response_model=LoadDataResponse,
    summary="Load raw DRES task and submission data",
    description="Transforms raw DRES logs into task and answer rows and loads them.",
)
def load_dres_log_data(request: LoadDresLogsRequest) -> LoadDataResponse:
    return load_dres_logs(
        filename=request.filename,
        data=request.data,
        task_group_datasets=request.taskGroupDatasets,
        dataset_roots=request.datasetRoots,
    )


@add_data_router.delete(
    "/source-files/{source_file_id}",
    response_model=LoadDataResponse,
    summary="Delete data loaded from one source file",
    description="Deletes all database rows associated with one source file id.",
)
def delete_source_file(source_file_id: int) -> LoadDataResponse:
    return delete_source_file_data(source_file_id)
