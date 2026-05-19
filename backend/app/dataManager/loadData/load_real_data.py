from dataclasses import dataclass
from typing import Any, Callable, TypeVar

from pydantic import ValidationError

from app.dataManager.database.connection import count_database_rows
from app.dataManager.database.handleData.interactionManager import insert as insert_interaction
from app.dataManager.database.handleData.sourceFileManager import fetch_all as fetch_source_files
from app.dataManager.database.handleData.sourceFileManager import insert as insert_source_file
from app.dataManager.database.handleData.submissionManager import insert as insert_submission
from app.dataManager.database.handleData.taskManager import insert as insert_task
from app.types.responses.model_requests import InteractionLogList, SubmissionList, TaskList
from app.types.responses.model_responses import LoadDataResponse

DataModel = TypeVar("DataModel", TaskList, SubmissionList, InteractionLogList)


@dataclass(frozen=True)
class UploadPayload:
    filename: str | None
    data: Any


def load_tasks(data: Any) -> LoadDataResponse:
    return _load_real_data(
        data=data,
        container_key="tasks",
        build_model=lambda rows: TaskList(tasks=rows),
        insert_model=insert_task,
        error_context="tasks",
    )


def load_answers(data: Any) -> LoadDataResponse:
    return _load_real_data(
        data=data,
        container_key="submissions",
        build_model=lambda rows: SubmissionList(submissions=rows),
        insert_model=insert_submission,
        error_context="answers",
    )


def load_interaction_logs(data: Any) -> LoadDataResponse:
    return _load_real_data(
        data=data,
        container_key="interaction_logs",
        build_model=lambda rows: InteractionLogList(interaction_logs=rows),
        insert_model=insert_interaction,
        error_context="interaction logs",
    )


def _load_real_data(
    data: Any,
    container_key: str,
    build_model: Callable[[list[Any]], DataModel],
    insert_model: Callable[[DataModel, int | None], int],
    error_context: str,
) -> LoadDataResponse:
    response = LoadDataResponse()
    before_counts = _empty_counts()

    try:
        before_counts = count_database_rows()
        for upload in _extract_uploads(data):
            rows = _extract_rows(upload.data, container_key)
            model = build_model(rows)
            from_file = insert_source_file(upload.filename) if upload.filename else None
            insert_model(model, from_file)
    except ValidationError as error:
        response.errorMessage = _format_validation_error(error)
    except Exception as error:
        response.errorMessage = f"Failed to load {error_context}: {error}"
    finally:
        try:
            after_counts = count_database_rows()
            _update_response_counts(response, before_counts, after_counts)
            response.sourceFiles = fetch_source_files()
        except Exception as error:
            response.errorMessage = f"Failed to count database rows: {error}"

    return response


def _extract_uploads(data: Any) -> list[UploadPayload]:
    if _is_upload_payload(data):
        return [UploadPayload(filename=data["filename"], data=data["data"])]

    if isinstance(data, list) and all(_is_upload_payload(item) for item in data):
        return [
            UploadPayload(filename=item["filename"], data=item["data"])
            for item in data
        ]

    return [UploadPayload(filename=None, data=data)]


def _is_upload_payload(data: Any) -> bool:
    return (
        isinstance(data, dict)
        and isinstance(data.get("filename"), str)
        and "data" in data
    )


def _extract_rows(data: Any, container_key: str) -> list[Any]:
    if isinstance(data, dict):
        if container_key in data:
            return _ensure_list(data[container_key])

        return [data]

    if isinstance(data, list):
        rows: list[Any] = []

        for item in data:
            if isinstance(item, dict) and container_key in item:
                rows.extend(_ensure_list(item[container_key]))
            elif isinstance(item, list):
                rows.extend(item)
            else:
                rows.append(item)

        return rows

    raise ValueError("Uploaded JSON must be an object or a list")


def _ensure_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value

    return [value]


def _empty_counts() -> dict[str, int]:
    return {
        "tasks": 0,
        "users": 0,
        "logs": 0,
        "answers": 0,
        "sourceFiles": 0,
    }


def _update_response_counts(
    response: LoadDataResponse,
    before_counts: dict[str, int],
    after_counts: dict[str, int],
) -> None:
    response.loadedTasks = after_counts["tasks"] - before_counts["tasks"]
    response.loadedUsers = after_counts["users"] - before_counts["users"]
    response.loadedLogs = after_counts["logs"] - before_counts["logs"]
    response.loadedAnswers = after_counts["answers"] - before_counts["answers"]

    response.totalTasks = after_counts["tasks"]
    response.totalUsers = after_counts["users"]
    response.totalLogs = after_counts["logs"]
    response.totalAnswers = after_counts["answers"]


def _format_validation_error(error: ValidationError) -> str:
    details = error.errors()[0]
    location = ".".join(str(part) for part in details["loc"])
    return f"Validation error at {location}: {details['msg']}"
