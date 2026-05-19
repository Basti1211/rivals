from app.dataManager.database.connection import insert as db_insert
from app.types.responses.model_requests import SubmissionList


def insert(submission_list: SubmissionList, from_file: int | None = None) -> int:
    """
    Insert submissions into the Answers table.

    Returns the number of inserted submission rows.
    """

    sql = """
        INSERT INTO Answers (
            task_name,
            user_name,
            time,
            status,
            answer_text,
            answer_video,
            answer_video_start_time,
            answer_video_end_time,
            from_file
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """

    inserted_count = 0

    for submission in submission_list.submissions:
        db_insert(
            sql,
            (
                submission.task_id,
                submission.user,
                submission.timestamp,
                submission.status,
                submission.answer_text,
                submission.answer_video,
                submission.answer_video_start_time,
                submission.answer_video_end_time,
                from_file,
            ),
        )
        inserted_count += 1

    return inserted_count
