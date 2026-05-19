
from app.generic_helpers import from_json
import json
from app.types.responses.model_requests import InteractionHierarchyNode, InteractionRequest, SubmissionList, TaskList


def _task_from_row(row: dict) -> dict:
    return {
        "task_id": row["task_id"],
        "name": row["task_name"],
        "dataset": row["dataset"],
        "taskGroup": row["task_group"],
        "finished_after_correct_answer": bool(row["finished_after_correct_answer"]),
        "hint_video": row["hint_video"],
        "hint_video_path": row["hint_video_path"],
        "hint_video_start_time": row["hint_video_start_time"],
        "hint_video_end_time": row["hint_video_end_time"],
        "hint_text": row["hint_text"],
        "target_text": row["target_text"],
        "target_video": row["target_video"],
        "target_video_path": row["target_video_path"],
        "target_video_start_time": row["target_video_start_time"],
        "target_video_end_time": row["target_video_end_time"],
        "started": row["task_start_time"],
        "ended": row["task_end_time"],
        "from_file": row["from_file"],
    }


def _user_from_row(row: dict) -> dict:
    return {
        "user": row["user_name"],
        "system": row["system_name"],
        "hierarchy": from_json(row["hierarchy"]) or [],
        "from_file": row["from_file"],
    }


def _submission_from_row(row: dict) -> dict:
    return {
        "task_id": row["task_name"],
        "user": row["user_name"],
        "timestamp": row["time"],
        "status": row["status"],
        "answer_text": row["answer_text"],
        "answer_video": row["answer_video"],
        "answer_video_start_time": row["answer_video_start_time"],
        "answer_video_end_time": row["answer_video_end_time"],
        "from_file": row["from_file"],
    }


def _interaction_from_row(row: dict, task_is_active: bool, abstract_type: str, cancelled: bool) -> dict:
    return {
        "timestamp": row["time"],
        "action": row["type"],
        "abstract_type": abstract_type,
        "frameRank": row["frame_rank"],
        "videoRank": row["video_rank"],
        "metadata": _metadata_from_text(row["metadata"]),
        "task_is_active": task_is_active,
        "cancelled": cancelled,
        "from_file": row["from_file"],
    }

def _hierarchy_to_response(hierarchy: list[InteractionHierarchyNode]) -> list[dict]:
    return [
        node.model_dump(by_alias=True)
        for node in hierarchy
    ]


def _metadata_from_text(value: str | None):
    if value is None:
        return None
    try:
        return from_json(value)
    except json.JSONDecodeError:
        return value
