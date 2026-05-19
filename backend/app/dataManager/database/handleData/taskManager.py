from app.dataManager.database.connection import insert as db_insert
from app.types.responses.model_requests import TaskList


def insert(task_list: TaskList, from_file: int | None = None) -> int:
    """
    Insert tasks into the Tasks table.

    Returns the number of inserted or replaced task rows.
    """

    sql = """
        INSERT OR REPLACE INTO Tasks (
            task_name,
            task_id,
            task_group,
            task_start_time,
            task_end_time,
            finished_after_correct_answer,
            dataset,
            hint_text,
            hint_video,
            hint_video_start_time,
            hint_video_end_time,
            target_text,
            target_video,
            target_video_start_time,
            target_video_end_time,
            from_file
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """

    inserted_count = 0

    for task in task_list.tasks:
        db_insert(
            sql,
            (
                task.name,
                task.task_id,
                task.task_group,
                task.started,
                task.ended,
                int(task.finished_after_correct_answer),
                task.dataset,
                task.hint_text,
                task.hint_video,
                task.hint_video_start_time,
                task.hint_video_end_time,
                task.target_text,
                task.target_video,
                task.target_video_start_time,
                task.target_video_end_time,
                from_file,
            ),
        )
        inserted_count += 1

    return inserted_count
