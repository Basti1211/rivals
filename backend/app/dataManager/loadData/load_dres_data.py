from typing import Any

from pydantic import ValidationError

from app.dataManager.database.connection import count_database_rows
from app.dataManager.database.handleData.sourceFileManager import fetch_all as fetch_source_files
from app.dataManager.database.handleData.sourceFileManager import insert as insert_source_file
from app.dataManager.database.handleData.submissionManager import insert as insert_submission
from app.dataManager.database.handleData.taskManager import insert as insert_task
from app.types.responses.model_requests import SubmissionList, TaskList
from app.types.responses.model_responses import (
    DresTaskGroupSummary,
    InspectDresLogsResponse,
    LoadDataResponse,
)


def inspect_dres_logs(data: Any) -> InspectDresLogsResponse:
    response = InspectDresLogsResponse()

    try:
        dres = _extract_dres_data(data)
        template_tasks = _get_list(dres, ["template", "tasks"])
        runtime_tasks = _get_list(dres, ["tasks"])

        task_group_summaries: dict[str, DresTaskGroupSummary] = {}
        for template_task in template_tasks:
            task_group = _normalize_task_group(template_task.get("taskGroup"))
            if not task_group:
                continue

            summary = task_group_summaries.setdefault(
                task_group,
                DresTaskGroupSummary(taskGroup=task_group, taskCount=0),
            )
            summary.taskCount += 1

            task_name = template_task.get("name")
            if isinstance(task_name, str) and len(summary.sampleTasks) < 3:
                summary.sampleTasks.append(task_name)

        users: set[str] = set()
        submission_count = 0
        for runtime_task in runtime_tasks:
            for submission in _safe_list(runtime_task.get("submissions")):
                submission_count += 1
                member_name = submission.get("memberName")
                if isinstance(member_name, str):
                    users.add(member_name)

        response.taskGroups = sorted(
            task_group_summaries.values(),
            key=lambda summary: summary.taskGroup,
        )
        response.users = sorted(users)
        response.taskCount = len(runtime_tasks)
        response.submissionCount = submission_count
    except Exception as error:
        response.errorMessage = f"Failed to inspect DRES logs: {error}"

    return response


def load_dres_logs(
    filename: str | None,
    data: Any,
    task_group_datasets: dict[str, str],
    dataset_roots: dict[str, str],
) -> LoadDataResponse:
    response = LoadDataResponse()
    before_counts = _empty_counts()

    try:
        before_counts = count_database_rows()
        dres = _extract_dres_data(data)
        task_rows, submission_rows = _transform_dres_logs(
            dres,
            task_group_datasets,
            dataset_roots,
        )

        task_model = TaskList(tasks=task_rows)
        submission_model = SubmissionList(submissions=submission_rows)
        from_file = insert_source_file(filename) if filename else None

        insert_task(task_model, from_file)
        insert_submission(submission_model, from_file)
    except ValidationError as error:
        response.errorMessage = _format_validation_error(error)
    except Exception as error:
        response.errorMessage = f"Failed to load DRES logs: {error}"
    finally:
        try:
            after_counts = count_database_rows()
            _update_response_counts(response, before_counts, after_counts)
            response.sourceFiles = fetch_source_files()
        except Exception as error:
            response.errorMessage = f"Failed to count database rows: {error}"

    return response


def _transform_dres_logs(
    dres: dict[str, Any],
    task_group_datasets: dict[str, str],
    dataset_roots: dict[str, str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    single_answer_by_task_type = _build_single_answer_map(
        _get_list(dres, ["template", "taskTypes"])
    )

    template_rows = {
        template_task["id"]: _build_task_template_row(
            template_task,
            single_answer_by_task_type,
            task_group_datasets,
            dataset_roots,
        )
        for template_task in _get_list(dres, ["template", "tasks"])
        if isinstance(template_task.get("id"), str)
    }

    task_rows: list[dict[str, Any]] = []
    submission_rows: list[dict[str, Any]] = []

    for runtime_task in _get_list(dres, ["tasks"]):
        template_id = runtime_task.get("templateId")
        if not isinstance(template_id, str) or template_id not in template_rows:
            continue

        task_row = dict(template_rows[template_id])
        task_row["started"] = _to_int(runtime_task.get("started"))
        task_row["ended"] = _to_int(runtime_task.get("ended"))
        task_rows.append(task_row)

        for submission in _safe_list(runtime_task.get("submissions")):
            submission_rows.append(_build_submission_row(template_id, submission))

    return task_rows, submission_rows


def _build_single_answer_map(task_types: list[dict[str, Any]]) -> dict[str, bool]:
    return {
        _normalize_imported_name(task_type.get("name")): (
            "LIMIT_CORRECT_PER_TEAM" in _safe_any_list(task_type.get("submissionOptions"))
        )
        for task_type in task_types
    }


def _build_task_template_row(
    template_task: dict[str, Any],
    single_answer_by_task_type: dict[str, bool],
    task_group_datasets: dict[str, str],
    dataset_roots: dict[str, str],
) -> dict[str, Any]:
    task_group = _normalize_task_group(template_task.get("taskGroup"))
    dataset = task_group_datasets.get(task_group, "").strip()
    if not dataset:
        raise ValueError(f"Missing dataset mapping for task group '{task_group}'")

    dataset_root = dataset_roots.get(dataset, "").strip()
    if not dataset_root:
        raise ValueError(f"Missing video root for dataset '{dataset}'")

    hint_video = None
    hint_video_start_time = None
    hint_video_end_time = None
    hint_text = None
    for hint in _safe_list(template_task.get("hints")):
        if hint.get("type") == "VIDEO":
            hint_video = _get_nested(hint, ["item", "name"])
            hint_video_start_time = _get_range_value(hint, "start")
            hint_video_end_time = _get_range_value(hint, "end")
        elif hint.get("type") == "TEXT":
            hint_text = hint.get("description")

    target_video = None
    target_video_start_time = None
    target_video_end_time = None
    for target in _safe_list(template_task.get("targets")):
        if target.get("type") == "MEDIA_ITEM_TEMPORAL_RANGE":
            target_video = _get_nested(target, ["item", "name"])
            target_video_start_time = _get_range_value(target, "start")
            target_video_end_time = _get_range_value(target, "end")

    task_type = _normalize_imported_name(template_task.get("taskType"))

    return {
        "task_id": template_task.get("id"),
        "name": template_task.get("name"),
        "dataset": dataset,
        "taskGroup": task_group,
        "finished_after_correct_answer": single_answer_by_task_type.get(task_type, False),
        "hint_video": hint_video,
        "hint_video_path": _video_path(dataset_root, hint_video),
        "hint_video_start_time": hint_video_start_time,
        "hint_video_end_time": hint_video_end_time,
        "hint_text": hint_text,
        "target_text": None,
        "target_video": target_video,
        "target_video_path": _video_path(dataset_root, target_video),
        "target_video_start_time": target_video_start_time,
        "target_video_end_time": target_video_end_time,
    }


def _build_submission_row(template_id: str, submission: dict[str, Any]) -> dict[str, Any]:
    answer = _first_dict(submission.get("answers"))
    answer_payload = _first_dict(answer.get("answers"))

    submission_row = {
        "task_id": template_id,
        "user": submission.get("memberName"),
        "timestamp": _to_int(submission.get("timestamp")),
        "status": _status_to_int(answer.get("status")),
        "answer_text": None,
        "answer_video": None,
        "answer_video_start_time": None,
        "answer_video_end_time": None,
    }

    if answer_payload.get("type") == "TEXT":
        submission_row["answer_text"] = answer_payload.get("text")
    else:
        submission_row["answer_video"] = _get_nested(answer_payload, ["item", "name"])
        submission_row["answer_video_start_time"] = _to_optional_int(answer_payload.get("start"))
        submission_row["answer_video_end_time"] = _to_optional_int(answer_payload.get("end"))

    return submission_row


def _extract_dres_data(data: Any) -> dict[str, Any]:
    if (
        isinstance(data, dict)
        and isinstance(data.get("filename"), str)
        and isinstance(data.get("data"), dict)
    ):
        data = data["data"]

    if not isinstance(data, dict):
        raise ValueError("Uploaded DRES JSON must be an object")

    if not isinstance(data.get("template"), dict) or not isinstance(data.get("tasks"), list):
        raise ValueError("Uploaded JSON does not look like a DRES export")

    return data


def _get_list(data: dict[str, Any], path: list[str]) -> list[dict[str, Any]]:
    value: Any = data
    for key in path:
        if not isinstance(value, dict):
            return []
        value = value.get(key)

    return _safe_list(value)


def _safe_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    return [item for item in value if isinstance(item, dict)]


def _safe_any_list(value: Any) -> list[Any]:
    if not isinstance(value, list):
        return []

    return value


def _first_dict(value: Any) -> dict[str, Any]:
    items = _safe_list(value)
    if not items:
        return {}

    return items[0]


def _get_nested(data: dict[str, Any], path: list[str]) -> Any:
    value: Any = data
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)

    return value


def _get_range_value(data: dict[str, Any], key: str) -> int | None:
    value = _get_nested(data, ["range", key, "value"])
    return _to_optional_int(value)


def _to_int(value: Any) -> int:
    if value is None:
        raise ValueError("Expected a timestamp value")

    return int(value)


def _to_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    return int(value)


def _status_to_int(status: Any) -> int:
    if status == "CORRECT":
        return 1

    if status == "WRONG":
        return -1

    return 0


def _normalize_task_group(value: Any) -> str:
    return _normalize_imported_name(value).replace("_GRP", "")


def _normalize_imported_name(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    return value.replace(" (Imported)", "")


def _video_path(dataset_root: str, video: Any) -> str | None:
    if not isinstance(video, str) or not video:
        return None

    return f"{dataset_root.rstrip('/')}/{video}.mp4"


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
