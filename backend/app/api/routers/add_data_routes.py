from typing import Any

from fastapi import APIRouter, Body

from app.dataManager.loadData.delete_source_file_data import delete_source_file_data
from app.dataManager.loadData.load_demo_data import load_demo_data
from app.dataManager.loadData.load_real_data import (
    load_answers,
    load_interaction_logs,
    load_tasks,
)
from app.types.responses.model_responses import LoadDataResponse

add_data_router = APIRouter(prefix="/data", tags=["data"])


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


@add_data_router.delete(
    "/source-files/{source_file_id}",
    response_model=LoadDataResponse,
    summary="Delete data loaded from one source file",
    description="Deletes all database rows associated with one source file id.",
)
def delete_source_file(source_file_id: int) -> LoadDataResponse:
    return delete_source_file_data(source_file_id)
