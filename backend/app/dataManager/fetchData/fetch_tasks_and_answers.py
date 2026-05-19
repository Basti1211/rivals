from app.dataManager.database.calls import fetch as fetch_table
from app.dataManager.database.constants import SUBMISSION_SELECT, TASK_SELECT
from app.dataManager.database.transformations import _submission_from_row, _task_from_row
from app.types.responses.model_requests import SubmissionList, TaskList
from app.types.responses.model_responses import FetchTasksAndAnswers


def fetch_tasks_and_answers() -> FetchTasksAndAnswers:
    task_rows = fetch_table(
        "Tasks",
        TASK_SELECT,
        [],
        "ORDER BY task_name",
    )

    submission_rows = fetch_table(
        "Answers",
        SUBMISSION_SELECT,
        [],
        "ORDER BY task_name, user_name, time",
    )

    tasks = TaskList(
        tasks=[
            _task_from_row(row)
            for row in task_rows
        ]
    )

    submissions = SubmissionList(
        submissions=[
            _submission_from_row(row)
            for row in submission_rows
        ]
    )

    return FetchTasksAndAnswers(tasks=tasks, submissions=submissions)
